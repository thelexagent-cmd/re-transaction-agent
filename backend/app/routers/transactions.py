"""Transaction endpoints — create, list, retrieve, and contract parsing."""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.event import Event
from app.models.party import Party
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.transaction import TransactionCreate, TransactionDetail, TransactionListItem
from app.services.intake import process_contract

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


@router.post("/{transaction_id}/parse-contract")
async def parse_contract(
    transaction_id: int,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Parse a contract PDF and extract structured data into the transaction record.

    Accepts a multipart PDF upload, runs the full extraction pipeline (PDF → Claude
    → structured JSON), and updates the transaction with parties, financial terms,
    dates, and deadlines.

    Returns the extracted JSON data plus a generated deadline timeline.
    Raises 422 with error detail if the file is not a PDF or parsing fails.
    """
    # Verify transaction exists and belongs to the authenticated user
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

    try:
        extracted = await process_contract(pdf_bytes, transaction_id, db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Contract parsing failed: {exc}",
        ) from exc

    return extracted


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
