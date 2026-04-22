# Lex Market Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/market` section to the existing Lex CRM that watches Miami/South Florida ZIP codes nightly, scores listings on 5 signals, and alerts Nico via Telegram + email when opportunity score ≥ 60.

**Architecture:** New `market` router + 3 DB tables + Celery nightly task embedded in the existing FastAPI/Railway/Next.js stack. External data: Zillow RapidAPI (paid), US Census API (free), Miami-Dade Permit API (free). Claude Haiku synthesizes scores into plain-English summaries.

**Tech Stack:** FastAPI, SQLAlchemy async, Alembic, Celery beat, httpx, anthropic SDK, Next.js App Router, SWR, Google Maps JavaScript API

---

## File Map

**Create:**
- `backend/app/models/market.py` — ORM models: MarketWatchlist, MarketProperty, MarketAlert
- `backend/alembic/versions/0018_market_overview.py` — creates 3 new tables
- `backend/app/services/zillow_client.py` — Zillow RapidAPI: listings + price history
- `backend/app/services/census_client.py` — US Census ACS: ZIP median price + median year built
- `backend/app/services/permit_client.py` — Miami-Dade Open Data: building permits by location
- `backend/app/services/property_scorer.py` — scores a property 0–100 across 5 signals
- `backend/app/services/market_scanner.py` — orchestrates full scan for one ZIP
- `backend/app/services/market_alerts.py` — fires Telegram message + email
- `backend/app/routers/market.py` — REST endpoints for watchlist, scan trigger, results, alerts
- `backend/tests/__init__.py`
- `backend/tests/test_property_scorer.py` — unit tests for scorer
- `frontend/app/market/watchlist/page.tsx` — add/remove ZIP codes, scan controls
- `frontend/app/market/[zip]/page.tsx` — map + property cards + permit pipeline
- `frontend/app/market/alerts/page.tsx` — alert history + deal status tags

**Create (additional):**
- `frontend/components/mode-switcher.tsx` — pill toggle: "Lex Transaction Agent" ↔ "Lex Market Analysis". Reads/writes `lex-mode` in localStorage. Rendered in the sidebar above nav items.
- `frontend/components/layout/market-sidebar.tsx` — market-mode sidebar with nav: Watchlist, ZIP Reports, Alerts

**Modify:**
- `backend/app/config.py` — add ZILLOW_RAPIDAPI_KEY, TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, GOOGLE_MAPS_API_KEY
- `backend/app/worker.py` — add run_market_scan Celery task
- `backend/celery_app.py` — add market scan to beat_schedule (daily at 07:00 UTC = ~2am ET)
- `backend/app/main.py` — include market router
- `frontend/lib/api.ts` — add market types + API functions
- `frontend/components/layout/sidebar.tsx` — add ModeSwitcher component at top; when mode=market render MarketSidebar instead of CRM nav items
- `frontend/app/layout.tsx` — no change needed (sidebar already handles layout)

---

## Task 1: Add Config Variables

**Files:**
- Modify: `backend/app/config.py`

- [ ] **Step 1: Add new settings fields to config.py**

Open `backend/app/config.py` and add these fields inside the `Settings` class, after the existing `twilio_from_number` line:

```python
    # Market Overview
    zillow_rapidapi_key: str = ""
    telegram_bot_token: str = ""      # @TheLexAI_bot token
    telegram_chat_id: str = ""        # Nico's personal Telegram user ID
    google_maps_api_key: str = ""     # For frontend map embed
```

- [ ] **Step 2: Update .env.example**

Add to `.env.example` (or create it if missing):

```
# Market Overview
ZILLOW_RAPIDAPI_KEY=your_rapidapi_key_here
TELEGRAM_BOT_TOKEN=8622735898:AAGZwaEKxvka_eWvpfTY7y5YtN7f89ZjLPk
TELEGRAM_CHAT_ID=your_telegram_user_id
GOOGLE_MAPS_API_KEY=your_google_maps_key
```

> **Note for Nico:** To get your Telegram user ID, message @userinfobot on Telegram — it replies with your numeric ID. Add `TELEGRAM_CHAT_ID` to Railway env vars. Add `ZILLOW_RAPIDAPI_KEY` to Railway env vars and `GOOGLE_MAPS_API_KEY` to both Railway and Vercel env vars (prefix with `NEXT_PUBLIC_` on Vercel).

- [ ] **Step 3: Commit**

```bash
git add backend/app/config.py
git commit -m "feat(market): add config fields for Zillow, Telegram, Google Maps"
```

---

## Task 2: Database Migration

**Files:**
- Create: `backend/alembic/versions/0018_market_overview.py`

- [ ] **Step 1: Create the migration file**

```python
"""market overview — watchlist, properties, alerts

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-22

Creates:
  - market_watchlist — ZIP codes Nico watches
  - market_properties — cached listing data per scan
  - market_alerts — fired alert log with deal status
"""

from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_watchlist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("zip_code", sa.String(10), nullable=False),
        sa.Column("alert_threshold", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "zip_code", name="uq_watchlist_user_zip"),
    )
    op.create_index("ix_market_watchlist_id", "market_watchlist", ["id"])
    op.create_index("ix_market_watchlist_user_id", "market_watchlist", ["user_id"])

    op.create_table(
        "market_properties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("zip_code", sa.String(10), nullable=False),
        sa.Column("zillow_id", sa.String(50), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("bathrooms", sa.Float(), nullable=True),
        sa.Column("living_area", sa.Integer(), nullable=True),
        sa.Column("year_built", sa.Integer(), nullable=True),
        sa.Column("days_on_market", sa.Integer(), nullable=True),
        sa.Column("zestimate", sa.Integer(), nullable=True),
        sa.Column("price_reduction_30d", sa.Integer(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("img_src", sa.String(1000), nullable=True),
        sa.Column("nearest_permit_distance_mi", sa.Float(), nullable=True),
        sa.Column("nearest_permit_type", sa.String(200), nullable=True),
        sa.Column("nearest_permit_date", sa.String(50), nullable=True),
        sa.Column("nearest_permit_address", sa.String(500), nullable=True),
        sa.Column("opportunity_score", sa.Integer(), nullable=True),
        sa.Column("claude_summary", sa.Text(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("zillow_id", name="uq_market_properties_zillow_id"),
    )
    op.create_index("ix_market_properties_id", "market_properties", ["id"])
    op.create_index("ix_market_properties_zip_code", "market_properties", ["zip_code"])
    op.create_index("ix_market_properties_zillow_id", "market_properties", ["zillow_id"])

    op.create_table(
        "market_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("score_at_alert", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("alerted_via", sa.String(50), nullable=False, server_default="both"),
        sa.Column("fired_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["property_id"], ["market_properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_market_alerts_id", "market_alerts", ["id"])
    op.create_index("ix_market_alerts_user_id", "market_alerts", ["user_id"])
    op.create_index("ix_market_alerts_property_id", "market_alerts", ["property_id"])


def downgrade() -> None:
    op.drop_table("market_alerts")
    op.drop_table("market_properties")
    op.drop_table("market_watchlist")
```

- [ ] **Step 2: Commit**

```bash
git add backend/alembic/versions/0018_market_overview.py
git commit -m "feat(market): add DB migration for watchlist, properties, alerts tables"
```

---

## Task 3: SQLAlchemy Models

**Files:**
- Create: `backend/app/models/market.py`

