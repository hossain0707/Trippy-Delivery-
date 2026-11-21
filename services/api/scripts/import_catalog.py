"""Idempotent catalog import. Existing SKUs and owner edits are never overwritten."""

import json
from pathlib import Path

from sqlalchemy import select

from app.core.database import session_factory
from app.modules.commerce.schemas import CatalogContent, MarketPrice
from decimal import Decimal
from app.modules.groceries.models import Product


def import_catalog(db, source=None):
    source = source or Path(__file__).resolve().parents[1] / "catalog/bd-groceries-v1.json"
    document = json.loads(Path(source).read_text())
    added = 0
    existing = set(db.scalars(select(Product.sku)).all())
    for item in document["products"]:
        if item["sku"] in existing:
            continue
        item["details"] = CatalogContent.model_validate(item["details"]).model_dump(mode="json")
        if item["price_approved"] or item["stock_qty"] != "0":
            raise ValueError("Catalog seeds cannot invent approved stock or prices")
        db.add(Product(**item))
        added += 1
    import_shopping_tariff(db)
    priced = import_market_prices(db)
    photos = import_real_photos(db)
    db.commit()
    return {
        "priced": priced,
        "photos": photos,
        "version": document["version"],
        "added": added,
        "total_source": len(document["products"]),
    }


def import_shopping_tariff(db):
    """Apply the owner's 21-Nov preparation tariff once; retain all later admin edits."""
    from app.modules.commerce.models import ServiceSetting
    marker = "shopping_tariff_2026_11_21"
    if db.get(ServiceSetting, marker):
        return
    row = db.get(ServiceSetting, "pilot")
    if row is None:
        row = ServiceSetting(key="pilot", value={})
        db.add(row)
    value = dict(row.value or {})
    value.setdefault("delivery_base_area", "Uttara")
    value.setdefault("delivery_base_fee_bdt", "30.00")
    value.setdefault("delivery_per_km_bdt", "5.00")
    for key, amount in {
        "preparation_cleaned_fee_bdt":"10.00",
        "preparation_cut_only_fee_bdt":"15.00",
        "preparation_cut_fee_bdt":"20.00",
    }.items():
        value.setdefault(key, amount)
    row.value = value
    db.add(ServiceSetting(key=marker, value={"source":"Owner instruction, 21 November 2026", "unit":"per ordered kg", "packaging":"Transparent food-safe wrapping included"}))


def import_real_photos(db):
    path = Path(__file__).resolve().parents[1] / "catalog/real-photo-sources.json"
    if not path.exists():
        return 0
    sources = json.loads(path.read_text())
    bases = json.loads((path.parent / "bd-groceries-v1.json").read_text())
    original = {p["sku"]: p["details"]["image"] for p in bases["products"]}
    changed = 0
    db.flush()
    for product in db.scalars(select(Product)):
        details = dict(product.details)
        # Retain explicitly approved or changed owner photography.
        if details.get("images_approved") or (
            details.get("image")
            and not details.get("photo_credit")
            and details.get("image") != original.get(product.sku)
        ):
            continue
        source = sources.get(product.sku)
        if source:
            details["image"] = source["image"]
            details["photo_credit"] = {k: v for k, v in source.items() if k != "image"}
        else:
            # Never keep an unverified legacy/generated picture as a fallback.
            details["image"] = ""
            details["photo_credit"] = None
        product.details = details
        changed += 1
    return changed


def import_market_prices(db, source=None):
    """Apply this dated owner-authorized price selection once to untouched zero-price SKUs.

    Never creates stock, enables checkout or overwrites subsequent owner prices/units.
    """
    source = source or Path(__file__).resolve().parents[1] / "catalog/market-prices-2026-11-21.json"
    document = json.loads(Path(source).read_text())
    changed = 0
    db.flush()
    for raw in document["prices"]:
        sku = raw["sku"]
        quote = MarketPrice.model_validate({k: v for k, v in raw.items() if k != "sku"})
        product = db.get(Product, sku)
        if (
            product is None
            or product.price_approved
            or product.price_bdt != 0
            or product.stock_qty != 0
        ):
            continue
        # A prior snapshot means an owner deliberately reset this SKU: preserve that edit too.
        if product.details.get("market_price"):
            continue
        details = dict(product.details)
        details["market_price"] = quote.model_dump(mode="json")
        details["packaging"] = quote.basis
        if quote.unit in ("piece", "bundle", "pack"):
            details["minimum_quantity"] = "1"
            details["quantity_step"] = "1"
        product.unit = quote.unit
        product.price_bdt = Decimal(quote.amount_bdt)
        product.price_approved = True
        product.details = details
        changed += 1
    return changed


if __name__ == "__main__":
    with session_factory()() as db:
        print(json.dumps(import_catalog(db)))
