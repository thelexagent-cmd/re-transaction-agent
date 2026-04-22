"""US Census ACS5 client — fetches ZIP-level median home value and median year built.

API: api.census.gov (free, no key required for basic use)
Endpoint: GET /data/2022/acs/acs5
  ?get=B25077_001E,B25035_001E
  &for=zip+code+tabulation+area:{zip}

B25077_001E = median value of owner-occupied housing units (dollars)
B25035_001E = median year structure built
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

CENSUS_BASE = "https://api.census.gov/data/2022/acs/acs5"


@dataclass
class ZipStats:
    zip_code: str
    median_home_value: int | None
    median_year_built: int | None


async def fetch_zip_stats(zip_code: str) -> ZipStats:
    """Return median home value and median year built for a ZIP code."""
    params = {
        "get": "B25077_001E,B25035_001E",
        "for": f"zip code tabulation area:{zip_code}",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        try:
            resp = await client.get(CENSUS_BASE, params=params)
            resp.raise_for_status()
        except httpx.HTTPError as exc:
            logger.error("Census fetch failed for ZIP %s: %s", zip_code, exc)
            return ZipStats(zip_code=zip_code, median_home_value=None, median_year_built=None)

    rows = resp.json()
    # rows[0] = header, rows[1] = data
    if len(rows) < 2:
        return ZipStats(zip_code=zip_code, median_home_value=None, median_year_built=None)

    _, data_row = rows[0], rows[1]
    try:
        median_value = int(data_row[0]) if data_row[0] and data_row[0] != "-666666666" else None
        median_year = int(data_row[1]) if data_row[1] and data_row[1] != "-666666666" else None
    except (ValueError, IndexError):
        median_value = None
        median_year = None

    logger.info("Census ZIP %s: median_value=%s median_year=%s", zip_code, median_value, median_year)
    return ZipStats(zip_code=zip_code, median_home_value=median_value, median_year_built=median_year)
