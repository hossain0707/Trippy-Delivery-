from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.core.config import Settings, settings
from app.core.database import get_db
from sqlalchemy.orm import Session


@dataclass(frozen=True)
class Actor:
    subject: str
    roles: frozenset[str]
    email: str | None = None
    name: str | None = None


@lru_cache(maxsize=4)
def jwks(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=300)


def get_actor(
    authorization: str | None = Header(default=None),
    x_dev_actor: str | None = Header(default=None),
    config: Settings = Depends(settings),
    db: Session = Depends(get_db),
) -> Actor:
    # Isolated local/test convenience only. Not a substitute for real authentication.
    if config.app_env in ("local", "test") and config.allow_dev_auth and x_dev_actor:
        return Actor(x_dev_actor[:100], frozenset({"customer"}))
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    token = authorization[7:].strip()
    if token.startswith("td_access_"):
        from app.modules.customer_auth.security import access_actor
        return access_actor(token, db)
    if config.google_client_id:
        return google_actor(token, config)
    if not all([config.jwt_issuer, config.jwt_audience, config.jwt_jwks_url]):
        raise HTTPException(503, "Authentication provider not configured")
    try:
        key = jwks(config.jwt_jwks_url).get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256", "ES256"],
                            issuer=config.jwt_issuer, audience=config.jwt_audience,
                            options={"require": ["sub", "iat", "exp"]})
        roles = claims.get("roles", ["customer"])
        if not isinstance(roles, list) or not all(isinstance(v, str) for v in roles):
            raise ValueError("Invalid roles")
        return Actor(claims["sub"], frozenset(roles) - {"admin"})
    except (jwt.PyJWTError, ValueError) as error:
        raise HTTPException(401, "Invalid token") from error


def google_actor(token: str, config: Settings) -> Actor:
    try:
        key = jwks("https://www.googleapis.com/oauth2/v3/certs").get_signing_key_from_jwt(token).key
        claims = jwt.decode(
            token, key, algorithms=["RS256"], audience=config.google_client_id,
            issuer=["https://accounts.google.com", "accounts.google.com"],
            options={"require": ["sub", "iat", "exp", "email", "email_verified"]},
        )
        email = claims["email"]
        subject = claims["sub"]
        if claims["email_verified"] is not True or not isinstance(email, str) or not email:
            raise ValueError("Unverified Google email")
        if not isinstance(subject, str) or not subject or len(subject) > 100:
            raise ValueError("Invalid Google subject")
        roles = {"customer"}
        if config.google_admin_email and (not config.google_admin_subject or subject == config.google_admin_subject) and email.lower() == config.google_admin_email.strip().lower():
            roles.add("admin")
        name = claims.get("name")
        return Actor(f"google:{subject}", frozenset(roles), email, name if isinstance(name, str) else None)
    except (jwt.PyJWTError, ValueError) as error:
        raise HTTPException(401, "Invalid Google credential") from error


def require_admin(actor: Actor = Depends(get_actor)) -> Actor:
    if "admin" not in actor.roles:
        raise HTTPException(403, "Administrator access required")
    return actor
