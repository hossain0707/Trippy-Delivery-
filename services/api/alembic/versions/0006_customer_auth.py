"""Persistent authentication, preserving all existing Google subjects and profiles."""

from alembic import op
import sqlalchemy as sa

revision = "0006_customer_auth"
down_revision = "0005_cod_checkout"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "login_identities",
        sa.Column("subject", sa.String(128), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("password_hash", sa.String(300)),
        sa.Column("verified", sa.Boolean(), nullable=False),
        sa.Column("provider", sa.String(20), nullable=False),
    )
    op.create_table(
        "login_sessions",
        sa.Column("digest", sa.String(64), primary_key=True),
        sa.Column(
            "subject", sa.String(128), sa.ForeignKey("login_identities.subject"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_sessions_subject", "login_sessions", ["subject"])
    op.create_table(
        "login_access_grants",
        sa.Column("digest", sa.String(64), primary_key=True),
        sa.Column(
            "session_digest", sa.String(64), sa.ForeignKey("login_sessions.digest"), nullable=False
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index(
        "ix_login_access_grants_session_digest", "login_access_grants", ["session_digest"]
    )
    op.create_table(
        "login_email_challenges",
        sa.Column("digest", sa.String(64), primary_key=True),
        sa.Column(
            "subject", sa.String(128), sa.ForeignKey("login_identities.subject"), nullable=False
        ),
        sa.Column("purpose", sa.String(12), nullable=False),
        sa.Column("password_hash", sa.String(300)),
        sa.Column("name", sa.String(120)),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False),
    )
    op.create_index("ix_login_email_challenges_subject", "login_email_challenges", ["subject"])
    op.create_table(
        "login_attempts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("key", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_login_attempts_key", "login_attempts", ["key"])


def downgrade():
    for name in (
        "login_attempts",
        "login_email_challenges",
        "login_access_grants",
        "login_sessions",
        "login_identities",
    ):
        op.drop_table(name)
