"""Market alerts -- fires Telegram + email when a property crosses the score threshold."""

from __future__ import annotations
import logging
import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.config import settings
from app.models.market import MarketAlert, MarketProperty
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


async def maybe_fire_alert(db: AsyncSession, user_id: int, property_id: int,
                            current_score: int, threshold: int) -> bool:
    if current_score < threshold:
        return False
    result = await db.execute(
        select(MarketAlert)
        .where(MarketAlert.property_id == property_id, MarketAlert.user_id == user_id)
        .order_by(MarketAlert.fired_at.desc()).limit(1)
    )
    last_alert = result.scalar_one_or_none()
    if last_alert and abs(current_score - last_alert.score_at_alert) < 10:
        return False
    prop_result = await db.execute(select(MarketProperty).where(MarketProperty.id == property_id))
    prop = prop_result.scalar_one_or_none()
    if not prop:
        return False
    message = _format_telegram_message(prop, current_score)
    html_body = _format_email_html(prop, current_score)
    telegram_ok = await _send_telegram(message)
    email_ok = await _send_email(html_body, prop.address)
    if not telegram_ok and not email_ok:
        logger.error("Both alert channels failed for property %s", prop.zillow_id)
        return False
    alerted_via = "both" if telegram_ok and email_ok else ("telegram" if telegram_ok else "email")
    db.add(MarketAlert(user_id=user_id, property_id=property_id,
                        score_at_alert=current_score, alerted_via=alerted_via))
    await db.flush()
    logger.info("Alert fired for property %d (score %d) via %s", property_id, current_score, alerted_via)
    return True


def _format_telegram_message(prop: MarketProperty, score: int) -> str:
    beds = f"{prop.bedrooms}bd" if prop.bedrooms else "?"
    baths = f"{prop.bathrooms}ba" if prop.bathrooms else "?"
    year = str(prop.year_built) if prop.year_built else "?"
    price = f"${prop.price:,}" if prop.price else "?"
    zest = f"${prop.zestimate:,}" if prop.zestimate else "?"
    lines = [
        f"<b>LEX MARKET ALERT -- Score: {score}/100</b>",
        f"{beds}/{baths} | {year} | {prop.address}",
        "",
    ]
    if prop.nearest_permit_distance_mi is not None:
        lines.append(f"   {prop.nearest_permit_distance_mi:.1f}mi from permitted {prop.nearest_permit_type or 'development'} ({prop.nearest_permit_date or ''})")
    if prop.price and prop.zestimate and prop.zestimate > prop.price:
        pct = round((prop.zestimate - prop.price) / prop.zestimate * 100)
        lines.append(f"   Listed {price} -- {pct}% below Zestimate ({zest})")
    if prop.price_reduction_30d:
        lines.append(f"   Price dropped ${prop.price_reduction_30d:,} in last 30 days")
    if prop.claude_summary:
        lines += ["", prop.claude_summary]
    lines += ["", f"<a href='{settings.dashboard_base_url}/market/{prop.zip_code}'>View on dashboard</a>"]
    return "\n".join(lines)


def _format_email_html(prop: MarketProperty, score: int) -> str:
    price = f"${prop.price:,}" if prop.price else "N/A"
    permit_type = prop.nearest_permit_type or "development"
    permit_date = prop.nearest_permit_date or "recent"
    permit_line = (f"<p>  {prop.nearest_permit_distance_mi:.1f}mi from permitted "
                   f"{permit_type} ({permit_date})</p>"
                   if prop.nearest_permit_distance_mi else "")
    reduction_line = (f"<p>  Price dropped ${prop.price_reduction_30d:,} in 30 days</p>"
                      if prop.price_reduction_30d else "")
    summary_line = f"<p style='color:#374151'>{prop.claude_summary}</p>" if prop.claude_summary else ""
    return f"""<div style='font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px'>
  <h2 style='color:#1e40af'>Lex Market Alert -- Score: {score}/100</h2>
  <p style='font-size:18px;font-weight:bold'>{prop.address}</p>
  <p>{prop.bedrooms or "?"}bd/{prop.bathrooms or "?"}ba | Built {prop.year_built or "unknown"} | Listed {price}</p>
  {permit_line}{reduction_line}{summary_line}
  <a href='{settings.dashboard_base_url}/market/{prop.zip_code}' style='background:#1e40af;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:16px'>View on Dashboard</a>
</div>"""


async def _send_telegram(message: str) -> bool:
    if not settings.telegram_bot_token or not settings.telegram_chat_id:
        logger.warning("Telegram not configured -- skipping alert")
        return False
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {"chat_id": settings.telegram_chat_id, "text": message, "parse_mode": "HTML"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(url, json=payload)
            resp.raise_for_status()
            return True
        except httpx.HTTPError as exc:
            logger.error("Telegram send failed: %s", exc)
            return False


async def _send_email(html_body: str, address: str) -> bool:
    try:
        svc = EmailService()
        await svc.send(to_email=settings.gmail_user, to_name="Nico",
                       subject=f"Lex Market Alert: {address}", html_body=html_body)
        return True
    except Exception as exc:
        logger.error("Email alert failed: %s", exc)
        return False
