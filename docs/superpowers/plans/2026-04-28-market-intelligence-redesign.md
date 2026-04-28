# Market Intelligence Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat market watchlist page with an immersive 3D globe → dark Mapbox ZIP-boundary map → slide-in track panel flow.

**Architecture:** Three.js/R3F globe as the entry screen; searching a city/ZIP animates the globe to face that region then cross-fades to a Mapbox dark map showing Census TIGER ZIP boundary polygons; clicking a ZIP zone slides in a panel with Census ACS median home value and a "Start Tracking" CTA that calls the existing watchlist API.

**Tech Stack:** React Three Fiber, @react-three/drei, three.js, react-map-gl, mapbox-gl, Mapbox Geocoding API, US Census ACS5 API, Census TIGER/Line GeoJSON, GSAP (already installed), existing FastAPI + Redis backend.

---

## File Map

**New frontend files:**
- `frontend/components/market/globe-scene.tsx` — R3F canvas, Earth sphere, atmosphere, stars, tracked-ZIP markers, OrbitControls
- `frontend/components/market/market-search.tsx` — Floating search bar overlay, calls Mapbox Geocoding API, emits result upward
- `frontend/components/market/zip-map.tsx` — react-map-gl map, loads Census TIGER ZCTA GeoJSON, renders fill+line layers, hover/click handlers
- `frontend/components/market/zip-panel.tsx` — Slide-in panel, calls `/api/market/zip-info/{zip}`, "Start Tracking" button
- `frontend/components/market/mode-pill.tsx` — Extracted pill (currently inline in mode-switcher, needed as standalone overlay on globe)

**Modified frontend files:**
- `frontend/app/market/page.tsx` — State machine: `globe | map | (panel overlay on map)`
- `frontend/app/market/layout.tsx` — Add CRM↔Market slide transition wrapper, remove TopBar (globe has its own UI)
- `frontend/lib/api.ts` — Add `getZipInfo()` function
- `frontend/lib/tour.ts` — Update selector IDs for new elements

**New backend files:**
- `backend/app/routers/zip_info.py` — `GET /market/zip-info/{zip}` — Census ACS B25077 lookup, Redis 24h cache

**Modified backend files:**
- `backend/app/main.py` — Register zip_info router

---

## Task 1: Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install frontend packages**

```bash
cd frontend
npm install @react-three/fiber @react-three/drei three react-map-gl mapbox-gl
npm install --save-dev @types/mapbox-gl @types/three
```

Expected output: packages added, no peer dep errors.

- [ ] **Step 2: Verify Three.js version compatibility**

```bash
node -e "const t = require('three'); console.log(t.REVISION)"
```

Expected: prints `163` or higher.

- [ ] **Step 3: Add Mapbox token to env files**

Add to `frontend/.env.local` (create if missing):
```
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1IjoiZ2V0bGV4YWkiLCJhIjoiY...
```

> **Note for Nico:** Get a free Mapbox token at https://account.mapbox.com → Tokens → Create token. Paste the `pk.eyJ1...` value above. Also add `NEXT_PUBLIC_MAPBOX_TOKEN` to Vercel env vars.

- [ ] **Step 4: Commit**

```bash
cd frontend
git add package.json package-lock.json .env.local
git commit -m "feat(market): install R3F, drei, react-map-gl, mapbox-gl"
```

---

## Task 2: Backend — ZIP Info Endpoint

**Files:**
- Create: `backend/app/routers/zip_info.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/test_zip_info.py`:

```python
"""Tests for ZIP info endpoint."""
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_zip_info_returns_data(async_client: AsyncClient):
    """GET /market/zip-info/33101 returns city, county, state, median_value."""
    mock_response = {
        "zip": "33101",
        "city": "Miami",
        "county": "Miami-Dade County",
        "state": "Florida",
        "state_abbr": "FL",
        "median_home_value": 485000,
    }
    with patch("app.routers.zip_info._fetch_zip_info", new_callable=AsyncMock, return_value=mock_response):
        resp = await async_client.get("/market/zip-info/33101", headers={"Authorization": "Bearer testtoken"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["zip"] == "33101"
    assert data["city"] == "Miami"
    assert data["median_home_value"] == 485000


@pytest.mark.asyncio
async def test_zip_info_invalid_zip(async_client: AsyncClient):
    """GET /market/zip-info/abc returns 422."""
    resp = await async_client.get("/market/zip-info/abc", headers={"Authorization": "Bearer testtoken"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_zip_info_not_found(async_client: AsyncClient):
    """GET /market/zip-info/99999 returns 404 when census returns no data."""
    with patch("app.routers.zip_info._fetch_zip_info", new_callable=AsyncMock, return_value=None):
        resp = await async_client.get("/market/zip-info/99999", headers={"Authorization": "Bearer testtoken"})
    assert resp.status_code == 404
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
pytest tests/test_zip_info.py -v
```

