import importlib.util
from decimal import Decimal
from pathlib import Path

import pytest
from test_operations import owner
from test_order_integration import request_body

from app.core.auth import Actor, get_actor
from app.core.config import Settings
from app.main import app
from app.modules.groceries.models import Product

ZONE = {
    "city": "Dhaka",
    "area": "Dhanmondi",
    "fee_bdt": "60.00",
    "active": True,
    "capacity_per_slot": 3,
    "preparation_ready": True,
    "courier_ready": True,
}


def configure(browser, method="cod", capacity=3):
    owner()
    assert (
        browser.put(
            "/api/v1/admin/commerce/settings/pilot",
            json={"zones": [{**ZONE, "capacity_per_slot": capacity}]},
        ).status_code
        == 200
    )
    payments = {"cod_enabled": True}
    if method != "cod":
        payments[method] = {
            "enabled": True,
            "verified": True,
            "receiving_number": "01712345678",
            "instructions": "Test receiving destination in an isolated test database only.",
        }
    assert browser.put("/api/v1/admin/commerce/settings/payments", json=payments).status_code == 200
    app.dependency_overrides[get_actor] = lambda: Actor(
        "regression-customer", frozenset({"customer"})
    )


def body(method="cod"):
    p = request_body()
    p["destination"]["area"] = "Dhanmondi"
    p["payment_method"] = method
    p["payment_reference"] = "ISOLATED-REFERENCE" if method != "cod" else ""
    return p


@pytest.mark.parametrize("method", ["bkash", "nagad", "rocket", "bank"])
def test_placeholder_payment_destinations_cannot_be_enabled(client, method):
    browser, _ = client
    owner()
    r = browser.put(
        "/api/v1/admin/commerce/settings/payments",
        json={
            method: {
                "enabled": True,
                "verified": True,
                "receiving_number": "00000000000",
                "account_number": "00000000000",
                "bank_name": "Demo",
                "account_name": "Demo",
                "branch": "Demo",
            }
        },
    )
    assert r.status_code == 422


@pytest.mark.parametrize(
    "path",
    [
        "/admin/commerce/settings/payments",
        "/admin/commerce/settings/pilot",
        "/admin/commerce/customers",
        "/admin/commerce/events",
        "/admin/commerce/catalog",
    ],
)
def test_owner_settings_and_reporting_require_owner(client, path):
    browser, _ = client
    assert browser.get("/api/v1" + path).status_code == 403


def test_basket_persists_and_is_identity_scoped(client):
    browser, _ = client
    items = {"items": [{"sku": "ROHU", "quantity": "1", "preparation": "whole"}]}
    assert browser.put("/api/v1/commerce/cart", json=items).status_code == 200
    assert browser.get("/api/v1/commerce/cart").json()["items"][0]["sku"] == "ROHU"
    owner()
    assert browser.get("/api/v1/commerce/cart").json()["items"] == []


def test_duplicate_basket_product_rejected(client):
    browser, _ = client
    item = {"sku": "ROHU", "quantity": "1", "preparation": "whole"}
    assert browser.put("/api/v1/commerce/cart", json={"items": [item, item]}).status_code == 422


def test_cod_order_includes_shipping_and_unpaid_status(client):
    browser, factory = client
    configure(browser)
    reviewed = browser.post("/api/v1/commerce/review", json=body())
    assert reviewed.status_code == 200, reviewed.text
    assert reviewed.json()["total_bdt"] == "720.00"
    r = browser.post(
        "/api/v1/groceries/orders", json=body(), headers={"Idempotency-Key": "cod-checkout-01"}
    )
    assert r.status_code == 201, r.text
    assert r.json()["payment_status"] == "unpaid"
    assert r.json()["order_number"].startswith("TRG-")
    assert r.json()["delivery_fee_bdt"] == "60.00"
    duplicate = browser.post(
        "/api/v1/groceries/orders", json=body(), headers={"Idempotency-Key": "cod-checkout-01"}
    )
    assert duplicate.json()["order_number"] == r.json()["order_number"]
    assert (
        browser.get("/api/v1/commerce/orders/" + r.json()["id"]).json()["history"][0]["event"]
        == "submitted"
    )
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 3


