# Lex Market Intelligence — UI Redesign Spec
**Date:** 2026-04-28
**Status:** Approved for implementation

---

## Overview

Redesign the Market Intelligence section of Lex from a flat list/overview page into an immersive globe-first discovery experience. The globe is the entry point. Users search a city or ZIP, the view zooms in and renders ZIP code boundary zones on a dark map, they click a zone to see basic info and add it to their watchlist. The nightly scanner does the heavy analysis — the globe is purely for discovery and watchlist management.

---

## User Flow

```
Globe (full screen)
  → user types city or ZIP in floating search bar
  → globe flies/zooms to that region (~800ms camera animation)
  → cross-fades to dark Mapbox map centered on that city
  → ZIP boundary polygons render on the map (Census TIGER/Line GeoJSON)
      - Untracked ZIPs: outlined only, dark subtle fill
      - Tracked ZIPs: colored fill + opportunity score badge (only after nightly scan)
  → user clicks a ZIP zone
  → panel slides in from the right (300ms ease-out)
      - ZIP code, city, county, state
      - Median Home Value (Census ACS, free, shown before tracking)
      - Avg Days on Market — (empty until tracked + scanned)
      - Opportunity Score — (empty until tracked + scanned)
      - "Start Tracking" CTA  (or "View Full Analysis →" if already tracked)
  → user clicks "Start Tracking"
  → POST /market/watchlist → ZIP added to watchlist
  → ZIP boundary on map upgrades to glowing colored fill
  → panel confirms: "Tracking active — first scan tonight at 2 AM"
```

---

## Mode Transition (CRM ↔ Market)

- Triggered by the mode switcher pill centered in the top bar
- **CRM → Market**: CRM content translates -100vw (slides left), Market content translates from +100vw (slides right into view)
- **Market → CRM**: reverse — Market slides right out, CRM slides in from left
- Duration: 350ms, `cubic-bezier(0.4, 0, 0.2, 1)`
- No page navigation — pure CSS transform on layout wrappers

---

## Globe (State 1 — Discovery)

**Library:** Three.js + React Three Fiber (R3F)
**Texture:** `earth_atmos_2048.jpg` + `earth_specular_2048.jpg` + `earth_normal_2048.jpg` + `earth_clouds_1024.png` from Three.js examples CDN
**Atmosphere:** Custom GLSL shader — blue rim glow (Fresnel effect), outer haze layer
**Stars:** 6,000-point star field, uniform sphere distribution
**Auto-rotation:** 0.35 deg/sec, pauses on hover/drag
**Controls:** OrbitControls — drag to rotate, scroll to zoom (min 1.6, max 4.5 units)
**Axial tilt:** 23.4° (0.41 rad) on Z axis
**Cloud layer:** Separate sphere at r=1.003, slight independent rotation

**Floating UI (overlay on globe):**
- Mode pill (top center): `Lex CRM | Lex Market`
- Search bar (bottom center, 360px wide): glassmorphism — `rgba(8,14,26,0.75)`, `backdrop-filter: blur(20px)`, blue border, rounded-full
- Search accepts: city name ("Miami"), state ("Connecticut"), or ZIP code ("33101")
- Geocoding: Mapbox Geocoding API (`/geocoding/v5/mapbox.places/{query}.json`) converts city names to lat/lon bounding box. Uses the same `NEXT_PUBLIC_MAPBOX_TOKEN`. ZIP codes geocode directly via the same API.

**Tracked ZIP markers on globe:**
- Visible as small glowing dots with pulse rings while in globe view
- Color indicates score tier: blue (high), amber (medium), green (low/watch)
- Hover shows tooltip: ZIP, city, score

---

## City/ZIP Map View (State 2 — Zone Discovery)

**Triggered by:** Submitting a search (city or ZIP)
**Transition:** Globe camera animates toward the searched location (~800ms), then cross-fades (300ms) to Mapbox map

**Map library:** Mapbox GL JS via `react-map-gl`
**Map style:** Custom dark style — `mapbox://styles/mapbox/dark-v11`
**Map key:** Uses existing `NEXT_PUBLIC_MAPBOX_TOKEN` env var (new — needs adding)