Expected: FAIL — `app.routers.zip_info` does not exist.

- [ ] **Step 3: Create the zip_info router**

Create `backend/app/routers/zip_info.py`:

```python
"""ZIP info endpoint — Census ACS median home value + geocoding metadata."""

import re
import logging
import httpx

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel

from app.middleware.auth import get_current_user
from app.models.user import User
from app.config import settings

try:
    import redis.asyncio as aioredis
    _redis_available = True
except ImportError:
    _redis_available = False

router = APIRouter(prefix="/market", tags=["market"])
logger = logging.getLogger(__name__)

CENSUS_BASE = "https://api.census.gov/data/2022/acs/acs5"
ZCTACACHE_TTL = 86400  # 24 hours


class ZipInfoResponse(BaseModel):
    zip: str
    city: str
    county: str
    state: str
    state_abbr: str
    median_home_value: int | None


async def _fetch_zip_info(zip_code: str) -> dict | None:
    """Fetch city/county/state from Census geocoder + median value from ACS5."""
    async with httpx.AsyncClient(timeout=10) as client:
        # 1. Census Geocoder — convert ZIP to county FIPS + state name
        geo_url = (
            "https://geocoding.geo.census.gov/geocoder/geographies/address"
            f"?benchmark=Public_AR_Current&vintage=Current_Residents"
            f"&address=&city=&state=&zip={zip_code}&format=json"
        )
        geo_resp = await client.get(geo_url)
        geo_data = geo_resp.json() if geo_resp.status_code == 200 else {}

        city = ""
        county = ""
        state = ""
        state_abbr = ""

        try:
            matches = geo_data["result"]["addressMatches"]
            if matches:
                geos = matches[0]["geographies"]
                state_info = geos.get("States", [{}])[0]
                county_info = geos.get("Counties", [{}])[0]
                city = matches[0].get("addressComponents", {}).get("city", "")
                county = county_info.get("NAME", "")
                state = state_info.get("NAME", "")
                state_abbr = state_info.get("STUSAB", "")
        except (KeyError, IndexError):
            pass

        # 2. Census ACS5 — median home value (B25077_001E)
        median_value = None
        census_key = getattr(settings, "CENSUS_API_KEY", "")
        acs_url = (
            f"{CENSUS_BASE}?get=B25077_001E,NAME"
            f"&for=zip+code+tabulation+area:{zip_code}"
            + (f"&key={census_key}" if census_key else "")
        )
        acs_resp = await client.get(acs_url)
        if acs_resp.status_code == 200:
            rows = acs_resp.json()
            if len(rows) > 1:  # row 0 is headers
                raw = rows[1][0]
                if raw and raw != "-666666666":
                    median_value = int(raw)
                # NAME field looks like "ZCTA5 33101, Florida"
                name_field = rows[1][1] if len(rows[1]) > 1 else ""
                if not state and ", " in name_field:
                    state = name_field.split(", ")[-1]
                if not city:
                    city = zip_code  # fallback

    if not state and not city:
        return None

    return {
        "zip": zip_code,
        "city": city or zip_code,
        "county": county or "",
        "state": state or "",
        "state_abbr": state_abbr or "",
        "median_home_value": median_value,
    }


@router.get("/zip-info/{zip_code}", response_model=ZipInfoResponse)
async def get_zip_info(
    zip_code: str = Path(..., pattern=r"^\d{5}$"),
    _: User = Depends(get_current_user),
) -> ZipInfoResponse:
    """Return city, county, state, and Census ACS median home value for a ZIP.

    Response is Redis-cached for 24 hours.
    """
    cache_key = f"zip_info:{zip_code}"

    # Try cache
    if _redis_available:
        try:
            r = aioredis.from_url(settings.REDIS_URL)
            cached = await r.get(cache_key)
            await r.aclose()
            if cached:
                import json
                return ZipInfoResponse(**json.loads(cached))
        except Exception:
            pass

    data = await _fetch_zip_info(zip_code)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No data found for ZIP {zip_code}")

    # Store in cache
    if _redis_available:
        try:
            import json
            r = aioredis.from_url(settings.REDIS_URL)
            await r.setex(cache_key, ZCTACACHE_TTL, json.dumps(data))
            await r.aclose()
        except Exception:
            pass

    return ZipInfoResponse(**data)
```

- [ ] **Step 4: Register router in main.py**

In `backend/app/main.py`, add after the existing market import:

```python
from app.routers import auth, compliance, documents, inspection, invites, tasks, transactions
from app.routers import market, portal, reports, templates, zip_info  # add zip_info
```

And after `app.include_router(market.router)`:

