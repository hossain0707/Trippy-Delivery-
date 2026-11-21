"""The restored checkout calculates without accepting payment or reserving stock."""

from decimal import Decimal

from test_order_integration import request_body

from app.core.auth import Actor, get_actor
from app.core.config import settings
from app.main import app
from app.modules.commerce.models import ServiceSetting
from app.modules.groceries.models import GroceryOrder, Product


def setup(client, monkeypatch):
    monkeypatch.setenv("APP_ENV", "preview")
    settings.cache_clear()
    browser, factory = client
    with factory() as db:
        p = db.get(Product, "ROHU")
        p.stock_qty = 0
        p.details = {
            "minimum_quantity": "0.5",
            "quantity_step": "0.5",
            "preparation_options": [
                {
                    "id": "whole",
                    "name_en": "Whole",
                    "name_bn": "আস্ত",
                    "fee_bdt": "0",
                    "enabled": True,
                    "yield_percent": 100,
                },
                {
                    "id": "cleaned",
                    "name_en": "Cleaned",
                    "name_bn": "পরিষ্কার",
                    "fee_bdt": "0",
                    "enabled": False,
                    "yield_percent": 90,
                },
                {
                    "id": "cut",
                    "name_en": "Cut",
                    "name_bn": "কাটা",
                    "fee_bdt": "0",
                    "enabled": False,
                    "yield_percent": 85,
                },
            ],
        }
        db.add(
            ServiceSetting(
                key="pilot",
                value={
                    "preparation_cleaned_fee_bdt": "10",
                    "preparation_cut_fee_bdt": "25",
                    "preparation_cut_only_fee_bdt": "15",
                    "dhaka_delivery_fee_bdt": "60",
                    "promotions": [{"code": "SAVE10", "percent": 10, "enabled": True}],
                },
            )
        )
        db.commit()
    return browser, factory


