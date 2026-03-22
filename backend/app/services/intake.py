"""Contract intake orchestrator: PDF → Claude extraction → database records."""

from datetime import date

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deadline import Deadline
from app.models.document import Document, DocumentStatus
from app.models.event import Event
from app.models.party import Party, PartyRole
from app.models.transaction import PropertyType, Transaction
from app.services.checklist import generate_checklist
from app.services.extractor import extract_contract_data
from app.services.parser import extract_text
from app.services.timeline import generate_timeline

# Map extracted party keys → Party model roles
_PARTY_ROLE_MAP: dict[str, PartyRole] = {
    "buyer": PartyRole.buyer,
    "seller": PartyRole.seller,
    "buyers_agent": PartyRole.buyers_agent,
    "listing_agent": PartyRole.listing_agent,
    "lender": PartyRole.lender,
    "title_company": PartyRole.title,
    "escrow_agent": PartyRole.escrow,
}

# Map extracted property type strings → PropertyType enum
_PROPERTY_TYPE_KEYWORDS: list[tuple[str, PropertyType]] = [
    ("condo", PropertyType.condo),
    ("condominium", PropertyType.condo),
    ("townhouse", PropertyType.townhouse),
    ("town house", PropertyType.townhouse),
    ("multi_family", PropertyType.multi_family),
    ("multi-family", PropertyType.multi_family),
    ("multifamily", PropertyType.multi_family),
    ("single family", PropertyType.sfh),
    ("single-family", PropertyType.sfh),
    ("sfh", PropertyType.sfh),
]


def _map_property_type(raw: str) -> PropertyType:
    lower = (raw or "").lower().strip()
    for keyword, ptype in _PROPERTY_TYPE_KEYWORDS:
        if keyword in lower:
            return ptype
    return PropertyType.other


def _parse_date(date_str: str | None) -> date | None:
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


async def process_contract(
    pdf_bytes: bytes,
    transaction_id: int,
    db: AsyncSession,
) -> dict:
    """Process a contract PDF through the full extraction pipeline.

    Steps:
        1. Extract raw text from the PDF.
        2. Send text to Claude for structured data extraction.
        3. Update the transaction record with extracted property/financial/date fields.
        4. Upsert party records (buyer, seller, agents, lender, title, escrow).
        5. Regenerate all deadline records from the calculated timeline.
        6. Log a contract_parsed event.

    Args:
        pdf_bytes: Raw bytes of the contract PDF.
        transaction_id: ID of the transaction to update.
        db: Async SQLAlchemy session (caller is responsible for session lifecycle).

    Returns:
        Dictionary containing all extracted contract data plus a "timeline" key
        with the serialized list of generated deadlines.

    Raises:
        ValueError: If the transaction is not found or extraction fails.
    """
    # 1. Verify transaction exists
    result = await db.execute(
        select(Transaction).where(Transaction.id == transaction_id)
    )
    transaction = result.scalar_one_or_none()
    if transaction is None:
        raise ValueError(f"Transaction {transaction_id} not found")

    # 2. Extract text from PDF (gracefully handles blank templates)
    contract_text = extract_text(pdf_bytes)

    # 3. Extract structured data via Claude
    extracted = await extract_contract_data(contract_text)

    # 4. Update transaction record with extracted fields
    prop = extracted.get("property", {})
    financial = extracted.get("financial", {})
    dates = extracted.get("dates", {})

    if prop.get("address"):
        transaction.address = prop["address"]

    if prop.get("property_type"):
        transaction.property_type = _map_property_type(prop["property_type"])

    if financial.get("purchase_price") is not None:
        try:
            transaction.purchase_price = float(financial["purchase_price"])
        except (TypeError, ValueError):
            pass

    closing_date = _parse_date(dates.get("closing_date"))
    if closing_date:
        transaction.closing_date = closing_date

    execution_date = _parse_date(dates.get("contract_execution_date"))
    if execution_date:
        transaction.contract_execution_date = execution_date

    db.add(transaction)

    # 5. Upsert party records
    parties_data = extracted.get("parties", {})
    for extracted_role, party_data in parties_data.items():
        db_role = _PARTY_ROLE_MAP.get(extracted_role)
        if db_role is None:
            continue

        name = (party_data.get("name") or "").strip()
        if not name:
            continue  # Skip parties with no name populated

        # Check whether a party with this role already exists
        existing = await db.execute(
            select(Party).where(
                Party.transaction_id == transaction_id,
                Party.role == db_role,
            )
        )
        party = existing.scalar_one_or_none()
        if party is None:
            party = Party(transaction_id=transaction_id, role=db_role)

        party.full_name = name
        party.email = party_data.get("email") or None
        party.phone = party_data.get("phone") or None
        db.add(party)

    # 6. Regenerate deadline records
    timeline_items = generate_timeline(extracted)

    await db.execute(
        delete(Deadline).where(Deadline.transaction_id == transaction_id)
    )
    for item in timeline_items:
        db.add(Deadline(
            transaction_id=transaction_id,
            name=item["name"],
            due_date=item["due_date"],
        ))

    # 7. Generate document checklist and (re)populate the documents table
    checklist = generate_checklist(transaction_id, extracted)

    await db.execute(
        delete(Document).where(Document.transaction_id == transaction_id)
    )
    for doc_data in checklist:
        db.add(
            Document(
                transaction_id=doc_data["transaction_id"],
                phase=doc_data["phase"],
                name=doc_data["name"],
                status=DocumentStatus.pending,
                responsible_party_role=doc_data["responsible_party_role"],
                due_date=doc_data["due_date"],
            )
        )

    # 8. Log event
    compliance = extracted.get("compliance_flags", {})
    active_flags = [k for k, v in compliance.items() if v]
    flags_summary = ", ".join(active_flags) if active_flags else "none"

    db.add(Event(
        transaction_id=transaction_id,
        event_type="contract_parsed",
        description=(
            f"Contract parsed successfully. "
            f"{len(timeline_items)} deadline(s) generated. "
            f"{len(checklist)} document(s) added to checklist. "
            f"Compliance flags: {flags_summary}."
        ),
    ))

    await db.commit()

    # Serialize timeline dates for JSON response
    serialized_timeline = [
        {
            "name": item["name"],
            "due_date": item["due_date"].isoformat(),
            "description": item["description"],
        }
        for item in timeline_items
    ]

    return {**extracted, "timeline": serialized_timeline}