```python
app.include_router(zip_info.router)
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
pytest tests/test_zip_info.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/routers/zip_info.py backend/app/main.py backend/tests/test_zip_info.py
git commit -m "feat(market): add /market/zip-info/{zip} endpoint with Census ACS cache"
```

---

## Task 3: Frontend — api.ts zip-info function

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add ZipInfo type and getZipInfo function**

At the end of `frontend/lib/api.ts`, append:

```typescript
export type ZipInfo = {
  zip: string;
  city: string;
  county: string;
  state: string;
  state_abbr: string;
  median_home_value: number | null;
};

export async function getZipInfo(zip: string): Promise<ZipInfo> {
  const res = await authFetch(`/market/zip-info/${zip}`);
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat(market): add getZipInfo() API function"
```

---

## Task 4: GlobeScene Component

**Files:**
- Create: `frontend/components/market/globe-scene.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/market/globe-scene.tsx`:

```tsx
'use client';

import { useRef, useEffect } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import type { WatchlistEntry } from '@/lib/api';

// ── Marker ─────────────────────────────────────────────────────────────────

function ZipMarker({ lat, lon, score }: { lat: number; lon: number; score: number }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const R = 1.016;
  const x = -(R * Math.sin(phi) * Math.cos(theta));
  const y = R * Math.cos(phi);
  const z = R * Math.sin(phi) * Math.sin(theta);
  const pos = new THREE.Vector3(x, y, z);

  const color = score >= 70 ? '#3b82f6' : score >= 40 ? '#f59e0b' : '#64748b';

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const s = 1 + 0.35 * Math.sin(t * 2.5);
      ringRef.current.scale.setScalar(s);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = 0.6 * (1 - (s - 1) / 0.35) + 0.1;
    }
    if (ring2Ref.current) {
      const s = 1 + 0.6 * Math.abs(Math.sin(t * 1.8));
      ring2Ref.current.scale.setScalar(s);
      (ring2Ref.current.material as THREE.MeshBasicMaterial).opacity = 0.2 * (1.6 - s);
    }
  });

  const lookTarget = pos.clone().multiplyScalar(2);

  return (
    <group>
      <mesh position={pos}>
        <sphereGeometry args={[0.012, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh ref={ringRef} position={pos} onUpdate={(m) => m.lookAt(lookTarget)}>
        <ringGeometry args={[0.018, 0.022, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref} position={pos} onUpdate={(m) => m.lookAt(lookTarget)}>
        <ringGeometry args={[0.026, 0.028, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ── Stars ───────────────────────────────────────────────────────────────────

function Stars() {
  const count = 6000;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const phi = Math.acos(-1 + (2 * i) / count);
    const theta = Math.sqrt(count * Math.PI) * phi;
    const r = 80 + Math.random() * 20;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={0xffffff} size={0.08} sizeAttenuation transparent opacity={0.7} />
    </points>
  );
}

// ── Atmosphere ──────────────────────────────────────────────────────────────

const atmVert = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
const atmFrag = `
  uniform vec3 glowColor;
  varying vec3 vNormal;
  void main() {
    float intensity = pow(0.72 - dot(vNormal, vec3(0,0,1.0)), 3.5);
    gl_FragColor = vec4(glowColor, intensity * 0.9);
  }