def test_original_calculation_without_payment_or_stock(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        body = request_body()
        body["promo_code"] = "SAVE10"
        r = browser.post("/api/v1/commerce/review", json=body)
        assert r.status_code == 200, r.text
        result = r.json()
        assert result["item_subtotal_bdt"] == "600.00"
        assert result["preparation_fee_bdt"] == "50.00"
        assert result["discount_bdt"] == "65.00"
        assert result["delivery_fee_bdt"] == "60"
        assert result["total_bdt"] == "645.00"
        assert result["payment_required"] is False
        assert result["slot_confirmed"] is False
        assert Decimal(result["lines"][0]["estimated_final_quantity"]) == Decimal("1.7")
        with factory() as db:
            assert db.get(Product, "ROHU").stock_qty == 0
    finally:
        settings.cache_clear()


def test_preview_order_persists_idempotently_and_is_customer_scoped(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        body = request_body()
        body["expected_total_bdt"] = "710.00"
        headers = {"Idempotency-Key": "restored-checkout-01"}
        a = browser.post("/api/v1/commerce/preview-orders", json=body, headers=headers)
        assert a.status_code == 201, a.text
        b = browser.post("/api/v1/commerce/preview-orders", json=body, headers=headers)
        assert b.json()["id"] == a.json()["id"]
        with factory() as db:
            o = db.get(GroceryOrder, a.json()["id"])
            assert o.status == "preview"
            assert o.amount_bdt == Decimal(710)
            assert o.checkout_data["stock_reserved"] is False
            assert o.payment_status == "disabled"
            assert db.get(Product, "ROHU").stock_qty == 0
        assert browser.get("/api/v1/commerce/orders/" + a.json()["id"]).status_code == 200
        app.dependency_overrides[get_actor] = lambda: Actor(
            "different-customer", frozenset({"customer"})
        )
        assert browser.get("/api/v1/commerce/orders/" + a.json()["id"]).status_code == 404
    finally:
        settings.cache_clear()


def test_stale_total_and_transfers_are_rejected(client, monkeypatch):
    browser, _ = setup(client, monkeypatch)
    try:
        body = request_body()
        body["expected_total_bdt"] = "1"
        assert (
            browser.post(
                "/api/v1/commerce/preview-orders",
                json=body,
                headers={"Idempotency-Key": "stale-checkout-01"},
            ).status_code
            == 409
        )
        body["payment_reference"] = "do-not-collect"
        assert (
            browser.post(
                "/api/v1/commerce/preview-orders",
                json=body,
                headers={"Idempotency-Key": "stale-checkout-02"},
            ).status_code
            == 422
        )
        assert (
            browser.post(
                "/api/v1/groceries/orders",
                json=body,
                headers={"Idempotency-Key": "legacy-checkout-01"},
            ).status_code
            == 503
        )
    finally:
        settings.cache_clear()


def test_missing_prices_are_not_treated_as_free(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        with factory() as db:
            p = db.get(Product, "ROHU")
            p.price_approved = False
            db.get(ServiceSetting, "pilot").value = {}
            db.commit()
        r = browser.post("/api/v1/commerce/review", json=request_body())
        assert r.status_code == 200
        assert r.json()["total_bdt"] is None
        assert len(r.json()["pending"]) == 3
        assert r.json()["delivery_fee_bdt"] is None
        assert (
            browser.post(
                "/api/v1/commerce/preview-orders",
                json=request_body(),
                headers={"Idempotency-Key": "missing-price-01"},
            ).status_code
            == 422
        )
    finally:
        settings.cache_clear()


def test_preparation_and_quantity_validation(client, monkeypatch):
    browser, _ = setup(client, monkeypatch)
    try:
        body = request_body()
        body["items"][0]["quantity"] = "0.7"
        assert browser.post("/api/v1/commerce/review", json=body).status_code == 422
        body = request_body()
        body["items"] = [{"sku": "RICE", "quantity": "1", "preparation": "cut"}]
        assert browser.post("/api/v1/commerce/review", json=body).status_code == 422
        body = request_body("custom")
        assert browser.post("/api/v1/commerce/review", json=body).status_code == 422
        body = request_body()
        body["items"] *= 2
        assert browser.post("/api/v1/commerce/review", json=body).status_code == 422
    finally:
        settings.cache_clear()


def test_tariffs_owner_only_and_invalid_rates_rejected(client, monkeypatch):
    browser, _ = setup(client, monkeypatch)
    try:
        assert (
            browser.put(
                "/api/v1/admin/commerce/settings/pilot", json={"dhaka_delivery_fee_bdt": "60"}
            ).status_code
            == 403
        )
        app.dependency_overrides[get_actor] = lambda: Actor("owner", frozenset({"admin"}))
        assert (
            browser.put(
                "/api/v1/admin/commerce/settings/pilot", json={"dhaka_delivery_fee_bdt": "-1"}
            ).status_code
            == 422
        )
        assert (
            browser.put(
                "/api/v1/admin/commerce/settings/pilot", json={"dhaka_delivery_fee_bdt": "80"}
            ).status_code
            == 200
        )
        assert (
            browser.get("/api/v1/commerce/configuration").json()["pilot"]["dhaka_delivery_fee_bdt"]
            == "80"
        )
    finally:
        settings.cache_clear()


def test_catalog_selectors_and_specific_tariff_override(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        with factory() as db:
            p = db.get(Product, "ROHU")
            d = dict(p.details)
            opts = [dict(o) for o in d["preparation_options"]]
            opts[2].update(fee_bdt="30", enabled=True)
            d["preparation_options"] = opts
            p.details = d
            db.commit()
        r = browser.get("/api/v1/groceries/products/ROHU").json()
        assert all(o["enabled"] for o in r["details"]["preparation_options"])
        r = browser.post("/api/v1/commerce/review", json=request_body()).json()
        assert r["total_bdt"] == "720.00"
    finally:
        settings.cache_clear()


def test_owner_tariff_initialization_is_once_and_preserves_edits(client):
    import importlib.util
    from pathlib import Path

    spec = importlib.util.spec_from_file_location(
        "catalog_tariff", Path(__file__).resolve().parents[1] / "scripts/import_catalog.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    _, factory = client
    with factory() as db:
        module.import_shopping_tariff(db)
        db.commit()
        row = db.get(ServiceSetting, "pilot")
        assert row.value["preparation_cleaned_fee_bdt"] == "10.00"
        assert row.value["preparation_cut_only_fee_bdt"] == "15.00"
        assert row.value["preparation_cut_fee_bdt"] == "20.00"
        row.value = {**row.value, "preparation_cut_fee_bdt": "27.00"}
        db.commit()
        module.import_shopping_tariff(db)
        db.commit()
        assert db.get(ServiceSetting, "pilot").value["preparation_cut_fee_bdt"] == "27.00"


def test_uttara_delivery_policy_and_outside_distance(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        with factory() as db:
            row = db.get(ServiceSetting, "pilot")
            row.value = {
                **row.value,
                "delivery_base_area": "Uttara",
                "delivery_base_fee_bdt": "30.00",
                "delivery_per_km_bdt": "5.00",
            }
            db.commit()
        body = request_body()
        body["destination"]["area"] = "Uttara Sector 7"
        r = browser.post("/api/v1/commerce/review", json=body).json()
        assert r["delivery_fee_bdt"] == "30.00"
        body["destination"]["area"] = "উত্তরা সেক্টর ১০"
        assert (
            browser.post("/api/v1/commerce/review", json=body).json()["delivery_fee_bdt"] == "30.00"
        )
        body["destination"]["area"] = "Dhanmondi"
        body["delivery_distance_km"] = "12.5"
        r = browser.post("/api/v1/commerce/review", json=body).json()
        assert r["delivery_fee_bdt"] == "92.50"
        assert r["distance_basis"] == "customer_entered_preview"
        body["delivery_distance_km"] = "-1"
        assert browser.post("/api/v1/commerce/review", json=body).status_code == 422
        body.pop("delivery_distance_km")
        assert browser.post("/api/v1/commerce/review", json=body).json()["total_bdt"] is None
    finally:
        settings.cache_clear()


def test_cut_only_uses_distinct_tariff(client, monkeypatch):
    browser, _ = setup(client, monkeypatch)
    try:
        r = browser.post("/api/v1/commerce/review", json=request_body("cut-only")).json()
        assert r["preparation_fee_bdt"] == "30.00"
        assert r["total_bdt"] == "690.00"
    finally:
        settings.cache_clear()


def test_non_kg_preparation_uses_explicit_weight_not_piece_count(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        with factory() as db:
            p = db.get(Product, "ROHU")
            p.unit = "piece"
            db.commit()
        body = request_body()
        body["items"][0]["preparation"] = "cleaned"
        missing = browser.post("/api/v1/commerce/review", json=body).json()
        assert missing["total_bdt"] is None
        body["items"][0]["preparation_weight_kg"] = "1.5"
        result = browser.post("/api/v1/commerce/review", json=body).json()
        assert result["preparation_fee_bdt"] == "15.00"
        assert result["total_bdt"] == "675.00"
        body["items"][0]["preparation_weight_kg"] = "0"
        assert browser.post("/api/v1/commerce/review", json=body).status_code == 422
    finally:
        settings.cache_clear()


def test_catalog_labels_and_units_match_current_selling_unit(client, monkeypatch):
    browser, factory = setup(client, monkeypatch)
    try:
        with factory() as db:
            p = db.get(Product, "ROHU")
            p.unit = "piece"
            p.details = {
                **p.details,
                "department": "fish",
                "description_en": f"{p.name_en} for your everyday Bangladeshi kitchen. Sold by kg; final packaging and availability are confirmed by TRIPPY.",
                "preparation_options": [
                    {
                        "id": "whole",
                        "name_en": "As sold",
                        "name_bn": "মূল",
                        "fee_bdt": "0",
                        "enabled": True,
                    }
                ],
            }
            db.commit()
        result = browser.get("/api/v1/groceries/products/ROHU").json()
        assert "Sold by piece" in result["details"]["description_en"]
        assert result["details"]["preparation_options"][0]["name_en"] == "Whole / unprepared"
    finally:
        settings.cache_clear()


def test_raw_fruits_offer_tariff_but_packaged_foods_do_not(client, monkeypatch):
    import importlib.util
    from pathlib import Path

    browser, factory = setup(client, monkeypatch)
    path = Path(__file__).resolve().parents[1] / "scripts/import_catalog.py"
    spec = importlib.util.spec_from_file_location("raw_fruit_catalog", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    try:
        with factory() as db:
            module.import_catalog(db)
        fruit = browser.get("/api/v1/groceries/products/APPLE").json()
        choices = {o["id"]: o for o in fruit["details"]["preparation_options"]}
        assert set(choices) == {"whole", "cleaned", "cut-only", "cut"}
        assert choices["cleaned"]["enabled"]
        assert choices["cleaned"]["fee_unit"] == "kg"
        for sku in ("MILK", "EGGS", "BEEF-MINCE", "BREAD"):
            options = browser.get("/api/v1/groceries/products/" + sku).json()["details"][
                "preparation_options"
            ]
            assert [o["id"] for o in options] == ["whole"]
            assert options[0]["name_en"] == "Original pack"
    finally:
        settings.cache_clear()
