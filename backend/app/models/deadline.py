"""Deadline model — tracks all critical dates and their alert status."""

import enum
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DeadlineStatus(str, enum.Enum):
    upcoming = "upcoming"
    warning = "warning"   # T-3 or closer
    missed = "missed"
    completed = "completed"


class Deadline(Base):
    __tablename__ = "deadlines"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[DeadlineStatus] = mapped_column(
        Enum(DeadlineStatus, name="deadline_status_enum"),
        nullable=False,
        default=DeadlineStatus.upcoming,
        index=True,
    )
    alert_t3_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    alert_t1_sent: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Stable normalized matching key — populated by intake.py via normalize_name().
    # NULL on rows created before migration 0014; backfilled on first re-parse.
    canonical_key: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    transaction: Mapped["Transaction"] = relationship(  # noqa: F821
        "Transaction", back_populates="deadlines"
    )