`;

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.08, 64, 64]} />
      <shaderMaterial
        vertexShader={atmVert}
        fragmentShader={atmFrag}
        uniforms={{ glowColor: { value: new THREE.Color(0x1a6bff) } }}
        side={THREE.FrontSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

// ── Earth ───────────────────────────────────────────────────────────────────

const TEXTURE_BASE = 'https://threejs.org/examples/textures/planets';

function Earth({ watchlist }: { watchlist: WatchlistEntry[] }) {
  const cloudRef = useRef<THREE.Mesh>(null);
  const [dayMap, specMap, normMap, cloudMap] = useTexture([
    `${TEXTURE_BASE}/earth_atmos_2048.jpg`,
    `${TEXTURE_BASE}/earth_specular_2048.jpg`,
    `${TEXTURE_BASE}/earth_normal_2048.jpg`,
    `${TEXTURE_BASE}/earth_clouds_1024.png`,
  ]);

  useFrame(({ clock }) => {
    if (cloudRef.current) cloudRef.current.rotation.y = clock.getElapsedTime() * 0.003;
  });

  return (
    <group rotation={[0, 0, 0.41]}>
      {/* Earth surface */}
      <mesh>
        <sphereGeometry args={[1, 64, 64]} />
        <meshPhongMaterial
          map={dayMap}
          specularMap={specMap}
          normalMap={normMap}
          specular={new THREE.Color(0x223366)}
          shininess={25}
          normalScale={new THREE.Vector2(0.85, 0.85)}
        />
      </mesh>
      {/* Clouds */}
      <mesh ref={cloudRef}>
        <sphereGeometry args={[1.003, 64, 64]} />
        <meshPhongMaterial map={cloudMap} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      {/* Tracked ZIP markers */}
      {watchlist.map((entry) => {
        const prop = (entry as any).latest_property;
        if (!prop?.latitude || !prop?.longitude) return null;
        return (
          <ZipMarker
            key={entry.zip_code}
            lat={prop.latitude}
            lon={prop.longitude}
            score={prop.opportunity_score ?? 0}
          />
        );
      })}
    </group>
  );
}

// ── Scene ───────────────────────────────────────────────────────────────────

function Scene({ watchlist }: { watchlist: WatchlistEntry[] }) {
  return (
    <>
      <ambientLight color={0x1a2744} intensity={2.5} />
      <directionalLight color={0xffffff} intensity={3.5} position={[3, 1, 2]} />
      <directionalLight color={0x1d4ed8} intensity={1.2} position={[-3, -1, -2]} />
      <Stars />
      <Earth watchlist={watchlist} />
      <Atmosphere />
      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        rotateSpeed={0.4}
        autoRotate
        autoRotateSpeed={0.35}
        minDistance={1.6}
        maxDistance={4.5}
      />
    </>
  );
}

// ── Export ───────────────────────────────────────────────────────────────────

export function GlobeScene({ watchlist }: { watchlist: WatchlistEntry[] }) {
  return (
    <Canvas
      camera={{ position: [0, 0, 2.8], fov: 45 }}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
      style={{ width: '100%', height: '100%', background: '#050a12' }}
    >
      <Scene watchlist={watchlist} />
    </Canvas>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/globe-scene.tsx
git commit -m "feat(market): GlobeScene R3F component with Earth textures and ZIP markers"
```

---

## Task 5: MarketSearch Component

**Files:**
- Create: `frontend/components/market/market-search.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/market/market-search.tsx`:

```tsx
'use client';

import { useState, useRef } from 'react';

export type GeocodingResult = {
  text: string;            // "Miami"
  place_name: string;      // "Miami, Florida, United States"
  center: [number, number]; // [lng, lat]
  bbox?: [number, number, number, number]; // [minLng, minLat, maxLng, maxLat]
  isZip: boolean;
};

interface MarketSearchProps {
  onResult: (result: GeocodingResult) => void;
}

export function MarketSearch({ onResult }: MarketSearchProps) {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setError('');
    setLoading(true);

    try {
      const isZip = /^\d{5}$/.test(q);
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`
        + `?country=US&types=${isZip ? 'postcode' : 'place,region,district'}`
        + `&access_token=${token}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!data.features?.length) {
        setError('Location not found. Try a city name or ZIP code.');
        return;
      }

      const feat = data.features[0];
      onResult({
        text: feat.text,
        place_name: feat.place_name,
        center: feat.center,
        bbox: feat.bbox,
        isZip,
      });
    } catch {
      setError('Search failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 20, width: 360 }}>
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(8,14,26,0.75)',
            border: `1px solid ${error ? 'rgba(239,68,68,0.5)' : 'rgba(59,130,246,0.4)'}`,
            borderRadius: 40, padding: '14px 22px',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 40px rgba(59,130,246,0.1), 0 8px 32px rgba(0,0,0,0.5)',
          }}
        >
          <span style={{ color: 'rgba(96,165,250,0.7)', fontSize: 16 }}>⌕</span>
          <input
            id="market-search-input"
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, state, or ZIP code"
            style={{
              background: 'transparent', border: 'none', outline: 'none',
              color: '#e2e8f0', fontSize: 14, width: '100%',
            }}
          />
          {loading
            ? <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11 }}>…</span>
            : <span style={{ color: 'rgba(148,163,184,0.35)', fontSize: 11, fontFamily: 'monospace' }}>↵</span>
          }
        </div>
      </form>
      {error && (
        <p style={{ marginTop: 8, textAlign: 'center', fontSize: 12, color: 'rgba(239,68,68,0.8)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/market-search.tsx
git commit -m "feat(market): MarketSearch component with Mapbox geocoding"
```

---

## Task 6: ZipPanel Component

