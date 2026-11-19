import pytest
from test_order_integration import request_body

from app.core.auth import Actor, get_actor
from app.main import app

PRODUCT = {
    "name_en": "Rice",
    "name_bn": "চাল",
    "category": "dry",
    "unit": "kg",
    "price_bdt": "80.00",
    "processing_fee_bdt": "0",
    "stock_qty": "12",
    "active": True,
}


def owner():
    app.dependency_overrides[get_actor] = lambda: Actor(
        "google:owner", frozenset({"customer", "admin"}), "owner@example.com"
    )


@pytest.mark.parametrize(
    "path", ["dashboard", "products", "orders", "parcels", "couriers", "activity", "orders/missing"]
)
def test_customer_denied_admin(client, path):
    browser, _ = client
    assert browser.get("/api/v1/admin/" + path).status_code == 403


def test_customer_denied_admin_write(client):
    browser, _ = client
    assert browser.put("/api/v1/admin/products/RICE", json=PRODUCT).status_code == 403


def test_profile_persists_and_is_isolated(client):
    browser, _ = client
    assert (
        browser.put(
            "/api/v1/account/profile",
            json={"name": "নাজমুল", "phone": "01712345678", "language": "bn"},
        ).status_code
        == 200
    )
    assert browser.get("/api/v1/account/profile").json()["language"] == "bn"
    owner()
    assert browser.get("/api/v1/account/profile").json()["name"] != "নাজমুল"


