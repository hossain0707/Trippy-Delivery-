"""Optional isolated-schema PostgreSQL tests using an existing database, never live tables."""

import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from test_order_integration import request_body

from app.core.auth import Actor, get_actor
from app.core.database import Base, get_db
from app.main import app
from app.modules.groceries.models import Product


@pytest.fixture
def pg_client():
    url = os.environ.get("TRIPPY_TEST_DATABASE_URL")
    if not url:
        pytest.skip("No isolated PostgreSQL test connection supplied")
    root = create_engine(url, pool_pre_ping=True)
    schema = "trippy_qa_" + uuid4().hex
    with root.begin() as conn:
        conn.execute(text('CREATE SCHEMA "' + schema + '"'))
    engine = root.execution_options(schema_translate_map={None: schema})
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        db.add(
            Product(
                sku="ROHU",
                name_en="Controlled test fish",
                name_bn="পরীক্ষার মাছ",
                category="fresh",
                unit="kg",
                price_bdt=Decimal(300),
                processing_fee_bdt=Decimal(30),
                stock_qty=Decimal(2),
                active=True,
                price_approved=True,
            )
        )
        db.commit()

    def override():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = override
    app.dependency_overrides[get_actor] = lambda: Actor("qa-customer", frozenset({"customer"}))
    try:
        with TestClient(app) as client:
            yield client, factory
    finally:
        app.dependency_overrides.clear()
        with root.begin() as conn:
            conn.execute(text('DROP SCHEMA "' + schema + '" CASCADE'))
        root.dispose()


def test_postgres_concurrent_orders_do_not_oversell(pg_client):
    client, factory = pg_client

    def place(i):
        return client.post(
            "/api/v1/groceries/orders",
            json=request_body(),
            headers={"Idempotency-Key": f"postgres-concurrent-{i}"},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(place, [1, 2]))
    assert sorted(r.status_code for r in responses) == [201, 409], [r.text for r in responses]
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 0


def test_postgres_concurrent_idempotency_returns_one_order(pg_client):
    client, factory = pg_client

    def place(_):
        return client.post(
            "/api/v1/groceries/orders",
            json=request_body(),
            headers={"Idempotency-Key": "postgres-same-request"},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(place, [1, 2]))
    assert [r.status_code for r in responses] == [201, 201], [r.text for r in responses]
    assert responses[0].json()["id"] == responses[1].json()["id"]
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 0


def test_postgres_profile_defaults_survive_a_new_session(pg_client):
    client, factory = pg_client
    payload = {
        "name": "Saved customer",
        "phone": "01712345678",
        "checkout_defaults": {
            "area": "Uttara",
            "instructions": "Call first",
            "payment_method": "bkash",
        },
    }
    assert client.put("/api/v1/account/profile", json=payload).status_code == 200
    from app.modules.operations.models import CustomerProfile

    with factory() as db:
        saved = db.get(CustomerProfile, "qa-customer")
        assert saved.checkout_defaults["instructions"] == "Call first"
    assert (
        client.get("/api/v1/account/profile").json()["checkout_defaults"]["payment_method"]
        == "bkash"
    )


def test_postgres_cod_confirmation_cannot_oversell(pg_client):
    client, factory = pg_client
    from app.modules.commerce.models import ServiceSetting

    with factory() as db:
        db.get(Product, "ROHU").details = {"department": "fish"}
        db.add(ServiceSetting(key="payments", value={"cod_enabled": True}))
        db.add(
            ServiceSetting(
                key="pilot", value={"dhaka_delivery_fee_bdt": "30", "preparation_cut_fee_bdt": "20"}
            )
        )
        db.commit()
    body = request_body()
    body["expected_total_bdt"] = "670"
    orders = [
        client.post(
            "/api/v1/commerce/cod-orders",
            json=body,
            headers={"Idempotency-Key": f"cod-pg-order-{i}"},
        )
        for i in range(2)
    ]
    assert all(r.status_code == 201 for r in orders), [r.text for r in orders]
    app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin"}))

    def confirm(response):
        return client.post(
            "/api/v1/admin/commerce/orders/" + response.json()["id"] + "/transition",
            json={"status": "confirmed"},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(confirm, orders))
    assert sorted(r.status_code for r in results) == [200, 409], [r.text for r in results]
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 0


def test_postgres_duplicate_purchase_receipt_adds_stock_only_once(pg_client):
    client, factory = pg_client
    from app.modules.commerce.models import ServiceSetting, CommerceEvent

    with factory() as db:
        db.get(Product, "ROHU").details = {"department": "fish"}
        db.add(ServiceSetting(key="payments", value={"cod_enabled": True}))
        db.add(
            ServiceSetting(
                key="pilot", value={"dhaka_delivery_fee_bdt": "30", "preparation_cut_fee_bdt": "20"}
            )
        )
        db.commit()
    body = request_body()
    body["expected_total_bdt"] = "670"
    order = client.post(
        "/api/v1/commerce/cod-orders",
        json=body,
        headers={"Idempotency-Key": "concurrent-purchase-01"},
    )
    assert order.status_code == 201, order.text
    ident = order.json()["id"]
    app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin"}))
    assert (
        client.post(
            f"/api/v1/admin/commerce/orders/{ident}/transition",
            json={"status": "awaiting_purchase"},
        ).status_code
        == 200
    )
    payload = {
        "items": [{"sku": "ROHU", "quantity": "1"}],
        "verified": True,
        "note": "Verified supplier receipt",
    }

    def receive(_):
        return client.post(f"/api/v1/admin/commerce/cod-orders/{ident}/purchase", json=payload)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(receive, [1, 2]))
    assert [r.status_code for r in results] == [200, 200], [r.text for r in results]
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 1
        assert db.query(CommerceEvent).filter_by(entity_id=ident, event="purchased").count() == 1


def test_postgres_competing_reset_links_are_single_use_without_deadlock(pg_client):
    from datetime import timedelta
    from app.modules.customer_auth.models import LoginIdentity, EmailChallenge, now
    from app.modules.customer_auth.security import digest, hash_password

    client, factory = pg_client
    tokens = [
        "first-reset-token-with-enough-entropy-123",
        "second-reset-token-with-enough-entropy-456",
    ]
    with factory() as db:
        db.add(
            LoginIdentity(
                subject="email:reset-test",
                email="reset@example.com",
                name="Reset customer",
                provider="email",
                verified=True,
                password_hash=hash_password("Original test password"),
            )
        )
        db.flush()
        for token in tokens:
            db.add(
                EmailChallenge(
                    digest=digest(token),
                    subject="email:reset-test",
                    purpose="reset",
                    expires_at=now() + timedelta(minutes=30),
                )
            )
        db.commit()

    def reset(token):
        return client.post(
            "/api/v1/auth/reset-password",
            json={"token": token, "password": "Replacement test password"},
            headers={"Origin": "https://trippy-delivery.pages.dev"},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        responses = list(pool.map(reset, tokens))
    assert sorted(r.status_code for r in responses) == [200, 400], [r.text for r in responses]
