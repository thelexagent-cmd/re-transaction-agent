"""CTC gap alert: fires broker alert when closing is ≤5 days away and no
Clear to Close document has been received.

Idempotent: uses Transaction.ctc_alert_sent flag so the alert fires once.
Phase 4: broker_alert events also trigger notify_broker() email dispatch.
"""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.transaction import Transaction, TransactionStatus

logger = logging.getLogger(__name__)

_CTC_DOC_NAMES = (
    "Loan Commitment Letter / Clear to Close",
    "Clear to Close (CTC) Received from Lender",
)
_ALERT_THRESHOLD_DAYS = 5


async def check_ctc_gap(db: AsyncSession) -> int:
    """Fire broker alerts for active transactions missing a CTC within 5 days
    of closing.

    Args:
        db: Async SQLAlchemy session (caller must commit).

    Returns:
        Number of alert events created.
    """
    today = date.today()

    result = await db.execute(
        select(Transaction).where(
            Transaction.status == TransactionStatus.active,
            Transaction.closing_date.isnot(None),
            Transaction.ctc_alert_sent.is_(False),
        )
    )
    transactions = result.scalars().all()

    fired = 0

    for txn in transactions:
        closing_date: date = txn.closing_date
        days_to_close = (closing_date - today).days

        if days_to_close > _ALERT_THRESHOLD_DAYS:
            continue

        # Check if any CTC document is collected
        docs_result = await db.execute(
            select(Document).where(
                Document.transaction_id == txn.id,
                Document.name.in_(_CTC_DOC_NAMES),
                Document.status == DocumentStatus.collected,
            )
        )
        collected_ctc = docs_result.scalar_one_or_none()

        if collected_ctc is not None:
            continue

        days_label = max(days_to_close, 0)
        txn.ctc_alert_sent = True
        alert_desc = (
            f"Clear to Close not received. "
            f"Closing in {days_label} day(s) ({closing_date.isoformat()}). "
            "Contact lender immediately."
        )
        db.add(Event(
            transaction_id=txn.id,
            event_type="broker_alert",
            description=alert_desc,
        ))
        db.add(txn)
        fired += 1

        # Notify broker via email (best-effort)
        await _notify_broker_safe(txn.id, "Clear to Close Missing", alert_desc, db)

    if fired > 0:
        await db.commit()
        logger.info("CTC gap check: %d alert(s) fired.", fired)
    else:
        logger.debug("CTC gap check: no alerts needed.")

    return fired


async def _notify_broker_safe(
    transaction_id: int, subject: str, message: str, db
) -> None:
    try:
        from app.services.email_service import notify_broker

        await notify_broker(
            transaction_id=transaction_id,
            subject=subject,
            message=message,
            db=db,
        )
    except Exception as exc:
        logger.error(
            "Failed to email broker for CTC alert [txn %d]: %s",
            transaction_id,
            exc,
        )
