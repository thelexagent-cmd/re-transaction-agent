"""Property scoring engine — scores a listing 0–100 across 5 signals.

Signal weights (must sum to 100):
  35 — near permitted development (tiered by distance)
  25 — price below ZIP median / Zestimate
  20 — old house in old neighborhood (pre-1980)
  10 — price reduction in last 30 days
  10 — days on market > 45
"""

from __future__ import annotations

import math
from dataclasses import dataclass


@dataclass
class ScoringInput:
    price: int | None
    zestimate: int | None
    zip_median_value: int | None
    year_built: int | None
    zip_median_year_built: int | None
    days_on_market: int | None
    price_reduction_30d: int | None
    nearest_permit_distance_mi: float | None


@dataclass
class ScoringResult:
    score: int
    signal_near_permit: bool
    signal_undervalued: bool
    signal_old_house: bool
    signal_price_reduction: bool
    signal_long_dom: bool
    breakdown: dict[str, int]


def score_property(inp: ScoringInput) -> ScoringResult:
    """Return 0–100 opportunity score and per-signal breakdown."""
    pts_permit = _score_permit(inp.nearest_permit_distance_mi)
    pts_value = _score_value(inp.price, inp.zestimate, inp.zip_median_value)
    pts_age = _score_age(inp.year_built, inp.zip_median_year_built)
    pts_reduction = 10 if inp.price_reduction_30d and inp.price_reduction_30d > 0 else 0
    pts_dom = 10 if inp.days_on_market and inp.days_on_market > 45 else 0

    total = pts_permit + pts_value + pts_age + pts_reduction + pts_dom

    return ScoringResult(
        score=min(total, 100),
        signal_near_permit=pts_permit > 0,
        signal_undervalued=pts_value > 0,
        signal_old_house=pts_age > 0,
        signal_price_reduction=pts_reduction > 0,
        signal_long_dom=pts_dom > 0,
        breakdown={
            "near_permit": pts_permit,
            "undervalued": pts_value,
            "old_house": pts_age,
            "price_reduction": pts_reduction,
            "long_dom": pts_dom,
        },
    )


def _score_permit(distance_mi: float | None) -> int:
    """35 pts tiered by distance: <0.5mi=35, 0.5-1mi=25, 1-2mi=17, >2mi=0."""
    if distance_mi is None:
        return 0
    if distance_mi < 0.5:
        return 35
    if distance_mi < 1.0:
        return 25
    if distance_mi < 2.0:
        return 17
    return 0


def _score_value(price: int | None, zestimate: int | None, zip_median: int | None) -> int:
    """25 pts if price is ≥10% below Zestimate OR ≥10% below ZIP median."""
    if price and zestimate and zestimate > 0:
        if (zestimate - price) / zestimate >= 0.10:
            return 25
    if price and zip_median and zip_median > 0:
        if (zip_median - price) / zip_median >= 0.10:
            return 25
    return 0


def _score_age(year_built: int | None, zip_median_year: int | None) -> int:
    """20 pts if house is pre-1980. Extra credit if ZIP median is also old."""
    if year_built is None:
        return 0
    if year_built < 1980:
        return 20
    return 0


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Return great-circle distance in miles between two lat/lng points."""
    R = 3958.8  # Earth radius in miles
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
