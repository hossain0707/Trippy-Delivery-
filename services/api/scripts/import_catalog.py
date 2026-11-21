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
    priced = import_market_prices(db)
    db.commit()
    return {
        "priced": priced,
        "version": document["version"],
        "added": added,
        "total_source": len(document["products"]),
    }


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
