"""Milestone event triggers: fires client update events when key documents are
collected and updates transaction status on closing.

Call check_and_fire_milestones() after any document status change.
All milestone checks are idempotent — each milestone fires at most once,
guarded by checking for an existing milestone event with the same description.
"""

import logging

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.transaction import Transaction, TransactionStatus

logger = logging.getLogger(__name__)

# Mapping: document name substring → milestone description
# Order matters: more specific names should come first to avoid ambiguous matches.
# The "closing complete" entry also sets transaction.status = "closed".
_MILESTONES: list[tuple[str, str, bool]] = [
    # (document_name_substring, milestone_description, is_closing)
    (
        "EMD Receipt Confirmation",
        "Earnest money deposit confirmed received.",
        False,
    ),
    (
        "Home Inspection Report",
        "The home inspection is complete.",
        False,
    ),
    (
        "Inspection Contingency Resolution",
        "The inspection period has been successfully completed.",
        False,
    ),
    (
        "Loan Commitment Letter / Clear to Close",
        "Great news — your financing has been approved.",
        False,
    ),
    (
        "Clear to Close (CTC) Received from Lender",
        "Your lender has issued a Clear to Close.",
        False,
    ),
    (
        "Closing Disclosure Issued",
        "Your Closing Disclosure has been issued. Closing is confirmed.",
        False,
    ),
    (
        "Deed Recording Number Received",
        "Transaction closed. Congratulations — the property has officially transferred.",
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

    for doc_name_substr, milestone_desc, is_closing in _MILESTONES:
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
