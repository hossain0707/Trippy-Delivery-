"""Idempotent catalog import. Existing SKUs and owner edits are never overwritten."""

import json
from pathlib import Path

from sqlalchemy import select

from app.core.database import session_factory
from app.modules.commerce.schemas import CatalogContent
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
    db.commit()
    return {
        "version": document["version"],
        "added": added,
        "total_source": len(document["products"]),
    }


if __name__ == "__main__":
    with session_factory()() as db:
        print(json.dumps(import_catalog(db)))
