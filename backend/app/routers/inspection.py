"""Inspection item endpoints — CRUD for inspection findings per transaction."""

from datetime import date
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.inspection import InspectionItem
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(
    prefix="/transactions/{transaction_id}/inspection",
    tags=["inspection"],
)


# ── Request schemas ──────────────────────────────────────────────────────────

class InspectionItemCreate(BaseModel):
    description: str
    severity: str = "minor"  # minor, major, safety
    status: str = "open"  # open, negotiating, repaired, waived, credited
    repair_cost: Decimal | None = None
    notes: str | None = None


class InspectionItemUpdate(BaseModel):
    description: str | None = None
    severity: str | None = None
    status: str | None = None
    repair_cost: Decimal | None = None
    notes: str | None = None


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


def _item_to_dict(item: InspectionItem) -> dict:
    return {
        "id": item.id,
        "transaction_id": item.transaction_id,
        "description": item.description,
        "severity": item.severity,
        "status": item.status,
        "repair_cost": float(item.repair_cost) if item.repair_cost else None,
        "notes": item.notes,
        "created_at": item.created_at.isoformat(),
        "updated_at": item.updated_at.isoformat(),
    }


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def list_inspection_items(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List all inspection items for a transaction."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(InspectionItem)
        .where(InspectionItem.transaction_id == transaction_id)
        .order_by(InspectionItem.created_at.asc())
    )
    items = result.scalars().all()
    return [_item_to_dict(item) for item in items]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_inspection_item(
    transaction_id: int,
    body: InspectionItemCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new inspection finding for a transaction."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    item = InspectionItem(
        transaction_id=transaction_id,
        description=body.description,
        severity=body.severity,
        status=body.status,
        repair_cost=body.repair_cost,
        notes=body.notes,
    )
    db.add(item)
    await db.flush()
    await db.refresh(item)

    return _item_to_dict(item)


@router.put("/{item_id}")
async def update_inspection_item(
    transaction_id: int,
    item_id: int,
    body: InspectionItemUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update an inspection item's fields."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(InspectionItem).where(
            InspectionItem.id == item_id,
            InspectionItem.transaction_id == transaction_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection item not found",
        )

    if body.description is not None:
        item.description = body.description
    if body.severity is not None:
        item.severity = body.severity
    if body.status is not None:
        item.status = body.status
    if body.repair_cost is not None:
        item.repair_cost = body.repair_cost
    if body.notes is not None:
        item.notes = body.notes

    db.add(item)
    await db.flush()
    await db.refresh(item)

    return _item_to_dict(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_inspection_item(
    transaction_id: int,
    item_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete an inspection item."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(InspectionItem).where(
            InspectionItem.id == item_id,
            InspectionItem.transaction_id == transaction_id,
        )
    )
    item = result.scalar_one_or_none()
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection item not found",
        )

    await db.delete(item)
