"""Catalog metadata, manual payments and safe pilot operations."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0003_commerce_pilot"
down_revision = "0002_customer_profiles"
branch_labels = None
depends_on = None


def upgrade():
    data = sa.JSON().with_variant(JSONB, "postgresql")
    op.add_column(
        "products",
        sa.Column("price_approved", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "products", sa.Column("details", data, nullable=False, server_default=sa.text("'{}'"))
    )
    op.add_column(
        "delivery_partners",
        sa.Column("details", data, nullable=False, server_default=sa.text("'{}'")),
    )
    for column in [
        sa.Column("order_number", sa.String(45), nullable=True),
        sa.Column("payment_method", sa.String(20), nullable=False, server_default="cod"),
        sa.Column("payment_status", sa.String(30), nullable=False, server_default="unpaid"),
        sa.Column("delivery_fee_bdt", sa.Numeric(12, 2), nullable=False, server_default="0"),
        sa.Column("checkout_data", data, nullable=False, server_default=sa.text("'{}'")),
        sa.Column("courier_id", sa.String(36), nullable=True),
    ]:
        op.add_column("grocery_orders", column)
    op.create_unique_constraint("uq_grocery_order_number", "grocery_orders", ["order_number"])
    op.create_foreign_key(
        "fk_grocery_courier", "grocery_orders", "delivery_partners", ["courier_id"], ["id"]
    )
    op.create_table(
        "service_settings",
        sa.Column("key", sa.String(60), primary_key=True),
        sa.Column("value", data, nullable=False),
    )
    op.create_table(
        "commerce_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("entity_type", sa.String(30), nullable=False),
        sa.Column("entity_id", sa.String(128), nullable=False),
        sa.Column("event", sa.String(60), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("details", data, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_commerce_entity_time", "commerce_events", ["entity_type", "entity_id", "created_at"]
    )


def downgrade():
    op.drop_table("commerce_events")
    op.drop_table("service_settings")
    op.drop_constraint("fk_grocery_courier", "grocery_orders", type_="foreignkey")
    op.drop_constraint("uq_grocery_order_number", "grocery_orders", type_="unique")
    for name in [
        "order_number",
        "payment_method",
        "payment_status",
        "delivery_fee_bdt",
        "checkout_data",
        "courier_id",
    ]:
        op.drop_column("grocery_orders", name)
    op.drop_column("delivery_partners", "details")
    op.drop_column("products", "details")
    op.drop_column("products", "price_approved")
