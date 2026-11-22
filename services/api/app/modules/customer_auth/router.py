import re
import secrets
import uuid
from datetime import timedelta
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.core.auth import google_actor
from app.core.config import settings
from app.core.database import get_db
from app.modules.operations.models import CustomerProfile
from .mail import email_ready, send_link
from .models import AccessGrant, EmailChallenge, LoginAttempt, LoginIdentity, LoginSession, now
from .security import digest, future, hash_password, identity_actor, verify_password

router = APIRouter(prefix="/auth", tags=["Customer authentication"])
DB = Annotated[Session, Depends(get_db)]
COOKIE = "__Host-trippy_session"
GENERIC = "If this address is eligible, an email with the next steps has been sent."


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Email(Input):
    email: str = Field(min_length=3, max_length=254)

    @field_validator("email")
    @classmethod
    def valid_email(cls, value):
        value = value.strip().lower()
        if not re.fullmatch(
            r"[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}", value
        ):
            raise ValueError("Enter a valid email address")
        return value


class Password(Input):
    password: str = Field(min_length=12, max_length=128)


class Signup(Email, Password):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def valid_name(cls, value):
        if not value.strip():
            raise ValueError("Enter your name")
        return value.strip()


class Signin(Email):
    password: str = Field(min_length=1, max_length=128)
    remember: bool = False


class Token(Input):
    token: str = Field(min_length=32, max_length=200)


class Reset(Token, Password):
    pass


class Google(Input):
    credential: str = Field(min_length=10, max_length=10000)


def trusted_origin(request: Request):
    c = settings()
    allowed = {v.strip().rstrip("/") for v in c.cors_origins.split(",")}
    allowed.add(c.customer_app_origin.rstrip("/"))
    if request.headers.get("origin", "").rstrip("/") not in allowed:
        raise HTTPException(403, "Untrusted request origin")


# Every credential-changing request requires a trusted browser origin.
router.dependencies.append(Depends(trusted_origin))


def throttle(db, email, purpose):
    key = digest(purpose + ":" + email)
    cutoff = now() - timedelta(minutes=15)
    db.execute(delete(LoginAttempt).where(LoginAttempt.created_at < cutoff))
    count = db.scalar(
        select(func.count())
        .select_from(LoginAttempt)
        .where(LoginAttempt.key == key, LoginAttempt.created_at >= cutoff)
    )
    if count >= 5:
        raise HTTPException(429, "Too many attempts. Please try again in 15 minutes.")
    db.add(LoginAttempt(id=str(uuid.uuid4()), key=key))
    db.commit()


def view(identity):
    actor = identity_actor(identity)
    return {"name": actor.name, "email": actor.email, "is_admin": "admin" in actor.roles}


def grant(db, session):
    raw = "td_access_" + secrets.token_urlsafe(32)
    db.add(
        AccessGrant(
            digest=digest(raw),
            session_digest=session.digest,
            expires_at=min(
                session.expires_at.replace(tzinfo=now().tzinfo), now() + timedelta(minutes=15)
            ),
        )
    )
    db.execute(
        delete(AccessGrant).where(
            AccessGrant.session_digest == session.digest, AccessGrant.expires_at < now()
        )
    )
    db.commit()
    return {
        "credential": raw,
        "profile": view(db.get(LoginIdentity, session.subject)),
        "expires_in": 900,
    }


def issue_session(db, identity, response, remember=True):
    raw = secrets.token_urlsafe(48)
    age = (
        8 * 3600
        if "admin" in identity_actor(identity).roles
        else (30 * 86400 if remember else 86400)
    )
    session = LoginSession(
        digest=digest(raw), subject=identity.subject, expires_at=now() + timedelta(seconds=age)
    )
    db.add(session)
    db.flush()
    response.set_cookie(
        COOKIE,
        raw,
        max_age=age if remember else None,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )
    response.headers["Cache-Control"] = "no-store"
    return grant(db, session)


def challenge(db, identity, purpose, password_hash=None, name=None):
    raw = secrets.token_urlsafe(48)
    # Keep pending sign-up credentials on the single-use challenge, not on an unverified account.
    row = EmailChallenge(
        digest=digest(raw),
        subject=identity.subject,
        purpose=purpose,
        password_hash=password_hash,
        name=name,
        expires_at=now() + timedelta(minutes=30),
    )
    db.add(row)
    db.flush()
    try:
        send_link(identity.email, raw, purpose)
    except Exception:
        db.rollback()
        raise HTTPException(
            503, "Email delivery is temporarily unavailable. Please try again later."
        ) from None
    db.commit()


@router.get("/configuration")
def configuration():
    return {"email_enabled": email_ready(), "google_enabled": bool(settings().google_client_id)}


@router.post("/google")
def google(payload: Google, db: DB, response: Response):
    actor = google_actor(payload.credential, settings())
    identity = db.get(LoginIdentity, actor.subject)
    email = actor.email.strip().lower()
    if identity is None:
        # Never silently merge two authenticated identities by matching email alone.
        other = db.scalar(select(LoginIdentity).where(LoginIdentity.email == email))
        if other and other.verified:
            raise HTTPException(
                409, "This email already uses email sign-in. Please use that method."
            )
        if other:
            # An unverified registration must never block the verified Google owner of an email.
            db.execute(delete(EmailChallenge).where(EmailChallenge.subject == other.subject))
            db.delete(other)
            db.flush()
        identity = LoginIdentity(
            subject=actor.subject,
            email=email,
            name=(actor.name or "")[:120],
            verified=True,
            provider="google",
        )
        db.add(identity)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            raise HTTPException(409, "Sign-in changed in another tab. Please try again.") from None
    elif identity.email != email:
        raise HTTPException(409, "Your Google email has changed. Please contact support.")
    return issue_session(db, identity, response)