@pytest.mark.parametrize("method", ["bkash", "nagad", "rocket"])
def test_manual_payment_remains_pending_until_owner_receipt(client, method):
    browser, _ = client
    configure(browser, method)
    r = browser.post(
        "/api/v1/groceries/orders",
        json=body(method),
        headers={"Idempotency-Key": "manual-" + method + "-01"},
    )
    assert r.status_code == 201, r.text
    assert r.json()["payment_status"] == "pending_verification"
    path = "/api/v1/admin/commerce/orders/" + r.json()["id"]
    receipt = {"received_amount_bdt": "720", "receipt_reference": "CONTROLLED-TEST-RECEIPT"}
    assert browser.post(path + "/payment", json=receipt).status_code == 403
    owner()
    assert browser.post(path + "/transition", json={"status": "confirmed"}).status_code == 409
    assert (
        browser.post(path + "/payment", json={**receipt, "received_amount_bdt": "1"}).status_code
        == 422
    )
    assert browser.post(path + "/payment", json=receipt).json()["payment_status"] == "paid"
    assert browser.post(path + "/payment", json=receipt).status_code == 409
    assert browser.post(path + "/transition", json={"status": "confirmed"}).status_code == 200


@pytest.mark.parametrize(
    "change", [{"price_approved": False}, {"price_bdt": Decimal(0)}, {"stock_qty": Decimal(0)}]
)
def test_review_and_checkout_reject_unapproved_or_unavailable_products(client, change):
    browser, factory = client
    configure(browser)
    with factory() as db:
        p = db.get(Product, "ROHU")
        for k, v in change.items():
            setattr(p, k, v)
        db.commit()
    assert browser.post("/api/v1/commerce/review", json=body()).status_code == 409
    assert (
        browser.post(
            "/api/v1/groceries/orders", json=body(), headers={"Idempotency-Key": "unavailable-01"}
        ).status_code
        == 409
    )


def test_preparation_fee_and_quantity_rules_use_owner_configuration(client):
    browser, factory = client
    configure(browser)
    with factory() as db:
        p = db.get(Product, "ROHU")
        p.details = {
            "minimum_quantity": "0.5",
            "quantity_step": "0.5",
            "preparation_options": [
                {"id": "cut", "enabled": True, "fee_bdt": "50", "yield_percent": 80}
            ],
        }
        db.commit()
    r = browser.post("/api/v1/commerce/review", json=body())
    assert r.json()["total_bdt"] == "760.00"
    assert r.json()["lines"][0]["estimated_final_quantity"] == "1.600"
    p = body()
    p["items"][0]["quantity"] = ".7"
    assert browser.post("/api/v1/commerce/review", json=p).status_code == 422
    p = body()
    p["items"][0]["preparation"] = "cleaned"
    assert browser.post("/api/v1/commerce/review", json=p).status_code == 422


def test_delivery_zone_capacity_is_enforced(client):
    browser, _ = client
    configure(browser, capacity=1)
    assert (
        browser.post(
            "/api/v1/groceries/orders", json=body(), headers={"Idempotency-Key": "capacity-first"}
        ).status_code
        == 201
    )
    p = body()
    p["destination"]["city"] = "DHAKA"
    p["destination"]["area"] = "DHANMONDI"
    assert (
        browser.post(
            "/api/v1/groceries/orders", json=p, headers={"Idempotency-Key": "capacity-second"}
        ).status_code
        == 409
    )


@pytest.mark.parametrize("field", ["active", "preparation_ready", "courier_ready"])
def test_unready_delivery_zone_cannot_promise_slot(client, field):
    browser, _ = client
    owner()
    assert (
        browser.put(
            "/api/v1/admin/commerce/settings/pilot", json={"zones": [{**ZONE, field: False}]}
        ).status_code
        == 200
    )
    assert browser.post("/api/v1/commerce/review", json=body()).status_code == 422


