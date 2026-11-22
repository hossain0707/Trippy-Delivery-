"""COD orders reach operations without prepayment; cash and delivery commit together."""

from decimal import Decimal

import pytest
from test_order_integration import request_body

from app.core.auth import Actor, get_actor
from app.core.config import settings
from app.main import app
from app.modules.commerce.models import CommerceEvent, ServiceSetting
from app.modules.couriers.models import DeliveryPartner
from app.modules.groceries.models import GroceryOrder, Product


@pytest.fixture
def cod(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "preview")
    settings.cache_clear()
    import importlib

    monkeypatch.setattr(importlib.import_module("app.main"), "config", settings())
    browser, factory = client
    with factory() as db:
        db.add(ServiceSetting(key="payments", value={"cod_enabled": True}))
        db.add(
            ServiceSetting(
                key="pilot",
                value={
                    "delivery_base_fee_bdt": "30",
                    "delivery_base_area": "Uttara",
                    "preparation_cut_fee_bdt": "20",
                },
            )
        )
        p = db.get(Product, "ROHU")
        p.details = {"department": "fish"}
        c = DeliveryPartner(
            actor_id="courier",
            status="approved",
            transport_mode="bicycle",
            details={
                "active": True,
                "identity_verified": True,
                "documents_verified": True,
                "service_cities": ["Dhaka"],
            },
        )
        db.add(c)
        db.commit()
        courier_id = c.id
    body = request_body()
    body["destination"]["area"] = "Uttara"
    body["expected_total_bdt"] = "670"
    yield browser, factory, body, courier_id
    settings.cache_clear()


def actor(subject="regression-customer", admin=False):
    app.dependency_overrides[get_actor] = lambda: Actor(
        subject, frozenset({"admin"} if admin else {"customer"})
    )


def place(browser, body, key="cod-checkout-001"):
    return browser.post("/api/v1/commerce/cod-orders", json=body, headers={"Idempotency-Key": key})


def transition(browser, ident, status, **extra):
    return browser.post(
        f"/api/v1/admin/commerce/orders/{ident}/transition", json={"status": status, **extra}
    )


def test_cod_persists_idempotently_and_is_owner_scoped(cod):
    browser, factory, body, _ = cod
    response = place(browser, body)
    assert response.status_code == 201, response.text
    ident = response.json()["id"]
    assert place(browser, body).json()["id"] == ident
    with factory() as db:
        order = db.get(GroceryOrder, ident)
        assert order.status == "placed" and order.payment_status == "unpaid"
        assert order.amount_bdt == Decimal(670)
        assert db.get(Product, "ROHU").stock_qty == 5
    assert transition(browser, ident, "confirmed").status_code == 403
    actor("another")
    assert browser.get(f"/api/v1/commerce/orders/{ident}").status_code == 404
    actor("owner", True)
    assert any(o["id"] == ident for o in browser.get("/api/v1/admin/orders").json())
    assert transition(browser, ident, "confirmed").status_code == 200
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 3


@pytest.mark.parametrize(
    "method,reference,total,code",
    [("bkash", "", "670", 422), ("cod", "transfer", "670", 422), ("cod", "", "1", 409)],
)
def test_cod_rejects_transfers_and_stale_prices(cod, method, reference, total, code):
    browser, _, body, _ = cod
    body.update(payment_method=method, payment_reference=reference, expected_total_bdt=total)
    assert place(browser, body).status_code == code


def test_cod_owner_switch_closes_intake(cod):
    browser, factory, body, _ = cod
    with factory() as db:
        db.get(ServiceSetting, "payments").value = {"cod_enabled": False}
        db.commit()
    assert place(browser, body).status_code == 503
    assert browser.get("/api/v1/commerce/configuration").json()["cod_ordering_open"] is False