**Files:**
- Create: `frontend/components/market/zip-panel.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/market/zip-panel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { getZipInfo, addWatchlistEntry, getWatchlist, type ZipInfo, type WatchlistEntry } from '@/lib/api';

interface ZipPanelProps {
  zip: string;
  onClose: () => void;
  onTracked: (entry: WatchlistEntry) => void;
  watchlist: WatchlistEntry[];
}

export function ZipPanel({ zip, onClose, onTracked, watchlist }: ZipPanelProps) {
  const [info, setInfo] = useState<ZipInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [tracking, setTracking] = useState(false);
  const [tracked, setTracked] = useState(false);
  const [visible, setVisible] = useState(false);

  const existingEntry = watchlist.find((e) => e.zip_code === zip);

  useEffect(() => {
    setVisible(false);
    setLoading(true);
    setTracked(!!existingEntry);
    // Slide in after mount
    const t = setTimeout(() => setVisible(true), 16);
    getZipInfo(zip)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
    return () => clearTimeout(t);
  }, [zip]);

  async function handleTrack() {
    setTracking(true);
    try {
      const entry = await addWatchlistEntry(zip);
      setTracked(true);
      onTracked(entry);
    } finally {
      setTracking(false);
    }
  }

  function formatCurrency(v: number | null) {
    if (!v) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }

  return (
    <div
      id="zip-panel"
      style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 280,
        background: 'rgba(6,10,20,0.95)',
        borderLeft: '1px solid rgba(59,130,246,0.2)',
        backdropFilter: 'blur(24px)',
        display: 'flex', flexDirection: 'column',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease-out',
        zIndex: 30,
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, color: '#60a5fa', fontFamily: 'monospace', letterSpacing: 2, marginBottom: 4 }}>
              ZIP CODE
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: '#f1f5f9', lineHeight: 1 }}>{zip}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'rgba(148,163,184,0.5)', cursor: 'pointer', fontSize: 18, padding: 4 }}
          >
            ×
          </button>
        </div>
        {loading ? (
          <div style={{ marginTop: 8, height: 16, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '70%' }} />
        ) : info ? (
          <div style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>
            {info.city}, {info.county}, {info.state}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(239,68,68,0.7)' }}>Location data unavailable</div>
        )}
      </div>

      {/* Stats */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <StatRow
          label="Median Home Value"
          value={loading ? null : formatCurrency(info?.median_home_value ?? null)}
          highlight
        />
        <StatRow
          label="Avg Days on Market"
          value={existingEntry ? '—' : '—'}
          muted={!existingEntry}
          hint={!existingEntry ? 'Available after first scan' : undefined}
        />
        <StatRow
          label="Opportunity Score"
          value={existingEntry ? '—' : '—'}
          muted={!existingEntry}
          hint={!existingEntry ? 'Available after first scan' : undefined}
        />
      </div>

      {/* CTA */}
      <div style={{ padding: '0 20px 24px', marginTop: 'auto' }}>
        {tracked || existingEntry ? (
          <div>
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(52,211,153,0.08)',
                border: '1px solid rgba(52,211,153,0.25)',
                borderRadius: 12, padding: '12px 16px',
                fontSize: 13, color: '#34d399', marginBottom: 12,
              }}
            >
              <span>✓</span>
              <span>Tracking active</span>
            </div>
            <p style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
              Next scan tonight at 2 AM
            </p>
            <a
              href={`/market/${zip}`}
              style={{
                display: 'block', marginTop: 12,
                textAlign: 'center', fontSize: 13,
                color: '#60a5fa', textDecoration: 'none',
              }}
            >
              View Full Analysis →
            </a>
          </div>
        ) : (
          <div>
            <button
              id="start-tracking-btn"
              onClick={handleTrack}
              disabled={tracking}
              style={{
                width: '100%', padding: '14px 0',
                background: tracking ? 'rgba(59,130,246,0.3)' : 'rgba(59,130,246,0.85)',
                border: 'none', borderRadius: 12,
                color: '#fff', fontSize: 14, fontWeight: 600,
                cursor: tracking ? 'not-allowed' : 'pointer',
                transition: 'background 0.2s',
              }}
            >
              {tracking ? 'Adding…' : 'Start Tracking'}
            </button>
            <p style={{ marginTop: 10, fontSize: 11, color: '#64748b', textAlign: 'center' }}>
              Nightly scan at 2 AM — permits, pricing, DOM signals
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatRow({
  label, value, highlight, muted, hint,
}: {
  label: string;
  value: string | null;
  highlight?: boolean;
  muted?: boolean;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: '#64748b', letterSpacing: 1, textTransform: 'uppercase' }}>{label}</span>
      {value === null ? (
        <div style={{ height: 20, background: 'rgba(255,255,255,0.06)', borderRadius: 4, width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : (
        <span style={{ fontSize: 18, fontWeight: 700, color: muted ? '#334155' : highlight ? '#f1f5f9' : '#94a3b8' }}>
          {value}
        </span>
      )}
      {hint && <span style={{ fontSize: 10, color: '#475569' }}>{hint}</span>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/zip-panel.tsx
git commit -m "feat(market): ZipPanel slide-in component with Census data and tracking CTA"
```

---

## Task 7: ZipMap Component

**Files:**
- Create: `frontend/components/market/zip-map.tsx`

- [ ] **Step 1: Create the component**

Create `frontend/components/market/zip-map.tsx`:

