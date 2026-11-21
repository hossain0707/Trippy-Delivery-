from decimal import Decimal

from app.core.auth import Actor, get_actor
from app.core.config import Settings
from app.main import app
from app.modules.groceries.models import Product, GroceryOrder
from test_order_integration import request_body


def body(preparation="cut"):
    p = request_body(preparation)
    p["destination"]["area"] = "Dhanmondi"
    p["preparation_notes"] = "Curry pieces, keep head separate"
    return p


def test_no_payment_request_accepts_clean_cut_without_stock(client):
    browser, factory = client
    with factory() as db:
        p = db.get(Product, "ROHU")
        p.stock_qty = 0
        db.commit()
    r = browser.post("/api/v1/commerce/order-requests/review", json=body())
    assert r.status_code == 200 and r.json()["payment_required"] is False
    assert r.json()["total_bdt"] is None
    r = browser.post(
        "/api/v1/commerce/order-requests",
        json=body(),
        headers={"Idempotency-Key": "request-clean-cut"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["payment_status"] == "not_requested"
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 0
        o = db.get(GroceryOrder, r.json()["id"])
        assert o.status == "requested" and o.payment_method == "disabled"
        assert o.checkout_data["stock_reserved"] is False
        assert o.checkout_data["preparation_notes"] == "Curry pieces, keep head separate"
    assert browser.get("/api/v1/account/history").json()["orders"][0]["id"] == r.json()["id"]


def test_request_idempotency_and_no_payment_payload(client):
    browser, _ = client
    headers = {"Idempotency-Key": "request-idempotent"}
    first = browser.post("/api/v1/commerce/order-requests", json=body(), headers=headers)
    second = browser.post("/api/v1/commerce/order-requests", json=body(), headers=headers)
    assert first.json()["id"] == second.json()["id"]
    assert (
        browser.post(
            "/api/v1/commerce/order-requests",
            json={**body(), "instructions": "changed"},
            headers=headers,
        ).status_code
        == 409
    )
    assert (
        browser.post(
            "/api/v1/commerce/order-requests",
            json={**body(), "payment_method": "bkash"},
            headers={"Idempotency-Key": "no-payment-fields"},
        ).status_code
        == 422
    )


def test_unpriced_product_requires_quote_never_free(client):
    browser, factory = client
    with factory() as db:
        p = db.get(Product, "ROHU")
        p.price_approved = False
        p.price_bdt = 0
        db.commit()
    r = browser.post("/api/v1/commerce/order-requests/review", json=body()).json()
    assert r["lines"][0]["price_pending"] is True
    assert r["quote_pending"] is True and r["total_bdt"] is None


def test_customer_cannot_review_other_request_or_inflate_stock(client):
    browser, factory = client
    r = browser.post(
        "/api/v1/commerce/order-requests",
        json=body(),
        headers={"Idempotency-Key": "request-owner-review"},
    ).json()
    path = "/api/v1/commerce/order-requests/" + r["id"] + "/update"
    assert (
        browser.post(
            path, json={"status": "reviewing", "note": "Customer tries approval"}
        ).status_code
        == 403
    )
    app.dependency_overrides[get_actor] = lambda: Actor("other", frozenset({"customer"}))
    assert browser.get("/api/v1/commerce/orders/" + r["id"]).status_code == 404
    assert (
        browser.post(path, json={"status": "cancelled", "note": "Unauthorized cancel"}).status_code
        == 404
    )
    app.dependency_overrides[get_actor] = lambda: Actor(
        "regression-customer", frozenset({"customer"})
    )
    assert (
        browser.post(path, json={"status": "cancelled", "note": "Customer cancelled"}).status_code
        == 200
    )
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == Decimal(5)


def test_preview_allows_requests_without_opening_payments(client, monkeypatch):
    import importlib

    main = importlib.import_module("app.main")
    monkeypatch.setattr(main, "config", Settings(app_env="preview"))
    browser, _ = client
    assert (
        browser.post(
            "/api/v1/commerce/order-requests",
            json=body(),
            headers={"Idempotency-Key": "preview-real-request"},
        ).status_code
        == 201
    )
    assert (
        browser.post(
            "/api/v1/groceries/orders",
            json=body(),
            headers={"Idempotency-Key": "preview-still-disabled"},
        ).status_code
        == 503
    )
    assert browser.post("/api/v1/admin/commerce/orders/missing/payment", json={}).status_code == 503


def test_request_input_failures(client):
    browser, _ = client
    p = body("custom")
    p["preparation_notes"] = ""
    assert browser.post("/api/v1/commerce/order-requests/review", json=p).status_code == 422
    p = body()
    p["items"].append(p["items"][0])
    assert browser.post("/api/v1/commerce/order-requests/review", json=p).status_code == 422


def test_final_quote_requires_customer_acceptance_before_preparation(client):
    browser, _ = client
    r = browser.post(
        "/api/v1/commerce/order-requests",
        json=body(),
        headers={"Idempotency-Key": "request-quote-flow"},
    ).json()
    path = "/api/v1/commerce/order-requests/" + r["id"] + "/update"
    app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin", "customer"}))
    assert (
        browser.post(
            path, json={"status": "preparing", "note": "Tried to skip acceptance"}
        ).status_code
        == 409
    )
    assert (
        browser.post(
            path, json={"status": "quoted", "note": "Includes cutting and delivery"}
        ).status_code
        == 422
    )
    assert (
        browser.post(
            path,
            json={
                "status": "quoted",
                "final_total_bdt": "720",
                "note": "Includes cutting and delivery",
            },
        ).status_code
        == 200
    )
    assert (
        browser.post(
            path, json={"status": "confirmed", "note": "Owner cannot accept for customer"}
        ).status_code
        == 409
    )
    app.dependency_overrides[get_actor] = lambda: Actor(
        "regression-customer", frozenset({"customer"})
    )
    assert (
        browser.post(
            path,
            json={
                "status": "confirmed",
                "note": "Stale quote must be rejected",
                "accepted_total_bdt": "700",
            },
        ).status_code
        == 409
    )
    assert (
        browser.post(
            path,
            json={
                "status": "confirmed",
                "note": "I accept the final quote",
                "accepted_total_bdt": "720",
            },
        ).status_code
        == 200
    )
    app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin", "customer"}))
    assert (
        browser.post(
            path, json={"status": "preparing", "note": "Stock sourced; preparation started"}
        ).status_code
        == 200
    )
    assert (
        browser.post(path, json={"status": "packed", "note": "Packed and checked"}).status_code
        == 200
    )
    assert (
        browser.post(
            path,
            json={
                "status": "assigned",
                "note": "No fake courier accepted",
                "courier_id": "missing",
            },
        ).status_code
        == 422
    )


def test_no_payment_parcel_request_is_persistent_and_scoped(client, monkeypatch):
    import importlib

    main = importlib.import_module("app.main")
    monkeypatch.setattr(main, "config", Settings(app_env="preview"))
    browser, _ = client
    address = {
        "name": "Controlled test",
        "phone": "01700000000",
        "address_line": "Isolated test road",
        "city": "Dhaka",
        "latitude": 23.8,
        "longitude": 90.37,
    }
    payload = {
        "sender": address,
        "recipient": {**address, "address_line": "Second isolated test road"},
        "package": {"weight_kg": 1, "length_cm": 10, "width_cm": 10, "height_cm": 10},
    }
    first = browser.post(
        "/api/v1/parcels/requests", json=payload, headers={"Idempotency-Key": "pickup-request-only"}
    )
    assert first.status_code == 201, first.text
    assert first.json()["status"] == "requested"
    again = browser.post(
        "/api/v1/parcels/requests", json=payload, headers={"Idempotency-Key": "pickup-request-only"}
    )
    assert first.json()["id"] == again.json()["id"]
    code = first.json()["tracking_code"]
    assert browser.get("/api/v1/parcels/" + code).json()["history"] == ["request_submitted"]
    path = "/api/v1/parcels/requests/" + first.json()["id"] + "/update"
    assert (
        browser.post(
            path, json={"status": "confirmed", "note": "Customer cannot approve pickup"}
        ).status_code
        == 403
    )
    app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin", "customer"}))
    assert (
        browser.post(
            path, json={"status": "confirmed", "note": "Pickup coverage reviewed"}
        ).status_code
        == 200
    )
    assert (
        browser.post(
            path,
            json={
                "status": "assigned",
                "note": "Cannot fabricate courier",
                "courier_id": "missing",
            },
        ).status_code
        == 422
    )
    app.dependency_overrides[get_actor] = lambda: Actor("other", frozenset({"customer"}))
    assert browser.get("/api/v1/parcels/" + code).status_code == 404


def test_real_photos_have_credit_and_local_asset():
    import json
    from pathlib import Path
    from app.modules.commerce.schemas import PhotoCredit

    root = Path(__file__).parents[3]
    sources = json.loads((root / "services/api/catalog/real-photo-sources.json").read_text())
    assert len(sources) >= 100
    for source in sources.values():
        PhotoCredit.model_validate({k: v for k, v in source.items() if k != "image"})
        assert source["image"].startswith("/real-products/")
        assert (root / "apps/web/public" / source["image"].lstrip("/")).is_file()
        assert not source["title"].lower().endswith((".svg", ".webm"))


def test_photo_import_preserves_owner_approved_images(client):
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "photo_import", Path(__file__).parents[1] / "scripts/import_catalog.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, factory = client
    with factory() as db:
        module.import_catalog(db)
        p = db.get(Product, "VEG-POTATO")
        assert p.details["image"].startswith("/real-products/")
        assert p.details["photo_credit"]["license"]
        p.details = {**p.details, "image": "/owner-photo.webp", "images_approved": True}
        db.commit()
        module.import_catalog(db)
        assert db.get(Product, "VEG-POTATO").details["image"] == "/owner-photo.webp"
