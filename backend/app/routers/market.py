"""Market Overview API endpoints."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.market import MarketAlert, MarketProperty, MarketWatchlist
from app.models.user import User

router = APIRouter(prefix="/market", tags=["market"])
logger = logging.getLogger(__name__)


# ── Schemas ───────────────────────────────────────────────────────────────────

class WatchlistCreate(BaseModel):
    zip_code: str
    alert_threshold: int = 40

    @field_validator("zip_code")
    @classmethod
    def validate_zip(cls, v: str) -> str:
        v = v.strip()
        if not v.isdigit() or len(v) != 5:
            raise ValueError("ZIP code must be exactly 5 digits")
        return v

    @field_validator("alert_threshold")
    @classmethod
    def validate_threshold(cls, v: int) -> int:
        if not 1 <= v <= 100:
            raise ValueError("Alert threshold must be between 1 and 100")
        return v


class WatchlistUpdate(BaseModel):
    alert_threshold: int | None = None
    status: str | None = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str | None) -> str | None:
        if v is not None and v not in ("active", "paused"):
            raise ValueError("Status must be active or paused")
        return v


class AlertStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_alert_status(cls, v: str) -> str:
        if v not in ("new", "reviewed", "interested", "passed"):
            raise ValueError("Status must be new, reviewed, interested, or passed")
        return v


# ── Watchlist ─────────────────────────────────────────────────────────────────

@router.get("/watchlist")
async def list_watchlist(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(MarketWatchlist)
        .where(MarketWatchlist.user_id == current_user.id)
        .order_by(MarketWatchlist.created_at.asc())
    )
    return [_watchlist_dict(e) for e in result.scalars().all()]


@router.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_watchlist(
    body: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    existing = await db.execute(
        select(MarketWatchlist).where(
            MarketWatchlist.user_id == current_user.id,
            MarketWatchlist.zip_code == body.zip_code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="ZIP code already in watchlist")
    entry = MarketWatchlist(
        user_id=current_user.id,
        zip_code=body.zip_code,
        alert_threshold=body.alert_threshold,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return _watchlist_dict(entry)


@router.patch("/watchlist/{entry_id}")
async def update_watchlist(
    entry_id: int,
    body: WatchlistUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    entry = await _require_watchlist_entry(entry_id, current_user.id, db)
    if body.alert_threshold is not None:
        entry.alert_threshold = body.alert_threshold
    if body.status is not None:
        entry.status = body.status
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return _watchlist_dict(entry)


@router.delete("/watchlist/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_watchlist(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    entry = await _require_watchlist_entry(entry_id, current_user.id, db)
    await db.delete(entry)


@router.post("/watchlist/{entry_id}/scan")
async def trigger_scan(
    entry_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    entry = await _require_watchlist_entry(entry_id, current_user.id, db)
    from app.services.market_alerts import maybe_fire_alert
    from app.services.market_scanner import scan_zip

    property_results = await scan_zip(entry.zip_code, db)
    alerted = 0
    for prop_id, score in property_results:
        fired = await maybe_fire_alert(
            db=db, user_id=current_user.id, property_id=prop_id,
            current_score=score, threshold=entry.alert_threshold,
        )
        if fired:
            alerted += 1
    await db.execute(
        update(MarketWatchlist)
        .where(MarketWatchlist.id == entry_id)
        .values(last_scanned_at=datetime.now(timezone.utc))
    )
    await db.flush()
    await db.commit()
    return {"scanned": len(property_results), "alerted": alerted, "zip_code": entry.zip_code}


# ── Properties ────────────────────────────────────────────────────────────────

@router.get("/properties/{zip_code}")
async def get_properties(
    zip_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    watchlist_entry = await db.scalar(
        select(MarketWatchlist).where(
            MarketWatchlist.user_id == current_user.id,
            MarketWatchlist.zip_code == zip_code,
        )
    )
    if not watchlist_entry:
        raise HTTPException(status_code=404, detail="ZIP code not in your watchlist")
    result = await db.execute(
        select(MarketProperty)
        .where(MarketProperty.zip_code == zip_code)
        .order_by(MarketProperty.opportunity_score.desc().nullslast())
        .limit(50)
    )
    return [_property_dict(p) for p in result.scalars().all()]


# ── Alerts ────────────────────────────────────────────────────────────────────

@router.get("/alerts")
async def list_alerts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(MarketAlert, MarketProperty)
        .join(MarketProperty, MarketAlert.property_id == MarketProperty.id)
        .where(MarketAlert.user_id == current_user.id)
        .order_by(MarketAlert.fired_at.desc())
        .limit(100)
    )
    return [
        {**_alert_dict(alert), "property": _property_dict(prop)}
        for alert, prop in result.all()
    ]


@router.patch("/alerts/{alert_id}")
async def update_alert_status(
    alert_id: int,
    body: AlertStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(MarketAlert).where(
            MarketAlert.id == alert_id,
            MarketAlert.user_id == current_user.id,
        )
    )
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    alert.status = body.status
    db.add(alert)
    await db.flush()
    await db.commit()
    await db.refresh(alert)
    prop_result = await db.execute(select(MarketProperty).where(MarketProperty.id == alert.property_id))
    prop = prop_result.scalar_one_or_none()
    return {**_alert_dict(alert), "property": _property_dict(prop) if prop else None}


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _require_watchlist_entry(
    entry_id: int, user_id: int, db: AsyncSession
) -> MarketWatchlist:
    result = await db.execute(
        select(MarketWatchlist).where(
            MarketWatchlist.id == entry_id,
            MarketWatchlist.user_id == user_id,
        )
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Watchlist entry not found")
    return entry


def _watchlist_dict(e: MarketWatchlist) -> dict:
    return {
        "id": e.id, "zip_code": e.zip_code, "alert_threshold": e.alert_threshold,
        "status": e.status, "created_at": e.created_at.isoformat(),
        "last_scanned_at": e.last_scanned_at.isoformat() if e.last_scanned_at else None,
    }


def _property_dict(p: MarketProperty) -> dict:
    return {
        "id": p.id, "zip_code": p.zip_code, "zillow_id": p.zillow_id, "address": p.address,
        "price": p.price, "bedrooms": p.bedrooms, "bathrooms": p.bathrooms,
        "living_area": p.living_area, "year_built": p.year_built,
        "days_on_market": p.days_on_market, "zestimate": p.zestimate,
        "price_reduction_30d": p.price_reduction_30d, "latitude": p.latitude,
        "longitude": p.longitude, "img_src": p.img_src,
        "nearest_permit_distance_mi": p.nearest_permit_distance_mi,
        "nearest_permit_type": p.nearest_permit_type,
        "nearest_permit_date": p.nearest_permit_date,
        "nearest_permit_address": p.nearest_permit_address,
        "opportunity_score": p.opportunity_score, "claude_summary": p.claude_summary,
        "score_breakdown": p.score_breakdown,
        "first_seen_at": p.first_seen_at.isoformat(),
        "last_updated_at": p.last_updated_at.isoformat(),
    }


def _alert_dict(a: MarketAlert) -> dict:
    return {
        "id": a.id, "property_id": a.property_id, "score_at_alert": a.score_at_alert,
        "status": a.status, "alerted_via": a.alerted_via, "fired_at": a.fired_at.isoformat(),
    }
