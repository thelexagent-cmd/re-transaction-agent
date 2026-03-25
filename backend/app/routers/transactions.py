"""Transaction endpoints — create, list, retrieve, and contract parsing."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.deadline import Deadline, DeadlineStatus
from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.party import Party
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import (
    AlertListResponse,
    DeadlineListResponse,
    HoaDocsDeliveredRequest,
    RecentEventsResponse,
    TransactionCreate,
    TransactionDetail,
    TransactionListItem,
)
from app.services import storage

router = APIRouter(prefix="/transactions", tags=["transactions"])


@router.post("", response_model=TransactionDetail, status_code=status.HTTP_201_CREATED)
async def create_transaction(
    body: TransactionCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    """Create a new transaction with an optional list of parties.

    The transaction is immediately associated with the authenticated broker.
    An opening event is recorded in the activity log.
    """
    transaction = Transaction(
        user_id=current_user.id,
        address=body.address,
        property_type=body.property_type,
        purchase_price=float(body.purchase_price) if body.purchase_price else None,
        closing_date=body.closing_date,
        contract_execution_date=body.contract_execution_date,
    )
    db.add(transaction)
    await db.flush()  # Populate transaction.id before creating children

    for party_data in body.parties:
        party = Party(
            transaction_id=transaction.id,
            role=party_data.role,
            full_name=party_data.full_name,
            email=party_data.email,
            phone=party_data.phone,
        )
        db.add(party)

    opening_event = Event(
        transaction_id=transaction.id,
        event_type="transaction_created",
        description=f"Transaction opened for {body.address} by {current_user.full_name}.",
    )
    db.add(opening_event)

    await db.flush()
    await db.refresh(transaction)

    # Reload with relationships for the response
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction.id)
        .options(
            selectinload(Transaction.parties),
            selectinload(Transaction.deadlines),
            selectinload(Transaction.events),
        )
    )
    return result.scalar_one()


@router.delete("/{transaction_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Permanently delete a transaction and all related records.

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    txn = await _require_transaction_ownership(transaction_id, current_user.id, db)
    await db.delete(txn)


@router.get("", response_model=list[TransactionListItem])
async def list_transactions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[Transaction]:
    """Return all transactions owned by the authenticated broker, newest first."""
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(Transaction.created_at.desc())
    )
    return list(result.scalars().all())


@router.post(
    "/{transaction_id}/parse-contract",
    status_code=status.HTTP_202_ACCEPTED,
)
async def parse_contract(
    transaction_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Enqueue a contract PDF for async background parsing.

    Stores the uploaded PDF immediately, then enqueues the extraction pipeline
    as a Celery task. Returns 202 Accepted with a task_id that can be polled
    via GET /transactions/{id}/parse-status/{task_id}.

    Raises:
        404 if the transaction does not exist or belongs to a different broker.
        422 if the uploaded file is not a PDF or is empty.
    """
    # Verify transaction ownership
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    # Loose PDF validation — some clients send application/octet-stream
    filename = (file.filename or "").lower()
    content_type = file.content_type or ""
    if "pdf" not in content_type and not filename.endswith(".pdf"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Only PDF files are accepted",
        )

    pdf_bytes = await file.read()
    if not pdf_bytes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Uploaded file is empty",
        )

    if pdf_bytes[:4] != b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="File does not appear to be a valid PDF (magic bytes check failed)",
        )

    # Store PDF so the Celery worker can retrieve it
    storage_key = await storage.upload_document(transaction_id, file.filename or "contract.pdf", pdf_bytes)

    # Enqueue background parsing task
    from app.worker import process_contract_async  # noqa: PLC0415

    task = process_contract_async.delay(transaction_id, storage_key)

    return {
        "status": "accepted",
        "task_id": task.id,
        "message": "Contract queued for parsing. Poll parse-status/{task_id} for results.",
    }