- [ ] **Step 1: Create the models file**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/market.py
git commit -m "feat(market): add SQLAlchemy models for MarketWatchlist, MarketProperty, MarketAlert"
```

---

## Task 4: Zillow Client

**Files:**
- Create: `backend/app/services/zillow_client.py`

- [ ] **Step 1: Create the Zillow RapidAPI client**

```python
"""Zillow RapidAPI client — fetches listings and price history for a ZIP code.

API: zillow56 on RapidAPI (https://rapidapi.com/ntd119/api/zillow56)
Endpoint: GET /search?location={zip}&status_type=ForSale&home_type=Houses

Response shape (relevant fields):
  props[]: zpid, address, price, bedrooms, bathrooms, livingArea, yearBuilt,
           daysOnZillow, zestimate, priceReduction, latitude, longitude, imgSrc
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

import httpx

logger = logging.getLogger(__name__)

ZILLOW_BASE = "https://zillow56.p.rapidapi.com"


@dataclass
class ZillowListing:
    zpid: str
    address: str
    price: int | None
    bedrooms: int | None
    bathrooms: float | None
    living_area: int | None
    year_built: int | None
    days_on_market: int | None
    zestimate: int | None
    price_reduction_30d: int | None  # dollar amount reduced, None if no reduction
    latitude: float | None
    longitude: float | None
    img_src: str | None


async def fetch_listings(zip_code: str, rapidapi_key: str) -> list[ZillowListing]:
    """Return all active for-sale house listings in the given ZIP code."""
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": "zillow56.p.rapidapi.com",
    }
    params = {
        "location": zip_code,
        "status_type": "ForSale",
        "home_type": "Houses",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(f"{ZILLOW_BASE}/search", headers=headers, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Zillow search failed for ZIP %s: %s", zip_code, exc)
            return []

    data = resp.json()
    props = data.get("props") or data.get("results") or []

    listings: list[ZillowListing] = []
    for p in props:
        price_reduction = _parse_price_reduction(p.get("priceReduction") or p.get("price_reduction") or "")
        listings.append(
            ZillowListing(
                zpid=str(p.get("zpid", "")),
                address=p.get("address", ""),
                price=_to_int(p.get("price")),
                bedrooms=_to_int(p.get("bedrooms")),
                bathrooms=_to_float(p.get("bathrooms")),
                living_area=_to_int(p.get("livingArea")),
                year_built=_to_int(p.get("yearBuilt")),
                days_on_market=_to_int(p.get("daysOnZillow")),
                zestimate=_to_int(p.get("zestimate")),
                price_reduction_30d=price_reduction,
                latitude=_to_float(p.get("latitude")),
                longitude=_to_float(p.get("longitude")),
                img_src=p.get("imgSrc"),
            )
        )

    logger.info("Zillow: %d listings fetched for ZIP %s", len(listings), zip_code)
    return listings


def _parse_price_reduction(text: str) -> int | None:
    """Extract dollar amount from strings like 'Price reduced by $18,000'."""
    import re
    if not text:
        return None
    match = re.search(r"\$[\d,]+", text)
    if not match:
        return None
    try:
        return int(match.group().replace("$", "").replace(",", ""))
    except ValueError:
        return None


def _to_int(val) -> int | None:
    try:
        return int(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def _to_float(val) -> float | None:
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/zillow_client.py
git commit -m "feat(market): add Zillow RapidAPI client"
```

---

## Task 5: Census + Permit Clients

**Files:**
- Create: `backend/app/services/census_client.py`
- Create: `backend/app/services/permit_client.py`

- [ ] **Step 1: Create census_client.py**

```python
"""US Census ACS5 client — fetches ZIP-level median home value and median year built.

API: api.census.gov (free, no key required for basic use)
Endpoint: GET /data/2022/acs/acs5
  ?get=B25077_001E,B25035_001E
  &for=zip+code+tabulation+area:{zip}

B25077_001E = median value of owner-occupied housing units (dollars)
B25035_001E = median year structure built
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

CENSUS_BASE = "https://api.census.gov/data/2022/acs/acs5"


@dataclass
class ZipStats:
    zip_code: str
    median_home_value: int | None
    median_year_built: int | None