def test_store_weighs_customer_accepts_quote_and_stock_required(cod):
    browser, factory, body, _ = cod
    with factory() as db:
        db.get(Product, "ROHU").unit = "piece"
        db.get(Product, "ROHU").stock_qty = 0
        db.commit()
    body["expected_total_bdt"] = None
    r = place(browser, body)
    assert r.status_code == 201, r.text
    ident = r.json()["id"]
    assert r.json()["quote_pending"] is True
    quote = f"/api/v1/admin/commerce/cod-orders/{ident}/quote"
    assert (
        browser.post(
            quote,
            json={
                "final_total_bdt": "665",
                "note": "Weighed 1.75kg; preparation35 + items600 + delivery30",
            },
        ).status_code
        == 403
    )
    actor("owner", True)
    assert transition(browser, ident, "confirmed").status_code == 409
    assert (
        browser.post(
            quote,
            json={
                "final_total_bdt": "665",
                "note": "Weighed 1.75kg; preparation35 + items600 + delivery30",
            },
        ).status_code
        == 200
    )
    actor()
    accept = f"/api/v1/commerce/cod-orders/{ident}/accept"
    assert browser.post(accept, json={"accepted_total_bdt": "660"}).status_code == 409
    accepted = browser.post(accept, json={"accepted_total_bdt": "665"})
    assert accepted.status_code == 200
    assert accepted.json()["status"] == "awaiting_purchase"
    actor("owner", True)
    received = browser.post(
        f"/api/v1/admin/commerce/cod-orders/{ident}/purchase",
        json={
            "items": [{"sku": "ROHU", "quantity": "2"}],
            "verified": True,
            "note": "Received two fish after customer approval",
        },
    )
    assert received.status_code == 200, received.text
    with factory() as db:
        o = db.get(GroceryOrder, ident)
        assert o.status == "purchased"
        assert o.payment_status == "unpaid" and not o.checkout_data["quote_pending"]
        assert db.get(Product, "ROHU").stock_qty == 0


def test_assigned_courier_delivers_and_collects_exact_cash_atomically(cod):
    browser, factory, body, courier_id = cod
    ident = place(browser, body).json()["id"]
    actor("owner", True)
    for state in ("confirmed", "preparing", "packed"):
        r = transition(browser, ident, state)
        assert r.status_code == 200, r.text
    assert transition(browser, ident, "assigned", courier_id=courier_id).status_code == 200
    actor("other-courier")
    update = {
        "entity": "grocery",
        "record_id": ident,
        "status": "out_for_delivery",
        "note": "Picked up securely",
    }
    assert browser.post("/api/v1/commerce/courier/update", json=update).status_code == 403
    actor("courier")
    work = browser.get("/api/v1/commerce/courier/work").json()["orders"][0]
    assert work["amount_bdt"] == "670.00" and work["destination"]["area"] == "Uttara"
    assert browser.post("/api/v1/commerce/courier/update", json=update).status_code == 200
    update.update(status="delivered", note="Recipient received all items")
    for cash in (None, "669"):
        update["cash_collected_bdt"] = cash
        assert browser.post("/api/v1/commerce/courier/update", json=update).status_code == 422
    with factory() as db:
        o = db.get(GroceryOrder, ident)
        assert o.status == "out_for_delivery" and o.payment_status == "unpaid"
    update["cash_collected_bdt"] = "670"
    assert browser.post("/api/v1/commerce/courier/update", json=update).status_code == 200
    assert browser.post("/api/v1/commerce/courier/update", json=update).status_code == 409
    with factory() as db:
        o = db.get(GroceryOrder, ident)
        assert o.status == "delivered" and o.payment_status == "paid"
        assert (
            db.query(CommerceEvent).filter_by(entity_id=ident, event="cod_cash_collected").count()
            == 1
        )
    assert "destination" not in browser.get("/api/v1/commerce/courier/work").json()["orders"][0]


def test_cancellation_returns_only_reserved_stock_once(cod):
    browser, factory, body, _ = cod
    for reserved in (False, True):
        actor()
        ident = place(browser, body, "cancel-cod-" + str(reserved)).json()["id"]
        if reserved:
            actor("owner", True)
            assert transition(browser, ident, "confirmed").status_code == 200
            actor()
        for _ in range(2):
            assert browser.post(f"/api/v1/commerce/cod-orders/{ident}/cancel").status_code == 200
        with factory() as db:
            assert db.get(Product, "ROHU").stock_qty == 5


def test_owner_cannot_mark_delivered_without_exact_cash_and_acknowledgement(cod):
    browser, factory, body, courier_id = cod
    ident = place(browser, body).json()["id"]
    actor("owner", True)
    for state in ("confirmed", "preparing", "packed", "assigned", "out_for_delivery"):
        assert transition(browser, ident, state, courier_id=courier_id).status_code == 200
    assert (
        transition(browser, ident, "delivered", note="Recipient accepted all items").status_code
        == 422
    )
    assert transition(browser, ident, "delivered", cash_collected_bdt="670").status_code == 422
    assert (
        transition(
            browser,
            ident,
            "delivered",
            cash_collected_bdt="670",
            note="Recipient accepted all items",
        ).status_code
        == 200
    )
    with factory() as db:
        assert db.get(GroceryOrder, ident).payment_status == "paid"


