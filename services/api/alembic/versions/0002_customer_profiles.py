"""Persist verified identity customer profiles."""
from alembic import op
import sqlalchemy as sa
revision = "0002_customer_profiles"
down_revision = "0001_initial"
branch_labels = None
depends_on = None

def upgrade():
    op.add_column("parcels", sa.Column("courier_id", sa.String(36), sa.ForeignKey("delivery_partners.id"), nullable=True))
    op.create_table("customer_profiles", sa.Column("subject", sa.String(128), primary_key=True), sa.Column("email", sa.String(320)), sa.Column("name", sa.String(120)), sa.Column("phone", sa.String(20), nullable=False), sa.Column("language", sa.String(2), nullable=False), sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False))

def downgrade():
    op.drop_column("parcels", "courier_id")
    op.drop_table("customer_profiles")
