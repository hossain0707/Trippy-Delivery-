"""Apply reviewed additive migrations under a PostgreSQL transaction lock, then serve.

No infrastructure is created. A migration failure prevents this revision becoming ready.
"""

import os
import sys
from pathlib import Path

from alembic.config import Config
from sqlalchemy import create_engine, text

from alembic import command
from app.core.config import settings


def migrate():
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    # Config paths stay independent of the shell's current directory.
    config.set_main_option("script_location", str(Path(__file__).resolve().parents[1] / "alembic"))
    engine = create_engine(settings().database_url, pool_pre_ping=True)
    try:
        with engine.begin() as connection:
            if connection.dialect.name == "postgresql":
                connection.execute(text("SELECT pg_advisory_xact_lock(7287192026)"))
            config.attributes["connection"] = connection
            command.upgrade(config, "head")
            command.check(config)
            # Seed catalog content only: approved prices and stock are never fabricated.
            import importlib.util

            from sqlalchemy.orm import Session

            path = Path(__file__).with_name("import_catalog.py")
            spec = importlib.util.spec_from_file_location("catalog_import", path)
            module = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(module)
            with Session(bind=connection) as db:
                module.import_catalog(db)

    finally:
        engine.dispose()


if __name__ == "__main__":
    migrate()
    os.execv(
        sys.executable,
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "0.0.0.0",
            "--port",
            os.environ.get("PORT", "8000"),
        ],
    )