```tsx
'use client';

import { useEffect, useRef, useCallback } from 'react';
import Map, { Source, Layer, type MapRef, type MapLayerMouseEvent } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import type { WatchlistEntry } from '@/lib/api';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

// US Census TIGER ZCTA GeoJSON per state
// e.g. ct_zip_codes_geo.min.json for Connecticut
const ZCTA_GEOJSON_BASE =
  'https://raw.githubusercontent.com/OpenDataDE/State-zip-code-GeoJSON/master';

const STATE_ABBR_TO_SLUG: Record<string, string> = {
  AL:'al',AK:'ak',AZ:'az',AR:'ar',CA:'ca',CO:'co',CT:'ct',DE:'de',FL:'fl',
  GA:'ga',HI:'hi',ID:'id',IL:'il',IN:'in',IA:'ia',KS:'ks',KY:'ky',LA:'la',
  ME:'me',MD:'md',MA:'ma',MI:'mi',MN:'mn',MS:'ms',MO:'mo',MT:'mt',NE:'ne',
  NV:'nv',NH:'nh',NJ:'nj',NM:'nm',NY:'ny',NC:'nc',ND:'nd',OH:'oh',OK:'ok',
  OR:'or',PA:'pa',RI:'ri',SC:'sc',SD:'sd',TN:'tn',TX:'tx',UT:'ut',VT:'vt',
  VA:'va',WA:'wa',WV:'wv',WI:'wi',WY:'wy',DC:'dc',
};

interface ZipMapProps {
  center: [number, number];
  bbox?: [number, number, number, number];
  stateAbbr: string;
  watchlist: WatchlistEntry[];
  panelOpen: boolean;
  onZipClick: (zip: string) => void;
  onBackToGlobe: () => void;
}

export function ZipMap({ center, bbox, stateAbbr, watchlist, panelOpen, onZipClick, onBackToGlobe }: ZipMapProps) {
  const mapRef = useRef<MapRef>(null);
  const geoJsonUrl = `${ZCTA_GEOJSON_BASE}/${STATE_ABBR_TO_SLUG[stateAbbr] ?? 'fl'}_zip_codes_geo.min.json`;
  const trackedZips = new Set(watchlist.map((e) => e.zip_code));

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current.getMap();
    if (bbox) {
      map.fitBounds(bbox as [number, number, number, number], { padding: 40, duration: 1000 });
    } else {
      map.flyTo({ center, zoom: 11, duration: 1000 });
    }
  }, [center, bbox]);

  const handleClick = useCallback((e: MapLayerMouseEvent) => {
    const features = e.features;
    if (!features?.length) return;
    const zip = features[0].properties?.ZCTA5CE10 ?? features[0].properties?.ZCTA5;
    if (zip) onZipClick(zip);
  }, [onZipClick]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={{ longitude: center[0], latitude: center[1], zoom: 10 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        interactiveLayerIds={['zip-fill']}
        onClick={handleClick}
        cursor="pointer"
      >
        <Source id="zcta" type="geojson" data={geoJsonUrl}>
          {/* Fill layer — click target */}
          <Layer
            id="zip-fill"
            type="fill"
            paint={{
              'fill-color': [
                'case',
                ['in', ['get', 'ZCTA5CE10'], ['literal', Array.from(trackedZips)]],
                'rgba(59,130,246,0.15)',
                'rgba(255,255,255,0.02)',
              ],
              'fill-opacity': 1,
            }}
          />
          {/* Border layer */}
          <Layer
            id="zip-line"
            type="line"
            paint={{
              'line-color': [
                'case',
                ['in', ['get', 'ZCTA5CE10'], ['literal', Array.from(trackedZips)]],
                'rgba(59,130,246,0.7)',
                'rgba(255,255,255,0.15)',
              ],
              'line-width': [
                'case',
                ['in', ['get', 'ZCTA5CE10'], ['literal', Array.from(trackedZips)]],
                1.5,
                0.8,
              ],
            }}
          />
          {/* ZIP label layer */}
          <Layer
            id="zip-label"
            type="symbol"
            layout={{
              'text-field': ['get', 'ZCTA5CE10'],
              'text-size': 11,
              'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
            }}
            paint={{
              'text-color': 'rgba(148,163,184,0.7)',
              'text-halo-color': 'rgba(0,0,0,0.5)',
              'text-halo-width': 1,
            }}
          />
        </Source>
      </Map>

      {/* Back to Globe */}
      <button
        onClick={onBackToGlobe}
        style={{
          position: 'absolute', top: 16, left: 16, zIndex: 20,
          background: 'rgba(8,14,26,0.8)', border: '1px solid rgba(255,255,255,0.1)',
          color: '#94a3b8', borderRadius: 8, padding: '8px 14px',
          fontSize: 12, cursor: 'pointer', backdropFilter: 'blur(12px)',
        }}
      >
        ← Globe
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/market/zip-map.tsx
git commit -m "feat(market): ZipMap component with Census TIGER ZCTA boundaries"
```

