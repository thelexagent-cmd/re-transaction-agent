"""Deadline alert engine: fires T-3, T-1, and T=0 alerts for all tracked deadlines.

All logic is idempotent — safe to run multiple times per day:
  - alert_t3_sent flag prevents duplicate T-3 alerts
  - alert_t1_sent flag prevents duplicate T-1 alerts
  - status == "missed" prevents re-triggering T=0 alerts

Phase 4: broker_alert events also trigger notify_broker() email dispatch.
"""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.deadline import Deadline, DeadlineStatus
from app.models.event import Event
from app.models.transaction import Transaction, TransactionStatus

logger = logging.getLogger(__name__)


async def check_deadlines(db: AsyncSession) -> int:
    """Scan all active-transaction deadlines and fire T-3 / T-1 / T=0 alerts.

    Uses catch-up logic: if the scheduler missed a run, earlier thresholds are
    still fired on the next run (e.g. T-3 fires even if we first check at T-1).

    Args:
        db: Async SQLAlchemy session (caller must commit).

    Returns:
        Number of alert events created.
    """
    today = date.today()

    # Load deadlines that are still actionable (upcoming or warning) and belong
    # to active transactions.
    result = await db.execute(
        select(Deadline)
        .join(Transaction, Transaction.id == Deadline.transaction_id)
        .where(
            Deadline.status.in_([DeadlineStatus.upcoming, DeadlineStatus.warning]),
            Transaction.status == TransactionStatus.active,
        )
        .options(selectinload(Deadline.transaction))
    )
    deadlines = result.scalars().all()

    fired = 0

    for dl in deadlines:
        days_left = (dl.due_date - today).days  # negative = past due
        events_to_add: list[Event] = []

        # ── T-3 alert (days_left <= 3, catch-up included) ─────────────────────
        if days_left <= 3 and not dl.alert_t3_sent:
            dl.status = DeadlineStatus.warning
            dl.alert_t3_sent = True
            events_to_add.append(Event(
                transaction_id=dl.transaction_id,
                event_type="deadline_warning_t3",
                description=(
                    f"Deadline '{dl.name}' is in {max(days_left, 0)} day(s) "
                    f"({dl.due_date.isoformat()})."
                ),
            ))

        # ── T-1 alert (days_left <= 1, catch-up included) ─────────────────────
        if days_left <= 1 and days_left > 0 and not dl.alert_t1_sent:
            dl.alert_t1_sent = True
            events_to_add.append(Event(
                transaction_id=dl.transaction_id,
                event_type="deadline_warning_t1",
                description=(
                    f"Deadline '{dl.name}' is due tomorrow "
                    f"({dl.due_date.isoformat()})."
                ),
            ))
            events_to_add.append(Event(
                transaction_id=dl.transaction_id,
                event_type="broker_alert",
                description=(
                    f"BROKER ALERT — Deadline tomorrow: '{dl.name}' "
                    f"due {dl.due_date.isoformat()}. Immediate attention required."
                ),
            ))

        # ── T=0 / missed (days_left <= 0) ─────────────────────────────────────
        if days_left <= 0:
            # Ensure T-1 flag is set even if scheduler ran late
            if not dl.alert_t1_sent:
                dl.alert_t1_sent = True

            dl.status = DeadlineStatus.missed
            events_to_add.append(Event(
                transaction_id=dl.transaction_id,
                event_type="deadline_missed",
                description=(
                    f"Deadline MISSED: '{dl.name}' was due "
                    f"{dl.due_date.isoformat()} "
                    f"({abs(days_left)} day(s) ago)."
                ),
            ))
            events_to_add.append(Event(
                transaction_id=dl.transaction_id,
                event_type="broker_alert",
                description=(
                    f"BROKER ALERT — Deadline missed: '{dl.name}' "
                    f"(was due {dl.due_date.isoformat()}). Deal at risk."
                ),
            ))

        for ev in events_to_add:
            db.add(ev)
        if events_to_add:
            db.add(dl)
            fired += len(events_to_add)

        # Dispatch broker alert emails (best-effort)
        for ev in events_to_add:
            if ev.event_type == "broker_alert":
                await _notify_broker_safe(dl.transaction_id, dl.name, ev.description, db)

    if fired > 0:
        await db.commit()
        logger.info("Deadline check complete: %d alert event(s) fired.", fired)
    else:
        logger.debug("Deadline check complete: no alerts needed.")

    return fired


async def _notify_broker_safe(
    transaction_id: int, deadline_name: str, message: str, db
) -> None:
    try:
        from app.services.email_service import notify_broker

        await notify_broker(
            transaction_id=transaction_id,
            subject=f"Deadline Alert: {deadline_name}",
            message=message,
            db=db,
        )
    except Exception as exc:
        logger.error(
            "Failed to email broker for deadline alert [txn %d]: %s",
            transaction_id,
            exc,
        )
