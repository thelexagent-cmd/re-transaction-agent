"""Document endpoints — upload files and mark documents as collected."""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.document import DocumentCollectRequest, DocumentResponse, DocumentUploadResponse
from app.services import storage

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

    filename = file.filename or "upload"
    name = document_name.strip() or filename

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

    await db.flush()
    await db.refresh(doc)
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
