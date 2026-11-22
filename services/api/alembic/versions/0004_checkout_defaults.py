"""Persist customer checkout defaults without changing verified identity."""
from alembic import op
import sqlalchemy as sa
revision = "0004_checkout_defaults"
down_revision = "0003_commerce_pilot"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("customer_profiles", sa.Column("checkout_defaults", sa.JSON(), nullable=False, server_default=sa.text("'{}'")))


def downgrade():
    op.drop_column("customer_profiles", "checkout_defaults")
