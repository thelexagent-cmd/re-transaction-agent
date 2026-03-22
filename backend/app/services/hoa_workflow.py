"""HOA rescission sub-workflow.

Florida law gives buyers 3 business days to cancel after receiving HOA docs.
This module manages the rescission countdown and clearance.
"""

import logging
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deadline import Deadline, DeadlineStatus
from app.models.event import Event
from app.services.timeline import _add_business_days

logger = logging.getLogger(__name__)

_RESCISSION_DEADLINE_NAME = "HOA Rescission Period Ends"


async def start_hoa_rescission_clock(
    transaction_id: int,
    delivery_date: date,
    db: AsyncSession,
) -> Deadline:
    """Start the 3-business-day HOA rescission countdown.

    Called when HOA documents are marked as delivered to the buyer.
    Creates a new Deadline and fires broker alert events.

    Args:
        transaction_id: Parent transaction ID.
        delivery_date:  Date HOA docs were delivered to buyer.
        db:             Async SQLAlchemy session (caller must commit).

    Returns:
        The newly created Deadline record.
    """
    rescission_end = _add_business_days(delivery_date, 3)

    deadline = Deadline(
        transaction_id=transaction_id,
        name=_RESCISSION_DEADLINE_NAME,
        due_date=rescission_end,
        status=DeadlineStatus.upcoming,
        alert_t3_sent=False,
        alert_t1_sent=False,
    )
    db.add(deadline)

    db.add(Event(
        transaction_id=transaction_id,
        event_type="hoa_rescission_started",
        description=(
            f"HOA documents delivered on {delivery_date.isoformat()}. "
            f"Rescission period ends {rescission_end.isoformat()} "
            f"(3 business days)."
        ),
    ))
    db.add(Event(
        transaction_id=transaction_id,
        event_type="broker_alert",
        description=(
            "HOA rescission clock started. Buyer has 3 business days to cancel. "
            f"Rescission deadline: {rescission_end.isoformat()}."
        ),
    ))

    await db.flush()
    logger.info(
        "HOA rescission clock started for transaction %d — deadline %s.",
        transaction_id,
        rescission_end.isoformat(),
    )
    return deadline


async def confirm_hoa_rescission_cleared(
    transaction_id: int,
    db: AsyncSession,
) -> Deadline:
    """Mark the HOA rescission period as cleared (buyer did not cancel).

    Finds the open HOA Rescission Period Ends deadline and marks it completed.

    Args:
        transaction_id: Parent transaction ID.
        db:             Async SQLAlchemy session (caller must commit).

    Returns:
        The updated Deadline record.

    Raises:
        ValueError: If no active HOA rescission deadline exists for the transaction.
    """
    result = await db.execute(
        select(Deadline).where(
            Deadline.transaction_id == transaction_id,
            Deadline.name == _RESCISSION_DEADLINE_NAME,
            Deadline.status.in_([DeadlineStatus.upcoming, DeadlineStatus.warning]),
        )
    )
    deadline = result.scalar_one_or_none()
    if deadline is None:
        raise ValueError(
            f"No active HOA rescission deadline found for transaction {transaction_id}."
        )

    deadline.status = DeadlineStatus.completed

    db.add(Event(
        transaction_id=transaction_id,
        event_type="hoa_rescission_cleared",
        description=(
            "HOA rescission period has passed without cancellation. "
            "Transaction may proceed."
        ),
    ))

    await db.flush()
    logger.info(
        "HOA rescission cleared for transaction %d.", transaction_id
    )
    return deadline