**ZIP boundary layer:**
- Source: US Census TIGER/Line ZCTA GeoJSON, fetched once per state and cached in browser localStorage
- Primary endpoint: Census TIGER/Line API `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/PUMA_TAD_TAZ_UGA_ZCTA/MapServer/2/query` filtered by bounding box
- Fallback: `https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master/{state}_zip_codes_geo.min.json` per state
- Layer type: `fill` + `line` — fill for click area, line for visible borders
- Untracked fill: `rgba(255,255,255,0.03)`, border: `rgba(255,255,255,0.15)`
- Tracked fill: color by score tier with 20% opacity, border: full color
- Hover state: fill brightens slightly, cursor becomes pointer

**Score badge on tracked ZIPs:**
- Rendered as a Mapbox symbol layer or HTML overlay marker
- Shows score number (e.g. "87") in the zone center
- Color-coded: ≥70 blue, 40–69 amber, <40 slate

**Back to globe:** "← Globe" button top-left, re-triggers the slide transition in reverse

---

## ZIP Info Panel (State 3 — Track Prompt)

**Triggered by:** Clicking any ZIP zone on the map
**Animation:** Slides in from right, 300ms `ease-out`, width 280px on desktop
**Map behavior:** Map shifts left by ~140px (half panel width) to keep the selected ZIP centered

**Panel content:**

```
[ZIP code large]        [× close]
[City], [County], [State]

──────────────────────────
Median Home Value
$XXX,XXX               ← Census ACS B25077 (owner-occupied median)

Avg Days on Market
—                      ← populated after first scan

Opportunity Score
—                      ← populated after first scan
──────────────────────────

[ Start Tracking ]     ← primary CTA, blue button

or if already tracked:

Last Scan: Apr 27, 2026
Opportunity Score: 87 / 100

[ View Full Analysis → ]
```

**"Start Tracking" action:**
1. `POST /api/market/watchlist` with `{ zip_code, city, state }`
2. On success: button changes to checkmark + "Tracking active"
3. Confirmation line: "First scan tonight at 2 AM"
4. ZIP boundary on map upgrades to colored fill immediately

**Median Home Value data source:**
- Census ACS5 table B25077 (Median value of owner-occupied housing units)
- API: `https://api.census.gov/data/2022/acs/acs5?get=B25077_001E&for=zip+code+tabulation+area:{ZIP}&key=...`
- Uses existing `CENSUS_API_KEY` already in backend
- Fetched backend-side via new endpoint: `GET /api/market/zip-info/{zip}`
- Response cached in Redis for 24h (data doesn't change day-to-day)

---

## Onboarding Tour Fix

The existing driver.js tour (`frontend/lib/tour.ts`) breaks because it targets elements that no longer exist after the redesign. Fix approach:
- Update all tour step selectors to match new element IDs in the redesigned Market page
- Tour triggers on first visit to `/market` (localStorage flag `lex-tour-market-done`)
- Steps: (1) globe search bar, (2) mode switcher, (3) first tracked ZIP marker, (4) watchlist link in sidebar
- Keep driver.js — no library change needed

---

## New Dependencies

| Package | Purpose |
|---|---|
| `@react-three/fiber` | React wrapper for Three.js (globe rendering) |
| `@react-three/drei` | OrbitControls, useTexture, Html helpers for R3F |
| `three` | Already installed (GSAP already present) |
| `react-map-gl` | React wrapper for Mapbox GL JS |
| `mapbox-gl` | Mapbox core rendering |

**New env var required:**
- `NEXT_PUBLIC_MAPBOX_TOKEN` — Mapbox public token (free tier covers this usage)

---

## New API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/market/zip-info/{zip}` | Returns city, county, state, Census ACS median home value. Redis-cached 24h. |

Existing watchlist endpoints (`POST /market/watchlist`, `GET /market/watchlist`) are unchanged.

---

## Files Changed / Created

**New:**
- `frontend/components/market/globe-scene.tsx` — R3F globe component
- `frontend/components/market/zip-map.tsx` — Mapbox map with ZIP boundary layer
- `frontend/components/market/zip-panel.tsx` — Slide-in info + tracking panel
- `frontend/components/market/market-search.tsx` — Search bar (city or ZIP input with geocoding)
- `backend/app/routers/zip_info.py` — `/api/market/zip-info/{zip}` endpoint

**Modified:**
- `frontend/app/market/page.tsx` — New landing page: globe → map → panel state machine
- `frontend/app/market/layout.tsx` — Add slide transition wrapper
- `frontend/lib/tour.ts` — Update selector targets for new elements
- `backend/app/main.py` — Register zip_info router

---

## Out of Scope (this release)

- Mobile/responsive layout (desktop first)
- ZIP boundary data for non-US regions
- Historical score charts in the ZIP panel
- Satellite/terrain map toggle
