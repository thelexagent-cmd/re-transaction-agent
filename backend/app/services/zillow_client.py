"""Realtor Data API client — fetches for-sale listings for a ZIP code.

API: Realtor Data API on RapidAPI (realtor-data1.p.rapidapi.com)
Endpoint: POST /property_list/
Body: {"query": {"status": ["for_sale"], "postal_code": "<zip>"}, "limit": 50}

Response shape (relevant fields):
  results[]: property_id, price, beds, baths, sqft, year_built, days_on_market,
             list_date, original_list_price, address{line, city, state, postal_code,
             coordinate{lat, lon}}, primary_photo{href}
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

REALTOR_BASE = "https://realtor-data1.p.rapidapi.com"


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
    zestimate: int | None          # not available from Realtor; always None
    price_reduction_30d: int | None
    latitude: float | None
    longitude: float | None
    img_src: str | None


async def fetch_listings(zip_code: str, rapidapi_key: str) -> list[ZillowListing]:
    """Return active for-sale house listings in the given ZIP code."""
    headers = {
        "X-RapidAPI-Key": rapidapi_key,
        "X-RapidAPI-Host": "realtor-data1.p.rapidapi.com",
        "Content-Type": "application/json",
    }
    body = {
        "query": {
            "status": ["for_sale"],
            "postal_code": zip_code,
            "type": ["single_family"],
        },
        "limit": 50,
        "offset": 0,
        "sort": {"direction": "desc", "field": "list_date"},
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.post(
                f"{REALTOR_BASE}/property_list/",
                headers=headers,
                json=body,
            )
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Realtor API search failed for ZIP %s: %s", zip_code, exc)
            return []

    data = resp.json()
    # Response is either {"results": [...]} or {"data": {"home_search": {"results": [...]}}}
    results = (
        data.get("results")
        or (data.get("data", {}).get("home_search") or {}).get("results")
        or []
    )

    listings: list[ZillowListing] = []
    for p in results:
        addr_obj = p.get("location", {}).get("address") or p.get("address") or {}
        coord = addr_obj.get("coordinate") or {}

        address_str = _build_address(addr_obj)
        price = _to_int(p.get("list_price") or p.get("price"))
        original_price = _to_int(p.get("original_list_price"))
        price_reduction = (
            original_price - price
            if price and original_price and original_price > price
            else None
        )

        listings.append(
            ZillowListing(
                zpid=str(p.get("property_id") or p.get("zpid") or ""),
                address=address_str,
                price=price,
                bedrooms=_to_int(p.get("description", {}).get("beds") or p.get("beds")),
                bathrooms=_to_float(
                    p.get("description", {}).get("baths_consolidated")
                    or p.get("description", {}).get("baths")
                    or p.get("baths")
                ),
                living_area=_to_int(
                    p.get("description", {}).get("sqft") or p.get("sqft")
                ),
                year_built=_to_int(
                    p.get("description", {}).get("year_built") or p.get("year_built")
                ),
                days_on_market=_to_int(
                    p.get("list_date_delta") or p.get("days_on_market")
                ),
                zestimate=None,  # Realtor.com doesn't provide Zestimate
                price_reduction_30d=price_reduction,
                latitude=_to_float(coord.get("lat")),
                longitude=_to_float(coord.get("lon")),
                img_src=(
                    (p.get("primary_photo") or {}).get("href")
                    or p.get("img_src")
                ),
            )
        )

    logger.info("Realtor API: %d listings fetched for ZIP %s", len(listings), zip_code)
    return listings


def _build_address(addr: dict) -> str:
    parts = [addr.get("line"), addr.get("city"), addr.get("state_code"), addr.get("postal_code")]
    return ", ".join(p for p in parts if p) or addr.get("street_address", "")


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
