"""Real password/session verification against isolated databases; mail transport is captured."""

from datetime import timedelta
import importlib
import pytest
from sqlalchemy import select
from app.core.auth import Actor, get_actor
from app.core.config import settings
from app.main import app
from app.modules.customer_auth.models import (
    AccessGrant,
    EmailChallenge,
    LoginIdentity,
    LoginSession,
    now,
)
from app.modules.customer_auth.security import digest
from app.modules.operations.models import CustomerProfile

AUTH = "/api/v1/auth/"
ORIGIN = {"Origin": "https://trippy-delivery.pages.dev"}
PASSWORD = "Example secure password 284!"


@pytest.fixture
def auth(client, monkeypatch):
    browser, factory = client
    browser.base_url = "https://testserver"
    app.dependency_overrides.pop(get_actor, None)
    monkeypatch.setenv("APP_ENV", "preview")
    settings.cache_clear()
    monkeypatch.setattr(importlib.import_module("app.main"), "config", settings())
    module = importlib.import_module("app.modules.customer_auth.router")
    monkeypatch.setattr(module, "email_ready", lambda: True)
    messages = []
    monkeypatch.setattr(
        module, "send_link", lambda email, token, purpose: messages.append((email, token, purpose))
    )
    yield browser, factory, messages, module
    settings.cache_clear()


def post(browser, action, body):
    return browser.post(AUTH + action, json=body, headers=ORIGIN)


def signup_verified(browser, messages, email="buyer@example.com"):
    assert (
        post(browser, "signup", {"email": email, "password": PASSWORD, "name": "Buyer"}).status_code
        == 202
    )
    assert len(messages) == 1
    result = post(browser, "verify-email", {"token": messages[-1][1]})
    assert result.status_code == 200, result.text
    return result.json()


def test_signup_verification_and_persistent_session(auth):
    browser, factory, messages, _ = auth
    assert (
        post(
            browser, "signup", {"email": "Buyer@example.com", "password": PASSWORD, "name": "Buyer"}
        ).status_code
        == 202
    )
    assert (
        post(browser, "signin", {"email": "buyer@example.com", "password": PASSWORD}).status_code
        == 401
    )
    verified = post(browser, "verify-email", {"token": messages[0][1]})
    assert verified.status_code == 200
    cookie = verified.headers["set-cookie"]
    assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
    token = verified.json()["credential"]
    headers = {"Authorization": "Bearer " + token}
    assert (
        browser.put(
            "/api/v1/account/profile",
            headers=headers,
            json={"name": "Saved Buyer", "phone": "01700000000"},
        ).status_code
        == 200
    )
    restored = post(browser, "session", {}).json()
    assert restored["credential"] != token
    for grant in (token, restored["credential"]):
        response = browser.get(
            "/api/v1/account/profile", headers={"Authorization": "Bearer " + grant}
        )
        assert response.json()["name"] == "Saved Buyer"
    assert post(browser, "verify-email", {"token": messages[0][1]}).status_code == 400
    with factory() as db:
        identity = db.scalar(select(LoginIdentity))
        assert identity.email == "buyer@example.com"
        assert (
            identity.password_hash.startswith("scrypt$") and PASSWORD not in identity.password_hash
        )
        assert db.scalar(select(LoginSession)).digest != browser.cookies.get(
            "__Host-trippy_session"
        )


def test_password_reset_single_use_and_revokes_all_sessions(auth):
    browser, factory, messages, _ = auth
    first = signup_verified(browser, messages)
    assert post(browser, "forgot-password", {"email": "buyer@example.com"}).status_code == 202
    token = messages[-1][1]
    new_password = "Replacement password 943!"
    assert (
        post(browser, "reset-password", {"token": token, "password": new_password}).status_code
        == 200
    )
    assert post(browser, "session", {}).status_code == 401
    assert (
        browser.get(
            "/api/v1/account", headers={"Authorization": "Bearer " + first["credential"]}
        ).status_code
        == 401
    )
    assert (
        post(browser, "reset-password", {"token": token, "password": new_password}).status_code
        == 400
    )
    assert (
        post(browser, "signin", {"email": "buyer@example.com", "password": PASSWORD}).status_code
        == 401
    )
    assert (
        post(
            browser, "signin", {"email": "buyer@example.com", "password": new_password}
        ).status_code
        == 200
    )
    with factory() as db:
        assert db.scalar(select(LoginIdentity)).verified


def test_logout_revokes_grants_and_cookie(auth):
    browser, _, messages, _ = auth
    session = signup_verified(browser, messages)
    assert post(browser, "signout", {}).status_code == 200
    assert post(browser, "session", {}).status_code == 401
    assert (
        browser.get(
            "/api/v1/account", headers={"Authorization": "Bearer " + session["credential"]}
        ).status_code
        == 401
    )


def test_expired_access_and_session(auth):
    browser, factory, messages, _ = auth
    session = signup_verified(browser, messages)
    with factory() as db:
        db.get(AccessGrant, digest(session["credential"])).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert (
        browser.get(
            "/api/v1/account", headers={"Authorization": "Bearer " + session["credential"]}
        ).status_code
        == 401
    )
    assert post(browser, "session", {}).status_code == 200
    with factory() as db:
        db.scalar(select(LoginSession)).expires_at = now() - timedelta(seconds=1)
        db.commit()
    assert post(browser, "session", {}).status_code == 401