def test_full_grocery_lifecycle_and_cod_collection(client):
    browser, _ = client
    configure(browser)
    o = browser.post(
        "/api/v1/groceries/orders", json=body(), headers={"Idempotency-Key": "lifecycle-order"}
    ).json()
    owner()
    path = "/api/v1/admin/commerce/orders/" + o["id"]
    assert (
        browser.post(
            path + "/payment",
            json={"received_amount_bdt": "720", "receipt_reference": "COD-RECEIPT"},
        ).status_code
        == 409
    )
    for state in ["confirmed", "preparing", "packed"]:
        assert browser.post(path + "/transition", json={"status": state}).status_code == 200
    assert browser.post(path + "/transition", json={"status": "delivered"}).status_code == 409
    assert (
        browser.put(
            "/api/v1/admin/couriers/verified-courier",
            json={"actor_id": "google:courier", "transport_mode": "bicycle", "status": "pending"},
        ).status_code
        == 200
    )
    review = {
        "status": "approved",
        "identity_verified": True,
        "documents_verified": True,
        "active": True,
        "service_cities": ["Dhaka"],
        "review_note": "Controlled test verification.",
    }
    assert (
        browser.put(
            "/api/v1/admin/commerce/couriers/verified-courier/review", json=review
        ).status_code
        == 200
    )
    for state in ["assigned", "out_for_delivery", "delivered"]:
        r = browser.post(
            path + "/transition", json={"status": state, "courier_id": "verified-courier"}
        )
        assert r.status_code == 200, r.text
    assert (
        browser.post(
            path + "/payment",
            json={"received_amount_bdt": "720", "receipt_reference": "COD-RECEIPT"},
        ).json()["payment_status"]
        == "paid"
    )


def test_rejection_restocks_and_paid_cancellation_requires_refund(client):
    browser, factory = client
    configure(browser, "bkash")
    o = browser.post(
        "/api/v1/groceries/orders",
        json=body("bkash"),
        headers={"Idempotency-Key": "rejection-order"},
    ).json()
    owner()
    path = "/api/v1/admin/commerce/orders/" + o["id"]
    assert (
        browser.post(
            path + "/payment",
            json={"received_amount_bdt": "720", "receipt_reference": "REAL-TEST-RECEIPT"},
        ).status_code
        == 200
    )
    assert (
        browser.post(
            path + "/transition", json={"status": "rejected", "note": "Controlled test rejection"}
        ).json()["payment_status"]
        == "refund_required"
    )
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 5


def test_simulated_payments_restricted_to_test_environment(client, monkeypatch):
    browser, _ = client
    configure(browser, "bkash")
    o = browser.post(
        "/api/v1/groceries/orders",
        json=body("bkash"),
        headers={"Idempotency-Key": "simulated-order"},
    ).json()
    owner()
    path = "/api/v1/admin/commerce/orders/" + o["id"] + "/payment"
    payload = {
        "received_amount_bdt": "720",
        "receipt_reference": "SIMULATED-RECEIPT",
        "simulate": True,
    }
    monkeypatch.setattr("app.modules.commerce.router.settings", lambda: Settings(app_env="local"))
    assert browser.post(path, json=payload).status_code == 403
    monkeypatch.setattr("app.modules.commerce.router.settings", lambda: Settings(app_env="test"))
    assert browser.post(path, json=payload).json()["payment_status"] == "test_paid"


def test_courier_application_never_autoapproves(client):
    browser, _ = client
    r = browser.post(
        "/api/v1/commerce/courier/application",
        json={"transport_mode": "walk", "phone": "01712345678", "service_cities": ["Dhaka"]},
    )
    assert r.status_code == 200 and r.json()["status"] == "pending"
    assert (
        browser.post(
            "/api/v1/commerce/courier/update",
            json={
                "entity": "parcel",
                "record_id": "missing",
                "status": "delivered",
                "note": "Recipient acknowledged",
            },
        ).status_code
        == 403
    )
    owner()
    assert (
        browser.put(
            "/api/v1/admin/commerce/couriers/" + r.json()["id"] + "/review",
            json={"status": "approved", "review_note": "Unverified documents"},
        ).status_code
        == 422
    )


