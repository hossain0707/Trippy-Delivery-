from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import HTTPException

from app.core.auth import google_actor
from app.core.config import Settings


@pytest.fixture
def google(monkeypatch):
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    monkeypatch.setattr(
        "app.core.auth.jwks",
        lambda url: SimpleNamespace(
            get_signing_key_from_jwt=lambda token: SimpleNamespace(key=key.public_key())
        ),
    )
    config = Settings(
        app_env="test",
        google_client_id="test-client",
        google_admin_email="owner@example.com",
        google_admin_subject="owner-id",
    )
    now = datetime.now(UTC)
    claims = {
        "sub": "owner-id",
        "email": "owner@example.com",
        "email_verified": True,
        "iss": "https://accounts.google.com",
        "aud": "test-client",
        "iat": now,
        "exp": now + timedelta(minutes=5),
    }
    return key, config, claims


@pytest.mark.parametrize(
    "changes",
    [
        {"aud": "wrong"},
        {"iss": "https://evil.example"},
        {"email_verified": False},
        {"exp": 0},
        {"sub": ""},
        {"sub": 123},
        {"email": ""},
    ],
)
def test_google_rejects_invalid_claims(google, changes):
    key, config, claims = google
    with pytest.raises(HTTPException) as error:
        google_actor(jwt.encode({**claims, **changes}, key, algorithm="RS256"), config)
    assert error.value.status_code == 401


def test_verified_owner(google):
    key, config, claims = google
    actor = google_actor(jwt.encode(claims, key, algorithm="RS256"), config)
    assert actor.subject == "google:owner-id"
    assert "admin" in actor.roles


@pytest.mark.parametrize("changes", [{"sub": "customer-id"}, {"email": "customer@example.com"}])
def test_verified_nonowner_cannot_be_admin(google, changes):
    key, config, claims = google
    actor = google_actor(
        jwt.encode({**claims, **changes, "roles": ["admin"]}, key, algorithm="RS256"), config
    )
    assert "admin" not in actor.roles


def test_invalid_signature(google):
    _, config, claims = google
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    with pytest.raises(HTTPException):
        google_actor(jwt.encode(claims, other, algorithm="RS256"), config)
