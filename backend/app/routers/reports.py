"""Reports router — aggregate analytics for the broker dashboard."""

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/summary")
async def get_report_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return aggregate stats for the broker's transaction portfolio."""
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

    return {
        "total_transactions": total,
        "active": active,
        "closed": closed,
        "cancelled": cancelled,
        "avg_days_to_close": avg_days_to_close,
        "total_volume": total_volume,
        "monthly_data": list(monthly.values()),
    }
