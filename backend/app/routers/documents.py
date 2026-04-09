"""Document endpoints — upload files, track status, and manage the checklist."""

from datetime import datetime, timezone

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.document import DocumentCollectRequest, DocumentResponse, DocumentUploadResponse
from app.services import storage
from app.services.doc_classifier import classify_document
from app.services.trigger_email import fire_document_trigger

router = APIRouter(prefix="/transactions", tags=["documents"])

_MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB


async def _get_transaction_or_404(
    transaction_id: int, user_id: int, db: AsyncSession
) -> Transaction:
    """Fetch a transaction owned by the given user, or raise 404."""
    result = await db.execute(
        select(Transaction).where(
            Transaction.id == transaction_id,
            Transaction.user_id == user_id,
        )
    )
    txn = result.scalar_one_or_none()
    if txn is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    return txn


# ── Checklist endpoints ───────────────────────────────────────────────────────

@router.get("/{transaction_id}/documents", response_model=dict)
async def list_documents(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all documents for a transaction, grouped by phase.

    Returns a dict with phase numbers as keys (1–6) and lists of
    DocumentResponse objects as values.

    Raises:
        404 if the transaction does not exist or belongs to a different broker.
    """
    await _get_transaction_or_404(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Document)
        .where(Document.transaction_id == transaction_id)
        .order_by(Document.phase, Document.id)
    )
    docs = result.scalars().all()

    grouped: dict[str, list] = {}
    for doc in docs:
        key = str(doc.phase)
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(
            {
                "id": doc.id,
                "transaction_id": doc.transaction_id,
                "phase": doc.phase,
                "name": doc.name,
                "status": doc.status,
                "responsible_party_role": doc.responsible_party_role,
                "due_date": doc.due_date.isoformat() if doc.due_date else None,
                "collected_at": doc.collected_at.isoformat() if doc.collected_at else None,
                "storage_key": doc.storage_key,
                "last_followup_at": (
                    doc.last_followup_at.isoformat() if doc.last_followup_at else None
                ),
                "created_at": doc.created_at.isoformat(),
            }
        )

    return grouped


@router.get("/{transaction_id}/documents/summary")
async def documents_summary(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Return document counts per phase broken down by status.

    Response shape:
    {
      "total": int,
      "collected": int,
      "pending": int,
      "overdue": int,
      "by_phase": {
        "1": {"total": int, "collected": int, "pending": int, "overdue": int},
        ...
      }
    }

    Raises:
        404 if the transaction does not exist or belongs to a different broker.
    """
    await _get_transaction_or_404(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Document.phase, Document.status, func.count(Document.id).label("cnt"))
        .where(Document.transaction_id == transaction_id)
        .group_by(Document.phase, Document.status)
    )
    rows = result.all()

    totals = {"collected": 0, "pending": 0, "overdue": 0}
    by_phase: dict[str, dict] = {}

    for phase, doc_status, cnt in rows:
        key = str(phase)
        if key not in by_phase:
            by_phase[key] = {"total": 0, "collected": 0, "pending": 0, "overdue": 0}
        by_phase[key][doc_status.value] += cnt
        by_phase[key]["total"] += cnt
        totals[doc_status.value] += cnt

    return {
        "total": sum(totals.values()),
        **totals,
        "by_phase": by_phase,
    }


# ── Document upload / manual collect ─────────────────────────────────────────