@router.post("/signup", status_code=202)
def signup(payload: Signup, db: DB):
    if not email_ready():
        raise HTTPException(503, "Email sign-up is not available yet. Please continue with Google.")
    throttle(db, payload.email, "mail")
    identity = db.scalar(select(LoginIdentity).where(LoginIdentity.email == payload.email))
    # Existing Google profiles must keep their subject and order history.
    existing_profile = db.scalar(
        select(CustomerProfile).where(func.lower(CustomerProfile.email) == payload.email)
    )
    if existing_profile or (identity and identity.verified):
        return {"message": GENERIC}
    if identity is None:
        identity = LoginIdentity(
            subject="email:" + str(uuid.uuid4()),
            email=payload.email,
            name=payload.name,
            provider="email",
            verified=False,
        )
        db.add(identity)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            return {"message": GENERIC}
    challenge(db, identity, "verify", hash_password(payload.password), payload.name)
    return {"message": GENERIC}


def locked_challenge(db, raw, purpose):
    key = digest(raw)
    initial = db.get(EmailChallenge, key)
    if not initial:
        raise HTTPException(400, "This link is invalid or expired. Please request a new one.")
    # Lock the identity before its challenges to avoid deadlocks between separate reset links.
    identity = db.scalar(
        select(LoginIdentity).where(LoginIdentity.subject == initial.subject).with_for_update()
    )
    row = db.scalar(
        select(EmailChallenge)
        .where(EmailChallenge.digest == key)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if not row or row.purpose != purpose or row.used or not future(row.expires_at):
        raise HTTPException(400, "This link is invalid or expired. Please request a new one.")
    return identity, row


@router.post("/verify-email")
def verify_email(payload: Token, db: DB, response: Response):
    identity, row = locked_challenge(db, payload.token, "verify")
    if identity.verified:
        raise HTTPException(400, "This email is already verified. Please sign in.")
    identity.verified, identity.password_hash, identity.name = True, row.password_hash, row.name
    db.execute(delete(EmailChallenge).where(EmailChallenge.subject == identity.subject))
    return issue_session(db, identity, response)


@router.post("/signin")
def signin(payload: Signin, db: DB, response: Response):
    throttle(db, payload.email, "login")
    identity = db.scalar(
        select(LoginIdentity).where(LoginIdentity.email == payload.email).with_for_update()
    )
    encoded = identity.password_hash if identity and identity.password_hash else DUMMY_HASH
    valid = verify_password(payload.password, encoded)
    if not identity or not identity.verified or identity.provider != "email" or not valid:
        raise HTTPException(
            401, "Email or password is incorrect, or email verification is incomplete."
        )
    db.execute(delete(LoginAttempt).where(LoginAttempt.key == digest("login:" + payload.email)))
    return issue_session(db, identity, response, payload.remember)


@router.post("/forgot-password", status_code=202)
def forgot_password(payload: Email, db: DB):
    if not email_ready():
        raise HTTPException(
            503,
            "Password-reset emails are not available yet. Google users can sign in with Google.",
        )
    throttle(db, payload.email, "mail")
    identity = db.scalar(select(LoginIdentity).where(LoginIdentity.email == payload.email))
    if identity and identity.verified and identity.provider == "email":
        challenge(db, identity, "reset")
    return {"message": GENERIC}


@router.post("/reset-password")
def reset_password(payload: Reset, db: DB):
    identity, row = locked_challenge(db, payload.token, "reset")
    identity.password_hash = hash_password(payload.password)
    sessions = select(LoginSession.digest).where(LoginSession.subject == identity.subject)
    db.execute(delete(AccessGrant).where(AccessGrant.session_digest.in_(sessions)))
    db.execute(delete(LoginSession).where(LoginSession.subject == identity.subject))
    db.execute(delete(EmailChallenge).where(EmailChallenge.subject == identity.subject))
    db.commit()
    return {"message": "Password updated. Please sign in with your new password."}


@router.post("/session")
def session(request: Request, db: DB):
    raw = request.cookies.get(COOKIE, "")
    initial = db.get(LoginSession, digest(raw)) if raw else None
    if initial:
        db.scalar(
            select(LoginIdentity).where(LoginIdentity.subject == initial.subject).with_for_update()
        )
    session = (
        db.scalar(
            select(LoginSession)
            .where(LoginSession.digest == digest(raw))
            .with_for_update()
            .execution_options(populate_existing=True)
        )
        if initial
        else None
    )
    if not session or not future(session.expires_at):
        raise HTTPException(401, "Please sign in.")
    return grant(db, session)


@router.post("/signout")
def signout(request: Request, db: DB, response: Response):
    raw = request.cookies.get(COOKIE, "")
    if raw:
        key = digest(raw)
        initial = db.get(LoginSession, key)
        if initial:
            db.scalar(
                select(LoginIdentity)
                .where(LoginIdentity.subject == initial.subject)
                .with_for_update()
            )
            db.scalar(select(LoginSession).where(LoginSession.digest == key).with_for_update())
        db.execute(delete(AccessGrant).where(AccessGrant.session_digest == key))
        db.execute(delete(LoginSession).where(LoginSession.digest == key))
        db.commit()
    response.delete_cookie(COOKIE, path="/", secure=True, httponly=True, samesite="lax")
    return {"message": "Signed out"}


# Equal-cost password work for unknown emails; this is a public dummy hash, not a credential.
DUMMY_HASH = "scrypt$" + "00" * 16 + "$" + "00" * 64
