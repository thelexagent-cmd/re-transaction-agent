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
