from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import JSON

from app.core.database import Base


class Product(Base):
    __tablename__ = "products"
    sku: Mapped[str] = mapped_column(String(50), primary_key=True)
    name_en: Mapped[str] = mapped_column(String(160), nullable=False)
    name_bn: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(20), nullable=False)  # fresh | dry
    unit: Mapped[str] = mapped_column(String(20), nullable=False)
    price_bdt: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    processing_fee_bdt: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    stock_qty: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    active: Mapped[bool] = mapped_column(nullable=False, default=True)


class GroceryOrder(Base):
    __tablename__ = "grocery_orders"
    __table_args__ = (
        UniqueConstraint("customer_id", "idempotency_key", name="uq_grocery_idempotency"),
        Index("ix_grocery_owner_created", "customer_id", "created_at"),
    )
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    customer_id: Mapped[str] = mapped_column(String(128), nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(120), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    destination: Mapped[dict] = mapped_column(JSON().with_variant(JSONB, "postgresql"), nullable=False)
    amount_bdt: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    delivery_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="placed", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class GroceryLine(Base):
    __tablename__ = "grocery_order_lines"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    order_id: Mapped[str] = mapped_column(ForeignKey("grocery_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    sku: Mapped[str] = mapped_column(ForeignKey("products.sku"), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    preparation: Mapped[str] = mapped_column(String(20), nullable=False)
    amount_bdt: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
