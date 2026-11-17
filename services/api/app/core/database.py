from functools import lru_cache
from typing import Generator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


@lru_cache
def engine():
    return create_engine(settings().database_url, pool_pre_ping=True, pool_recycle=1800)


@lru_cache
def session_factory():
    return sessionmaker(bind=engine(), autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    with session_factory()() as db:
        yield db


def is_ready() -> bool:
    with engine().connect() as conn:
        conn.execute(text("SELECT 1"))
    return True