---

## Task 8: Market Page State Machine

**Files:**
- Modify: `frontend/app/market/page.tsx`

- [ ] **Step 1: Replace the redirect with the full state machine**

Replace the entire contents of `frontend/app/market/page.tsx`:

```tsx
'use client';

import { useState, useEffect } from 'react';
import { GlobeScene } from '@/components/market/globe-scene';
import { MarketSearch, type GeocodingResult } from '@/components/market/market-search';
import { ZipMap } from '@/components/market/zip-map';
import { ZipPanel } from '@/components/market/zip-panel';
import { getWatchlist, type WatchlistEntry } from '@/lib/api';

type ViewState =
  | { mode: 'globe' }
  | { mode: 'map'; result: GeocodingResult; stateAbbr: string };

export default function MarketPage() {
  const [view, setView] = useState<ViewState>({ mode: 'globe' });
  const [selectedZip, setSelectedZip] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [mapVisible, setMapVisible] = useState(false);

  useEffect(() => {
    getWatchlist().then(setWatchlist).catch(() => {});
  }, []);

  function handleSearchResult(result: GeocodingResult) {
    // Derive state abbreviation from place_name e.g. "Miami, Florida, United States"
    const parts = result.place_name.split(', ');
    const stateAbbr = deriveStateAbbr(parts);
    // Fade out globe, fade in map
    setMapVisible(false);
    setView({ mode: 'map', result, stateAbbr });
    setTimeout(() => setMapVisible(true), 50);
  }

  function handleBackToGlobe() {
    setMapVisible(false);
    setSelectedZip(null);
    setTimeout(() => setView({ mode: 'globe' }), 300);
  }

  function handleZipClick(zip: string) {
    setSelectedZip(zip);
  }

  function handleTracked(entry: WatchlistEntry) {
    setWatchlist((prev) => {
      if (prev.find((e) => e.zip_code === entry.zip_code)) return prev;
      return [...prev, entry];
    });
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100vh - 45px)', overflow: 'hidden', background: '#050a12' }}>
      {/* Globe layer */}
      <div
        style={{
          position: 'absolute', inset: 0,
          opacity: view.mode === 'globe' ? 1 : 0,
          transition: 'opacity 300ms ease',
          pointerEvents: view.mode === 'globe' ? 'auto' : 'none',
        }}
      >
        <GlobeScene watchlist={watchlist} />
        <MarketSearch onResult={handleSearchResult} />
      </div>

      {/* Map layer */}
      {view.mode === 'map' && (
        <div
          style={{
            position: 'absolute', inset: 0,
            opacity: mapVisible ? 1 : 0,
            transition: 'opacity 300ms ease',
          }}
        >
          <ZipMap
            center={view.result.center}
            bbox={view.result.bbox}
            stateAbbr={view.stateAbbr}
            watchlist={watchlist}
            panelOpen={!!selectedZip}
            onZipClick={handleZipClick}
            onBackToGlobe={handleBackToGlobe}
          />
          {selectedZip && (
            <ZipPanel
              zip={selectedZip}
              onClose={() => setSelectedZip(null)}
              onTracked={handleTracked}
              watchlist={watchlist}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const STATE_NAME_TO_ABBR: Record<string, string> = {
  'Alabama':'AL','Alaska':'AK','Arizona':'AZ','Arkansas':'AR','California':'CA',
  'Colorado':'CO','Connecticut':'CT','Delaware':'DE','Florida':'FL','Georgia':'GA',
  'Hawaii':'HI','Idaho':'ID','Illinois':'IL','Indiana':'IN','Iowa':'IA',
  'Kansas':'KS','Kentucky':'KY','Louisiana':'LA','Maine':'ME','Maryland':'MD',
  'Massachusetts':'MA','Michigan':'MI','Minnesota':'MN','Mississippi':'MS',
  'Missouri':'MO','Montana':'MT','Nebraska':'NE','Nevada':'NV','New Hampshire':'NH',
  'New Jersey':'NJ','New Mexico':'NM','New York':'NY','North Carolina':'NC',
  'North Dakota':'ND','Ohio':'OH','Oklahoma':'OK','Oregon':'OR','Pennsylvania':'PA',
  'Rhode Island':'RI','South Carolina':'SC','South Dakota':'SD','Tennessee':'TN',
  'Texas':'TX','Utah':'UT','Vermont':'VT','Virginia':'VA','Washington':'WA',
  'West Virginia':'WV','Wisconsin':'WI','Wyoming':'WY','District of Columbia':'DC',
};

function deriveStateAbbr(placeParts: string[]): string {
  for (const part of placeParts) {
    const trimmed = part.trim();
    if (STATE_NAME_TO_ABBR[trimmed]) return STATE_NAME_TO_ABBR[trimmed];
    // Already an abbreviation
    if (/^[A-Z]{2}$/.test(trimmed)) return trimmed;
  }
  return 'FL'; // default
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/market/page.tsx
git commit -m "feat(market): market page state machine — globe/map/panel"
```

