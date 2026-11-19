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
