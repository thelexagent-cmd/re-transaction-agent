"""Party model — all participants in a real estate transaction."""

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PartyRole(str, enum.Enum):
    buyer = "buyer"
    seller = "seller"
    buyers_agent = "buyers_agent"
    listing_agent = "listing_agent"
    lender = "lender"
    title = "title"
    escrow = "escrow"
    hoa = "hoa"


class Party(Base):
    __tablename__ = "parties"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    transaction_id: Mapped[int] = mapped_column(
        ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[PartyRole] = mapped_column(
        Enum(PartyRole, name="party_role_enum"), nullable=False
    )
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    preferred_language: Mapped[str] = mapped_column(String(10), nullable=False, server_default="en")
    is_foreign_national: Mapped[bool] = mapped_column(Boolean(), nullable=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    transaction: Mapped["Transaction"] = relationship(  # noqa: F821
        "Transaction", back_populates="parties"
    )
