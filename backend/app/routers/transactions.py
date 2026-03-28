"""Transaction endpoints — create, list, retrieve, and contract parsing."""

from datetime import date, datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.deadline import Deadline, DeadlineStatus
from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.party import Party
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.schemas.transaction import (
    AlertListResponse,
    ContactItem,
    ContactsResponse,
    DashboardStats,
    DeadlineListResponse,
    HealthFactor,
    HealthScoreResponse,
    HoaDocsDeliveredRequest,
    NotesResponse,
    NotesUpdate,
    PartyUpdate,
    RecentEventsResponse,
    TransactionCreate,
    TransactionDetail,
    TransactionListItem,
    TransactionUpdate,
)
from app.services import storage
from app.services.trigger_email import fire_status_trigger


# ── Inline request schemas for new endpoints ─────────────────────────────────

class EsignUrlRequest(BaseModel):
    esign_url: str


class CommissionUpdateRequest(BaseModel):
    status: str
    disbursed_at: datetime | None = None
    notes: str | None = None


class EmdUpdateRequest(BaseModel):
    emd_amount: float | None = None
    emd_holder: str | None = None
    emd_due_date: date | None = None
    emd_received: bool | None = None
    emd_notes: str | None = None

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


# ── E-Signature URL endpoint ──────────────────────────────────────────────────


@router.patch("/{transaction_id}/documents/{document_id}/esign")
async def update_document_esign_url(
    transaction_id: int,
    document_id: int,
    body: EsignUrlRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Set or update the e-signature URL for a document.

    Raises 404 if the transaction or document does not exist or belongs to a different broker.
    """
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.transaction_id == transaction_id,
        )
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    doc.esign_url = body.esign_url
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    return {
        "id": doc.id,
        "transaction_id": doc.transaction_id,
        "name": doc.name,
        "esign_url": doc.esign_url,
        "status": doc.status,
    }


# ── Commission disbursement endpoint ─────────────────────────────────────────


@router.patch("/{transaction_id}/commission")
async def update_commission(
    transaction_id: int,
    body: CommissionUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update commission disbursement fields on a transaction.

    Body: {status: "pending"|"disbursed"|"partial", disbursed_at?, notes?}

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    txn = await _require_transaction_ownership(transaction_id, current_user.id, db)

    txn.commission_status = body.status
    if body.disbursed_at is not None:
        txn.commission_disbursed_at = body.disbursed_at
    if body.notes is not None:
        txn.commission_notes = body.notes

    db.add(txn)
    await db.flush()
    await db.refresh(txn)

    return {
        "id": txn.id,
        "commission_status": txn.commission_status,
        "commission_disbursed_at": txn.commission_disbursed_at.isoformat() if txn.commission_disbursed_at else None,
        "commission_notes": txn.commission_notes,
    }


@router.patch("/{transaction_id}/emd")
async def update_emd(
    transaction_id: int,
    body: EmdUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update earnest money deposit fields on a transaction.

    Only fields included in the request body are modified.
    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    txn = await _require_transaction_ownership(transaction_id, current_user.id, db)

    if body.emd_amount is not None:
        txn.emd_amount = body.emd_amount
    if body.emd_holder is not None:
        txn.emd_holder = body.emd_holder
    if body.emd_due_date is not None:
        txn.emd_due_date = body.emd_due_date
    if body.emd_received is not None:
        txn.emd_received = body.emd_received
    if body.emd_notes is not None:
        txn.emd_notes = body.emd_notes

    db.add(txn)
    await db.flush()
    await db.refresh(txn)

    return {
        "id": txn.id,
        "emd_amount": float(txn.emd_amount) if txn.emd_amount else None,
        "emd_holder": txn.emd_holder,
        "emd_due_date": txn.emd_due_date.isoformat() if txn.emd_due_date else None,
        "emd_received": txn.emd_received,
        "emd_notes": txn.emd_notes,
    }


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


# ── Transaction status/field update endpoint ──────────────────────────────────


@router.patch("/{transaction_id}", response_model=TransactionDetail)
async def update_transaction(
    transaction_id: int,
    body: TransactionUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Transaction:
    """Update one or more top-level transaction fields.

    Allowed fields: status, closing_date, purchase_price, contract_execution_date.
    Only fields included in the request body are modified.

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    txn = await _require_transaction_ownership(transaction_id, current_user.id, db)

    old_status = txn.status
    if body.status is not None:
        txn.status = body.status
    if body.closing_date is not None:
        txn.closing_date = body.closing_date
    if body.purchase_price is not None:
        txn.purchase_price = float(body.purchase_price)
    if body.contract_execution_date is not None:
        txn.contract_execution_date = body.contract_execution_date
    if body.notes is not None:
        txn.notes = body.notes
    if body.emd_amount is not None:
        txn.emd_amount = float(body.emd_amount)
    if body.emd_holder is not None:
        txn.emd_holder = body.emd_holder
    if body.emd_due_date is not None:
        txn.emd_due_date = body.emd_due_date
    if body.emd_received is not None:
        txn.emd_received = body.emd_received
    if body.emd_notes is not None:
        txn.emd_notes = body.emd_notes

    db.add(txn)
    await db.flush()

    # Fire status-change trigger email (never crashes — all errors caught inside)
    if body.status is not None and str(body.status) != str(old_status):
        await fire_status_trigger(transaction_id, str(body.status), db)

    # Reload with relationships for the response
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id)
        .options(
            selectinload(Transaction.parties),
            selectinload(Transaction.deadlines),
            selectinload(Transaction.events),
        )
    )
    return result.scalar_one()


