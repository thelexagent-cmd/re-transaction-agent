"""Realty US API client — fetches for-sale listings for a ZIP code.

API: Realty US by Things4u (ntd119) on RapidAPI (realty-us.p.rapidapi.com)
Endpoint: GET /properties/search-buy?location=postal_code%3A<zip>&limit=50
Free tier: check RapidAPI subscription

Response shape (relevant fields):
  data.results[]: property_id, status, list_price, list_date, price_reduced_amount,
                  description{beds, baths, sqft, type, year_built},
                  flags{is_price_reduced, is_new_listing, is_foreclosure},
                  estimate{estimate},
                  location.address{line, city, postal_code, state_code, coordinate{lat,lon}},
                  primary_photo{href}, days_on_market
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from urllib.parse import quote

import httpx

logger = logging.getLogger(__name__)

REALTY_BASE = "https://realty-us.p.rapidapi.com"


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
    price_reduction_30d: int | None
    latitude: float | None
    longitude: float | None
    img_src: str | None


async def fetch_listings(zip_code: str, rapidapi_key: str) -> list[ZillowListing]:
    """Return active for-sale listings in the given ZIP code.

    Uses location format: postal_code:<zip> — no auto-complete call needed.
    """
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": "realty-us.p.rapidapi.com",
    }
    params = {
        "location": f"postal_code:{zip_code}",
        "limit": "50",
        "offset": "0",
        "sort": "newest",
        "prop_type": "single_family",
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(
                f"{REALTY_BASE}/properties/search-buy",
                headers=headers,
                params=params,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Realty US API search failed for ZIP %s: %s", zip_code, exc)
            return []

    data = resp.json()
    results = (data.get("data") or {}).get("results") or []

    listings: list[ZillowListing] = []
    for p in results:
        if p.get("status") != "for_sale":
            continue

        addr_obj = (p.get("location") or {}).get("address") or {}
        coord = addr_obj.get("coordinate") or {}
        desc = p.get("description") or {}
        flags = p.get("flags") or {}
        estimate_obj = p.get("estimate") or {}

        address_str = _build_address(addr_obj)
        price = _to_int(p.get("list_price"))
        zestimate = _to_int(estimate_obj.get("estimate"))
        price_reduction = _to_int(p.get("price_reduced_amount"))

        listings.append(
            ZillowListing(
                zpid=str(p.get("property_id") or ""),
                address=address_str,
                price=price,
                bedrooms=_to_int(desc.get("beds")),
                bathrooms=_to_float(desc.get("baths")),
                living_area=_to_int(desc.get("sqft")),
                year_built=_to_int(desc.get("year_built")),
                days_on_market=_to_int(p.get("days_on_market")),
                zestimate=zestimate,
                price_reduction_30d=price_reduction,
                latitude=_to_float(coord.get("lat")),
                longitude=_to_float(coord.get("lon")),
                img_src=(p.get("primary_photo") or {}).get("href"),
            )
        )

    logger.info("Realty US API: %d listings fetched for ZIP %s", len(listings), zip_code)
    return listings


def _build_address(addr: dict) -> str:
    parts = [addr.get("line"), addr.get("city"), addr.get("state_code"), addr.get("postal_code")]
    return ", ".join(p for p in parts if p)


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
