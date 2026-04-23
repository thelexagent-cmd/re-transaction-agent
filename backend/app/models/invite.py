"""Invite model — single-use links for agents to join a brokerage."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Invite(Base):
    __tablename__ = "invites"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    # 32-byte urlsafe token — ~256 bits of entropy, unguessable
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    brokerage_id: Mapped[int] = mapped_column(
        ForeignKey("brokerages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    invited_by_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    # Optional: pre-populate the signup form with this email
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    used_by_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    brokerage: Mapped["Brokerage"] = relationship(  # noqa: F821
        "Brokerage", back_populates="invites"
    )
    invited_by: Mapped["User"] = relationship(  # noqa: F821
        "User", foreign_keys=[invited_by_id]
    )
    used_by: Mapped["User | None"] = relationship(  # noqa: F821
        "User", foreign_keys=[used_by_id]
    )
