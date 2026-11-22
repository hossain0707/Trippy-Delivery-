"""The owner workspace shows scoped, paginated, real operational records."""

from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.core.auth import Actor, get_actor
from app.main import app
from app.modules.commerce.models import CommerceEvent
from app.modules.groceries.models import GroceryOrder
from app.modules.operations.models import CustomerProfile


def owner():
    app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin"}))


@pytest.mark.parametrize(
    "path",
    [
        "overview",
        "couriers",
        "records/orders",
        "records/products",
        "records/customers",
        "records/parcels",
        "records/activity",
        "customer?subject=private",
        "parcel/private",
    ],
)
def test_workspace_requires_owner(client, path):
    browser, _ = client
    assert browser.get("/api/v1/admin/workspace/" + path).status_code == 403


def seed(factory):
    with factory() as db:
        db.add(
            CustomerProfile(
                subject="customer-private",
                email="customer@example.com",
                name="Saved customer",
                phone="01712345678",
                checkout_defaults={"area": "Uttara", "instructions": "Call first"},
            )
        )
        for n in range(25):
            db.add(
                GroceryOrder(
                    id=f"order-{n:02}",
                    customer_id="customer-private",
                    order_number=f"TRC-{n:02}",
                    idempotency_key=f"key-{n}",
                    request_hash="private-hash",
                    destination={"name": "Recipient", "city": "Dhaka", "area": "Uttara"},
                    status="preview" if n == 0 else "placed",
                    payment_method="cod",
                    payment_status="unpaid",
                    amount_bdt=Decimal(100),
                    delivery_fee_bdt=Decimal(30),
                    delivery_deadline=datetime.now(UTC),
                    checkout_data={"mode": "cod_order", "quote_pending": n == 1},
                )
            )
        db.add(
            CommerceEvent(
                entity_type="grocery_order",
                entity_id="order-01",
                actor_id="private-owner",
                event="cod_order_placed",
                details={"secret": "not rendered"},
            )
        )
        db.commit()


def test_workspace_pagination_filters_and_private_fields(client):
    browser, factory = client
    seed(factory)
    owner()
    base = "/api/v1/admin/workspace/records/orders"
    result = browser.get(base).json()
    assert result["total"] == 24 and len(result["items"]) == 20
    page2 = browser.get(base + "?page=2").json()
    assert len(page2["items"]) == 4
    assert not {o["id"] for o in result["items"]} & {o["id"] for o in page2["items"]}
    assert browser.get(base + "?archived=true").json()["total"] == 25
    assert browser.get(base + "?q=TRC-24").json()["total"] == 1
    assert browser.get(base + "?status=delivered").json()["total"] == 0
    for item in result["items"]:
        assert not {"customer_id", "request_hash", "idempotency_key", "checkout_data"} & item.keys()
    assert browser.get(base + "?page=0").status_code == 422


def test_overview_excludes_previews_and_unknown_final_prices(client):
    browser, factory = client
    seed(factory)
    owner()
    result = browser.get("/api/v1/admin/workspace/overview").json()
    assert result["new_orders"] == 24
    assert result["awaiting_final_price"] == 1
    assert Decimal(result["cod_to_collect_bdt"]) == 2300
    assert sum(d["orders"] for d in result["daily"]) == 24
    assert len(result["recent_orders"]) == 6


def test_customer_and_activity_are_readable_and_owner_only(client):
    browser, factory = client
    seed(factory)
    owner()
    rows = browser.get("/api/v1/admin/workspace/records/customers?q=Saved").json()["items"]
    assert rows[0]["order_count"] == 24
    assert rows[0]["email"] != "customer@example.com" and rows[0]["phone"] != "01712345678"
    p = browser.get("/api/v1/admin/workspace/customer?subject=customer-private").json()
    assert p["checkout_defaults"]["instructions"] == "Call first"
    activity = browser.get("/api/v1/admin/workspace/records/activity").json()["items"][0]
    assert activity["event"] == "cod_order_placed"
    assert not {"details", "actor_id", "entity_id"} & activity.keys()
    assert browser.get("/api/v1/admin/workspace/customer?subject=missing").status_code == 404


def test_empty_dashboard_has_no_synthetic_orders(client):
    browser, _ = client
    owner()
    overview = browser.get("/api/v1/admin/workspace/overview").json()
    assert overview["new_orders"] == 0 and overview["recent_orders"] == []
    assert all(d["orders"] == 0 for d in overview["daily"])
    assert browser.get("/api/v1/admin/workspace/records/products?q=রুই").json()["total"] == 1
