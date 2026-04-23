"""Broker/agent user model for authentication."""

import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class UserRole(str, enum.Enum):
    broker = "broker"
    agent = "agent"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    brokerage_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default=UserRole.broker.value,
        server_default=UserRole.broker.value,
    )
    brokerage_id: Mapped[int | None] = mapped_column(
        ForeignKey("brokerages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    brokerage: Mapped["Brokerage | None"] = relationship(  # noqa: F821
        "Brokerage", back_populates="users"
    )
    transactions: Mapped[list["Transaction"]] = relationship(  # noqa: F821
        "Transaction", back_populates="user", lazy="select"
    )
    email_templates: Mapped[list["EmailTemplate"]] = relationship(  # noqa: F821
        "EmailTemplate", back_populates="user", cascade="all, delete-orphan", lazy="select"
    )