@router.post(
    "/{transaction_id}/documents",
    response_model=DocumentUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(
    transaction_id: int,
    phase: int = 1,
    document_name: str = "",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    """Upload a document file for a transaction.

    Stores the file in S3/R2 (or local filesystem in dev) and creates a
    Document record with status=collected.

    Args:
        transaction_id: Parent transaction ID.
        phase: Document phase (1–6). Defaults to 1.
        document_name: Human-readable document name. Defaults to the filename.
        file: The uploaded file (multipart/form-data).

    Raises:
        404 if the transaction does not exist or belongs to a different broker.
        413 if the file exceeds 50 MB.
        422 if phase is outside the 1–6 range.
    """
    if not 1 <= phase <= 6:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="phase must be between 1 and 6",
        )

    txn = await _get_transaction_or_404(transaction_id, current_user.id, db)

    content = await file.read()
    if len(content) > _MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File exceeds the 50 MB limit",
        )

    if content[:4] != b"%PDF":
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Only PDF files are accepted (file does not appear to be a valid PDF)",
        )

    # Reject manually provided names that exceed 255 characters
    if document_name and len(document_name.strip()) > 255:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Document name must be at most 255 characters",
        )

    filename = file.filename or "upload"
    user_provided_name = document_name.strip()
    classification = await classify_document(filename, content)
    if user_provided_name:
        name = user_provided_name
    elif classification["confidence"] in ("high", "medium"):
        name = classification["suggested_name"][:255]
    else:
        name = filename[:255]

    storage_key = await storage.upload_document(transaction_id, filename, content)

    doc = Document(
        transaction_id=transaction_id,
        phase=phase,
        name=name,
        status=DocumentStatus.collected,
        storage_key=storage_key,
        collected_at=datetime.now(tz=timezone.utc),
    )
    db.add(doc)

    event = Event(
        transaction_id=transaction_id,
        event_type="document_uploaded",
        description=f"Document '{name}' (phase {phase}) uploaded by {current_user.full_name}.",
    )
    db.add(event)

    await db.commit()
    await db.refresh(doc)
    await fire_document_trigger(transaction_id, name, db, doc_type=classification["doc_type"])
    return doc


@router.patch(
    "/{transaction_id}/documents/{document_id}",
    response_model=DocumentResponse,
)
async def mark_document_collected(
    transaction_id: int,
    document_id: int,
    body: DocumentCollectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Document:
    """Manually mark a document as collected (broker override).

    This is used when a document was received outside the system (e.g., via
    email) and the broker wants to update the checklist status.

    Raises:
        404 if the transaction or document does not exist or belongs to a different broker.
        409 if the document is already marked as collected.
    """
    await _get_transaction_or_404(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.transaction_id == transaction_id,
        )
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc.status == DocumentStatus.collected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Document is already marked as collected",
        )

    doc.status = DocumentStatus.collected
    doc.collected_at = datetime.now(tz=timezone.utc)

    note = body.notes or "Manually marked as collected"
    event = Event(
        transaction_id=transaction_id,
        event_type="document_collected",
        description=f"Document '{doc.name}' marked collected by {current_user.full_name}. {note}",
    )
    db.add(event)

    await db.flush()
    await db.refresh(doc)
    return doc


# ── Snooze endpoint ───────────────────────────────────────────────────────────

@router.patch("/{transaction_id}/documents/{document_id}/snooze")
async def snooze_document(
    transaction_id: int,
    document_id: int,
    days: int = Body(..., embed=True, ge=1, le=90),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Snooze a document's follow-up by extending its due date by N days.

    Clears last_followup_at so the next follow-up fires fresh relative to the
    new due date. The broker uses this when parties have agreed to an extension.

    Args:
        days: Number of days to extend the due date (1–90).

    Raises:
        404 if the transaction or document does not exist or belongs to a different broker.
        409 if the document is already collected.
    """
    from datetime import date, timedelta  # noqa: PLC0415

    await _get_transaction_or_404(transaction_id, current_user.id, db)

    result = await db.execute(
        select(Document).where(
            Document.id == document_id,
            Document.transaction_id == transaction_id,
        )
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found")

    if doc.status == DocumentStatus.collected:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot snooze a document that has already been collected",
        )

    original_due = doc.due_date or date.today()
    new_due = original_due + timedelta(days=days)

    doc.due_date = new_due
    doc.last_followup_at = None  # Reset so follow-ups recalculate from new due date
    if doc.status == DocumentStatus.overdue:
        doc.status = DocumentStatus.pending  # Un-flag overdue status

    db.add(doc)

    event = Event(
        transaction_id=transaction_id,
        event_type="document_snoozed",
        description=(
            f"Document '{doc.name}' snoozed {days} day(s) by {current_user.full_name}. "
            f"New due date: {new_due.isoformat()}."
        ),
    )
    db.add(event)

    await db.flush()

    return {
        "id": doc.id,
        "name": doc.name,
        "due_date": new_due.isoformat(),
        "status": doc.status,
        "snoozed_days": days,
    }
