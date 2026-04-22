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
