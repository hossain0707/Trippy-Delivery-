"""API regression cases using an isolated in-memory SQLite database.

Run with: pip install -e '.[dev]' && pytest -q
These do not replace PostgreSQL concurrency and container integration tests.
"""
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.auth import Actor, get_actor
from app.core.database import Base, get_db
from app.main import app
from app.modules.audit import models as audit_models
from app.modules.couriers import models as courier_models
from app.modules.groceries.models import Product
from app.modules.parcels import models as parcel_models


@pytest.fixture
def client():
    engine = create_engine("sqlite+pysqlite://", connect_args={"check_same_thread": False},
                           poolclass=StaticPool)
    Base.metadata.create_all(engine)
    factory = sessionmaker(engine, expire_on_commit=False)
    with factory() as db:
        db.add(Product(sku="ROHU", name_en="Rohu Fish", name_bn="রুই মাছ",
                       category="fresh", unit="kg", price_bdt=Decimal("300"),
                       processing_fee_bdt=Decimal("30"), stock_qty=Decimal("5"), active=True))
        db.add(Product(sku="RICE", name_en="Rice", name_bn="চাল",
                       category="dry", unit="kg", price_bdt=Decimal("70"),
                       processing_fee_bdt=Decimal("0"), stock_qty=Decimal("10"), active=True))
        db.commit()

    def db_override():
        with factory() as db:
            yield db

    app.dependency_overrides[get_db] = db_override
    app.dependency_overrides[get_actor] = lambda: Actor("regression-customer", frozenset({"customer"}))
    try:
        with TestClient(app) as test:
            yield test, factory
    finally:
        app.dependency_overrides.clear()
        engine.dispose()


def request_body(preparation="cut"):
    return {
        "destination": {
            "name": "Test Recipient", "phone": "01700000000",
            "address_line": "Example Dhanmondi Street", "city": "Dhaka"
        },
        "items": [{"sku": "ROHU", "quantity": "2.000", "preparation": preparation}]
    }


def test_grocery_checkout_idempotency_and_cancellation(client):
    browser, factory = client
    headers = {"Idempotency-Key": "checkout-regression-01"}
    first = browser.post("/api/v1/groceries/orders", json=request_body(), headers=headers)
    assert first.status_code == 201, first.text
    assert first.json()["amount_bdt"] == "660.00"
    repeated = browser.post("/api/v1/groceries/orders", json=request_body(), headers=headers)
    assert repeated.status_code == 201
    assert repeated.json()["id"] == first.json()["id"]
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == Decimal("3")
    cancel = browser.post("/api/v1/groceries/orders/" + first.json()["id"] + "/cancel")
    assert cancel.status_code == 200
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == Decimal("5")


def test_dry_goods_reject_processing(client):
    browser, _ = client
    payload = request_body()
    payload["items"] = [{"sku": "RICE", "quantity": "1", "preparation": "cleaned"}]
    response = browser.post("/api/v1/groceries/orders", json=payload,
                            headers={"Idempotency-Key": "checkout-regression-02"})
    assert response.status_code == 422


def test_owner_cannot_see_unknown_tracking(client):
    browser, _ = client
    response = browser.get("/api/v1/parcels/TRPUNKNOWN")
    assert response.status_code == 404


def test_idempotency_payload_mismatch(client):
    browser, _ = client
    headers = {"Idempotency-Key": "checkout-regression-03"}
    first = browser.post("/api/v1/groceries/orders", json=request_body(), headers=headers)
    assert first.status_code == 201
    second = browser.post("/api/v1/groceries/orders", json=request_body("whole"), headers=headers)
    assert second.status_code == 409
