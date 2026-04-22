"""Market Overview models — watchlist, properties, alerts."""

from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MarketWatchlist(Base):
    __tablename__ = "market_watchlist"
    __table_args__ = (UniqueConstraint("user_id", "zip_code", name="uq_watchlist_user_zip"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    zip_code: Mapped[str] = mapped_column(String(10), nullable=False)
    alert_threshold: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class MarketProperty(Base):
    __tablename__ = "market_properties"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    zip_code: Mapped[str] = mapped_column(String(10), nullable=False, index=True)
    zillow_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True, index=True)
    address: Mapped[str] = mapped_column(String(500), nullable=False)
    price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bedrooms: Mapped[int | None] = mapped_column(Integer, nullable=True)
    bathrooms: Mapped[float | None] = mapped_column(Float, nullable=True)
    living_area: Mapped[int | None] = mapped_column(Integer, nullable=True)
    year_built: Mapped[int | None] = mapped_column(Integer, nullable=True)
    days_on_market: Mapped[int | None] = mapped_column(Integer, nullable=True)
    zestimate: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price_reduction_30d: Mapped[int | None] = mapped_column(Integer, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    img_src: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    nearest_permit_distance_mi: Mapped[float | None] = mapped_column(Float, nullable=True)
    nearest_permit_type: Mapped[str | None] = mapped_column(String(200), nullable=True)
    nearest_permit_date: Mapped[str | None] = mapped_column(String(50), nullable=True)
    nearest_permit_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    opportunity_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    claude_summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    alerts: Mapped[list["MarketAlert"]] = relationship("MarketAlert", back_populates="property", cascade="all, delete-orphan")


class MarketAlert(Base):
    __tablename__ = "market_alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    property_id: Mapped[int] = mapped_column(ForeignKey("market_properties.id", ondelete="CASCADE"), nullable=False, index=True)
    score_at_alert: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    alerted_via: Mapped[str] = mapped_column(String(50), nullable=False, default="both")
    fired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    property: Mapped["MarketProperty"] = relationship("MarketProperty", back_populates="alerts")