async def fetch_zip_stats(zip_code: str) -> ZipStats:
    """Return median home value and median year built for a ZIP code."""
    params = {
        "get": "B25077_001E,B25035_001E",
        "for": f"zip code tabulation area:{zip_code}",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(CENSUS_BASE, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Census fetch failed for ZIP %s: %s", zip_code, exc)
            return ZipStats(zip_code=zip_code, median_home_value=None, median_year_built=None)

    rows = resp.json()
    # rows[0] = header, rows[1] = data
    if len(rows) < 2:
        return ZipStats(zip_code=zip_code, median_home_value=None, median_year_built=None)

    _, data_row = rows[0], rows[1]
    try:
        median_value = int(data_row[0]) if data_row[0] and data_row[0] != "-666666666" else None
        median_year = int(data_row[1]) if data_row[1] and data_row[1] != "-666666666" else None
    except (ValueError, IndexError):
        median_value = None
        median_year = None

    logger.info("Census ZIP %s: median_value=%s median_year=%s", zip_code, median_value, median_year)
    return ZipStats(zip_code=zip_code, median_home_value=median_value, median_year_built=median_year)
```

- [ ] **Step 2: Create permit_client.py**

```python
"""Miami-Dade Open Data permit client — fetches active building permits near a lat/lng.

API: opendata.miamidade.gov (free, no key required)
Endpoint: GET /resource/8why-47es.json
  ?$where=within_circle(location, {lat}, {lng}, {radius_meters})
  &$limit=10
  &$order=issue_date DESC

Filters to permits issued in the last 3 years with job_value > $500k
(signals significant development, not a homeowner's kitchen remodel).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

import httpx

logger = logging.getLogger(__name__)

PERMIT_URL = "https://opendata.miamidade.gov/resource/8why-47es.json"
SEARCH_RADIUS_METERS = 3218  # ~2 miles


@dataclass
class NearbyPermit:
    address: str
    permit_type: str
    issue_date: str
    job_value: int | None
    distance_mi: float  # computed by caller using haversine


async def fetch_permits_near(lat: float, lng: float) -> list[dict]:
    """Return raw permit records within 2 miles of the given coordinates.

    Returns raw dicts — distance calculation is done by property_scorer
    using the haversine formula since it already has both coordinates.
    """
    cutoff = (datetime.utcnow() - timedelta(days=365 * 3)).strftime("%Y-%m-%dT00:00:00.000")
    where = (
        f"within_circle(location, {lat}, {lng}, {SEARCH_RADIUS_METERS})"
        f" AND issue_date >= '{cutoff}'"
        f" AND job_value > '500000'"
    )
    params = {
        "$where": where,
        "$limit": "10",
        "$order": "issue_date DESC",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(PERMIT_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Permit fetch failed near (%.4f, %.4f): %s", lat, lng, exc)
            return []

    permits = resp.json()
    logger.info("Permits: %d found near (%.4f, %.4f)", len(permits), lat, lng)
    return permits
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/services/census_client.py backend/app/services/permit_client.py
git commit -m "feat(market): add Census and Miami-Dade permit API clients"
```

---

## Task 6: Property Scorer + Tests

**Files:**
- Create: `backend/app/services/property_scorer.py`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/test_property_scorer.py`

- [ ] **Step 1: Write the failing tests first**

Create `backend/tests/__init__.py` (empty):
```python
```

Create `backend/tests/test_property_scorer.py`:

```python
"""Unit tests for property_scorer.py"""

import pytest
from app.services.property_scorer import (
    haversine_miles,
    score_property,
    ScoringInput,
)


def test_haversine_same_point():
    assert haversine_miles(25.8576, -80.2781, 25.8576, -80.2781) == pytest.approx(0.0, abs=0.001)


def test_haversine_known_distance():
    # Miami Airport (25.7959, -80.2870) to Hialeah (25.8576, -80.2781) ≈ 4.3 miles
    dist = haversine_miles(25.7959, -80.2870, 25.8576, -80.2781)
    assert 4.0 < dist < 5.0


def test_score_all_signals_max():
    inp = ScoringInput(
        price=200_000,
        zestimate=240_000,           # 16.7% below → full 25 pts
        zip_median_value=280_000,
        year_built=1965,             # pre-1980 → full 20 pts
        zip_median_year_built=1972,
        days_on_market=60,           # >45 → 10 pts
        price_reduction_30d=15_000,  # reduction present → 10 pts
        nearest_permit_distance_mi=0.3,  # <0.5mi → full 35 pts
    )
    result = score_property(inp)
    assert result.score == 100


def test_score_no_signals():
    inp = ScoringInput(
        price=400_000,
        zestimate=390_000,           # overpriced vs Zestimate → 0 pts
        zip_median_value=350_000,    # overpriced vs median → 0 pts
        year_built=2015,             # new → 0 pts
        zip_median_year_built=1972,
        days_on_market=10,           # fresh listing → 0 pts
        price_reduction_30d=None,    # no reduction → 0 pts
        nearest_permit_distance_mi=None,  # no permit nearby → 0 pts
    )
    result = score_property(inp)
    assert result.score == 0


def test_score_partial_signals():
    inp = ScoringInput(
        price=280_000,
        zestimate=320_000,           # 12.5% below → 25 pts (>10% threshold)
        zip_median_value=350_000,
        year_built=1975,             # pre-1980 → 20 pts
        zip_median_year_built=1972,
        days_on_market=30,           # <45 → 0 pts
        price_reduction_30d=None,    # 0 pts
        nearest_permit_distance_mi=1.5,  # 1-2mi → partial 17 pts
    )
    result = score_property(inp)
    assert result.score == 62  # 25 + 20 + 17
    assert result.signal_near_permit is True
    assert result.signal_old_house is True


def test_score_permit_distance_tiers():
    base = dict(
        price=200_000, zestimate=200_000, zip_median_value=200_000,
        year_built=2010, zip_median_year_built=1972,
        days_on_market=10, price_reduction_30d=None,
    )
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=0.3)).score == 35
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=0.8)).score == 25
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=1.5)).score == 17
    assert score_property(ScoringInput(**base, nearest_permit_distance_mi=2.5)).score == 0
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

```bash
cd backend && python -m pytest tests/test_property_scorer.py -v
```
Expected: `ModuleNotFoundError: No module named 'app.services.property_scorer'`

- [ ] **Step 3: Implement property_scorer.py**

```python
"""Property scoring engine — scores a listing 0–100 across 5 signals.

Signal weights (must sum to 100):
  35 — near permitted development (tiered by distance)
  25 — price below ZIP median / Zestimate
  20 — old house in old neighborhood (pre-1980)
  10 — price reduction in last 30 days
  10 — days on market > 45
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class ScoringInput:
    price: int | None
    zestimate: int | None
    zip_median_value: int | None
    year_built: int | None
    zip_median_year_built: int | None
    days_on_market: int | None
    price_reduction_30d: int | None
    nearest_permit_distance_mi: float | None


@dataclass
class ScoringResult:
    score: int
    signal_near_permit: bool
    signal_undervalued: bool
    signal_old_house: bool
    signal_price_reduction: bool
    signal_long_dom: bool
    breakdown: dict[str, int]


def score_property(inp: ScoringInput) -> ScoringResult:
    """Return 0–100 opportunity score and per-signal breakdown."""
    pts_permit = _score_permit(inp.nearest_permit_distance_mi)
    pts_value = _score_value(inp.price, inp.zestimate, inp.zip_median_value)
    pts_age = _score_age(inp.year_built, inp.zip_median_year_built)
    pts_reduction = 10 if inp.price_reduction_30d and inp.price_reduction_30d > 0 else 0
    pts_dom = 10 if inp.days_on_market and inp.days_on_market > 45 else 0

    total = pts_permit + pts_value + pts_age + pts_reduction + pts_dom

    return ScoringResult(
        score=min(total, 100),
        signal_near_permit=pts_permit > 0,
        signal_undervalued=pts_value > 0,
        signal_old_house=pts_age > 0,
        signal_price_reduction=pts_reduction > 0,
        signal_long_dom=pts_dom > 0,
        breakdown={
            "near_permit": pts_permit,
            "undervalued": pts_value,
            "old_house": pts_age,
            "price_reduction": pts_reduction,
            "long_dom": pts_dom,
        },
    )


def _score_permit(distance_mi: float | None) -> int:
    """35 pts tiered by distance: <0.5mi=35, 0.5-1mi=25, 1-2mi=17, >2mi=0."""
    if distance_mi is None:
        return 0
    if distance_mi < 0.5:
        return 35
    if distance_mi < 1.0:
        return 25
    if distance_mi < 2.0:
        return 17
    return 0


def _score_value(price: int | None, zestimate: int | None, zip_median: int | None) -> int:
    """25 pts if price is ≥10% below Zestimate OR ≥10% below ZIP median."""
    if price and zestimate and zestimate > 0:
        if (zestimate - price) / zestimate >= 0.10:
            return 25
    if price and zip_median and zip_median > 0:
        if (zip_median - price) / zip_median >= 0.10:
            return 25
    return 0


def _score_age(year_built: int | None, zip_median_year: int | None) -> int:
    """20 pts if house is pre-1980. Extra credit if ZIP median is also old."""
    if year_built is None:
        return 0
    if year_built < 1980:
        return 20
    return 0


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in miles between two lat/lng points."""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
cd backend && python -m pytest tests/test_property_scorer.py -v
```
Expected:
```
PASSED tests/test_property_scorer.py::test_haversine_same_point
PASSED tests/test_property_scorer.py::test_haversine_known_distance
PASSED tests/test_property_scorer.py::test_score_all_signals_max
PASSED tests/test_property_scorer.py::test_score_no_signals
PASSED tests/test_property_scorer.py::test_score_partial_signals
PASSED tests/test_property_scorer.py::test_score_permit_distance_tiers
6 passed
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/property_scorer.py backend/tests/
git commit -m "feat(market): add property scoring engine with unit tests"
```

---

## Task 7: Market Scanner Service

**Files:**
- Create: `backend/app/services/market_scanner.py`

- [ ] **Step 1: Create market_scanner.py**

```python
"""Market scanner — orchestrates a full scan for one ZIP code.

Flow per ZIP:
  1. Zillow: fetch all active for-sale listings
  2. Census: fetch ZIP median value + median year built
  3. For each listing: fetch nearby permits, score, upsert to DB
  4. Return list of (property_id, score) for alert filtering
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.market import MarketProperty
from app.services.census_client import fetch_zip_stats
from app.services.permit_client import fetch_permits_near
from app.services.property_scorer import ScoringInput, haversine_miles, score_property
from app.services.zillow_client import ZillowListing, fetch_listings

logger = logging.getLogger(__name__)


async def scan_zip(zip_code: str, db: AsyncSession) -> list[tuple[int, int]]:
    """Scan one ZIP code. Returns list of (property_id, score) for all processed listings."""
    logger.info("Market scan starting for ZIP %s", zip_code)

    listings = await fetch_listings(zip_code, settings.zillow_rapidapi_key)
    if not listings:
        logger.warning("No listings found for ZIP %s", zip_code)
        return []

    zip_stats = await fetch_zip_stats(zip_code)
    results: list[tuple[int, int]] = []

    for listing in listings:
        if not listing.zpid:
            continue

        # Fetch nearby permits (only if we have coordinates)
        nearest_permit = None
        nearest_distance = None
        if listing.latitude and listing.longitude:
            raw_permits = await fetch_permits_near(listing.latitude, listing.longitude)
            if raw_permits:
                nearest_permit, nearest_distance = _find_nearest_permit(
                    listing.latitude, listing.longitude, raw_permits
                )

        # Score the property
        score_result = score_property(
            ScoringInput(
                price=listing.price,
                zestimate=listing.zestimate,
                zip_median_value=zip_stats.median_home_value,
                year_built=listing.year_built,
                zip_median_year_built=zip_stats.median_year_built,
                days_on_market=listing.days_on_market,
                price_reduction_30d=listing.price_reduction_30d,
                nearest_permit_distance_mi=nearest_distance,
            )
        )

        # Claude summary (only for properties scoring ≥ 40 to save API cost)
        claude_summary = None
        if score_result.score >= 40:
            claude_summary = await _generate_summary(listing, score_result, nearest_permit, nearest_distance, zip_stats)

        # Upsert to DB
        prop_id = await _upsert_property(
            db=db,
            listing=listing,
            zip_code=zip_code,
            score_result=score_result,
            nearest_permit=nearest_permit,
            nearest_distance=nearest_distance,
            claude_summary=claude_summary,
        )
        results.append((prop_id, score_result.score))

    logger.info("Market scan complete for ZIP %s: %d properties processed", zip_code, len(results))
    return results


def _find_nearest_permit(
    lat: float, lng: float, raw_permits: list[dict]
) -> tuple[dict | None, float | None]:
    """Return (nearest_permit_dict, distance_miles) from a list of raw permit records."""
    nearest = None
    nearest_dist = float("inf")

    for p in raw_permits:
        loc = p.get("location", {})
        coords = loc.get("coordinates", [])
        if len(coords) < 2:
            continue
        p_lng, p_lat = float(coords[0]), float(coords[1])
        dist = haversine_miles(lat, lng, p_lat, p_lng)
        if dist < nearest_dist:
            nearest_dist = dist
            nearest = p

    return (nearest, nearest_dist) if nearest else (None, None)


async def _generate_summary(listing: ZillowListing, score_result, nearest_permit, nearest_distance: float | None, zip_stats) -> str:
    """Ask Claude Haiku to write a 2-sentence investment summary."""
    import anthropic

    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    signals = []
    if score_result.signal_near_permit and nearest_permit and nearest_distance is not None:
        p_type = nearest_permit.get("permit_type", "development")
        p_date = nearest_permit.get("issue_date", "")[:10]
        signals.append(f"Active {p_type} permit {nearest_distance:.1f}mi away (issued {p_date})")
    if score_result.signal_undervalued:
        if listing.zestimate and listing.price:
            pct = round((listing.zestimate - listing.price) / listing.zestimate * 100)
            signals.append(f"Listed {pct}% below Zestimate (${listing.price:,} vs ${listing.zestimate:,})")
    if score_result.signal_old_house:
        signals.append(f"Built {listing.year_built} — pre-1980 home in established neighborhood")
    if score_result.signal_price_reduction:
        signals.append(f"Price dropped ${listing.price_reduction_30d:,} in last 30 days")
    if score_result.signal_long_dom:
        signals.append(f"On market {listing.days_on_market} days — motivated seller signal")

    prompt = (
        f"Property: {listing.address}, {listing.bedrooms}bd/{listing.bathrooms}ba, "
        f"built {listing.year_built}, listed ${listing.price:,}. "
        f"Opportunity score: {score_result.score}/100. "
        f"Signals: {'; '.join(signals)}. "
        f"Write 2 concise sentences for a real estate investor explaining why this is worth looking at. "
        f"Be specific. No fluff."
    )

    try:
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude summary failed for %s: %s", listing.address, exc)
        return "; ".join(signals)


async def _upsert_property(
    db: AsyncSession,
    listing: ZillowListing,
    zip_code: str,
    score_result,
    nearest_permit: dict | None,
    nearest_distance: float | None,
    claude_summary: str | None,
) -> int:
    """Insert or update a MarketProperty row. Returns the property ID."""
    result = await db.execute(
        select(MarketProperty).where(MarketProperty.zillow_id == listing.zpid)
    )
    prop = result.scalar_one_or_none()

    permit_type = nearest_permit.get("permit_type") if nearest_permit else None
    permit_date = (nearest_permit.get("issue_date") or "")[:10] if nearest_permit else None
    permit_address = nearest_permit.get("address") if nearest_permit else None

    if prop is None:
        prop = MarketProperty(
            zip_code=zip_code,
            zillow_id=listing.zpid,
            address=listing.address,
            price=listing.price,
            bedrooms=listing.bedrooms,
            bathrooms=listing.bathrooms,
            living_area=listing.living_area,
            year_built=listing.year_built,
            days_on_market=listing.days_on_market,
            zestimate=listing.zestimate,
            price_reduction_30d=listing.price_reduction_30d,
            latitude=listing.latitude,
            longitude=listing.longitude,
            img_src=listing.img_src,
            nearest_permit_distance_mi=nearest_distance,
            nearest_permit_type=permit_type,
            nearest_permit_date=permit_date,
            nearest_permit_address=permit_address,
            opportunity_score=score_result.score,
            claude_summary=claude_summary,
        )
        db.add(prop)
    else:
        prop.price = listing.price
        prop.days_on_market = listing.days_on_market
        prop.zestimate = listing.zestimate
        prop.price_reduction_30d = listing.price_reduction_30d
        prop.nearest_permit_distance_mi = nearest_distance
        prop.nearest_permit_type = permit_type
        prop.nearest_permit_date = permit_date
        prop.nearest_permit_address = permit_address
        prop.opportunity_score = score_result.score
        if claude_summary:
            prop.claude_summary = claude_summary
        prop.last_updated_at = datetime.now(timezone.utc)

    await db.flush()
    await db.refresh(prop)
    return prop.id
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/market_scanner.py
git commit -m "feat(market): add market scanner service orchestrating ZIP scan pipeline"
```

---

## Task 8: Market Alerts Service

**Files:**
- Create: `backend/app/services/market_alerts.py`

- [ ] **Step 1: Create market_alerts.py**

```python
"""Market alerts — fires Telegram + email when a property crosses the score threshold.

Deduplication: only fires once per property unless score increases by ≥10 pts.
"""

from __future__ import annotations

import logging

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.market import MarketAlert, MarketProperty
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

DASHBOARD_BASE = "https://lex-transaction-agent.vercel.app"


async def maybe_fire_alert(
    db: AsyncSession,
    user_id: int,
    property_id: int,
    current_score: int,
    threshold: int,
) -> bool:
    """Fire Telegram + email if score ≥ threshold and not already alerted at this level.

    Returns True if an alert was fired.
    """
    if current_score < threshold:
        return False

    # Check last alert for this property
    result = await db.execute(
        select(MarketAlert)
        .where(MarketAlert.property_id == property_id, MarketAlert.user_id == user_id)
        .order_by(MarketAlert.fired_at.desc())
        .limit(1)
    )
    last_alert = result.scalar_one_or_none()

    # Skip if already alerted and score hasn't improved by ≥10
    if last_alert and (current_score - last_alert.score_at_alert) < 10:
        return False

    # Fetch property details for the message
    prop_result = await db.execute(
        select(MarketProperty).where(MarketProperty.id == property_id)
    )
    prop = prop_result.scalar_one_or_none()
    if not prop:
        return False

    message = _format_telegram_message(prop, current_score)
    html_body = _format_email_html(prop, current_score)

    telegram_ok = await _send_telegram(message)
    email_ok = await _send_email(html_body, prop.address)

    alerted_via = "both" if telegram_ok and email_ok else ("telegram" if telegram_ok else "email")

    alert = MarketAlert(
        user_id=user_id,
        property_id=property_id,
        score_at_alert=current_score,
        alerted_via=alerted_via,
    )
    db.add(alert)
    await db.flush()

    logger.info("Alert fired for property %d (score %d) via %s", property_id, current_score, alerted_via)
    return True


def _format_telegram_message(prop: MarketProperty, score: int) -> str:
    beds = f"{prop.bedrooms}bd" if prop.bedrooms else "?"
    baths = f"{prop.bathrooms}ba" if prop.bathrooms else "?"
    year = str(prop.year_built) if prop.year_built else "?"
    price = f"${prop.price:,}" if prop.price else "?"
    zest = f"${prop.zestimate:,}" if prop.zestimate else "?"

    lines = [
        f"🏠 <b>LEX MARKET ALERT — Score: {score}/100</b>",
        f"{beds}/{baths} | {year} | {prop.address}",
        "",
    ]
    if prop.nearest_permit_distance_mi is not None:
        lines.append(f"📍 {prop.nearest_permit_distance_mi:.1f}mi from permitted {prop.nearest_permit_type or 'development'} ({prop.nearest_permit_date or ''})")
    if prop.price and prop.zestimate and prop.zestimate > prop.price:
        pct = round((prop.zestimate - prop.price) / prop.zestimate * 100)
        lines.append(f"💰 Listed {price} — {pct}% below Zestimate ({zest})")
    if prop.price_reduction_30d:
        lines.append(f"📉 Price dropped ${prop.price_reduction_30d:,} in last 30 days")

    if prop.claude_summary:
        lines.append("")
        lines.append(prop.claude_summary)

    lines.append("")
    lines.append(f"<a href='{DASHBOARD_BASE}/market/{prop.zip_code}'>View on dashboard →</a>")
    return "\n".join(lines)


def _format_email_html(prop: MarketProperty, score: int) -> str:
    price = f"${prop.price:,}" if prop.price else "N/A"
    return f"""
<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
  <h2 style="color:#1e40af">🏠 Lex Market Alert — Score: {score}/100</h2>
  <p style="font-size:18px;font-weight:bold">{prop.address}</p>
  <p>{prop.bedrooms}bd/{prop.bathrooms}ba | Built {prop.year_built} | Listed {price}</p>
  {f'<p>📍 {prop.nearest_permit_distance_mi:.1f}mi from permitted {prop.nearest_permit_type} ({prop.nearest_permit_date})</p>' if prop.nearest_permit_distance_mi else ''}
  {f'<p>📉 Price dropped ${prop.price_reduction_30d:,} in 30 days</p>' if prop.price_reduction_30d else ''}
  {f'<p style="color:#374151">{prop.claude_summary}</p>' if prop.claude_summary else ''}
  <a href="{DASHBOARD_BASE}/market/{prop.zip_code}" style="background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px">View on Dashboard</a>
</div>
"""


async def _send_telegram(message: str) -> bool:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.warning("Telegram not configured — skipping alert")
        return False

    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {"chat_id": settings.telegram_chat_id, "text": message, "parse_mode": "HTML"}

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.error("Telegram send failed: %s", exc)
            return False


async def _send_email(html_body: str, address: str) -> bool:
    try:
        svc = EmailService()
        await svc.send(
            to_email=settings.gmail_user,
            to_name="Nico",
            subject=f"🏠 Lex Market Alert: {address}",
            html_body=html_body,
        )
        return True
    except Exception as exc:
        logger.error("Email alert failed: %s", exc)
        return False
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/market_alerts.py
git commit -m "feat(market): add market alerts service for Telegram + email notifications"
```

---

## Task 9: Celery Task + Beat Schedule

**Files:**
- Modify: `backend/app/worker.py`
- Modify: `backend/celery_app.py`

- [ ] **Step 1: Add market scan task to worker.py**

Add this block at the end of `backend/app/worker.py`:

```python
# ── Periodic task: market scan ────────────────────────────────────────────────

@shared_task(name="app.worker.run_market_scan", bind=True, max_retries=2)
def run_market_scan(self) -> dict:
    """Nightly task: scan all active watchlist ZIPs, score listings, fire alerts."""
    try:
        return asyncio.run(_run_market_scan_async())
    except Exception as exc:
        logger.exception("run_market_scan failed: %s", exc)
        raise self.retry(exc=exc, countdown=300) from exc


async def _run_market_scan_async() -> dict:
    from app.database import AsyncSessionLocal
    from app.models.market import MarketAlert, MarketWatchlist
    from app.services.market_alerts import maybe_fire_alert
    from app.services.market_scanner import scan_zip
    from sqlalchemy import select, update
    from datetime import datetime, timezone

    total_scanned = 0
    total_alerted = 0

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(MarketWatchlist).where(MarketWatchlist.status == "active")
            )
            watchlist = result.scalars().all()

            for entry in watchlist:
                property_results = await scan_zip(entry.zip_code, db)

                for prop_id, score in property_results:
                    total_scanned += 1
                    fired = await maybe_fire_alert(
                        db=db,
                        user_id=entry.user_id,
                        property_id=prop_id,
                        current_score=score,
                        threshold=entry.alert_threshold,
                    )
                    if fired:
                        total_alerted += 1

                # Update last_scanned_at
                await db.execute(
                    update(MarketWatchlist)
                    .where(MarketWatchlist.id == entry.id)
                    .values(last_scanned_at=datetime.now(timezone.utc))
                )

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    logger.info("Market scan complete: %d properties, %d alerts fired", total_scanned, total_alerted)
    return {"scanned": total_scanned, "alerted": total_alerted}
```

- [ ] **Step 2: Add to beat schedule in celery_app.py**

Add the `from celery.schedules import crontab` import at the top of `backend/celery_app.py`, then add to `beat_schedule`:

```python
from celery.schedules import crontab
```

Inside `beat_schedule` dict, add:
```python
        "run-market-scan-nightly": {
            "task": "app.worker.run_market_scan",
            "schedule": crontab(hour=7, minute=0),  # 07:00 UTC = ~2am ET
        },
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/worker.py backend/celery_app.py
git commit -m "feat(market): add nightly market scan Celery task at 07:00 UTC"
```

---

## Task 10: Market API Router

**Files:**
- Create: `backend/app/routers/market.py`

- [ ] **Step 1: Create market.py router**

```python
"""Market Overview API endpoints.

Routes:
  GET    /market/watchlist              — list user's watched ZIPs
  POST   /market/watchlist              — add a ZIP
  PATCH  /market/watchlist/{id}         — update threshold or status
  DELETE /market/watchlist/{id}         — remove a ZIP
  POST   /market/watchlist/{id}/scan    — trigger on-demand scan
  GET    /market/properties/{zip_code}  — get scored properties for a ZIP
  GET    /market/alerts                 — list fired alerts with property details
  PATCH  /market/alerts/{id}            — update alert status (reviewed/interested/passed)
"""

import asyncio
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
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
    alert_threshold: int = 60

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
            raise ValueError("Status must be 'active' or 'paused'")
        return v


class AlertStatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        if v not in ("new", "reviewed", "interested", "passed"):
            raise ValueError("Status must be new, reviewed, interested, or passed")
        return v


# ── Watchlist endpoints ───────────────────────────────────────────────────────

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
    entries = result.scalars().all()
    return [_watchlist_dict(e) for e in entries]


@router.post("/watchlist", status_code=status.HTTP_201_CREATED)
async def add_watchlist(
    body: WatchlistCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Check for duplicate
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
    from datetime import datetime, timezone
    from sqlalchemy import update

    property_results = await scan_zip(entry.zip_code, db)
    alerted = 0
    for prop_id, score in property_results:
        fired = await maybe_fire_alert(
            db=db,
            user_id=current_user.id,
            property_id=prop_id,
            current_score=score,
            threshold=entry.alert_threshold,
        )
        if fired:
            alerted += 1

    await db.execute(
        update(MarketWatchlist)
        .where(MarketWatchlist.id == entry_id)
        .values(last_scanned_at=datetime.now(timezone.utc))
    )
    await db.flush()

    return {"scanned": len(property_results), "alerted": alerted, "zip_code": entry.zip_code}


# ── Properties endpoint ───────────────────────────────────────────────────────

@router.get("/properties/{zip_code}")
async def get_properties(
    zip_code: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    result = await db.execute(
        select(MarketProperty)
        .where(MarketProperty.zip_code == zip_code)
        .order_by(MarketProperty.opportunity_score.desc().nullslast())
        .limit(50)
    )
    props = result.scalars().all()
    return [_property_dict(p) for p in props]


# ── Alerts endpoints ──────────────────────────────────────────────────────────

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
    rows = result.all()
    return [
        {
            **_alert_dict(alert),
            "property": _property_dict(prop),
        }
        for alert, prop in rows
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
    await db.refresh(alert)
    return _alert_dict(alert)


# ── Helpers ───────────────────────────────────────────────────────────────────

async def _require_watchlist_entry(entry_id: int, user_id: int, db: AsyncSession) -> MarketWatchlist:
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
        "id": e.id,
        "zip_code": e.zip_code,
        "alert_threshold": e.alert_threshold,
        "status": e.status,
        "created_at": e.created_at.isoformat(),
        "last_scanned_at": e.last_scanned_at.isoformat() if e.last_scanned_at else None,
    }


def _property_dict(p: MarketProperty) -> dict:
    return {
        "id": p.id,
        "zip_code": p.zip_code,
        "zillow_id": p.zillow_id,
        "address": p.address,
        "price": p.price,
        "bedrooms": p.bedrooms,
        "bathrooms": p.bathrooms,
        "living_area": p.living_area,
        "year_built": p.year_built,
        "days_on_market": p.days_on_market,
        "zestimate": p.zestimate,
        "price_reduction_30d": p.price_reduction_30d,
        "latitude": p.latitude,
        "longitude": p.longitude,
        "img_src": p.img_src,
        "nearest_permit_distance_mi": p.nearest_permit_distance_mi,
        "nearest_permit_type": p.nearest_permit_type,
        "nearest_permit_date": p.nearest_permit_date,
        "nearest_permit_address": p.nearest_permit_address,
        "opportunity_score": p.opportunity_score,
        "claude_summary": p.claude_summary,
        "first_seen_at": p.first_seen_at.isoformat(),
        "last_updated_at": p.last_updated_at.isoformat(),
    }


def _alert_dict(a: MarketAlert) -> dict:
    return {
        "id": a.id,
        "property_id": a.property_id,
        "score_at_alert": a.score_at_alert,
        "status": a.status,
        "alerted_via": a.alerted_via,
        "fired_at": a.fired_at.isoformat(),
    }
```

- [ ] **Step 2: Register router in main.py**

In `backend/app/main.py`, add to imports:
```python
from app.routers import market
```

Add to routers section:
```python
app.include_router(market.router)
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/routers/market.py backend/app/main.py
git commit -m "feat(market): add market API router and register in main.py"
```

---

## Task 11: Frontend API Types + Functions

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add types and functions to lib/api.ts**

Append to the end of `frontend/lib/api.ts`:

```typescript
// ── Market Overview ────────────────────────────────────────────────────────

export type WatchlistEntry = {
  id: number;
  zip_code: string;
  alert_threshold: number;
  status: 'active' | 'paused';
  created_at: string;
  last_scanned_at: string | null;
};

export type MarketProperty = {
  id: number;
  zip_code: string;
  zillow_id: string;
  address: string;
  price: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  living_area: number | null;
  year_built: number | null;
  days_on_market: number | null;
  zestimate: number | null;
  price_reduction_30d: number | null;
  latitude: number | null;
  longitude: number | null;
  img_src: string | null;
  nearest_permit_distance_mi: number | null;
  nearest_permit_type: string | null;
  nearest_permit_date: string | null;
  nearest_permit_address: string | null;
  opportunity_score: number | null;
  claude_summary: string | null;
  first_seen_at: string;
  last_updated_at: string;
};

export type MarketAlert = {
  id: number;
  property_id: number;
  score_at_alert: number;
  status: 'new' | 'reviewed' | 'interested' | 'passed';
  alerted_via: string;
  fired_at: string;
  property: MarketProperty;
};

export async function getWatchlist(): Promise<WatchlistEntry[]> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/watchlist`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

export async function addWatchlistEntry(zip_code: string, alert_threshold = 60): Promise<WatchlistEntry> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/watchlist`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ zip_code, alert_threshold }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to add ZIP code');
  }
  return res.json();
}

