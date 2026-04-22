"""Market scanner -- orchestrates a full scan for one ZIP code."""

from __future__ import annotations
import logging
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.market import MarketProperty
from app.services.census_client import fetch_zip_stats
from app.services.permit_client import fetch_permits_near
from app.services.property_scorer import ScoringInput, haversine_miles, score_property
from app.services.zillow_client import ZillowListing, fetch_listings

logger = logging.getLogger(__name__)


async def scan_zip(zip_code: str, db: AsyncSession) -> list[tuple[int, int]]:
    logger.info("Market scan starting for ZIP %s", zip_code)
    listings = await fetch_listings(zip_code, settings.zillow_rapidapi_key)
    if not listings:
        logger.warning("No listings found for ZIP %s", zip_code)
        return []
    zip_stats = await fetch_zip_stats(zip_code)
    results: list[tuple[int, int]] = []
    for listing in listings:
        if not listing.zpid:
            continue
        nearest_permit = None
        nearest_distance = None
        if listing.latitude and listing.longitude:
            raw_permits = await fetch_permits_near(listing.latitude, listing.longitude)
            if raw_permits:
                nearest_permit, nearest_distance = _find_nearest_permit(
                    listing.latitude, listing.longitude, raw_permits
                )
        score_result = score_property(
            ScoringInput(
                price=listing.price,
                zestimate=listing.zestimate,
                zip_median_value=zip_stats.median_home_value,
                year_built=listing.year_built,
                zip_median_year_built=zip_stats.median_year_built,
                days_on_market=listing.days_on_market,
                price_reduction_30d=listing.price_reduction_30d,
                nearest_permit_distance_mi=nearest_distance,
            )
        )
        claude_summary = None
        if score_result.score >= 40:
            claude_summary = await _generate_summary(listing, score_result, nearest_permit, nearest_distance, zip_stats)
        prop_id = await _upsert_property(
            db=db, listing=listing, zip_code=zip_code,
            score_result=score_result, nearest_permit=nearest_permit,
            nearest_distance=nearest_distance, claude_summary=claude_summary,
        )
        results.append((prop_id, score_result.score))
    logger.info("Market scan complete for ZIP %s: %d properties processed", zip_code, len(results))
    return results


def _find_nearest_permit(lat: float, lng: float, raw_permits: list[dict]) -> tuple[dict | None, float | None]:
    nearest = None
    nearest_dist = float("inf")
    for p in raw_permits:
        loc = p.get("location", {})
        coords = loc.get("coordinates", [])
        if len(coords) < 2:
            continue
        p_lng, p_lat = float(coords[0]), float(coords[1])
        dist = haversine_miles(lat, lng, p_lat, p_lng)
        if dist < nearest_dist:
            nearest_dist = dist
            nearest = p
    return (nearest, nearest_dist) if nearest else (None, None)


async def _generate_summary(listing: ZillowListing, score_result, nearest_permit, nearest_distance: float | None, zip_stats) -> str:
    import anthropic
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
    signals = []
    if score_result.signal_near_permit and nearest_permit and nearest_distance is not None:
        p_type = nearest_permit.get("permit_type", "development")
        p_date = nearest_permit.get("issue_date", "")[:10]
        signals.append(f"Active {p_type} permit {nearest_distance:.1f}mi away (issued {p_date})")
    if score_result.signal_undervalued and listing.zestimate and listing.price:
        pct = round((listing.zestimate - listing.price) / listing.zestimate * 100)
        signals.append(f"Listed {pct}% below Zestimate (${listing.price:,} vs ${listing.zestimate:,})")
    if score_result.signal_old_house:
        signals.append(f"Built {listing.year_built} -- pre-1980 home in established neighborhood")
    if score_result.signal_price_reduction:
        signals.append(f"Price dropped ${listing.price_reduction_30d:,} in last 30 days")
    if score_result.signal_long_dom:
        signals.append(f"On market {listing.days_on_market} days -- motivated seller signal")
    prompt = (
        f"Property: {listing.address}, {listing.bedrooms}bd/{listing.bathrooms}ba, "
        f"built {listing.year_built}, listed ${listing.price:,}. "
        f"Opportunity score: {score_result.score}/100. "
        f"Signals: {'; '.join(signals)}. "
        f"Write 2 concise sentences for a real estate investor. Be specific. No fluff."
    )
    try:
        msg = await client.messages.create(
            model="claude-haiku-4-5-20251001", max_tokens=150,
            messages=[{"role": "user", "content": prompt}],
        )
        return msg.content[0].text.strip()
    except Exception as exc:
        logger.error("Claude summary failed for %s: %s", listing.address, exc)
        return "; ".join(signals)


async def _upsert_property(db: AsyncSession, listing: ZillowListing, zip_code: str,
                            score_result, nearest_permit: dict | None, nearest_distance: float | None,
                            claude_summary: str | None) -> int:
    result = await db.execute(select(MarketProperty).where(MarketProperty.zillow_id == listing.zpid))
    prop = result.scalar_one_or_none()
    permit_type = nearest_permit.get("permit_type") if nearest_permit else None
    permit_date = (nearest_permit.get("issue_date") or "")[:10] if nearest_permit else None
    permit_address = nearest_permit.get("address") if nearest_permit else None
    if prop is None:
        prop = MarketProperty(
            zip_code=zip_code, zillow_id=listing.zpid, address=listing.address,
            price=listing.price, bedrooms=listing.bedrooms, bathrooms=listing.bathrooms,
            living_area=listing.living_area, year_built=listing.year_built,
            days_on_market=listing.days_on_market, zestimate=listing.zestimate,
            price_reduction_30d=listing.price_reduction_30d,
            latitude=listing.latitude, longitude=listing.longitude, img_src=listing.img_src,
            nearest_permit_distance_mi=nearest_distance, nearest_permit_type=permit_type,
            nearest_permit_date=permit_date, nearest_permit_address=permit_address,
            opportunity_score=score_result.score, claude_summary=claude_summary,
        )
        db.add(prop)
    else:
        prop.price = listing.price
        prop.days_on_market = listing.days_on_market
        prop.zestimate = listing.zestimate
        prop.price_reduction_30d = listing.price_reduction_30d
        prop.nearest_permit_distance_mi = nearest_distance
        prop.nearest_permit_type = permit_type
        prop.nearest_permit_date = permit_date
        prop.nearest_permit_address = permit_address
        prop.opportunity_score = score_result.score
        if claude_summary:
            prop.claude_summary = claude_summary
        prop.last_updated_at = datetime.now(timezone.utc)
    await db.flush()
    await db.refresh(prop)
    return prop.id
