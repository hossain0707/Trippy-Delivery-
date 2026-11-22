"""Authorized COD activation runs once and preserves online payment configuration."""

from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, select

from alembic import command
from app.core.database import Base
from app.modules.commerce.models import ServiceSetting


def test_cod_activation_preserves_other_settings_and_later_owner_disable():
    root = Path(__file__).resolve().parents[1]
    cfg = Config(str(root / "alembic.ini"))
    cfg.set_main_option("script_location", str(root / "alembic"))
    engine = create_engine("sqlite+pysqlite:///:memory:")
    table = ServiceSetting.__table__
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        Base.metadata.create_all(conn, tables=[t for t in Base.metadata.sorted_tables if not t.name.startswith("login_")])
        command.stamp(cfg, "0004_checkout_defaults")
        original = {
            "cod_enabled": False,
            "nagad": {"enabled": False, "instructions": "Keep owner text"},
        }
        conn.execute(table.insert().values(key="payments", value=original))
        command.upgrade(cfg, "head")
        value = conn.execute(select(table.c.value).where(table.c.key == "payments")).scalar_one()
        assert value == {**original, "cod_enabled": True}
        conn.execute(table.update().where(table.c.key == "payments").values(value=original))
        command.upgrade(cfg, "head")
        assert (
            conn.execute(select(table.c.value).where(table.c.key == "payments")).scalar_one()
            == original
        )
        command.check(cfg)
    engine.dispose()
