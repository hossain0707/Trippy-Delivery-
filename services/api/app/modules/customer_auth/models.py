from datetime import UTC, datetime
from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


def now():
    return datetime.now(UTC)


class LoginIdentity(Base):
    __tablename__ = "login_identities"
    subject: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str | None] = mapped_column(String(300))
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    provider: Mapped[str] = mapped_column(String(20))


class LoginSession(Base):
    __tablename__ = "login_sessions"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    subject: Mapped[str] = mapped_column(ForeignKey("login_identities.subject"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)


class AccessGrant(Base):
    __tablename__ = "login_access_grants"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    session_digest: Mapped[str] = mapped_column(ForeignKey("login_sessions.digest"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EmailChallenge(Base):
    __tablename__ = "login_email_challenges"
    digest: Mapped[str] = mapped_column(String(64), primary_key=True)
    subject: Mapped[str] = mapped_column(ForeignKey("login_identities.subject"), index=True)
    purpose: Mapped[str] = mapped_column(String(12))
    password_hash: Mapped[str | None] = mapped_column(String(300))
    name: Mapped[str | None] = mapped_column(String(120))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class LoginAttempt(Base):
    __tablename__ = "login_attempts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    key: Mapped[str] = mapped_column(String(64), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now)
