"""Contract intake orchestrator: PDF → Claude extraction → database records.

Phase 4 additions: after checklist is generated and the transaction is committed,
intro emails are sent to every party that has an email address.  Each send is
logged as an Event.  Failures are caught per-party — one bad address does not
prevent other parties from receiving their intro.
"""

from datetime import date

from sqlalchemy import select
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

# Map PartyRole → intro email template name
_INTRO_TEMPLATE_MAP: dict[PartyRole, str] = {
    PartyRole.buyer: "intro_buyer",
    PartyRole.seller: "intro_seller",
    PartyRole.buyers_agent: "intro_agent",
    PartyRole.listing_agent: "intro_agent",
    PartyRole.lender: "intro_lender",
    PartyRole.title: "intro_title",
    PartyRole.escrow: "intro_title",  # same template as title
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
        7. Send intro emails to all parties that have an email address.

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
    # 1. Verify transaction exists — acquire row-level lock immediately.
    #
    # with_for_update() issues SELECT ... FOR UPDATE in PostgreSQL.
    # Any concurrent call to process_contract() for the same transaction_id
    # will block here until this call commits or rolls back.
    # This prevents two simultaneous re-parses from producing duplicate
    # document/deadline records (read-then-write race condition).
    result = await db.execute(
        select(Transaction)
        .where(Transaction.id == transaction_id)
        .with_for_update()
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

    # 6. Regenerate deadline records — UPSERT by name, never reset alert flags
    #
    # We match on deadline name rather than deleting and recreating because:
    #   - alert_t3_sent / alert_t1_sent would reset to False on new records
    #   - Celery would re-fire T-3 and T-1 emails to parties who already received them
    #
    # Rules:
    #   - Existing deadline with same name → update due_date only, keep all flags/status
    #   - New name not in existing → insert fresh record
    #   - Existing name not in new timeline AND no alerts fired → delete (truly stale)
    #   - Existing name not in new timeline BUT alerts already fired → keep (preserve audit trail)
    timeline_items = generate_timeline(extracted)

    existing_deadlines_result = await db.execute(
        select(Deadline).where(Deadline.transaction_id == transaction_id)
    )
    # Normalize names with .strip() so minor whitespace differences (e.g. from
    # an older version of the generator) don't silently skip the upsert.
    existing_deadlines: dict[str, Deadline] = {
        d.name.strip(): d for d in existing_deadlines_result.scalars().all()
    }
    new_deadline_names = {item["name"].strip() for item in timeline_items}

    for item in timeline_items:
        name = item["name"].strip()
        if name in existing_deadlines:
            existing_deadlines[name].due_date = item["due_date"]
            db.add(existing_deadlines[name])
        else:
            db.add(Deadline(
                transaction_id=transaction_id,
                name=name,
                due_date=item["due_date"],
            ))

    for name, deadline in existing_deadlines.items():
        # name is already stripped (from dict comprehension above)
        if name not in new_deadline_names and not deadline.alert_t3_sent and not deadline.alert_t1_sent:
            await db.delete(deadline)

    # 7. Merge document checklist — NEVER delete collected documents or files
    #
    # A document is "protected" if it has been collected (status=collected) OR
    # has a real file in storage (storage_key is not None). These must never be
    # deleted, overwritten, or have their status changed by a re-parse.
    #
    # Merge rules:
    #   - Protected doc whose name IS in new checklist → update due_date only, preserve everything else
    #   - Protected doc whose name is NOT in new checklist → keep as-is, log a conflict event
    #   - Pending doc whose name IS in new checklist → update due_date + phase (dates may have changed)
    #   - Pending doc whose name is NOT in new checklist → delete (stale pending item)
    #   - New checklist name not seen before → insert as pending
    checklist = generate_checklist(transaction_id, extracted)

    existing_docs_result = await db.execute(
        select(Document).where(Document.transaction_id == transaction_id)
    )
    all_existing = existing_docs_result.scalars().all()

    # Normalize names with .strip() — same reason as deadlines above.
    # If a document name somehow appears in both protected and pending (data bug),
    # protected wins: we never discard a collected file.
    protected_docs: dict[str, Document] = {
        doc.name.strip(): doc
        for doc in all_existing
        if doc.status == DocumentStatus.collected or doc.storage_key is not None
    }
    pending_docs: dict[str, Document] = {
        doc.name.strip(): doc
        for doc in all_existing
        if doc.status != DocumentStatus.collected and doc.storage_key is None
        and doc.name.strip() not in {
            d.name.strip() for d in all_existing
            if d.status == DocumentStatus.collected or d.storage_key is not None
        }
    }

    new_checklist_names = {item["name"].strip() for item in checklist}

    # Detect conflicts: collected doc no longer required by new contract version
    orphaned = [name for name in protected_docs if name not in new_checklist_names]
    if orphaned:
        sample = ", ".join(orphaned[:5])
        suffix = f" (+{len(orphaned) - 5} more)" if len(orphaned) > 5 else ""
        db.add(Event(
            transaction_id=transaction_id,
            event_type="contract_conflict",
            description=(
                f"Re-parse conflict: {len(orphaned)} previously collected document(s) "
                f"are not listed in the updated contract checklist. "
                f"Files have been preserved and require manual review. "
                f"Affected: {sample}{suffix}."
            ),
        ))

    for doc_data in checklist:
        name = doc_data["name"].strip()
        if name in protected_docs:
            # Already collected — only update due_date if it changed, never touch status or file
            existing = protected_docs[name]
            if doc_data["due_date"] != existing.due_date:
                existing.due_date = doc_data["due_date"]
                db.add(existing)
        elif name in pending_docs:
            # Still pending — update phase/due_date in case contract dates changed
            existing = pending_docs[name]
            existing.phase = doc_data["phase"]
            existing.due_date = doc_data["due_date"]
            db.add(existing)
        else:
            # Net-new checklist item — insert
            db.add(Document(
                transaction_id=doc_data["transaction_id"],
                phase=doc_data["phase"],
                name=doc_data["name"],
                status=DocumentStatus.pending,
                responsible_party_role=doc_data["responsible_party_role"],
                due_date=doc_data["due_date"],
            ))

    # Remove stale pending items no longer in the new checklist
    # (name keys in pending_docs are already stripped)
    for name, doc in pending_docs.items():
        if name not in new_checklist_names:
            await db.delete(doc)

    # 8. Log event
    compliance = extracted.get("compliance_flags", {})
    active_flags = [k for k, v in compliance.items() if v]
    flags_summary = ", ".join(active_flags) if active_flags else "none"

    protected_count = len(protected_docs)
    conflict_count = len(orphaned)
    conflict_note = f" {conflict_count} conflict(s) flagged for review." if conflict_count else ""

    db.add(Event(
        transaction_id=transaction_id,
        event_type="contract_parsed",
        description=(
            f"Contract re-parsed successfully. "
            f"{len(timeline_items)} deadline(s) updated. "
            f"{len(checklist)} checklist item(s) merged "
            f"({protected_count} collected document(s) preserved).{conflict_note} "
            f"Compliance flags: {flags_summary}."
        ),
    ))

    await db.commit()

    # 9. Send intro emails to all parties with email addresses (Phase 4)
    await _send_intro_emails(transaction_id, db)

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


# ---------------------------------------------------------------------------
# Intro email sequence
# ---------------------------------------------------------------------------

async def _send_intro_emails(transaction_id: int, db: AsyncSession) -> None:
    """Send intro emails to all parties that have an email address.

    Each successful send is logged as an intro_sent Event.
    Each failure is logged as an email_failed Event.
    Neither success nor failure interrupts the overall intake flow.
    """
    import logging

    from app.models.user import User
    from app.services.email_service import EmailService

    log = logging.getLogger(__name__)

    try:
        # Fresh load of transaction + broker after commit
        txn_result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            return

        user_result = await db.execute(
            select(User).where(User.id == txn.user_id)
        )
        broker = user_result.scalar_one_or_none()
        broker_name = broker.full_name if broker else ""
        brokerage_name = (broker.brokerage_name or "") if broker else ""
        broker_email = broker.email if broker else ""

        # Load all parties
        parties_result = await db.execute(
            select(Party).where(Party.transaction_id == transaction_id)
        )
        parties = parties_result.scalars().all()

        # Build lookup maps for template vars
        party_by_role: dict[PartyRole, Party] = {p.role: p for p in parties}
        buyer = party_by_role.get(PartyRole.buyer)
        seller = party_by_role.get(PartyRole.seller)
        buyers_agent = party_by_role.get(PartyRole.buyers_agent)
        title_party = party_by_role.get(PartyRole.title)

        buyer_name = buyer.full_name if buyer else ""
        seller_name = seller.full_name if seller else ""
        buyers_agent_name = buyers_agent.full_name if buyers_agent else ""
        title_company = title_party.full_name if title_party else "the title company"

        base_vars = {
            "property_address": txn.address,
            "broker_name": broker_name,
            "brokerage_name": brokerage_name,
            "broker_email": broker_email,
            "buyer_name": buyer_name,
            "seller_name": seller_name,
            "agent_name": buyers_agent_name,
            "title_company": title_company,
        }

        svc = EmailService()

        for party in parties:
            template_name = _INTRO_TEMPLATE_MAP.get(party.role)
            if template_name is None or not party.email:
                continue

            # Build role-specific extra vars
            extra: dict[str, str] = {}
            if party.role == PartyRole.lender:
                extra["lender_name"] = party.full_name
            elif party.role in (PartyRole.title, PartyRole.escrow):
                extra["title_name"] = party.full_name
            elif party.role in (PartyRole.buyers_agent, PartyRole.listing_agent):
                extra["agent_name"] = party.full_name  # override with this specific agent

            template_vars = {**base_vars, **extra}

            try:
                await svc.send_template(
                    to_email=party.email,
                    to_name=party.full_name,
                    template_name=template_name,
                    template_vars=template_vars,
                )
                db.add(Event(
                    transaction_id=transaction_id,
                    event_type="intro_sent",
                    description=(
                        f"Intro email sent to {party.role.value} {party.full_name} "
                        f"({party.email})."
                    ),
                ))
                log.info(
                    "Intro email sent to %s %s (%s) [txn %d].",
                    party.role.value,
                    party.full_name,
                    party.email,
                    transaction_id,
                )
            except Exception as exc:
                db.add(Event(
                    transaction_id=transaction_id,
                    event_type="email_failed",
                    description=(
                        f"Intro email failed for {party.role.value} {party.full_name} "
                        f"({party.email}): {exc}"
                    ),
                ))
                log.error(
                    "Intro email failed for %s %s: %s",
                    party.role.value,
                    party.full_name,
                    exc,
                )

        await db.commit()

    except Exception as exc:
        log.error("_send_intro_emails failed for transaction %d: %s", transaction_id, exc)