@router.get("/{transaction_id}/parse-status/{task_id}")
async def get_parse_status(
    transaction_id: int,
    task_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Poll the status of a background contract-parsing task.

    Returns:
        - status: pending | processing | complete | failed
        - result: extracted data dict (only when status == complete)
        - error:  error message (only when status == failed)

    Raises:
        404 if the transaction does not exist or belongs to a different broker.
    """
    # Verify transaction ownership
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == current_user.id,
        )
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    from celery.result import AsyncResult  # noqa: PLC0415
    from celery_app import celery_app  # noqa: PLC0415

    task_result = AsyncResult(task_id, app=celery_app)

    state = task_result.state  # PENDING, STARTED, SUCCESS, FAILURE, RETRY

    if state == "PENDING":
        return {"task_id": task_id, "status": "pending"}
    if state == "STARTED":
        return {"task_id": task_id, "status": "processing"}
    if state == "SUCCESS":
        return {"task_id": task_id, "status": "complete", "result": task_result.result}
    if state == "FAILURE":
        exc = task_result.result
        reason = str(exc) if exc else "Unknown error during contract parsing"
        return {
            "task_id": task_id,
            "status": "failed",
            "detail": "Contract parsing failed",
            "reason": reason,
        }
    # RETRY or unknown
    return {"task_id": task_id, "status": "processing"}


@router.get("/{transaction_id}", response_model=TransactionDetail)
async def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    """Return full transaction detail including parties, documents, deadlines, and events.

    Raises 404 if the transaction does not exist or belongs to a different broker.
    """
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .options(
            selectinload(Transaction.parties),
            selectinload(Transaction.deadlines),
            selectinload(Transaction.events),
        )
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return transaction


# ── Alert endpoints ───────────────────────────────────────────────────────────


@router.get("/{transaction_id}/alerts", response_model=AlertListResponse)
async def list_alerts(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all unresolved (not dismissed) broker_alert events for a transaction.

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Event)
        .where(
            Event.transaction_id == transaction_id,
            Event.event_type == "broker_alert",
            Event.dismissed.is_(False),
        )
        .order_by(Event.created_at.desc())
    )
    alerts = list(result.scalars().all())
    return {"alerts": alerts, "total": len(alerts)}


@router.post("/{transaction_id}/alerts/{event_id}/dismiss", response_model=dict)
async def dismiss_alert(
    transaction_id: int,
    event_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Dismiss a broker alert event.

    Raises 404 if the transaction or event is not found / accessible.
    """
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Event).where(
            Event.id == event_id,
            Event.transaction_id == transaction_id,
            Event.event_type == "broker_alert",
        )
    )
    event = result.scalar_one_or_none()
    if event is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Alert event not found",
        )

    event.dismissed = True
    db.add(event)
    return {"status": "dismissed", "event_id": event_id}


# ── Deadline list endpoint ────────────────────────────────────────────────────


@router.get("/{transaction_id}/deadlines", response_model=DeadlineListResponse)
async def list_deadlines(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all deadlines for a transaction sorted by due_date ascending.

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Deadline)
        .where(Deadline.transaction_id == transaction_id)
        .order_by(Deadline.due_date.asc())
    )
    deadlines = list(result.scalars().all())
    return {"deadlines": deadlines, "total": len(deadlines)}


# ── HOA workflow endpoints ────────────────────────────────────────────────────


