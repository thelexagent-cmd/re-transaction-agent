"""Automated follow-up engine: checks pending documents and fires follow-up events.

Follow-up schedule relative to each document's due_date:
  T-5 days (or sooner, still > T-3): first follow-up
  T-3 days (or sooner, still > T-1): second follow-up (escalated tone)
  T-1 day:                           third follow-up + broker alert
  T=0 or past:                       mark document overdue + broker alert

All follow-ups are logged as Event records.  Phase 4 wires each tier to
EmailService.send_template() and — for T-1 and overdue — SMSService.send().
Broker-alert events are also dispatched via notify_broker().

Communication dispatch is best-effort: failures are logged but never crash
the follow-up tracking loop.  A 12-hour cooldown on last_followup_at prevents
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

# Map document responsible_party_role strings → PartyRole enum values
_ROLE_STR_TO_ENUM: dict[str, str] = {
    "buyer": "buyer",
    "seller": "seller",
    "buyers_agent": "buyers_agent",
    "listing_agent": "listing_agent",
    "lender": "lender",
    "title": "title",
    "escrow": "escrow",
    "hoa": "hoa",
}


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
        followup_tier: str | None = None

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
            followup_tier = "overdue"

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
            followup_tier = "t1"

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
            followup_tier = "t3"

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
            followup_tier = "t5"

        for event in events_to_add:
            db.add(event)
        if events_to_add:
            db.add(doc)

        # ── Dispatch email / SMS (best-effort, after DB adds) ─────────────────
        if followup_tier is not None:
            broker_alert_desc = next(
                (e.description for e in events_to_add if e.event_type == "broker_alert"),
                None,
            )
            await _dispatch_followup_comms(
                doc=doc,
                tier=followup_tier,
                days_until_due=days_until_due,
                due_date=due_date,
                broker_alert_desc=broker_alert_desc,
                db=db,
            )

    if sent_count > 0:
        await db.commit()
        logger.info("Follow-up check complete: %d action(s) taken.", sent_count)
    else:
        logger.debug("Follow-up check complete: no actions needed.")

    return sent_count


# ---------------------------------------------------------------------------
# Communication dispatch helpers
# ---------------------------------------------------------------------------

async def _dispatch_followup_comms(
    doc: Document,
    tier: str,
    days_until_due: int,
    due_date: date,
    broker_alert_desc: str | None,
    db: AsyncSession,
) -> None:
    """Send email (and optionally SMS) for a follow-up action.

    All exceptions are caught — communication failures do not affect tracking.
    """
    from app.models.party import Party, PartyRole
    from app.models.transaction import Transaction
    from app.models.user import User
    from app.services.email_service import EmailService, notify_broker
    from app.services.sms_service import SMSService

    try:
        # Load transaction for property address + broker info
        txn_result = await db.execute(
            select(Transaction).where(Transaction.id == doc.transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            return

        # Load broker (user)
        user_result = await db.execute(
            select(User).where(User.id == txn.user_id)
        )
        broker = user_result.scalar_one_or_none()
        broker_name = broker.full_name if broker else ""
        brokerage_name = (broker.brokerage_name or "") if broker else ""

        # Resolve responsible party record (may not exist for all role strings)
        party_record = None
        role_str = doc.responsible_party_role or ""
        if role_str in _ROLE_STR_TO_ENUM:
            try:
                party_role = PartyRole(_ROLE_STR_TO_ENUM[role_str])
                p_result = await db.execute(
                    select(Party).where(
                        Party.transaction_id == doc.transaction_id,
                        Party.role == party_role,
                    )
                )
                party_record = p_result.scalar_one_or_none()
            except Exception:
                pass

        party_name = party_record.full_name if party_record else role_str
        party_email = party_record.email if party_record else None
        party_phone = party_record.phone if party_record else None

        # Build template vars
        if tier == "overdue":
            days_label = "OVERDUE"
            template_name = "document_followup_t1"
        elif tier == "t1":
            days_label = "Due Tomorrow"
            template_name = "document_followup_t1"
        elif tier == "t3":
            days_label = str(days_until_due)
            template_name = "document_followup_t3"
        else:  # t5
            days_label = str(days_until_due)
            template_name = "document_followup_t5"

        template_vars = {
            "party_name": party_name,
            "document_name": doc.name,
            "deadline_date": due_date.isoformat(),
            "days_until_due": days_label,
            "property_address": txn.address,
            "broker_name": broker_name,
            "brokerage_name": brokerage_name,
            "broker_email": broker.email if broker else "",
        }

        # Send email to responsible party
        if party_email:
            svc = EmailService()
            await svc.send_template(
                to_email=party_email,
                to_name=party_name,
                template_name=template_name,
                template_vars=template_vars,
            )
            logger.info(
                "Follow-up email (%s) sent to %s for doc '%s' [txn %d].",
                tier,
                party_email,
                doc.name,
                doc.transaction_id,
            )

        # Send SMS for T-1 and overdue if phone is available
        if tier in ("t1", "overdue") and party_phone:
            sms_svc = SMSService()
            sms_msg = (
                f"URGENT: '{doc.name}' is {days_label} for {txn.address}. "
                f"Please submit immediately. — {broker_name}"
            )
            await sms_svc.send(to_phone=party_phone, message=sms_msg)
            logger.info(
                "Follow-up SMS (%s) sent to %s for doc '%s' [txn %d].",
                tier,
                party_phone,
                doc.name,
                doc.transaction_id,
            )

        # Notify broker for T-1 and overdue alert events
        if tier in ("t1", "overdue") and broker_alert_desc:
            await notify_broker(
                transaction_id=doc.transaction_id,
                subject=f"Document {days_label}: {doc.name}",
                message=broker_alert_desc,
                db=db,
            )

    except Exception as exc:
        logger.error(
            "Failed to dispatch follow-up comms for doc '%s' [txn %d]: %s",
            doc.name,
            doc.transaction_id,
            exc,
        )
