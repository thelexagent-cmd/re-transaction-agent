"""Task endpoints — create, list, update, delete, and bulk-create tasks for transactions."""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.task import Task, TaskStatus
from app.models.transaction import Transaction
from app.models.user import User

router = APIRouter(prefix="/transactions/{transaction_id}/tasks", tags=["tasks"])


# ── Request / response schemas ───────────────────────────────────────────────

class TaskCreate(BaseModel):
    title: str
    due_date: date | None = None
    assigned_role: str | None = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Task title is required")
        if len(v) > 500:
            raise ValueError("Task title must be at most 500 characters")
        return v.strip()

    @field_validator("assigned_role")
    @classmethod
    def assigned_role_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 100:
            raise ValueError("Assigned role must be at most 100 characters")
        return v


class TaskUpdate(BaseModel):
    title: str | None = None
    status: TaskStatus | None = None
    due_date: date | None = None
    assigned_role: str | None = None

    @field_validator("title")
    @classmethod
    def title_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("Task title must be at most 500 characters")
        return v.strip() if v else v

    @field_validator("assigned_role")
    @classmethod
    def assigned_role_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 100:
            raise ValueError("Assigned role must be at most 100 characters")
        return v


class BulkTaskCreate(BaseModel):
    tasks: list[TaskCreate]


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
async def list_tasks(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """List all tasks for a transaction, ordered by sort_order."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Task)
        .where(Task.transaction_id == transaction_id)
        .order_by(Task.sort_order.asc(), Task.id.asc())
    )
    tasks = result.scalars().all()
    return [
        {
            "id": t.id,
            "transaction_id": t.transaction_id,
            "title": t.title,
            "status": t.status,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "assigned_role": t.assigned_role,
            "sort_order": t.sort_order,
            "created_at": t.created_at.isoformat(),
        }
        for t in tasks
    ]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_task(
    transaction_id: int,
    body: TaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new task for a transaction."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    task = Task(
        transaction_id=transaction_id,
        title=body.title,
        due_date=body.due_date,
        assigned_role=body.assigned_role,
    )
    db.add(task)
    await db.flush()
    await db.refresh(task)

    return {
        "id": task.id,
        "transaction_id": task.transaction_id,
        "title": task.title,
        "status": task.status,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assigned_role": task.assigned_role,
        "sort_order": task.sort_order,
        "created_at": task.created_at.isoformat(),
    }


@router.patch("/{task_id}")
async def update_task(
    transaction_id: int,
    task_id: int,
    body: TaskUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update a task's fields (status, title, due_date, assigned_role)."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.transaction_id == transaction_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    if body.title is not None:
        task.title = body.title
    if body.status is not None:
        task.status = body.status
    if body.due_date is not None:
        task.due_date = body.due_date
    if body.assigned_role is not None:
        task.assigned_role = body.assigned_role

    db.add(task)
    await db.flush()
    await db.refresh(task)

    return {
        "id": task.id,
        "transaction_id": task.transaction_id,
        "title": task.title,
        "status": task.status,
        "due_date": task.due_date.isoformat() if task.due_date else None,
        "assigned_role": task.assigned_role,
        "sort_order": task.sort_order,
        "created_at": task.created_at.isoformat(),
    }


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    transaction_id: int,
    task_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Delete a task."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Task).where(Task.id == task_id, Task.transaction_id == transaction_id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")

    await db.delete(task)


@router.post("/bulk", status_code=status.HTTP_201_CREATED)
async def bulk_create_tasks(
    transaction_id: int,
    body: BulkTaskCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    """Create multiple tasks at once (for template application)."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    created = []
    for idx, task_data in enumerate(body.tasks):
        task = Task(
            transaction_id=transaction_id,
            title=task_data.title,
            due_date=task_data.due_date,
            assigned_role=task_data.assigned_role,
            sort_order=idx,
        )
        db.add(task)
        created.append(task)

    await db.flush()
    for task in created:
        await db.refresh(task)

    return [
        {
            "id": t.id,
            "transaction_id": t.transaction_id,
            "title": t.title,
            "status": t.status,
            "due_date": t.due_date.isoformat() if t.due_date else None,
            "assigned_role": t.assigned_role,
            "sort_order": t.sort_order,
            "created_at": t.created_at.isoformat(),
        }
        for t in created
    ]