def test_catalog_import_is_idempotent_and_never_invents_stock(client):
    _, factory = client
    path = Path(__file__).resolve().parents[1] / "scripts/import_catalog.py"
    spec = importlib.util.spec_from_file_location("catalog_import", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    with factory() as db:
        result = module.import_catalog(db)
        assert result["total_source"] >= 100
        p = db.get(Product, "MRIGAL")
        assert not p.price_approved and p.stock_qty == 0 and p.price_bdt == 0
        p.name_en = "Owner edited name"
        db.commit()
        assert module.import_catalog(db)["added"] == 0
        assert db.get(Product, "MRIGAL").name_en == "Owner edited name"


def test_catalog_search_and_product_detail(client):
    browser, _ = client
    assert browser.get("/api/v1/groceries/products?q=রুই").json()[0]["sku"] == "ROHU"
    assert browser.get("/api/v1/groceries/products/ROHU").status_code == 200
    assert browser.get("/api/v1/groceries/products/MISSING").status_code == 404
    assert browser.get("/api/v1/groceries/products?sort=invalid").status_code == 422


def test_preview_stays_closed_even_with_pilot_flags(monkeypatch):
    from fastapi import HTTPException

    from app.modules.commerce.service import require_live_orders

    monkeypatch.setattr(
        "app.modules.commerce.service.settings",
        lambda: Settings(app_env="preview", live_orders_enabled=True, pilot_approved=True),
    )
    with pytest.raises(HTTPException) as error:
        require_live_orders()
    assert error.value.status_code == 503

@pytest.mark.parametrize('code,expected',[('DHAKA10',200),('MISSING',422)])
def test_owner_configured_promotion_uses_backend_totals(client,code,expected):
    browser,_=client;configure(browser);owner()
    assert browser.put('/api/v1/admin/commerce/settings/pilot',json={'zones':[ZONE],'promotions':[{'code':'DHAKA10','percent':10,'enabled':True,'minimum_subtotal_bdt':'100'}]}).status_code==200
    p=body();p['promo_code']=code
    r=browser.post('/api/v1/commerce/review',json=p)
    assert r.status_code==expected
    if expected==200:assert r.json()['total_bdt']=='654.00'

def test_saved_delivery_deadline_includes_timezone(client):
    browser,_=client;configure(browser)
    o=browser.post('/api/v1/groceries/orders',json=body(),headers={'Idempotency-Key':'timezone-order'}).json()
    detail=browser.get('/api/v1/commerce/orders/'+o['id']).json()
    assert detail['delivery_deadline'].endswith('+06:00')
    assert 'T09:00:00' in detail['delivery_deadline'] or 'T21:00:00' in detail['delivery_deadline']

def test_transfer_configuration_is_never_mistaken_for_payment(client):
    browser,_=client
    c=browser.get('/api/v1/commerce/configuration').json()
    assert not c['ordering_open']
    for method in ['bkash','nagad','rocket','bank']:
        assert not c['payments'][method]['enabled']
        assert 'Do not send' in c['payments'][method]['instructions']


def test_customer_commerce_responses_cannot_be_cached(client):
    browser, _ = client
    response = browser.get("/api/v1/commerce/cart")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"


def test_market_prices_preserve_stock_and_owner_edits(client):
    import importlib.util
    from pathlib import Path
    from sqlalchemy import select
    spec = importlib.util.spec_from_file_location("catalog_prices", Path(__file__).parents[1] / "scripts/import_catalog.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, factory = client
    with factory() as db:
        module.import_catalog(db)
        potato = db.get(Product, "VEG-POTATO")
        assert potato.price_bdt == Decimal("29")
        assert potato.stock_qty == 0
        assert potato.details["market_price"]["checked_on"] == "2026-11-21"
        assert db.get(Product, "VEG-SPINACH").unit == "bundle"
        potato.price_bdt = Decimal("33")
        db.commit()
        module.import_catalog(db)
        assert db.get(Product, "VEG-POTATO").price_bdt == Decimal("33")
        assert all(p.stock_qty == 0 for p in db.scalars(select(Product)).all() if p.sku not in ("ROHU", "RICE"))


def test_market_price_reset_is_not_overwritten(client):
    import importlib.util
    from pathlib import Path
    spec = importlib.util.spec_from_file_location("catalog_reset", Path(__file__).parents[1] / "scripts/import_catalog.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, factory = client
    with factory() as db:
        module.import_catalog(db)
        p = db.get(Product, "VEG-POTATO")
        p.price_bdt = 0
        p.price_approved = False
        db.commit()
        module.import_catalog(db)
        assert db.get(Product, "VEG-POTATO").price_bdt == 0
        assert db.get(Product, "VEG-POTATO").price_approved is False


def test_public_checkout_explains_incomplete_setup(client):
    browser, _ = client
    data = browser.get("/api/v1/commerce/configuration").json()
    assert data["ordering_open"] is False
    assert any("delivery area" in x for x in data["setup_issues"])
    assert any("payment method" in x for x in data["setup_issues"])