export async function updateWatchlistEntry(id: number, updates: Partial<{ alert_threshold: number; status: string }>): Promise<WatchlistEntry> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/watchlist/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error('Failed to update watchlist entry');
  return res.json();
}

export async function deleteWatchlistEntry(id: number): Promise<void> {
  const token = getToken();
  await fetch(`${API_URL}/market/watchlist/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function triggerScan(entryId: number): Promise<{ scanned: number; alerted: number; zip_code: string }> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/watchlist/${entryId}/scan`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Scan failed');
  return res.json();
}

export async function getMarketProperties(zipCode: string): Promise<MarketProperty[]> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/properties/${zipCode}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch properties');
  return res.json();
}

export async function getMarketAlerts(): Promise<MarketAlert[]> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/alerts`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch alerts');
  return res.json();
}

export async function updateAlertStatus(id: number, alertStatus: string): Promise<MarketAlert> {
  const token = getToken();
  const res = await fetch(`${API_URL}/market/alerts/${id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: alertStatus }),
  });
  if (!res.ok) throw new Error('Failed to update alert');
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(market): add market API types and functions to frontend lib"
```

---

## Task 12: Mode Switcher + Market Sidebar

**Files:**
- Create: `frontend/components/mode-switcher.tsx`
- Create: `frontend/components/layout/market-sidebar.tsx`
- Modify: `frontend/components/layout/sidebar.tsx`

This replaces a simple sidebar nav item with a top-level mode switcher — like Claude's interface toggle between Claude.ai and Claude Code. Switching to "Lex Market Analysis" transforms the entire sidebar into a market-focused nav.

- [ ] **Step 1: Create mode-switcher.tsx**

```tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, MapPin } from 'lucide-react';