def test_origin_validation_password_rules_and_mail_gate(auth, monkeypatch):
    browser, _, _, module = auth
    assert (
        browser.post(
            AUTH + "signin", json={"email": "buyer@example.com", "password": PASSWORD}
        ).status_code
        == 403
    )
    assert (
        browser.post(
            AUTH + "session", json={}, headers={"Origin": "https://evil.example"}
        ).status_code
        == 403
    )
    for body in (
        {"email": "bad", "password": PASSWORD, "name": "Buyer"},
        {"email": "buyer@example.com", "password": "short", "name": "Buyer"},
        {"email": "buyer@example.com", "password": PASSWORD, "name": " "},
    ):
        assert post(browser, "signup", body).status_code == 422
    monkeypatch.setattr(module, "email_ready", lambda: False)
    assert (
        post(
            browser, "signup", {"email": "buyer@example.com", "password": PASSWORD, "name": "Buyer"}
        ).status_code
        == 503
    )


def test_generic_recovery_and_failed_login_throttle(auth):
    browser, _, messages, _ = auth
    expected = post(browser, "forgot-password", {"email": "unknown@example.com"})
    assert expected.status_code == 202 and not messages
    for _ in range(5):
        assert (
            post(
                browser, "signin", {"email": "unknown@example.com", "password": PASSWORD}
            ).status_code
            == 401
        )
    assert (
        post(browser, "signin", {"email": "unknown@example.com", "password": PASSWORD}).status_code
        == 429
    )


def test_google_subject_history_and_owner_authorization_preserved(auth, monkeypatch):
    browser, factory, messages, module = auth
    with factory() as db:
        db.add(
            CustomerProfile(
                subject="google:123",
                email="owner@example.com",
                name="Original",
                phone="01700000000",
                checkout_defaults={"area": "Uttara"},
            )
        )
        db.commit()
    monkeypatch.setenv("GOOGLE_ADMIN_EMAIL", "owner@example.com")
    settings.cache_clear()
    monkeypatch.setattr(
        module,
        "google_actor",
        lambda token, c: Actor(
            "google:123", frozenset({"customer", "admin"}), "owner@example.com", "Owner"
        ),
    )
    session = post(browser, "google", {"credential": "verified-token-value"}).json()
    assert session["profile"]["is_admin"]
    headers = {"Authorization": "Bearer " + session["credential"]}
    profile = browser.get("/api/v1/account/profile", headers=headers).json()
    assert profile["subject"] == "google:123" and profile["phone"] == "01700000000"
    assert browser.get("/api/v1/admin/session", headers=headers).status_code == 200
    assert (
        post(
            browser,
            "signup",
            {"email": "owner@example.com", "password": PASSWORD, "name": "Impersonator"},
        ).status_code
        == 202
    )
    assert not messages
    assert (
        post(browser, "signin", {"email": "owner@example.com", "password": PASSWORD}).status_code
        == 401
    )


def test_email_owner_lookalike_is_never_admin(auth, monkeypatch):
    browser, _, messages, _ = auth
    monkeypatch.setenv("GOOGLE_ADMIN_EMAIL", "buyer@example.com")
    settings.cache_clear()
    session = signup_verified(browser, messages)
    assert not session["profile"]["is_admin"]
    assert (
        browser.get(
            "/api/v1/admin/session", headers={"Authorization": "Bearer " + session["credential"]}
        ).status_code
        == 403
    )


def test_pending_signup_cannot_replace_verified_password(auth):
    browser, _, messages, _ = auth
    signup_verified(browser, messages)
    result = post(
        browser,
        "signup",
        {"email": "buyer@example.com", "password": "An attackers new password", "name": "Other"},
    )
    assert result.status_code == 202 and len(messages) == 1
    assert (
        post(browser, "signin", {"email": "buyer@example.com", "password": PASSWORD}).status_code
        == 200
    )


def test_mail_failure_does_not_create_usable_challenge(auth, monkeypatch):
    browser, factory, _, module = auth

    def fail(*args):
        raise OSError("transport failed")

    monkeypatch.setattr(module, "send_link", fail)
    assert (
        post(
            browser, "signup", {"email": "buyer@example.com", "password": PASSWORD, "name": "Buyer"}
        ).status_code
        == 503
    )
    with factory() as db:
        assert db.scalar(select(EmailChallenge)) is None


def test_unverified_signup_cannot_block_google_email_owner(auth, monkeypatch):
    browser, factory, messages, module = auth
    post(browser, "signup", {"email": "buyer@example.com", "password": PASSWORD, "name": "Pending"})
    monkeypatch.setattr(
        module,
        "google_actor",
        lambda token, c: Actor(
            "google:buyer", frozenset({"customer"}), "buyer@example.com", "Google Buyer"
        ),
    )
    session = post(browser, "google", {"credential": "verified-google-token"})
    assert session.status_code == 200
    assert post(browser, "verify-email", {"token": messages[0][1]}).status_code == 400
    with factory() as db:
        assert db.scalar(select(LoginIdentity)).subject == "google:buyer"
