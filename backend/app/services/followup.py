"""Automated follow-up engine: checks pending documents and fires follow-up events.

Follow-up schedule relative to each document's due_date:
  T-5 days (or sooner, still > T-3): first follow-up
  T-3 days (or sooner, still > T-1): second follow-up (escalated tone)
  T-1 day:                           third follow-up + broker alert
  T=0 or past:                       mark document overdue + broker alert

All follow-ups are logged as Event records (email/SMS delivery is Phase 4).
The function is idempotent: a 12-hour cooldown on last_followup_at prevents
duplicate sends when the scheduler runs multiple times per day.
"""

import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus
from app.models.event import Event

logger = logging.getLogger(__name__)

_FOLLOWUP_COOLDOWN_HOURS = 12


async def check_and_send_followups(db: AsyncSession) -> int:
    """Check all pending/overdue documents and create follow-up Event records.

    Uses a tier-range approach so a missed hourly run doesn't permanently
    skip a follow-up window:
      - days_until_due in (4, 5]  → T-5 first follow-up
      - days_until_due in (1, 3]  → T-3 second follow-up (escalated)
      - days_until_due == 1       → T-1 third follow-up + broker alert
      - days_until_due <= 0       → mark overdue + broker alert

    Args:
        db: Async SQLAlchemy session.

    Returns:
        Number of follow-up actions taken (events created).
    """
    today = date.today()
    now = datetime.now(tz=timezone.utc)
    cooldown_cutoff = now - timedelta(hours=_FOLLOWUP_COOLDOWN_HOURS)

    result = await db.execute(
        select(Document).where(
            Document.status.in_([DocumentStatus.pending, DocumentStatus.overdue]),
            Document.due_date.isnot(None),
        )
    )
    documents = result.scalars().all()

    sent_count = 0

    for doc in documents:
        due_date: date = doc.due_date
        days_until_due = (due_date - today).days  # negative = past due

        # Respect cooldown: skip if a follow-up was sent recently
        if doc.last_followup_at is not None:
            last_at = doc.last_followup_at
            if last_at.tzinfo is None:
                last_at = last_at.replace(tzinfo=timezone.utc)
            if last_at >= cooldown_cutoff:
                continue

        party = doc.responsible_party_role or "responsible party"
        txn_ref = f"transaction {doc.transaction_id}"
        events_to_add: list[Event] = []

        if days_until_due <= 0:
            # ── T=0 or past: mark overdue + immediate broker alert ────────────
            if doc.status != DocumentStatus.overdue:
                doc.status = DocumentStatus.overdue

            overdue_days = abs(days_until_due)
            overdue_label = (
                f"{overdue_days} day(s) past due" if overdue_days > 0 else "due today"
            )

            events_to_add.append(
                Event(
                    transaction_id=doc.transaction_id,
                    event_type="followup_sent",
                    description=(
                        f"OVERDUE — '{doc.name}' is {overdue_label} "
                        f"(was due {due_date.isoformat()}). "
                        f"Responsible party: {party}. [{txn_ref}]"
                    ),
                )
            )
            events_to_add.append(
                Event(
                    transaction_id=doc.transaction_id,
                    event_type="broker_alert",
                    description=(
                        f"BROKER ALERT — Document overdue: '{doc.name}' "
                        f"({overdue_label}, due {due_date.isoformat()}). "
                        f"Responsible: {party}. Immediate attention required."
                    ),
                )
            )
            doc.last_followup_at = now
            sent_count += 1

        elif days_until_due == 1:
            # ── T-1: third follow-up + broker alert ──────────────────────────
            events_to_add.append(
                Event(
                    transaction_id=doc.transaction_id,
                    event_type="followup_sent",
                    description=(
                        f"T-1 follow-up (URGENT) — '{doc.name}' due tomorrow "
                        f"({due_date.isoformat()}). "
                        f"Responsible party: {party}. [{txn_ref}]"
                    ),
                )
            )
            events_to_add.append(
                Event(
                    transaction_id=doc.transaction_id,
                    event_type="broker_alert",
                    description=(
                        f"BROKER ALERT — 1 day remaining: '{doc.name}' "
                        f"due {due_date.isoformat()}. Responsible: {party}."
                    ),
                )
            )
            doc.last_followup_at = now
            sent_count += 1

        elif days_until_due <= 3:
            # ── T-3 window (2–3 days): second follow-up (escalated) ───────────
            events_to_add.append(
                Event(
                    transaction_id=doc.transaction_id,
                    event_type="followup_sent",
                    description=(
                        f"T-3 follow-up (escalated) — '{doc.name}' due in "
                        f"{days_until_due} day(s) ({due_date.isoformat()}). "
                        f"Responsible party: {party}. [{txn_ref}]"
                    ),
                )
            )
            doc.last_followup_at = now
            sent_count += 1

        elif days_until_due <= 5:
            # ── T-5 window (4–5 days): first follow-up ────────────────────────
            events_to_add.append(
                Event(
                    transaction_id=doc.transaction_id,
                    event_type="followup_sent",
                    description=(
                        f"T-5 follow-up — '{doc.name}' due in "
                        f"{days_until_due} day(s) ({due_date.isoformat()}). "
                        f"Responsible party: {party}. [{txn_ref}]"
                    ),
                )
            )
            doc.last_followup_at = now
            sent_count += 1

        for event in events_to_add:
            db.add(event)
        if events_to_add:
            db.add(doc)

    if sent_count > 0:
        await db.commit()
        logger.info("Follow-up check complete: %d action(s) taken.", sent_count)
    else:
        logger.debug("Follow-up check complete: no actions needed.")

    return sent_count
