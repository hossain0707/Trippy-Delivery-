from datetime import UTC, datetime

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"
    subject: Mapped[str] = mapped_column(String(128), primary_key=True)
    email: Mapped[str | None] = mapped_column(String(320))
    name: Mapped[str | None] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), default="")
    language: Mapped[str] = mapped_column(String(2), default="en")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