type Mode = 'crm' | 'market';

export function ModeSwitcher() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('crm');

  useEffect(() => {
    const stored = localStorage.getItem('lex-mode') as Mode | null;
    setMode(stored ?? 'crm');
  }, []);

  function switchMode(next: Mode) {
    setMode(next);
    localStorage.setItem('lex-mode', next);
    if (next === 'market') router.push('/market/watchlist');
    else router.push('/transactions');
  }

  return (
    <div
      className="flex rounded-xl p-1 mx-3 mb-4"
      style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid var(--border)' }}
    >
      {([
        { id: 'crm',    label: 'CRM',    icon: Building2 },
        { id: 'market', label: 'Market', icon: MapPin },
      ] as { id: Mode; label: string; icon: any }[]).map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => switchMode(id)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 transition-all duration-150"
          style={{
            fontSize: '0.75rem',
            fontWeight: mode === id ? 700 : 500,
            color: mode === id ? 'var(--text-primary)' : 'var(--text-muted)',
            background: mode === id ? 'var(--bg-elevated)' : 'transparent',
            boxShadow: mode === id ? '0 1px 4px rgba(0,0,0,0.25)' : 'none',
          }}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

export function useMode(): Mode {
  const [mode, setMode] = useState<Mode>('crm');
  useEffect(() => {
    const stored = localStorage.getItem('lex-mode') as Mode | null;
    setMode(stored ?? 'crm');
    function onStorage(e: StorageEvent) {
      if (e.key === 'lex-mode') setMode((e.newValue as Mode) ?? 'crm');
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  return mode;
}
```

- [ ] **Step 2: Create market-sidebar.tsx**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MapPin, ListChecks, Bell } from 'lucide-react';

const marketNavItems = [
  { href: '/market/watchlist', label: 'Watchlist', icon: ListChecks },
  { href: '/market/alerts',    label: 'Alerts',    icon: Bell },
];

export function MarketSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-3">
      {marketNavItems.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(href.replace('/watchlist', ''));
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150"
            style={{
              fontSize: '0.875rem',
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--text-primary)' : 'var(--text-muted)',
              background: active ? 'var(--bg-elevated)' : 'transparent',
            }}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        );
      })}

      <div className="mt-3 px-3">
        <p style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
          Recent ZIPs
        </p>
        <RecentZips />
      </div>
    </nav>
  );
}

function RecentZips() {
  // Reads watchlist ZIPs from localStorage cache set by watchlist page
  // Falls back to empty — no API call needed in sidebar
  const zips: string[] = [];
  if (typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('lex-market-zips');
      if (cached) zips.push(...JSON.parse(cached));
    } catch { /* ignore */ }
  }

  if (zips.length === 0) return null;

  return (
    <div className="flex flex-col gap-0.5">
      {zips.slice(0, 5).map((zip) => (
        <Link
          key={zip}
          href={`/market/${zip}`}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors"
          style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}
        >
          <MapPin className="h-3 w-3 shrink-0" />
          {zip}
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Update sidebar.tsx to render ModeSwitcher + conditional nav**

In `frontend/components/layout/sidebar.tsx`:

Add imports at the top (after existing imports):
```tsx
import { ModeSwitcher, useMode } from '@/components/mode-switcher';
import { MarketSidebar } from '@/components/layout/market-sidebar';
```

Inside the `Sidebar` function, after existing `useState`/`useEffect` hooks, add:
```tsx
  const mode = useMode();
```

Find the section that renders `navItems.map(...)` and wrap it so CRM nav only shows in CRM mode, and Market nav shows in market mode. Replace the nav items render block with:

```tsx
{mode === 'crm' ? (
  <nav className="flex flex-col gap-1 px-3">
    {navItems.map(({ href, label, icon: Icon }) => {
      // ... existing nav item JSX unchanged ...
    })}
  </nav>
) : (
  <MarketSidebar />
)}
```

Place `<ModeSwitcher />` directly above the nav block (below the logo/brand section, above the nav items).

- [ ] **Step 4: Commit**

```bash
git add frontend/components/mode-switcher.tsx frontend/components/layout/market-sidebar.tsx frontend/components/layout/sidebar.tsx
git commit -m "feat(market): add mode switcher pill — toggle between Lex CRM and Lex Market Analysis"
```

---

## Task 13: Watchlist Page

**Files:**
- Create: `frontend/app/market/watchlist/page.tsx`

- [ ] **Step 1: Create the watchlist page**

```tsx
'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { MapPin, Plus, Trash2, Play, Pause, Zap, Clock } from 'lucide-react';
import {
  getWatchlist,
  addWatchlistEntry,
  updateWatchlistEntry,
  deleteWatchlistEntry,
  triggerScan,
  type WatchlistEntry,
} from '@/lib/api';

const inputStyle = {
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  outline: 'none',
  fontSize: '0.875rem',
  padding: '0.5rem 0.75rem',
  borderRadius: '0.5rem',
};

export default function WatchlistPage() {
  const router = useRouter();
  const { data: entries = [], mutate } = useSWR('/market/watchlist', getWatchlist, { revalidateOnFocus: false });

  const [newZip, setNewZip] = useState('');
  const [newThreshold, setNewThreshold] = useState(60);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [scanningId, setScanningId] = useState<number | null>(null);
  const [scanResult, setScanResult] = useState<{ id: number; text: string } | null>(null);

  async function handleAdd() {
    if (!newZip.trim()) return;
    setAdding(true);
    setAddError('');
    try {
      await addWatchlistEntry(newZip.trim(), newThreshold);
      await mutate();
      setNewZip('');
      setNewThreshold(60);
    } catch (err: any) {
      setAddError(err.message || 'Failed to add ZIP');
    } finally {
      setAdding(false);
    }
  }

  async function handleToggleStatus(entry: WatchlistEntry) {
    const next = entry.status === 'active' ? 'paused' : 'active';
    await updateWatchlistEntry(entry.id, { status: next });
    await mutate();
  }

  async function handleDelete(id: number) {
    await deleteWatchlistEntry(id);
    await mutate();
  }

  async function handleScan(entry: WatchlistEntry) {
    setScanningId(entry.id);
    setScanResult(null);
    try {
      const result = await triggerScan(entry.id);
      setScanResult({ id: entry.id, text: `Scanned ${result.scanned} properties · ${result.alerted} alerts fired` });
      await mutate();
    } catch {
      setScanResult({ id: entry.id, text: 'Scan failed — check backend logs' });
    } finally {
      setScanningId(null);
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
          <MapPin className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            Market Watchlist
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            ZIP codes scanned nightly at 2am · Alerts when score ≥ threshold
          </p>
        </div>
      </div>

      {/* Add ZIP form */}
      <div className="rounded-2xl p-5 mb-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>Add ZIP Code</p>
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={newZip}
            onChange={(e) => setNewZip(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder="33012"
            maxLength={5}
            className="w-32"
            style={inputStyle}
          />
          <div className="flex items-center gap-2">
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Alert at score ≥</span>
            <input
              type="number"
              value={newThreshold}
              onChange={(e) => setNewThreshold(Number(e.target.value))}
              min={1}
              max={100}
              className="w-20"
              style={inputStyle}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !newZip.trim()}
            className="inline-flex items-center gap-1 rounded-lg disabled:opacity-40"
            style={{ padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 600, background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', boxShadow: '0 2px 8px rgba(16,185,129,0.3)' }}
          >
            <Plus className="h-4 w-4" />
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {addError && <p style={{ fontSize: '0.8125rem', color: '#f87171', marginTop: '8px' }}>{addError}</p>}
      </div>

      {/* Watchlist entries */}
      {entries.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <MapPin className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No ZIP codes yet. Add one above to start watching.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-xl cursor-pointer font-bold text-sm"
                    style={{ background: entry.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.08)', color: entry.status === 'active' ? '#34d399' : 'var(--text-muted)', border: `1px solid ${entry.status === 'active' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}` }}
                    onClick={() => router.push(`/market/${entry.zip_code}`)}
                  >
                    {entry.zip_code}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => router.push(`/market/${entry.zip_code}`)}>
                        {entry.zip_code}
                      </span>
                      <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '9999px', background: entry.status === 'active' ? 'rgba(16,185,129,0.1)' : 'rgba(148,163,184,0.08)', color: entry.status === 'active' ? '#34d399' : 'var(--text-muted)', border: `1px solid ${entry.status === 'active' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}` }}>
                        {entry.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Alert ≥ {entry.alert_threshold}</span>
                      {entry.last_scanned_at && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          Last scan: {new Date(entry.last_scanned_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Scan Now */}
                  <button
                    onClick={() => handleScan(entry)}
                    disabled={scanningId === entry.id}
                    title="Scan Now"
                    className="flex h-8 w-8 items-center justify-center rounded-lg disabled:opacity-40"
                    style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa' }}
                  >
                    {scanningId === entry.id ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                  </button>
                  {/* Pause / Resume */}
                  <button
                    onClick={() => handleToggleStatus(entry)}
                    title={entry.status === 'active' ? 'Pause' : 'Resume'}
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(148,163,184,0.06)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
                  >
                    {entry.status === 'active' ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  </button>
                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(entry.id)}
                    title="Remove"
                    className="flex h-8 w-8 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171' }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              {scanResult?.id === entry.id && (
                <div className="mt-3 rounded-lg px-3 py-2" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)', fontSize: '0.8125rem', color: '#93c5fd' }}>
                  {scanResult.text}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/market/watchlist/page.tsx
git commit -m "feat(market): add watchlist management page"
```

---

## Task 14: ZIP Report Page

**Files:**
- Create: `frontend/app/market/[zip]/page.tsx`

- [ ] **Step 1: Create the ZIP report page**

```tsx
'use client';

import { useParams } from 'next/navigation';
import useSWR from 'swr';
import { MapPin, TrendingDown, Building2, Calendar, Home } from 'lucide-react';
import { getMarketProperties, type MarketProperty } from '@/lib/api';

const GMAPS_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '';

function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  const color = score >= 80 ? '#34d399' : score >= 60 ? '#fbbf24' : 'var(--text-muted)';
  const bg = score >= 80 ? 'rgba(16,185,129,0.1)' : score >= 60 ? 'rgba(251,191,36,0.1)' : 'rgba(148,163,184,0.06)';
  const border = score >= 80 ? 'rgba(16,185,129,0.2)' : score >= 60 ? 'rgba(251,191,36,0.2)' : 'var(--border)';
  return (
    <span style={{ padding: '3px 10px', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color, background: bg, border: `1px solid ${border}` }}>
      {score}/100
    </span>
  );
}

function PropertyCard({ prop }: { prop: MarketProperty }) {
  const undervalued = prop.price && prop.zestimate && prop.zestimate > prop.price
    ? Math.round((prop.zestimate - prop.price) / prop.zestimate * 100)
    : null;

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{prop.address}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            {prop.bedrooms}bd / {prop.bathrooms}ba
            {prop.living_area ? ` · ${prop.living_area.toLocaleString()} sqft` : ''}
            {prop.year_built ? ` · Built ${prop.year_built}` : ''}
          </p>
        </div>
        <ScoreBadge score={prop.opportunity_score} />
      </div>

      {/* Price row */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {prop.price && (
          <span style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            ${prop.price.toLocaleString()}
          </span>
        )}
        {undervalued !== null && (
          <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '9999px', background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
            {undervalued}% below Zestimate
          </span>
        )}
        {prop.price_reduction_30d && (
          <span style={{ fontSize: '0.75rem', color: '#fbbf24' }}>
            ↓ ${prop.price_reduction_30d.toLocaleString()} reduction
          </span>
        )}
        {prop.days_on_market && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {prop.days_on_market}d on market
          </span>
        )}
      </div>

      {/* Permit signal */}
      {prop.nearest_permit_distance_mi !== null && (
        <div className="flex items-start gap-2 mb-3 rounded-lg px-3 py-2" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
          <Building2 className="h-4 w-4 shrink-0 mt-0.5" style={{ color: '#60a5fa' }} />
          <span style={{ fontSize: '0.8125rem', color: '#93c5fd' }}>
            {prop.nearest_permit_distance_mi.toFixed(1)}mi from {prop.nearest_permit_type || 'development permit'}
            {prop.nearest_permit_date ? ` (${prop.nearest_permit_date})` : ''}
            {prop.nearest_permit_address ? ` · ${prop.nearest_permit_address}` : ''}
          </span>
        </div>
      )}

      {/* Claude summary */}
      {prop.claude_summary && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
          {prop.claude_summary}
        </p>
      )}
    </div>
  );
}

export default function ZipReportPage() {
  const { zip } = useParams<{ zip: string }>();
  const { data: properties = [], isLoading } = useSWR(
    `/market/properties/${zip}`,
    () => getMarketProperties(zip),
    { revalidateOnFocus: false }
  );

  const scored = properties.filter((p) => p.opportunity_score !== null && p.opportunity_score >= 60);
  const permits = properties.filter((p) => p.nearest_permit_distance_mi !== null);
  const medianPrice = properties.length > 0
    ? Math.round(properties.filter(p => p.price).reduce((s, p) => s + (p.price || 0), 0) / properties.filter(p => p.price).length)
    : null;

  return (
    <div className="p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}>
          <MapPin className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            ZIP {zip}
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {properties.length} listings · {scored.length} opportunities (score ≥ 60)
          </p>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
        {[
          { label: 'Active listings', value: properties.length, icon: Home },
          { label: 'Median price', value: medianPrice ? `$${medianPrice.toLocaleString()}` : '—', icon: TrendingDown },
          { label: 'Opportunities', value: scored.length, icon: MapPin },
          { label: 'Near permits', value: permits.length, icon: Building2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl p-4" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className="h-3.5 w-3.5" style={{ color: 'var(--text-muted)' }} />
              <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            </div>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Google Map */}
      {GMAPS_KEY && properties.some(p => p.latitude) && (
        <div className="rounded-2xl overflow-hidden mb-6" style={{ border: '1px solid var(--border)', height: '340px' }}>
          <iframe
            title={`Map of ZIP ${zip}`}
            width="100%"
            height="340"
            style={{ border: 0 }}
            loading="lazy"
            src={`https://www.google.com/maps/embed/v1/search?key=${GMAPS_KEY}&q=real+estate+${zip}+FL&zoom=13`}
          />
        </div>
      )}

      {/* Property cards */}
      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading properties…</p>
      ) : properties.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No scan data yet. Run a scan from the watchlist page.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {properties.map((prop) => (
            <PropertyCard key={prop.id} prop={prop} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/market/[zip]/page.tsx
git commit -m "feat(market): add ZIP report page with property cards and map embed"
```

---

## Task 15: Alerts Page

**Files:**
- Create: `frontend/app/market/alerts/page.tsx`

- [ ] **Step 1: Create the alerts page**

```tsx
'use client';

import useSWR from 'swr';
import { Bell, CheckCircle, Star, XCircle } from 'lucide-react';
import { getMarketAlerts, updateAlertStatus, type MarketAlert } from '@/lib/api';

const STATUS_CONFIG = {
  new:        { label: 'New',        color: '#60a5fa', bg: 'rgba(59,130,246,0.1)',   border: 'rgba(59,130,246,0.2)' },
  reviewed:   { label: 'Reviewed',   color: '#94a3b8', bg: 'rgba(148,163,184,0.08)', border: 'var(--border)' },
  interested: { label: 'Interested', color: '#34d399', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.2)' },
  passed:     { label: 'Passed',     color: '#f87171', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.15)' },
};

function AlertCard({ alert, onStatusChange }: { alert: MarketAlert; onStatusChange: () => void }) {
  const prop = alert.property;
  const cfg = STATUS_CONFIG[alert.status] ?? STATUS_CONFIG.new;
  const undervalued = prop.price && prop.zestimate && prop.zestimate > prop.price
    ? Math.round((prop.zestimate - prop.price) / prop.zestimate * 100)
    : null;

  async function setStatus(s: string) {
    await updateAlertStatus(alert.id, s);
    onStatusChange();
  }

  return (
    <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: '9999px', color: '#fbbf24', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
              Score {alert.score_at_alert}/100
            </span>
            <span style={{ fontSize: '0.6875rem', padding: '2px 8px', borderRadius: '9999px', color: cfg.color, background: cfg.bg, border: `1px solid ${cfg.border}` }}>
              {cfg.label}
            </span>
          </div>
          <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{prop.address}</p>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {prop.bedrooms}bd/{prop.bathrooms}ba
            {prop.year_built ? ` · Built ${prop.year_built}` : ''}
            {prop.price ? ` · $${prop.price.toLocaleString()}` : ''}
            {undervalued ? ` · ${undervalued}% below Zestimate` : ''}
          </p>
        </div>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {new Date(alert.fired_at).toLocaleDateString()}
        </span>
      </div>

      {prop.nearest_permit_distance_mi !== null && (
        <p style={{ fontSize: '0.8125rem', color: '#93c5fd', marginBottom: '8px' }}>
          📍 {prop.nearest_permit_distance_mi.toFixed(1)}mi from {prop.nearest_permit_type || 'development'} permit
          {prop.nearest_permit_date ? ` (${prop.nearest_permit_date})` : ''}
        </p>
      )}

      {prop.claude_summary && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: '1.5', marginBottom: '12px' }}>
          {prop.claude_summary}
        </p>
      )}

      {/* Status actions */}
      <div className="flex items-center gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '4px' }}>Mark as:</span>
        {(['reviewed', 'interested', 'passed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            disabled={alert.status === s}
            style={{
              fontSize: '0.75rem',
              padding: '3px 10px',
              borderRadius: '9999px',
              cursor: alert.status === s ? 'default' : 'pointer',
              opacity: alert.status === s ? 1 : 0.7,
              color: STATUS_CONFIG[s].color,
              background: alert.status === s ? STATUS_CONFIG[s].bg : 'transparent',
              border: `1px solid ${alert.status === s ? STATUS_CONFIG[s].border : 'var(--border)'}`,
              fontWeight: alert.status === s ? 700 : 400,
            }}
          >
            {STATUS_CONFIG[s].label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function AlertsPage() {
  const { data: alerts = [], mutate, isLoading } = useSWR('/market/alerts', getMarketAlerts, { revalidateOnFocus: false });

  const newCount = alerts.filter((a) => a.status === 'new').length;
  const interestedCount = alerts.filter((a) => a.status === 'interested').length;

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', boxShadow: '0 4px 16px rgba(245,158,11,0.35)' }}>
          <Bell className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.5rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--text-primary)' }}>
            Market Alerts
          </h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            {newCount} new · {interestedCount} interested · {alerts.length} total
          </p>
        </div>
      </div>

      {isLoading ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading alerts…</p>
      ) : alerts.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <Bell className="h-8 w-8 mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No alerts yet. Add ZIP codes to your watchlist and run a scan.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {alerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onStatusChange={() => mutate()} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/market/alerts/page.tsx
git commit -m "feat(market): add market alerts page with deal status tracking"
```

---

## Task 16: Market Landing Route Redirect

**Files:**
- Create: `frontend/app/market/page.tsx`

- [ ] **Step 1: Create redirect from /market to /market/watchlist**

```tsx
import { redirect } from 'next/navigation';

export default function MarketPage() {
  redirect('/market/watchlist');
}
```

- [ ] **Step 2: Deploy backend migration and verify**

```bash
# Push to Railway (triggers migration automatically via startup script)
git add frontend/app/market/page.tsx
git commit -m "feat(market): redirect /market to /market/watchlist"
git push origin master
```

Then verify migration ran:
```bash
# Check Railway logs for: "Running alembic upgrade head"
# Then confirm tables exist:
# GET https://backend-production-bb87.up.railway.app/health
```

- [ ] **Step 3: Add env vars to Railway and Vercel**

In Railway dashboard → Variables, add:
- `ZILLOW_RAPIDAPI_KEY` = your key from rapidapi.com (subscribe to "zillow56")
- `TELEGRAM_BOT_TOKEN` = `8622735898:AAGZwaEKxvka_eWvpfTY7y5YtN7f89ZjLPk`
- `TELEGRAM_CHAT_ID` = your numeric Telegram user ID (message @userinfobot to get it)

In Vercel dashboard → Settings → Environment Variables, add:
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` = your Google Maps API key (enable "Maps Embed API" in Google Cloud Console)

- [ ] **Step 4: Final smoke test**

1. Navigate to `https://lex-transaction-agent.vercel.app/market/watchlist`
2. Add ZIP code `33012` with threshold 60
3. Click ⚡ "Scan Now"
4. Verify properties appear and Telegram message fires
5. Navigate to `/market/33012` — verify map and property cards render
6. Navigate to `/market/alerts` — verify alert appears with score and Claude summary
