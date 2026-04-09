"""Reports router — aggregate analytics for the broker dashboard."""

import json
import logging
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["reports"])


def _default_serializer(obj):
    """JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


@router.get("/summary")
async def get_report_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return aggregate stats for the broker's transaction portfolio."""
    # Try Redis cache first
    cache_key = f"reports:summary:{current_user.id}"
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        cached = await r.get(cache_key)
        if cached is not None:
            await r.aclose()
            return json.loads(cached)
    except Exception:
        logger.debug("Redis cache miss or unavailable for %s", cache_key)
        r = None  # type: ignore[assignment]

    result = await db.execute(
        select(Transaction).where(Transaction.user_id == current_user.id)
    )
    all_txns = list(result.scalars().all())

    total = len(all_txns)
    active = sum(1 for t in all_txns if t.status == TransactionStatus.active)
    closed = sum(1 for t in all_txns if t.status == TransactionStatus.closed)
    cancelled = sum(1 for t in all_txns if t.status == TransactionStatus.cancelled)

    # Average days to close (only closed transactions with both dates)
    days_list = []
    for t in all_txns:
        if t.status == TransactionStatus.closed and t.closing_date and t.contract_execution_date:
            delta = (t.closing_date - t.contract_execution_date).days
            if delta >= 0:
                days_list.append(delta)
    avg_days_to_close = round(sum(days_list) / len(days_list), 1) if days_list else None

    # Total volume (sum of purchase prices for closed deals)
    total_volume = sum(
        t.purchase_price for t in all_txns
        if t.status == TransactionStatus.closed and t.purchase_price
    )

    # Monthly breakdown (last 12 months)
    now = datetime.now(timezone.utc)
    monthly: dict[str, dict] = {}
    for i in range(11, -1, -1):
        month_start = (now.replace(day=1) - timedelta(days=i * 30)).replace(
            day=1, hour=0, minute=0, second=0, microsecond=0
        )
        key = month_start.strftime("%Y-%m")
        monthly[key] = {"month": key, "created": 0, "closed": 0, "volume": 0}

    for t in all_txns:
        key = t.created_at.strftime("%Y-%m")
        if key in monthly:
            monthly[key]["created"] += 1
        if t.status == TransactionStatus.closed and t.closing_date:
            ckey = t.closing_date.strftime("%Y-%m")
            if ckey in monthly:
                monthly[ckey]["closed"] += 1
                if t.purchase_price:
                    monthly[ckey]["volume"] += t.purchase_price

    response = {
        "total_transactions": total,
        "active": active,
        "closed": closed,
        "cancelled": cancelled,
        "avg_days_to_close": avg_days_to_close,
        "total_volume": total_volume,
        "monthly_data": list(monthly.values()),
    }

    # Cache result in Redis for 5 minutes
    try:
        if r is None:
            import redis.asyncio as aioredis  # noqa: PLC0415

            r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.set(cache_key, json.dumps(response, default=_default_serializer), ex=300)
        await r.aclose()
    except Exception:
        logger.debug("Failed to cache report summary for user %s", current_user.id)

    return response