def test_hosted_preview_keeps_online_payments_and_legacy_orders_closed(cod):
    browser, _, body, _ = cod
    assert (
        browser.post(
            "/api/v1/groceries/orders", json=body, headers={"Idempotency-Key": "blocked-online-01"}
        ).status_code
        == 503
    )
    actor("owner", True)
    assert (
        browser.post(
            "/api/v1/admin/commerce/orders/unknown/payment",
            json={"received_amount_bdt": "670", "receipt_reference": "not-a-receipt"},
        ).status_code
        == 503
    )


def test_procurement_is_owner_only_and_receipt_is_verified_atomic_idempotent(cod):
    browser, factory, body, _ = cod
    with factory() as db:
        db.get(Product, "ROHU").stock_qty = 0
        db.commit()
    ident = place(browser, body).json()["id"]
    availability = f"/api/v1/admin/commerce/cod-orders/{ident}/availability"
    assert browser.get(availability).status_code == 403
    assert transition(browser, ident, "awaiting_purchase").status_code == 403
    actor("owner", True)
    check = browser.get(availability).json()
    assert check["items"][0]["required"] == "2.000"
    assert Decimal(check["items"][0]["shortfall"]) == 2
    assert check["can_confirm"] is False
    assert transition(browser, ident, "confirmed").status_code == 409
    assert transition(browser, ident, "awaiting_purchase").status_code == 200
    assert transition(browser, ident, "preparing").status_code == 409
    path = f"/api/v1/admin/commerce/cod-orders/{ident}/purchase"
    payload = {
        "items": [{"sku": "ROHU", "quantity": "1"}],
        "verified": True,
        "note": "Supplier receipt checked",
    }
    assert browser.post(path, json=payload).status_code == 409
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 0
    payload["items"][0]["quantity"] = "3"
    payload["verified"] = False
    assert browser.post(path, json=payload).status_code == 422
    payload["verified"] = True
    assert browser.post(path, json=payload).status_code == 200
    assert browser.post(path, json=payload).status_code == 200
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 1
        assert db.get(GroceryOrder, ident).status == "purchased"
        assert db.query(CommerceEvent).filter_by(entity_id=ident, event="purchased").count() == 1
    assert browser.get(availability).json()["stock_reserved"] is True
    assert transition(browser, ident, "preparing").status_code == 200
    actor()
    assert browser.post(f"/api/v1/commerce/cod-orders/{ident}/cancel").status_code == 409


def test_verified_stock_count_rejects_stale_or_unverified_counts(cod):
    browser, factory, _, _ = cod
    path = "/api/v1/admin/commerce/catalog/ROHU/stock"
    body = {
        "available_qty": "7",
        "expected_qty": "5",
        "verified": True,
        "note": "Counted actual fish",
    }
    assert browser.put(path, json=body).status_code == 403
    actor("owner", True)
    body["verified"] = False
    assert browser.put(path, json=body).status_code == 422
    body["verified"] = True
    assert browser.put(path, json=body).status_code == 200
    assert browser.put(path, json=body).status_code == 409
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 7


def test_awaiting_purchase_cancellation_does_not_invent_stock(cod):
    browser, factory, body, _ = cod
    with factory() as db:
        db.get(Product, "ROHU").stock_qty = 0
        db.commit()
    ident = place(browser, body).json()["id"]
    actor("owner", True)
    assert transition(browser, ident, "awaiting_purchase").status_code == 200
    actor()
    assert browser.post(f"/api/v1/commerce/cod-orders/{ident}/cancel").status_code == 200
    with factory() as db:
        assert db.get(Product, "ROHU").stock_qty == 0


def test_customer_order_list_is_scoped_paginated_and_classifies_procurement(cod):
    browser, _, body, _ = cod
    ident = place(browser, body).json()["id"]
    assert browser.get("/api/v1/account/orders").json()["total"] == 1
    assert browser.get("/api/v1/account/orders?group=history").json()["total"] == 0
    result = browser.get("/api/v1/account/orders?q=TRC-").json()["items"][0]
    assert not {"request_hash", "idempotency_key", "customer_id"} & result.keys()
    actor("another-customer")
    assert browser.get("/api/v1/account/orders").json()["total"] == 0
    actor("owner", True)
    assert transition(browser, ident, "awaiting_purchase").status_code == 200
    actor()
    assert browser.get("/api/v1/account/orders").json()["items"][0]["status"] == "awaiting_purchase"
    assert browser.get("/api/v1/account/orders?page=0").status_code == 422
