"""Transaction model — the core deal record."""

import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TransactionStatus(str, enum.Enum):
    active = "active"
    closed = "closed"
    cancelled = "cancelled"


class PropertyType(str, enum.Enum):
    sfh = "sfh"
    condo = "condo"
    townhouse = "townhouse"
    multi_family = "multi_family"
    other = "other"


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    property_type: Mapped[PropertyType] = mapped_column(
        Enum(PropertyType, name="property_type_enum"), nullable=False, default=PropertyType.sfh
    )
    status: Mapped[TransactionStatus] = mapped_column(
        Enum(TransactionStatus, name="transaction_status_enum"),
        nullable=False,
        default=TransactionStatus.active,
        index=True,
    )
    purchase_price: Mapped[float | None] = mapped_column(Numeric(12, 2), nullable=True)
    closing_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    contract_execution_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user: Mapped["User"] = relationship("User", back_populates="transactions")  # noqa: F821
    parties: Mapped[list["Party"]] = relationship(  # noqa: F821
        "Party", back_populates="transaction", cascade="all, delete-orphan", lazy="select"
    )
    documents: Mapped[list["Document"]] = relationship(  # noqa: F821
        "Document", back_populates="transaction", cascade="all, delete-orphan", lazy="select"
    )
    deadlines: Mapped[list["Deadline"]] = relationship(  # noqa: F821
        "Deadline", back_populates="transaction", cascade="all, delete-orphan", lazy="select"
    )
    events: Mapped[list["Event"]] = relationship(  # noqa: F821
        "Event", back_populates="transaction", cascade="all, delete-orphan", lazy="select"
    )
