"""Miami-Dade Property Appraiser GIS client.

Uses the public MD_LandInformation MapServer (layer 26 — PaParcel) to look up
parcel attributes for a given lat/lng coordinate.  No API key required.

Checks for individual (non-corporate) owner who occupies the property —
a proxy for a real homeowner who is more likely to be a motivated seller
than an LLC, trust, or corporate investor.
"""

from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)

PA_GIS_URL = (
    "https://gis.miamidade.gov/arcgis/rest/services"
    "/MD_LandInformation/MapServer/26/query"
)

_CORPORATE_KEYWORDS = frozenset({
    "LLC", "INC", "CORP", "LTD", "LP", "LLP", "TRUST", "ESTATE",
    "ASSOCIATION", "ASSOC", "BANK", "FUND", "INVESTMENT", "INVESTMENTS",
    "HOLDINGS", "PROPERTIES", "REALTY", "GROUP", "VENTURES", "PARTNERS",
    "PARTNERSHIP", "MANAGEMENT", "MGMT", "INTERNATIONAL", "INTL",
})


async def fetch_parcel_info(lat: float, lng: float) -> dict | None:
    """Return raw parcel attributes for the parcel at (lat, lng), or None."""
    params = {
        "geometry": f"{lng},{lat}",
        "geometryType": "esriGeometryPoint",
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": (
            "FOLIO,TRUE_OWNER1,TRUE_OWNER2,TRUE_OWNER3,"
            "TRUE_SITE_ADDR,TRUE_MAILING_ADDR1,TRUE_MAILING_STATE,"
            "DOR_CODE_CUR,DOR_DESC"
        ),
        "inSR": "4326",
        "returnGeometry": "false",
        "resultRecordCount": "1",
        "f": "json",
    }
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(PA_GIS_URL, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.warning(
                "PA GIS parcel fetch failed near (%.4f, %.4f): %s", lat, lng, exc
            )
            return None

    features = resp.json().get("features") or []
    if not features:
        logger.debug("PA GIS: no parcel found at (%.4f, %.4f)", lat, lng)
        return None

    attrs = features[0].get("attributes") or {}
    logger.debug(
        "PA GIS: folio %s owner=%s at (%.4f, %.4f)",
        attrs.get("FOLIO"), attrs.get("TRUE_OWNER1"), lat, lng,
    )
    return attrs


def is_individual_owner_occupied(attrs: dict) -> bool:
    """Return True if the parcel is owned by an individual living at the property.

    Two conditions must both be true:
    1. No corporate/entity keywords in owner names (suggests natural person)
    2. Mailing address matches site address (owner-occupied / homesteaded)
    """
    owner1 = (attrs.get("TRUE_OWNER1") or "").upper().strip()
    if not owner1:
        return False

    combined_owners = " ".join(filter(None, [
        owner1,
        (attrs.get("TRUE_OWNER2") or "").upper(),
        (attrs.get("TRUE_OWNER3") or "").upper(),
    ]))
    for kw in _CORPORATE_KEYWORDS:
        if kw in combined_owners.split():
            return False

    site = (attrs.get("TRUE_SITE_ADDR") or "").upper().strip()
    mailing = (attrs.get("TRUE_MAILING_ADDR1") or "").upper().strip()
    if not site or not mailing:
        return False

    # Allow partial matches (mailing may have unit suffix or minor formatting diff)
    return site in mailing or mailing.startswith(site[:len(site) // 2 + 1])