@router.post("/{transaction_id}/hoa/docs-delivered", status_code=status.HTTP_201_CREATED)
async def hoa_docs_delivered(
    transaction_id: int,
    body: HoaDocsDeliveredRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Start the HOA rescission clock after HOA documents are delivered to the buyer.

    Creates a new deadline (delivery_date + 3 business days) and fires broker
    alert events.

    Body:
        delivery_date: ISO 8601 date string (YYYY-MM-DD)

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    from app.services.hoa_workflow import start_hoa_rescission_clock  # noqa: PLC0415

    await _require_transaction_ownership(transaction_id, current_user.id, db)

    deadline = await start_hoa_rescission_clock(
        transaction_id=transaction_id,
        delivery_date=body.delivery_date,
        db=db,
    )
    return {
        "status": "rescission_clock_started",
        "rescission_deadline": deadline.due_date.isoformat(),
        "deadline_id": deadline.id,
    }


@router.post("/{transaction_id}/hoa/rescission-cleared", response_model=dict)
async def hoa_rescission_cleared(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Confirm that the HOA rescission period passed without buyer cancellation.

    Marks the rescission deadline as completed and records a clearance event.

    Raises 404 if the transaction does not belong to the authenticated broker.
    Raises 422 if no active HOA rescission deadline exists.
    """
    from app.services.hoa_workflow import confirm_hoa_rescission_cleared  # noqa: PLC0415

    await _require_transaction_ownership(transaction_id, current_user.id, db)

    try:
        deadline = await confirm_hoa_rescission_cleared(transaction_id, db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    return {
        "status": "rescission_cleared",
        "deadline_id": deadline.id,
    }


# ── Global deadlines + documents views ───────────────────────────────────────


@router.get("/deadlines/all", response_model=list)
async def all_deadlines(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """Return all non-completed deadlines across the broker's transactions, sorted by due_date."""
    result = await db.execute(
        select(Deadline, Transaction.address)
        .join(Transaction, Deadline.transaction_id == Transaction.id)
        .where(
            Transaction.user_id == current_user.id,
            Deadline.status != DeadlineStatus.completed,
        )
        .order_by(Deadline.due_date.asc())
    )
    return [
        {
            "id": d.id,
            "transaction_id": d.transaction_id,
            "transaction_address": address,
            "name": d.name,
            "due_date": d.due_date.isoformat(),
            "status": d.status,
            "alert_t3_sent": d.alert_t3_sent,
            "alert_t1_sent": d.alert_t1_sent,
            "created_at": d.created_at.isoformat(),
        }
        for d, address in result.all()
    ]


@router.get("/documents/all", response_model=list)
async def all_documents(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list:
    """Return all pending/overdue documents across the broker's transactions, sorted by due_date."""
    result = await db.execute(
        select(Document, Transaction.address)
        .join(Transaction, Document.transaction_id == Transaction.id)
        .where(
            Transaction.user_id == current_user.id,
            Document.status != DocumentStatus.collected,
        )
        .order_by(Document.due_date.asc().nullslast())
    )
    return [
        {
            "id": doc.id,
            "transaction_id": doc.transaction_id,
            "transaction_address": address,
            "phase": doc.phase,
            "name": doc.name,
            "status": doc.status,
            "responsible_party_role": doc.responsible_party_role,
            "due_date": doc.due_date.isoformat() if doc.due_date else None,
            "collected_at": None,
            "created_at": doc.created_at.isoformat(),
        }
        for doc, address in result.all()
    ]


# ── Recent activity feed ─────────────────────────────────────────────────────


@router.get("/events/recent", response_model=RecentEventsResponse)
async def recent_events(
    limit: int = 15,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the most recent activity events across all of the broker's transactions."""
    result = await db.execute(
        select(Event, Transaction.address)
        .join(Transaction, Event.transaction_id == Transaction.id)
        .where(Transaction.user_id == current_user.id)
        .order_by(Event.created_at.desc())
        .limit(limit)
    )
    rows = result.all()
    events = []
    for event, address in rows:
        events.append({
            "id": event.id,
            "transaction_id": event.transaction_id,
            "transaction_address": address,
            "event_type": event.event_type,
            "description": event.description,
            "dismissed": event.dismissed,
            "created_at": event.created_at,
        })
    return {"events": events, "total": len(events)}


# ── Ownership helper ──────────────────────────────────────────────────────────


async def _require_transaction_ownership(
    transaction_id: int,
    user_id: int,
    db: AsyncSession,
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
