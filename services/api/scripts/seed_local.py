"""OPTIONAL local example inventory. Never run against staging/production."""
from decimal import Decimal

from app.core.config import settings
from app.core.database import session_factory
from app.modules.groceries.models import Product


def main():
    if settings().app_env not in ("local", "test"):
        raise RuntimeError("Sample catalog is only allowed in local/test")
    sample = [
        ("FISH-ROHU", "Rohu Fish", "রুই মাছ", "fresh", "kg", "350", "30", "25"),
        ("VEG-POTATO", "Potatoes", "আলু", "fresh", "kg", "60", "10", "80"),
        ("CHICKEN", "Broiler Chicken", "ব্রয়লার মুরগি", "fresh", "kg", "210", "25", "40"),
        ("RICE", "Miniket Rice", "মিনিকেট চাল", "dry", "kg", "75", "0", "200"),
        ("DAL", "Masoor Lentils", "মসুর ডাল", "dry", "kg", "125", "0", "120"),
    ]
    with session_factory()() as db:
        for sku, en, bn, group, unit, price, fee, stock in sample:
            if not db.get(Product, sku):
                db.add(Product(sku=sku, name_en=en, name_bn=bn, category=group,
                               unit=unit, price_bdt=Decimal(price),
                               processing_fee_bdt=Decimal(fee),
                               stock_qty=Decimal(stock), active=True))
        db.commit()


if __name__ == "__main__":
    main()
