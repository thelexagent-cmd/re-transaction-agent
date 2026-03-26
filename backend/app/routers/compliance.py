"""Compliance endpoints — checklist initialization, toggle, and broker review."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.compliance import ComplianceItem, ComplianceReview
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/transactions/{transaction_id}/compliance", tags=["compliance"])


# ── Request schemas ──────────────────────────────────────────────────────────

class ReviewRequest(BaseModel):
    reviewed_by_name: str


# ── Default checklist template ───────────────────────────────────────────────

DEFAULT_CHECKLIST: list[tuple[str, str]] = [
    # Contract (4 items)
    ("Contract", "Purchase agreement fully executed"),
    ("Contract", "All addenda signed"),
    ("Contract", "Earnest money deposit verified"),
    ("Contract", "Contract copies distributed to all parties"),
    # Inspection (4 items)
    ("Inspection", "Home inspection scheduled"),
    ("Inspection", "Home inspection report reviewed"),
    ("Inspection", "Repair negotiations completed"),
    ("Inspection", "Re-inspection completed (if applicable)"),
    # Financing (4 items)
    ("Financing", "Pre-approval letter on file"),
    ("Financing", "Loan application submitted"),
    ("Financing", "Appraisal ordered and completed"),
    ("Financing", "Clear to close received from lender"),
    # Title (4 items)
    ("Title", "Title search ordered"),
    ("Title", "Title commitment reviewed"),
    ("Title", "Title exceptions cleared"),
    ("Title", "Title insurance binder issued"),
    # Closing (4 items)
    ("Closing", "Closing date confirmed with all parties"),
    ("Closing", "Final walkthrough scheduled"),
    ("Closing", "Closing disclosure reviewed and approved"),
    ("Closing", "Funds wired / cashier's check verified"),
]


# ── Helpers ──────────────────────────────────────────────────────────────────

async def _require_transaction_ownership(
    transaction_id: int, user_id: int, db: AsyncSession
) -> Transaction:
    """Return the transaction if it belongs to user_id; raise 404 otherwise."""
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found",
        )
    return transaction


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def get_compliance(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all compliance items and review status for a transaction."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    items_result = await db.execute(
        select(ComplianceItem)
        .where(ComplianceItem.transaction_id == transaction_id)
        .order_by(ComplianceItem.sort_order.asc(), ComplianceItem.id.asc())
    )
    items = items_result.scalars().all()

    review_result = await db.execute(
        select(ComplianceReview).where(ComplianceReview.transaction_id == transaction_id)
    )
    review = review_result.scalar_one_or_none()

    return {
        "items": [
            {
                "id": item.id,
                "transaction_id": item.transaction_id,
                "section": item.section,
                "label": item.label,
                "is_checked": item.is_checked,
                "sort_order": item.sort_order,
                "checked_at": item.checked_at.isoformat() if item.checked_at else None,
                "created_at": item.created_at.isoformat(),
            }
            for item in items
        ],
        "review": {
            "id": review.id,
            "reviewed_by_name": review.reviewed_by_name,
            "reviewed_at": review.reviewed_at.isoformat(),
        } if review else None,
        "total": len(items),
    }


@router.post("/initialize", status_code=status.HTTP_201_CREATED)
async def initialize_compliance(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create default compliance checklist items for a transaction.

    Returns 409 if items already exist for this transaction.
    """
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    # Check if items already exist
    existing = await db.execute(
        select(ComplianceItem.id).where(ComplianceItem.transaction_id == transaction_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Compliance checklist already initialized for this transaction",
        )

    created = []
    for idx, (section, label) in enumerate(DEFAULT_CHECKLIST):
        item = ComplianceItem(
            transaction_id=transaction_id,
            section=section,
            label=label,
            sort_order=idx,
        )
        db.add(item)
        created.append(item)

    await db.flush()
    for item in created:
        await db.refresh(item)

    return {
        "items": [
            {
                "id": item.id,
                "transaction_id": item.transaction_id,
                "section": item.section,
                "label": item.label,
                "is_checked": item.is_checked,
                "sort_order": item.sort_order,
                "checked_at": None,
                "created_at": item.created_at.isoformat(),
            }
            for item in created
        ],
        "total": len(created),
    }


@router.patch("/items/{item_id}")
async def toggle_compliance_item(
    transaction_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Toggle the is_checked status of a compliance item."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(ComplianceItem).where(
            ComplianceItem.id == item_id,
            ComplianceItem.transaction_id == transaction_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Compliance item not found")

    item.is_checked = not item.is_checked
    item.checked_at = datetime.now(tz=timezone.utc) if item.is_checked else None
    db.add(item)
    await db.flush()
    await db.refresh(item)

    return {
        "id": item.id,
        "transaction_id": item.transaction_id,
        "section": item.section,
        "label": item.label,
        "is_checked": item.is_checked,
        "sort_order": item.sort_order,
        "checked_at": item.checked_at.isoformat() if item.checked_at else None,
        "created_at": item.created_at.isoformat(),
    }


@router.post("/review", status_code=status.HTTP_201_CREATED)
async def submit_compliance_review(
    transaction_id: int,
    body: ReviewRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Mark a transaction's compliance checklist as broker-reviewed.

    Returns 409 if already reviewed.
    """
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    existing = await db.execute(
        select(ComplianceReview).where(ComplianceReview.transaction_id == transaction_id)
    )
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Compliance review already submitted for this transaction",
        )

    review = ComplianceReview(
        transaction_id=transaction_id,
        reviewed_by_name=body.reviewed_by_name,
    )
    db.add(review)
    await db.flush()
    await db.refresh(review)

    return {
        "id": review.id,
        "transaction_id": review.transaction_id,
        "reviewed_by_name": review.reviewed_by_name,
        "reviewed_at": review.reviewed_at.isoformat(),
    }
