import hashlib
import hmac
import secrets
from datetime import UTC, datetime
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.core.auth import Actor
from app.core.config import settings
from .models import AccessGrant, LoginIdentity, LoginSession


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    key = hashlib.scrypt(
        password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024
    ).hex()
    return f"scrypt${salt}${key}"


def verify_password(password: str, encoded: str | None) -> bool:
    if not encoded:
        return False
    try:
        algorithm, salt, expected = encoded.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(
            password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024
        ).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


def future(value):
    return value.replace(tzinfo=UTC) > datetime.now(UTC)


def identity_actor(identity: LoginIdentity) -> Actor:
    roles = {"customer"}
    c = settings()
    if (
        identity.provider == "google"
        and c.google_admin_email
        and identity.email == c.google_admin_email.strip().lower()
        and (not c.google_admin_subject or identity.subject == "google:" + c.google_admin_subject)
    ):
        roles.add("admin")
    return Actor(identity.subject, frozenset(roles), identity.email, identity.name)


def access_actor(token: str, db: Session) -> Actor:
    grant = db.get(AccessGrant, digest(token))
    session = (
        db.get(LoginSession, grant.session_digest) if grant and future(grant.expires_at) else None
    )
    identity = (
        db.get(LoginIdentity, session.subject) if session and future(session.expires_at) else None
    )
    if not identity or not identity.verified:
        raise HTTPException(401, "Session expired. Please sign in again.")
    return identity_actor(identity)
