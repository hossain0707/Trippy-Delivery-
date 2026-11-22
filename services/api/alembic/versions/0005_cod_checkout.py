"""Activate owner-authorized COD intake; leave online payment configuration intact."""

import sqlalchemy as sa

from alembic import op

revision = "0005_cod_checkout"
down_revision = "0004_checkout_defaults"
branch_labels = None
depends_on = None


def upgrade():
    settings = sa.table(
        "service_settings", sa.column("key", sa.String()), sa.column("value", sa.JSON())
    )
    connection = op.get_bind()
    value = connection.execute(
        sa.select(settings.c.value).where(settings.c.key == "payments")
    ).scalar_one_or_none()
    if value is None:
        connection.execute(settings.insert().values(key="payments", value={"cod_enabled": True}))
    else:
        connection.execute(
            settings.update()
            .where(settings.c.key == "payments")
            .values(value={**value, "cod_enabled": True})
        )

    pilot = connection.execute(
        sa.select(settings.c.value).where(settings.c.key == "pilot")
    ).scalar_one_or_none()
    if pilot is not None:
        updated = dict(pilot)
        if (
            updated.get("banner_en")
            == "Our Dhaka market is getting ready. Ordering opens after owner approval."
        ):
            updated["banner_en"] = (
                "Cash on delivery in Dhaka. Orders are confirmed after store availability checks."
            )
        if updated.get("banner_bn") == "ঢাকায় আমাদের বাজার প্রস্তুত হচ্ছে। অনুমোদনের পরে অর্ডার চালু হবে।":
            updated["banner_bn"] = "ঢাকায় ক্যাশ অন ডেলিভারি। দোকানের মজুত যাচাইয়ের পরে অর্ডার নিশ্চিত করা হবে।"
        if updated != pilot:
            connection.execute(
                settings.update().where(settings.c.key == "pilot").values(value=updated)
            )


def downgrade():
    settings = sa.table(
        "service_settings", sa.column("key", sa.String()), sa.column("value", sa.JSON())
    )
    connection = op.get_bind()
    value = connection.execute(
        sa.select(settings.c.value).where(settings.c.key == "payments")
    ).scalar_one_or_none()
    if value is not None:
        connection.execute(
            settings.update()
            .where(settings.c.key == "payments")
            .values(value={**value, "cod_enabled": False})
        )