# ── Notes endpoints ───────────────────────────────────────────────────────────


@router.get("/{transaction_id}/notes", response_model=NotesResponse)
async def get_notes(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return the quick notes for a transaction.

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    txn = await _require_transaction_ownership(transaction_id, current_user.id, db)
    return {"notes": txn.notes}


@router.post("/{transaction_id}/notes", response_model=NotesResponse)
async def update_notes(
    transaction_id: int,
    body: NotesUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Save quick notes for a transaction (replaces existing notes).

    Body: {"content": "..."}
    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    txn = await _require_transaction_ownership(transaction_id, current_user.id, db)
    txn.notes = body.content
    db.add(txn)
    await db.flush()
    return {"notes": txn.notes}


# ── Deal health score endpoint ────────────────────────────────────────────────


@router.get("/{transaction_id}/health-score", response_model=HealthScoreResponse)
async def get_health_score(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Calculate and return a deal health score for a transaction.

    Scoring (start at 100):
      -5  per missed deadline
      -8  per overdue document
      -3  if closing within 7 days
      -5  additional if closing within 3 days (cumulative: -8 total)
      -10 if no closing date is set

    Level thresholds:
      >= 80: healthy
      >= 60: warning
      < 60:  critical

    Raises 404 if the transaction does not belong to the authenticated broker.
    """
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .options(
            selectinload(Transaction.deadlines),
            selectinload(Transaction.documents),
        )
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    score = 100
    factors: list[HealthFactor] = []
    today = date.today()

    # Missed deadlines
    missed = [d for d in txn.deadlines if d.status == DeadlineStatus.missed]
    if missed:
        impact = -5 * len(missed)
        score += impact
        factors.append(HealthFactor(
            name="Missed deadlines",
            impact=impact,
            detail=f"{len(missed)} missed deadline{'s' if len(missed) != 1 else ''}",
        ))

    # Overdue documents
    overdue_docs = [d for d in txn.documents if d.status == DocumentStatus.overdue]
    if overdue_docs:
        impact = -8 * len(overdue_docs)
        score += impact
        factors.append(HealthFactor(
            name="Overdue documents",
            impact=impact,
            detail=f"{len(overdue_docs)} overdue doc{'s' if len(overdue_docs) != 1 else ''}",
        ))

    # Closing date proximity
    if txn.closing_date is None:
        score -= 10
        factors.append(HealthFactor(
            name="No closing date",
            impact=-10,
            detail="Closing date has not been set",
        ))
    else:
        days_until_close = (txn.closing_date - today).days
        if days_until_close <= 3:
            score -= 8  # -3 for within 7 days + -5 more for within 3 days
            factors.append(HealthFactor(
                name="Days until close",
                impact=-8,
                detail=f"{max(days_until_close, 0)} days remaining (critical)",
            ))
        elif days_until_close <= 7:
            score -= 3
            factors.append(HealthFactor(
                name="Days until close",
                impact=-3,
                detail=f"{days_until_close} days remaining",
            ))
        else:
            factors.append(HealthFactor(
                name="Days until close",
                impact=0,
                detail=f"{days_until_close} days remaining",
            ))

    # Clamp score to [0, 100]
    score = max(0, min(100, score))

    # Determine level
    if score >= 80:
        level = "healthy"
    elif score >= 60:
        level = "warning"
    else:
        level = "critical"

    return {"score": score, "level": level, "factors": factors}


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


# ── Global contacts endpoint ──────────────────────────────────────────────────


@router.get("/contacts/all", response_model=ContactsResponse)
async def all_contacts(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return all unique parties across the broker's transactions, deduplicated by email or name+role.

    Each contact includes transaction_count and the list of transaction_ids they appear in.
    """
    result = await db.execute(
        select(Party)
        .join(Transaction, Party.transaction_id == Transaction.id)
        .where(Transaction.user_id == current_user.id)
        .order_by(Party.full_name.asc())
    )
    all_parties = list(result.scalars().all())

    # Deduplicate: key is email (if present) else "{full_name}|{role}"
    seen: dict[str, ContactItem] = {}
    for party in all_parties:
        key = party.email.lower().strip() if party.email else f"{party.full_name.lower().strip()}|{party.role.value}"
        if key in seen:
            existing = seen[key]
            if party.transaction_id not in existing.transaction_ids:
                existing.transaction_ids.append(party.transaction_id)
                existing.transaction_count = len(existing.transaction_ids)
        else:
            seen[key] = ContactItem(
                id=party.id,
                full_name=party.full_name,
                email=party.email,
                phone=party.phone,
                role=party.role.value,
                transaction_count=1,
                transaction_ids=[party.transaction_id],
            )

    contacts = list(seen.values())
    return {"contacts": contacts, "total": len(contacts)}


# ── Dashboard stats endpoint ──────────────────────────────────────────────────


@router.get("/stats", response_model=DashboardStats)
async def dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return dashboard summary statistics for the authenticated broker.

    Returns total active transactions, how many close this calendar month,
    count of overdue documents, and count of missed deadlines.
    """
    today = date.today()
    month_start = today.replace(day=1)
    # Last day of current month: first day of next month minus one day
    if today.month == 12:
        month_end = today.replace(year=today.year + 1, month=1, day=1)
    else:
        month_end = today.replace(month=today.month + 1, day=1)

    # Total active transactions
    active_result = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == current_user.id,
            Transaction.status == TransactionStatus.active,
        )
    )
    total_active = active_result.scalar_one() or 0

    # Closing this month: active transactions with closing_date in current month
    closing_result = await db.execute(
        select(func.count(Transaction.id)).where(
            Transaction.user_id == current_user.id,
            Transaction.status == TransactionStatus.active,
            Transaction.closing_date >= month_start,
            Transaction.closing_date < month_end,
        )
    )
    closing_this_month = closing_result.scalar_one() or 0

    # Overdue documents: across active transactions
    overdue_docs_result = await db.execute(
        select(func.count(Document.id))
        .join(Transaction, Document.transaction_id == Transaction.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.status == TransactionStatus.active,
            Document.status == DocumentStatus.overdue,
        )
    )
    overdue_documents = overdue_docs_result.scalar_one() or 0

    # Missed deadlines: across active transactions
    missed_dl_result = await db.execute(
        select(func.count(Deadline.id))
        .join(Transaction, Deadline.transaction_id == Transaction.id)
        .where(
            Transaction.user_id == current_user.id,
            Transaction.status == TransactionStatus.active,
            Deadline.status == DeadlineStatus.missed,
        )
    )
    missed_deadlines = missed_dl_result.scalar_one() or 0

    return {
        "total_active": total_active,
        "closing_this_month": closing_this_month,
        "overdue_documents": overdue_documents,
        "missed_deadlines": missed_deadlines,
    }


# ── FIRPTA analysis endpoint ──────────────────────────────────────────────────


@router.get("/{transaction_id}/firpta")
async def get_firpta_analysis(
    transaction_id: int,
    buyer_primary_residence: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Run FIRPTA compliance analysis for a transaction.

    Returns withholding amounts, applicable rates, and action items.
    """
    from app.services.firpta import analyze  # noqa: PLC0415

    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
        .options(selectinload(Transaction.parties))
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")

    has_foreign_seller = any(
        getattr(p, "is_foreign_national", False)
        for p in txn.parties
        if p.role.value == "seller"
    )

    firpta = analyze(
        purchase_price=txn.purchase_price or 0.0,
        has_foreign_seller=has_foreign_seller,
        buyer_intends_primary_residence=buyer_primary_residence,
    )

    return {
        "is_firpta_applicable": firpta.is_firpta_applicable,
        "withholding_amount": firpta.withholding_amount,
        "withholding_rate": firpta.withholding_rate,
        "gross_sales_price": firpta.gross_sales_price,
        "notes": firpta.notes,
        "action_items": firpta.action_items,
    }


# ── Update party endpoint ─────────────────────────────────────────────────────


@router.patch("/{transaction_id}/parties/{party_id}")
async def update_party(
    transaction_id: int,
    party_id: int,
    body: PartyUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update party fields (preferred_language, is_foreign_national)."""
    await _require_transaction_ownership(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Party).where(Party.id == party_id, Party.transaction_id == transaction_id)
    )
    party = result.scalar_one_or_none()
    if party is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Party not found")

    if body.preferred_language is not None:
        party.preferred_language = body.preferred_language
    if body.is_foreign_national is not None:
        party.is_foreign_national = body.is_foreign_national

    db.add(party)
    return {
        "id": party.id,
        "preferred_language": party.preferred_language,
        "is_foreign_national": party.is_foreign_national,
    }


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
