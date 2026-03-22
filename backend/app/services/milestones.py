"""Milestone event triggers: fires client update events when key documents are
collected and updates transaction status on closing.

Call check_and_fire_milestones() after any document status change.
All milestone checks are idempotent — each milestone fires at most once,
guarded by checking for an existing milestone event with the same description.

Phase 4: after logging a milestone Event, sends appropriate email to buyer
and seller via EmailService.  Failures are logged but never propagate.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.transaction import Transaction, TransactionStatus

logger = logging.getLogger(__name__)

# Mapping: document name substring → (milestone_description, template_name, is_closing)
# Order matters: more specific names should come first to avoid ambiguous matches.
_MILESTONES: list[tuple[str, str, str, bool]] = [
    # (document_name_substring, milestone_description, email_template_name, is_closing)
    (
        "EMD Receipt Confirmation",
        "Earnest money deposit confirmed received.",
        "milestone_emd_confirmed",
        False,
    ),
    (
        "Home Inspection Report",
        "The home inspection is complete.",
        "milestone_inspection_complete",
        False,
    ),
    (
        "Inspection Contingency Resolution",
        "The inspection period has been successfully completed.",
        "milestone_inspection_complete",
        False,
    ),
    (
        "Loan Commitment Letter / Clear to Close",
        "Great news — your financing has been approved.",
        "milestone_loan_commitment",
        False,
    ),
    (
        "Clear to Close (CTC) Received from Lender",
        "Your lender has issued a Clear to Close.",
        "milestone_ctc",
        False,
    ),
    (
        "Closing Disclosure Issued",
        "Your Closing Disclosure has been issued. Closing is confirmed.",
        "milestone_closing_disclosure",
        False,
    ),
    (
        "Deed Recording Number Received",
        "Transaction closed. Congratulations — the property has officially transferred.",
        "milestone_closed",
        True,  # triggers transaction status → closed
    ),
]


async def check_and_fire_milestones(
    transaction_id: int,
    db: AsyncSession,
) -> int:
    """Check if any milestone has been reached and fire the corresponding event.

    Should be called after any document status change for the transaction.

    Args:
        transaction_id: The transaction to evaluate.
        db:             Async SQLAlchemy session (caller must commit).

    Returns:
        Number of new milestone events fired.
    """
    # Load all collected documents for this transaction
    docs_result = await db.execute(
        select(Document).where(
            Document.transaction_id == transaction_id,
            Document.status == DocumentStatus.collected,
        )
    )
    collected_docs = docs_result.scalars().all()
    collected_names = {doc.name for doc in collected_docs}

    # Load all existing milestone event descriptions to prevent duplicates
    events_result = await db.execute(
        select(Event.description).where(
            Event.transaction_id == transaction_id,
            Event.event_type == "milestone",
        )
    )
    existing_milestone_descriptions = {row[0] for row in events_result.all()}

    fired = 0

    for doc_name_substr, milestone_desc, template_name, is_closing in _MILESTONES:
        # Check if any collected doc name contains the milestone substring
        matched = any(doc_name_substr in name for name in collected_names)
        if not matched:
            continue

        # Idempotency: skip if we already fired this milestone
        if milestone_desc in existing_milestone_descriptions:
            continue

        db.add(Event(
            transaction_id=transaction_id,
            event_type="milestone",
            description=milestone_desc,
        ))
        existing_milestone_descriptions.add(milestone_desc)  # prevent double-fire within loop
        fired += 1

        if is_closing:
            # Mark the transaction as closed
            txn_result = await db.execute(
                select(Transaction).where(Transaction.id == transaction_id)
            )
            txn = txn_result.scalar_one_or_none()
            if txn is not None and txn.status == TransactionStatus.active:
                txn.status = TransactionStatus.closed
                db.add(txn)
                logger.info("Transaction %d marked as closed.", transaction_id)

        # Send milestone email to buyer and seller (best-effort)
        await _send_milestone_emails(
            transaction_id=transaction_id,
            milestone_desc=milestone_desc,
            template_name=template_name,
            db=db,
        )

    if fired > 0:
        await db.flush()
        logger.info(
            "Milestone check for transaction %d: %d new milestone(s) fired.",
            transaction_id,
            fired,
        )
    else:
        logger.debug(
            "Milestone check for transaction %d: no new milestones.", transaction_id
        )

    return fired


# ---------------------------------------------------------------------------
# Email dispatch for milestones
# ---------------------------------------------------------------------------

async def _send_milestone_emails(
    transaction_id: int,
    milestone_desc: str,
    template_name: str,
    db: AsyncSession,
) -> None:
    """Send the milestone email to buyer and seller.

    All exceptions are caught — email failures do not affect milestone tracking.
    """
    from app.models.party import Party, PartyRole
    from app.models.user import User
    from app.services.email_service import EmailService

    try:
        # Load transaction
        txn_result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            return

        # Load broker
        user_result = await db.execute(
            select(User).where(User.id == txn.user_id)
        )
        broker = user_result.scalar_one_or_none()
        broker_name = broker.full_name if broker else ""
        brokerage_name = (broker.brokerage_name or "") if broker else ""

        # Load title company name for wire fraud warning (closing disclosure)
        title_result = await db.execute(
            select(Party).where(
                Party.transaction_id == transaction_id,
                Party.role == PartyRole.title,
            )
        )
        title_party = title_result.scalar_one_or_none()
        title_company = title_party.full_name if title_party else "the title company"

        closing_date = txn.closing_date.isoformat() if txn.closing_date else "TBD"

        base_vars = {
            "property_address": txn.address,
            "broker_name": broker_name,
            "brokerage_name": brokerage_name,
            "closing_date": closing_date,
            "title_company": title_company,
        }

        svc = EmailService()

        # Send to buyer
        buyer_result = await db.execute(
            select(Party).where(
                Party.transaction_id == transaction_id,
                Party.role == PartyRole.buyer,
            )
        )
        buyer = buyer_result.scalar_one_or_none()
        if buyer and buyer.email:
            await svc.send_template(
                to_email=buyer.email,
                to_name=buyer.full_name,
                template_name=template_name,
                template_vars={**base_vars, "party_name": buyer.full_name},
            )
            logger.info(
                "Milestone email (%s) sent to buyer %s [txn %d].",
                template_name,
                buyer.email,
                transaction_id,
            )

        # Send to seller
        seller_result = await db.execute(
            select(Party).where(
                Party.transaction_id == transaction_id,
                Party.role == PartyRole.seller,
            )
        )
        seller = seller_result.scalar_one_or_none()
        if seller and seller.email:
            await svc.send_template(
                to_email=seller.email,
                to_name=seller.full_name,
                template_name=template_name,
                template_vars={**base_vars, "party_name": seller.full_name},
            )
            logger.info(
                "Milestone email (%s) sent to seller %s [txn %d].",
                template_name,
                seller.email,
                transaction_id,
            )

    except Exception as exc:
        logger.error(
            "Failed to send milestone emails for transaction %d (%s): %s",
            transaction_id,
            milestone_desc,
            exc,
        )