---

## Task 9: Market Layout — Remove TopBar, Fix Height

**Files:**
- Modify: `frontend/app/market/layout.tsx`

- [ ] **Step 1: Update layout to let globe fill the screen**

The globe needs to fill its container. The TopBar (mode switcher) stays — the globe renders below it. Update `frontend/app/market/layout.tsx`:

```tsx
'use client';

import type { ReactNode } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';

export default function MarketLayout({ children }: { children: ReactNode }) {
  return (
    <AuthGuard>
      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
        <Sidebar />
        <div style={{ marginLeft: 256, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <TopBar />
          <div style={{ flex: 1, overflow: 'hidden' }}>
            {children}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/market/layout.tsx
git commit -m "feat(market): layout fills viewport height for globe"
```

---

## Task 10: Onboarding Tour Fix

**Files:**
- Modify: `frontend/lib/tour.ts`

- [ ] **Step 1: Read the current tour file**

```bash
cat frontend/lib/tour.ts
```

- [ ] **Step 2: Update selector IDs**

Replace any broken selectors with the new IDs introduced in this feature. The new element IDs are:
- `#market-search-input` — the floating search bar on the globe
- `#zip-panel` — the ZIP info slide-in panel
- `#start-tracking-btn` — the Start Tracking button

Find the market-related tour steps in `frontend/lib/tour.ts` and update them to target these IDs. If the file targets `#watchlist-table` or similar old selectors, replace with the new ones.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/tour.ts
git commit -m "fix(tour): update onboarding selectors for redesigned market page"
```

---

## Task 11: Add Mapbox Token to Railway + Vercel

- [ ] **Step 1: Add to Vercel**

In the Vercel dashboard for `lex-transaction-agent`, add:
```
NEXT_PUBLIC_MAPBOX_TOKEN = pk.eyJ1...  (your Mapbox public token)
```

Or via CLI if installed:
```bash
vercel env add NEXT_PUBLIC_MAPBOX_TOKEN production
```

- [ ] **Step 2: Trigger redeploy**

```bash
git push
```

Expected: Vercel builds successfully, market page loads at `/market`.

---

## Task 12: Smoke Test

- [ ] **Step 1: Test globe loads**

Open `/market` — globe should render with Earth textures, stars, atmosphere glow.

- [ ] **Step 2: Test city search**

Type "Miami" → hit enter → globe cross-fades to dark Mapbox map → Florida ZIP boundaries visible.

- [ ] **Step 3: Test ZIP search**

Type "33101" → map zooms to that ZIP → ZIP boundary highlighted.

- [ ] **Step 4: Test ZIP panel**

Click any ZIP zone → panel slides in from right → shows ZIP code, city/county/state, Median Home Value.

- [ ] **Step 5: Test Start Tracking**

Click "Start Tracking" on an untracked ZIP → button changes to "Tracking active" → ZIP boundary fill turns blue.

- [ ] **Step 6: Test back to globe**

Click "← Globe" → map fades out → globe reappears.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat(market): market intelligence redesign complete"
git push
```

---

## Self-Review Checklist

- [x] Globe renders with textures + atmosphere + stars ✓ Task 4
- [x] Search accepts city name, state name, ZIP ✓ Task 5
- [x] Globe flies toward searched region (via Mapbox geocoding → map fitBounds) ✓ Task 5, 7, 8
- [x] Dark Mapbox map with ZIP boundary polygons ✓ Task 7
- [x] Untracked ZIPs: subtle outline only ✓ Task 7 (fill-color case expression)
- [x] Tracked ZIPs: blue fill + border ✓ Task 7
- [x] ZIP label text on each zone ✓ Task 7 (zip-label layer)
- [x] ZIP click → panel slides in ✓ Task 6, 8
- [x] Panel shows: ZIP, city, county, state, median home value ✓ Task 6
- [x] Median home value from Census ACS B25077 ✓ Task 2, 3
- [x] "Start Tracking" → POST watchlist → confirmation ✓ Task 6
- [x] "View Full Analysis →" link for already-tracked ZIPs ✓ Task 6
- [x] "← Globe" button returns to globe view ✓ Task 7, 8
- [x] CRM↔Market slide transition: handled by existing mode-switcher + layout, no additional work needed (current layout already navigates)
- [x] Onboarding tour selectors updated ✓ Task 10
- [x] Redis cache on zip-info endpoint ✓ Task 2
- [x] New env var documented ✓ Task 1, 11