def test_profile_cannot_set_identity_or_role(client):
    browser, _ = client
    assert (
        browser.put(
            "/api/v1/account/profile", json={"name": "Test", "subject": "owner", "roles": ["admin"]}
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "changes",
    [
        {"stock_qty": "-1"},
        {"price_bdt": "NaN"},
        {"price_bdt": "1.001"},
        {"processing_fee_bdt": "5"},
        {"category": "unknown"},
    ],
)
def test_product_validation(client, changes):
    browser, _ = client
    owner()
    assert (
        browser.put("/api/v1/admin/products/RICE", json={**PRODUCT, **changes}).status_code == 422
    )


def test_product_persistence_and_audit(client):
    browser, _ = client
    owner()
    assert browser.put("/api/v1/admin/products/RICE", json=PRODUCT).status_code == 200
    products = browser.get("/api/v1/admin/products").json()
    assert next(p for p in products if p["sku"] == "RICE")["price_bdt"] == "80.00"
    assert browser.get("/api/v1/admin/activity").json()[0]["action"] == "product.saved"
    assert browser.get("/api/v1/admin/dashboard").json()["counts"]["products"] == 2


def test_history_ownership(client):
    browser, _ = client
    assert (
        browser.post(
            "/api/v1/groceries/orders",
            json=request_body(),
            headers={"Idempotency-Key": "history-test-01"},
        ).status_code
        == 201
    )
    assert len(browser.get("/api/v1/account/history").json()["orders"]) == 1
    owner()
    assert browser.get("/api/v1/account/history").json()["orders"] == []


def test_inactive_product_removed_from_public_catalog(client):
    browser, _ = client
    owner()
    assert (
        browser.put("/api/v1/admin/products/RICE", json={**PRODUCT, "active": False}).status_code
        == 200
    )
    assert all(p["sku"] != "RICE" for p in browser.get("/api/v1/groceries/products").json())


def test_admin_pagination_validation(client):
    browser, _ = client
    owner()
    assert browser.get("/api/v1/admin/products?offset=-1").status_code == 422


@pytest.mark.parametrize(
    "path,payload",
    [
        ("/admin/parcels/missing/assignment", {"courier_id": "missing"}),
        ("/admin/parcels/missing/status", {"status": "delivered"}),
        ("/admin/orders/missing/status", {"status": "preparing"}),
    ],
)
def test_preview_fulfillment_disabled(client, monkeypatch, path, payload):
    from app.core.config import Settings

    monkeypatch.setattr(
        "app.modules.operations.router.settings", lambda: Settings(app_env="preview")
    )
    browser, _ = client
    owner()
    assert browser.post("/api/v1" + path, json=payload).status_code == 503


def test_courier_approval_is_persistent_and_owner_only(client):
    browser, _ = client
    payload = {"actor_id": "google:courier", "transport_mode": "bicycle", "status": "approved"}
    assert browser.put("/api/v1/admin/couriers/courier-1", json=payload).status_code == 403
    owner()
    result = browser.put("/api/v1/admin/couriers/courier-1", json=payload)
    assert result.status_code == 200
    assert result.json()["approved_by"] == "google:owner"
    assert browser.get("/api/v1/admin/couriers").json()[0]["status"] == "approved"
    assert browser.put("/api/v1/admin/couriers/courier-2", json=payload).status_code == 409


def test_preview_write_guard_preserves_safe_writes(client, monkeypatch):
    import importlib

    from app.core.config import Settings

    main = importlib.import_module("app.main")
    monkeypatch.setattr(main, "config", Settings(app_env="preview"))
    browser, _ = client
    assert (
        browser.post(
            "/api/v1/groceries/orders",
            json=request_body(),
            headers={"Idempotency-Key": "preview-disabled"},
        ).status_code
        == 503
    )
    assert browser.post("/api/v1/parcels", json={}).status_code == 503
    assert (
        browser.put("/api/v1/account/profile", json={"name": "Preview profile"}).status_code == 200
    )
    owner()
    assert browser.put("/api/v1/admin/products/RICE", json=PRODUCT).status_code == 200
    assert browser.get("/api/v1/admin/dashboard").headers["Cache-Control"] == "no-store"


def test_parcel_assignment_status_tracking_and_ownership(client):
    browser, _ = client
    address = {
        "name": "Test",
        "phone": "01700000000",
        "address_line": "Example street 11",
        "city": "Dhaka",
        "latitude": 23.8,
        "longitude": 90.37,
    }
    payload = {
        "sender": address,
        "recipient": address,
        "package": {"weight_kg": 1, "length_cm": 10, "width_cm": 10, "height_cm": 10},
    }
    booked = browser.post(
        "/api/v1/parcels", json=payload, headers={"Idempotency-Key": "parcel-flow-test"}
    )
    assert booked.status_code == 201
    parcel = booked.json()
    owner()
    path = "/api/v1/admin/parcels/" + parcel["id"]
    assert browser.post(path + "/assignment", json={"courier_id": "missing"}).status_code == 422
    assert (
        browser.put(
            "/api/v1/admin/couriers/test-courier",
            json={"actor_id": "google:courier", "transport_mode": "walk", "status": "approved"},
        ).status_code
        == 200
    )
    assert (
        browser.post(path + "/assignment", json={"courier_id": "test-courier"}).status_code == 200
    )
    assert browser.post(path + "/status", json={"status": "delivered"}).status_code == 409
    for status in ["picked_up", "in_transit", "delivered"]:
        assert browser.post(path + "/status", json={"status": status}).status_code == 200
    assert (
        browser.post(path + "/assignment", json={"courier_id": "test-courier"}).status_code == 409
    )
    tracking = "/api/v1/parcels/" + parcel["tracking_code"]
    assert browser.get(tracking).json()["history"] == [
        "created",
        "assigned",
        "picked_up",
        "in_transit",
        "delivered",
    ]
    app.dependency_overrides[get_actor] = lambda: Actor("another-customer", frozenset({"customer"}))
    assert browser.get(tracking).status_code == 404


def test_order_state_machine(client):
    browser, _ = client
    booked = browser.post(
        "/api/v1/groceries/orders",
        json=request_body(),
        headers={"Idempotency-Key": "order-state-test"},
    )
    order_id = booked.json()["id"]
    owner()
    path = "/api/v1/admin/orders/" + order_id
    assert len(browser.get(path).json()["items"]) == 1
    assert browser.post(path + "/status", json={"status": "delivered"}).status_code == 409
    for status in ["preparing", "ready", "dispatched", "delivered"]:
        assert browser.post(path + "/status", json={"status": status}).status_code == 200
    assert browser.post("/api/v1/groceries/orders/" + order_id + "/cancel").status_code == 409


def test_inventory_failure_rolls_back(client):
    from app.modules.groceries.models import Product

    browser, factory = client
    payload = request_body()
    payload["items"].append({"sku": "RICE", "quantity": "50", "preparation": "none"})
    assert (
        browser.post(
            "/api/v1/groceries/orders",
            json=payload,
            headers={"Idempotency-Key": "rollback-stock-test"},
        ).status_code
        == 409
    )
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 5
    assert browser.get("/api/v1/account/history").json()["orders"] == []


def test_anonymous_access_rejected(client):
    browser, _ = client
    app.dependency_overrides.pop(get_actor)
    for path in ["/account/profile", "/account/history", "/admin/dashboard", "/admin/products"]:
        assert browser.get("/api/v1" + path).status_code == 401


def test_admin_session_route_precedes_collection_route(client):
    browser, _ = client
    assert browser.get("/api/v1/admin/session").status_code == 403
    owner()
    response = browser.get("/api/v1/admin/session")
    assert response.status_code == 200
    assert response.json()["is_admin"] is True
    assert response.json()["email"] == "owner@example.com"
