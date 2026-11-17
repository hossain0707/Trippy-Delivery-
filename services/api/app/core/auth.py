from dataclasses import dataclass
from functools import lru_cache

import jwt
from fastapi import Depends, Header, HTTPException
from jwt import PyJWKClient

from app.core.config import Settings, settings


@dataclass(frozen=True)
class Actor:
    subject: str
    roles: frozenset[str]


@lru_cache(maxsize=4)
def jwks(url: str) -> PyJWKClient:
    return PyJWKClient(url, cache_keys=True, lifespan=300)


def get_actor(
    authorization: str | None = Header(default=None),
    x_dev_actor: str | None = Header(default=None),
    config: Settings = Depends(settings),
) -> Actor:
    # Isolated local/test convenience only. Not a substitute for real authentication.
    if config.app_env in ("local", "test") and config.allow_dev_auth and x_dev_actor:
        return Actor(x_dev_actor[:100], frozenset({"customer"}))
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    if not all([config.jwt_issuer, config.jwt_audience, config.jwt_jwks_url]):
        raise HTTPException(503, "Authentication provider not configured")
    try:
        token = authorization[7:].strip()
        key = jwks(config.jwt_jwks_url).get_signing_key_from_jwt(token).key
        claims = jwt.decode(token, key, algorithms=["RS256", "ES256"],
                            issuer=config.jwt_issuer, audience=config.jwt_audience,
                            options={"require": ["sub", "iat", "exp"]})
        roles = claims.get("roles", ["customer"])
        if not isinstance(roles, list) or not all(isinstance(v, str) for v in roles):
            raise ValueError("Invalid roles")
        return Actor(claims["sub"], frozenset(roles))
    except (jwt.PyJWTError, ValueError) as error:
        raise HTTPException(401, "Invalid token") from error
