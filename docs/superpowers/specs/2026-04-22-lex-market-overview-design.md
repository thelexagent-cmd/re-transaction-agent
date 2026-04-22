# Lex Market Overview — Design Spec
**Date:** 2026-04-22
**Status:** Approved
**Owner:** Nico

---

## Overview

Lex Market Overview is a personal real estate intelligence tool embedded in the existing Lex CRM. It watches a set of Miami/South Florida ZIP codes, runs a nightly scan across multiple data sources, scores every active listing against five weighted signals, and alerts Nico via Telegram and email whenever a high-opportunity property appears. A dashboard provides the full picture for desktop review.

**Goal:** Surface undervalued properties near upcoming development before the broader market notices — helping Nico and his mom find smart investment opportunities in South Florida.

**Scope:** Personal tool only. Single user (Nico). Miami/South Florida ZIPs only.

---

## Architecture

Embedded in the existing `re-transaction-agent` monorepo. No new deployments required.

```
Frontend (Next.js / Vercel)
└── /market section (3 new pages)
    ├── /market/watchlist   — ZIP code management + settings
    ├── /market/[zip]       — full ZIP report with map and property cards
    └── /market/alerts      — alert history and deal tracker

Backend (FastAPI / Railway)
└── /market router (new)
    ├── CRUD for watchlist
    ├── On-demand scan trigger
    └── Results + alerts endpoints

Celery Beat (existing scheduler)
└── market_scan task — runs nightly at 2am ET
    └── Scans all active ZIP codes sequentially

PostgreSQL (existing DB)
└── 3 new tables
    ├── market_watchlist
    ├── market_properties
    └── market_alerts

Data Sources (called by nightly job)
├── Zillow RapidAPI         — listings, Zestimate, price history (~$15–30/mo)
├── US Census API           — ZIP median price, housing age (FREE)
├── Miami-Dade Permit API   — active building permits (FREE)
├── Google Maps Places API  — neighborhood POIs, map display (FREE / $200 credit)
└── Claude API              — scoring synthesis + plain-English summaries (~$5–10/mo)

Alerts
├── Telegram → @TheLexAI_bot   — instant mobile push
└── Gmail SMTP                  — email backup (already configured)
```

**Estimated monthly cost:** $20–40/mo (Zillow RapidAPI + Claude API; everything else free)

---

## Scoring Engine

Every property is scored 0–100 across five weighted signals. Claude reads all five together and writes a 2–3 sentence plain-English summary.

| Signal | Weight | Detection Method |
|---|---|---|
| Near permitted development | 35 pts | Miami-Dade permit API — active permits within 0.5–2mi radius |
| Price below area median | 25 pts | Zillow Zestimate + Census ZIP median comparison |
| Old house / low-turnover area | 20 pts | Year built pre-1980 + avg days since last sale in ZIP |
| Price reduction (last 30 days) | 10 pts | Zillow price history delta |
| Days on market > 45 days | 10 pts | Listing age from Zillow |

**Alert threshold:** Score ≥ 60 fires a Telegram message + email. Tunable from dashboard (default 60).

**Deduplication:** A property only fires an alert once unless its score increases by ≥10 points (e.g. a new nearby permit is filed). No repeat noise for unchanged listings.

---

## Nightly Job Flow

Runs at 2am ET via Celery beat. One `market_scan` task per watched ZIP, sequential.

```
For each ZIP in watchlist (status=active):
  1. Zillow RapidAPI        → fetch all active listings in ZIP
  2. Census API             → get ZIP median price, avg housing age
  3. Miami-Dade Permit API  → get permits within 2mi of each listing
  4. Zillow price history   → check for reductions in last 30 days
  5. Claude API             → score each listing (0-100), write summary
  6. PostgreSQL             → upsert results, mark new vs. previously seen
  7. Filter                 → score ≥ threshold AND not already alerted
  8. Telegram + Email       → fire alerts for qualifying properties
```

---

## Dashboard Pages

### `/market/watchlist`
- Add / remove ZIP codes
- Set alert threshold per ZIP (slider, default 60)
- Toggle active / paused per ZIP
- Last scan time + next scheduled scan
- "Scan Now" button for on-demand runs

### `/market/[zip]`
- Google Maps embed — pins for all flagged properties, color-coded by score (green ≥80, yellow 60–79)
- Summary stats bar: median price, avg DOM, # active listings, # active permits
- Property cards sorted by Opportunity Score — click for full Claude analysis
- Development Pipeline panel — list of active permits in ZIP (type, address, permit date, distance)

### `/market/alerts`
- Full log of all fired alerts with property, score, Claude summary, date
- Status tags per property: "Reviewed", "Interested", "Passed"
- Works as a lightweight deal tracker

---

## Alert Format

**Telegram:**
```
🏠 LEX MARKET ALERT — Score: 82/100
4bd/2ba | 1971 | Hialeah, 33012

📍 0.3mi from permitted mixed-use dev (Jan 2026)
💰 Listed $247k — 14% below ZIP median
📉 Price dropped $18k in last 30 days

View → https://lex-transaction-agent.vercel.app/market/33012
```

**Email:** Same content in HTML format with property image from Zillow if available.

---

## Database Schema

### `market_watchlist`
```sql
id, user_id, zip_code, alert_threshold (int default 60),
status (active/paused), created_at, last_scanned_at
```

### `market_properties`
```sql
id, zip_code, zillow_id, address, price, bedrooms, bathrooms,
year_built, days_on_market, zestimate, price_reduction_30d,
nearest_permit_distance_mi, nearest_permit_type, nearest_permit_date,
opportunity_score (int), claude_summary (text),
first_seen_at, last_updated_at
```

### `market_alerts`
```sql
id, user_id, property_id, score_at_alert, status (new/reviewed/interested/passed),
alerted_via (telegram/email/both), fired_at
```

---

## Data Sources Detail

| Source | What it provides | Cost | Notes |
|---|---|---|---|
| Zillow RapidAPI | Listings, Zestimate, price history, photos | ~$15–30/mo | Unofficial API via RapidAPI — most comprehensive listing data |
| US Census ACS API | Median home value, housing age by ZIP | FREE | api.census.gov — reliable, stable |
| Miami-Dade Open Data | Building permits, permit type, location | FREE | opendata.miamidade.gov — updated regularly |
| Google Maps Places | Map display, geocoding, POIs | FREE | Under $200/mo credit easily for personal use |
| Claude API | Scoring synthesis, plain-English summaries | ~$5–10/mo | claude-haiku-4-5-20251001 for cost efficiency |

---

## Out of Scope (v1)

- Properties outside Miami/South Florida
- Multi-user support or billing
- MLS/IDX direct feed (requires broker license)
- CoStar commercial data
- Automated offer or outreach generation
- Mobile app (Telegram covers mobile)
