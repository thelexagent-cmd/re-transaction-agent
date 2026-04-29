"""Miami-Dade building permit client — fetches active permits near a lat/lng.

API: Miami-Dade ArcGIS FeatureServer (free, no key required)
Endpoint: services.arcgis.com/8Pc9XBTAsYuxx9Ny/.../BuildingPermit_gdb/FeatureServer/0/query

Filters to BLDG permits issued in the last 3 years.
Returns normalized dicts compatible with market_scanner.py expectations.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import httpx

logger = logging.getLogger(__name__)

PERMIT_URL = (
    "https://services.arcgis.com/8Pc9XBTAsYuxx9Ny/arcgis/rest/services"
    "/BuildingPermit_gdb/FeatureServer/0/query"
)
SEARCH_RADIUS_MILES = 2.0


async def fetch_permits_near(lat: float, lng: float) -> list[dict]:
    """Return normalized permit records within 2 miles of the given coordinates."""
    cutoff_ms = int(
        (datetime.now(timezone.utc) - timedelta(days=365 * 3)).timestamp() * 1000
    )
    where = f"TYPE='BLDG' AND ISSUDATE >= {cutoff_ms}"
    params = {
        "geometry": f"{lng},{lat}",
        "geometryType": "esriGeometryPoint",
        "distance": SEARCH_RADIUS_MILES,
        "units": "esriSRUnit_StatuteMile",
        "inSR": "4326",
        "spatialRel": "esriSpatialRelIntersects",
        "where": where,
        "outFields": "PROCNUM,TYPE,ISSUDATE,ESTVALUE,ADDRESS,BPSTATUS",
        "returnGeometry": "true",
        "outSR": "4326",
        "resultRecordCount": "10",
        "orderByFields": "ISSUDATE DESC",
        "f": "json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(PERMIT_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning("Permit fetch failed near (%.4f, %.4f): %s", lat, lng, exc)
            return []

    data = resp.json()
    features = data.get("features") or []

    permits = []
    for f in features:
        attrs = f.get("attributes") or {}
        geom = f.get("geometry") or {}

        issue_ms = attrs.get("ISSUDATE")
        issue_date = (
            datetime.fromtimestamp(issue_ms / 1000, tz=timezone.utc).strftime("%Y-%m-%d")
            if issue_ms
            else ""
        )
        job_value_raw = attrs.get("ESTVALUE") or "0"
        try:
            job_value = int(job_value_raw.lstrip("0") or "0")
        except (ValueError, AttributeError):
            job_value = None

        permits.append({
            "location": {"coordinates": [geom.get("x"), geom.get("y")]},
            "permit_type": attrs.get("TYPE", "BLDG"),
            "issue_date": issue_date,
            "job_value": job_value,
            "address": (attrs.get("ADDRESS") or "").strip(),
        })

    logger.info("Permits: %d found near (%.4f, %.4f)", len(permits), lat, lng)
    return permits
