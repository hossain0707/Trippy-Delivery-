"""Initial separated parcel, grocery, courier and audit schema."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None

json_type = sa.JSON().with_variant(JSONB, "postgresql")


def upgrade():
    op.create_table("products",
        sa.Column("sku", sa.String(50), primary_key=True),
        sa.Column("name_en", sa.String(160), nullable=False),
        sa.Column("name_bn", sa.String(160), nullable=False),
        sa.Column("category", sa.String(20), nullable=False),
        sa.Column("unit", sa.String(20), nullable=False),
        sa.Column("price_bdt", sa.Numeric(12, 2), nullable=False),
        sa.Column("processing_fee_bdt", sa.Numeric(12, 2), nullable=False),
        sa.Column("stock_qty", sa.Numeric(12, 3), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False))
    op.create_table("parcels",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tracking_code", sa.String(30), nullable=False),
        sa.Column("customer_id", sa.String(128), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("sender", json_type, nullable=False),
        sa.Column("recipient", json_type, nullable=False),
        sa.Column("package", json_type, nullable=False),
        sa.Column("amount_bdt", sa.Integer(), nullable=False),
        sa.Column("distance_km", sa.Numeric(8, 2), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("customer_id", "idempotency_key", name="uq_parcel_idempotency"))
    op.create_index("ix_parcels_tracking_code", "parcels", ["tracking_code"], unique=True)
    op.create_index("ix_parcels_customer_id", "parcels", ["customer_id"])
    op.create_index("ix_parcel_owner_created", "parcels", ["customer_id", "created_at"])
    op.create_table("parcel_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("parcel_id", sa.String(36), sa.ForeignKey("parcels.id", ondelete="CASCADE"), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_parcel_events_parcel_id", "parcel_events", ["parcel_id"])
    op.create_table("grocery_orders",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("customer_id", sa.String(128), nullable=False),
        sa.Column("idempotency_key", sa.String(120), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column("destination", json_type, nullable=False),
        sa.Column("amount_bdt", sa.Numeric(12, 2), nullable=False),
        sa.Column("delivery_deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(30), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("customer_id", "idempotency_key", name="uq_grocery_idempotency"))
    op.create_index("ix_grocery_owner_created", "grocery_orders", ["customer_id", "created_at"])
    op.create_table("grocery_order_lines",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("order_id", sa.String(36), sa.ForeignKey("grocery_orders.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sku", sa.String(50), sa.ForeignKey("products.sku"), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("preparation", sa.String(20), nullable=False),
        sa.Column("amount_bdt", sa.Numeric(12, 2), nullable=False))
    op.create_index("ix_grocery_order_lines_order_id", "grocery_order_lines", ["order_id"])
    op.create_table("delivery_partners",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(128), nullable=False, unique=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("transport_mode", sa.String(40), nullable=False),
        sa.Column("approved_by", sa.String(128), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_table("audit_records",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("actor_id", sa.String(128), nullable=False),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("entity_type", sa.String(60), nullable=False),
        sa.Column("entity_id", sa.String(100), nullable=False),
        sa.Column("details", json_type, nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False))
    op.create_index("ix_audit_actor_time", "audit_records", ["actor_id", "created_at"])


def downgrade():
    op.drop_table("audit_records")
    op.drop_table("delivery_partners")
    op.drop_table("grocery_order_lines")
    op.drop_table("grocery_orders")
    op.drop_table("parcel_events")
    op.drop_table("parcels")
    op.drop_table("products")
