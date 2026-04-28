"""ZIP info endpoint — Census ACS median home value + geocoding metadata."""

import logging
import json
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
CACHE_TTL = 86400  # 24 hours


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
        city = ""
        county = ""
        state = ""
        state_abbr = ""

        # 1. Census Geocoder — convert ZIP to county/state metadata
        try:
            geo_url = (
                "https://geocoding.geo.census.gov/geocoder/geographies/address"
                f"?benchmark=Public_AR_Current&vintage=Current_Residents"
                f"&address=&city=&state=&zip={zip_code}&format=json"
            )
            geo_resp = await client.get(geo_url)
            if geo_resp.status_code == 200:
                geo_data = geo_resp.json()
                matches = geo_data.get("result", {}).get("addressMatches", [])
                if matches:
                    geos = matches[0].get("geographies", {})
                    state_info = geos.get("States", [{}])[0]
                    county_info = geos.get("Counties", [{}])[0]
                    city = matches[0].get("addressComponents", {}).get("city", "")
                    county = county_info.get("NAME", "")
                    state = state_info.get("NAME", "")
                    state_abbr = state_info.get("STUSAB", "")
        except Exception:
            pass

        # 2. Census ACS5 — median home value (B25077_001E)
        median_value = None
        try:
            census_key = getattr(settings, "census_api_key", "") or getattr(settings, "CENSUS_API_KEY", "")
            acs_url = (
                f"{CENSUS_BASE}?get=B25077_001E,NAME"
                f"&for=zip+code+tabulation+area:{zip_code}"
                + (f"&key={census_key}" if census_key else "")
            )
            acs_resp = await client.get(acs_url)
            if acs_resp.status_code == 200:
                rows = acs_resp.json()
                if len(rows) > 1:
                    raw = rows[1][0]
                    if raw and raw != "-666666666":
                        median_value = int(raw)
                    name_field = rows[1][1] if len(rows[1]) > 1 else ""
                    if not state and ", " in name_field:
                        state = name_field.split(", ")[-1]
                    if not city:
                        city = zip_code
        except Exception:
            pass

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
    """Return city, county, state, and Census ACS median home value for a ZIP."""
    cache_key = f"zip_info:{zip_code}"

    if _redis_available:
        try:
            r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
            cached = await r.get(cache_key)
            await r.aclose()
            if cached:
                return ZipInfoResponse(**json.loads(cached))
        except Exception:
            pass

    data = await _fetch_zip_info(zip_code)
    if data is None:
        raise HTTPException(status_code=404, detail=f"No data found for ZIP {zip_code}")

    if _redis_available:
        try:
            r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
            await r.setex(cache_key, CACHE_TTL, json.dumps(data))
            await r.aclose()
        except Exception:
            pass

    return ZipInfoResponse(**data)
