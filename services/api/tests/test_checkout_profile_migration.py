"""Upgrade a populated older profile schema without dropping saved customer identity."""
from pathlib import Path
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text
from app.core.database import Base


def test_checkout_defaults_migration_preserves_existing_profiles():
    api_root = Path(__file__).resolve().parents[1]
    cfg = Config(str(api_root / "alembic.ini"))
    cfg.set_main_option("script_location", str(api_root / "alembic"))
    engine = create_engine("sqlite+pysqlite:///:memory:")
    with engine.begin() as conn:
        cfg.attributes["connection"] = conn
        Base.metadata.create_all(conn, tables=[t for t in Base.metadata.sorted_tables if not t.name.startswith("login_")])
        conn.execute(text("ALTER TABLE customer_profiles DROP COLUMN checkout_defaults"))
        command.stamp(cfg, "0003_commerce_pilot")
        conn.execute(text("INSERT INTO customer_profiles (subject,email,name,phone,language,updated_at) VALUES ('google:existing','existing@example.com','Existing customer','01712345678','bn','2026-11-22 00:00:00')"))
        command.upgrade(cfg, "head")
        row = conn.execute(text("SELECT subject,name,phone,language,checkout_defaults FROM customer_profiles")).one()
        assert row[:4] == ("google:existing", "Existing customer", "01712345678", "bn")
        assert row.checkout_defaults == "{}"
        command.check(cfg)
    engine.dispose()
