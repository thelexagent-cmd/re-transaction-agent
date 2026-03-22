"""End-to-end test: simulates a full transaction lifecycle without a running server.

Uses an in-memory SQLite database and calls the real Anthropic API to parse
the sample contract. Validates that all expected records are created and that
the deadline alert engine fires correctly.

Requirements:
    ANTHROPIC_API_KEY must be set in the environment.

Usage:
    cd <project-root>
    ANTHROPIC_API_KEY=sk-ant-... python scripts/test_e2e.py
"""

import asyncio
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

# ── Path setup and env defaults (MUST happen before app imports) ──────────────

_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_ROOT / "backend"))

# Provide minimal env config so Settings() doesn't fail on required fields.
# The DATABASE_URL is overridden below after we patch app.database.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "test-e2e-secret-key-not-for-production")
os.environ.setdefault("REDIS_URL", "redis://localhost:6379/0")

# ── Imports (after env is set) ────────────────────────────────────────────────

import app.database as _db_module  # noqa: E402
from sqlalchemy import select  # noqa: E402
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

# Override the engine with StaticPool so all connections share the same
# in-memory SQLite database (required for :memory: to work correctly).
_test_engine = create_async_engine(
    "sqlite+aiosqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
_db_module.engine = _test_engine
_db_module.AsyncSessionLocal = async_sessionmaker(
    bind=_test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

# Now safe to import app models and services
from app.database import Base  # noqa: E402
from app.models.deadline import Deadline, DeadlineStatus  # noqa: E402
from app.models.document import Document, DocumentStatus  # noqa: E402
from app.models.event import Event  # noqa: E402
from app.models.transaction import PropertyType, Transaction, TransactionStatus  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.checklist import generate_checklist  # noqa: E402
from app.services.deadline_alerts import check_deadlines  # noqa: E402
from app.services.extractor import extract_contract_data  # noqa: E402
from app.services.parser import extract_text  # noqa: E402
from app.services.timeline import generate_timeline  # noqa: E402

SAMPLE_PDF = _ROOT / "samples" / "AS-IS-Contract-Main.pdf"

_PASS = "\033[92m✓\033[0m"
_FAIL = "\033[91m✗\033[0m"


def _check(condition: bool, label: str) -> None:
    symbol = _PASS if condition else _FAIL
    print(f"  {symbol} {label}")
    if not condition:
        raise AssertionError(f"Assertion failed: {label}")


# ── Test steps ────────────────────────────────────────────────────────────────


async def step_create_schema(engine) -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def step_create_user_and_transaction(db: AsyncSession) -> tuple[int, int]:
    """Create a mock broker user and a bare transaction record."""
    user = User(
        email="broker@test.example",
        hashed_password="hashed-not-real",
        full_name="Test Broker",
        brokerage_name="Test Realty",
    )
    db.add(user)
    await db.flush()

    txn = Transaction(
        user_id=user.id,
        address="123 Placeholder St, Miami, FL 33101",
        property_type=PropertyType.sfh,
        status=TransactionStatus.active,
        closing_date=date.today() + timedelta(days=45),
    )
    db.add(txn)
    db.add(Event(
        transaction_id=txn.id,  # populated after flush
        event_type="transaction_created",
        description=f"E2E test transaction created for {txn.address}.",
    ))
    await db.flush()
    # Re-add the event with the correct transaction id now that txn.id is set
    db.expunge_all()

    # Reload cleanly
    txn_result = await db.execute(select(Transaction))
    txn = txn_result.scalar_one()

    event = Event(
        transaction_id=txn.id,
        event_type="transaction_created",
        description=f"E2E test transaction created for {txn.address}.",
    )
    db.add(event)
    await db.commit()
    return user.id, txn.id


async def step_parse_contract(txn_id: int, db: AsyncSession) -> dict:
    """Extract structured data from the sample PDF using the real Anthropic API."""
    pdf_bytes = SAMPLE_PDF.read_bytes()
    contract_text = extract_text(pdf_bytes)
    extracted = await extract_contract_data(contract_text)
    return extracted


async def step_generate_checklist(txn_id: int, extracted: dict, db: AsyncSession) -> int:
    """Generate the document checklist and persist it."""
    checklist = generate_checklist(txn_id, extracted)
    for doc_data in checklist:
        db.add(Document(
            transaction_id=txn_id,
            phase=doc_data["phase"],
            name=doc_data["name"],
            status=DocumentStatus.pending,
            responsible_party_role=doc_data["responsible_party_role"],
            due_date=doc_data["due_date"],
        ))
    await db.commit()
    return len(checklist)


async def step_generate_timeline(txn_id: int, extracted: dict, db: AsyncSession) -> int:
    """Generate deadline timeline and persist it."""
    timeline = generate_timeline(extracted)
    for item in timeline:
        db.add(Deadline(
            transaction_id=txn_id,
            name=item["name"],
            due_date=item["due_date"],
        ))
    db.add(Event(
        transaction_id=txn_id,
        event_type="contract_parsed",
        description=(
            f"Contract parsed. {len(timeline)} deadline(s) generated. "
            f"Address: {extracted.get('property', {}).get('address', 'N/A')}."
        ),
    ))
    await db.commit()
    return len(timeline)


async def step_collect_document(txn_id: int, db: AsyncSession) -> str | None:
    """Mark the first pending document as collected; check for milestone event."""
    result = await db.execute(
        select(Document)
        .where(Document.transaction_id == txn_id, Document.status == DocumentStatus.pending)
        .order_by(Document.id)
        .limit(1)
    )
    doc = result.scalar_one_or_none()
    if doc is None:
        return None

    doc.status = DocumentStatus.collected
    doc.collected_at = datetime.now(tz=timezone.utc)
    db.add(doc)
    db.add(Event(
        transaction_id=txn_id,
        event_type="document_collected",
        description=f"Document '{doc.name}' marked collected (E2E simulation).",
    ))
    await db.commit()
    return doc.name


async def step_simulate_approaching_deadline(txn_id: int, db: AsyncSession) -> int:
    """Move the first deadline to today+2 and run check_deadlines()."""
    result = await db.execute(
        select(Deadline)
        .where(Deadline.transaction_id == txn_id)
        .order_by(Deadline.id)
        .limit(1)
    )
    dl = result.scalar_one_or_none()
    if dl is None:
        return 0

    dl.due_date = date.today() + timedelta(days=2)
    dl.status = DeadlineStatus.upcoming
    dl.alert_t3_sent = False
    dl.alert_t1_sent = False
    db.add(dl)
    await db.commit()

    # Run the deadline alert engine — fires T-3 alert since due_date <= today+3
    alerts_fired = await check_deadlines(db)
    return alerts_fired


# ── Main ──────────────────────────────────────────────────────────────────────


async def main() -> None:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        print(f"{_FAIL} ANTHROPIC_API_KEY is not set. Export it and re-run.")
        sys.exit(1)

    if not SAMPLE_PDF.exists():
        print(f"{_FAIL} Sample PDF not found at: {SAMPLE_PDF}")
        sys.exit(1)

    print("=" * 60)
    print("  Real Estate Transaction Agent — E2E Test")
    print("=" * 60)
    print()

    # Create schema
    print("[ Setup ] Creating in-memory SQLite schema...")
    await step_create_schema(_test_engine)
    print("          Schema created.\n")

    async with _db_module.AsyncSessionLocal() as db:

        # Step 1: Create broker user + transaction
        print("[ Step 1 ] Creating broker user and transaction...")
        user_id, txn_id = await step_create_user_and_transaction(db)
        print(f"           User ID={user_id}, Transaction ID={txn_id}\n")

        # Step 2: Parse real sample contract
        print("[ Step 2 ] Parsing AS-IS-Contract-Main.pdf via Anthropic API...")
        print("           (This calls the real API — may take 10–30 seconds)")
        extracted = await step_parse_contract(txn_id, db)
        prop = extracted.get("property", {})
        fin = extracted.get("financial", {})
        print(f"           Address  : {prop.get('address', 'N/A')}")
        print(f"           Price    : ${fin.get('purchase_price', 'N/A')}")
        print(f"           Type     : {prop.get('property_type', 'N/A')}")
        compliance = extracted.get("compliance_flags", {})
        active_flags = [k for k, v in compliance.items() if v]
        print(f"           Flags    : {', '.join(active_flags) or 'none'}\n")

        # Step 3: Generate document checklist
        print("[ Step 3 ] Generating document checklist...")
        doc_count = await step_generate_checklist(txn_id, extracted, db)
        print(f"           {doc_count} documents added to checklist.\n")

        # Step 4: Generate timeline/deadlines
        print("[ Step 4 ] Generating deadline timeline...")
        deadline_count = await step_generate_timeline(txn_id, extracted, db)
        print(f"           {deadline_count} deadlines created.\n")

        # Step 5: Simulate document collection
        print("[ Step 5 ] Simulating document collection...")
        collected_name = await step_collect_document(txn_id, db)
        if collected_name:
            print(f"           Marked '{collected_name}' as collected.\n")
        else:
            print("           No pending documents found (skipped).\n")

        # Step 6: Simulate approaching deadline
        print("[ Step 6 ] Simulating deadline approaching (due_date = today+2)...")
        alerts_fired = await step_simulate_approaching_deadline(txn_id, db)
        print(f"           check_deadlines() fired {alerts_fired} alert event(s).\n")

        # ── Summary ───────────────────────────────────────────────────────────
        events_result = await db.execute(
            select(Event).where(Event.transaction_id == txn_id)
        )
        events = list(events_result.scalars().all())

        docs_result = await db.execute(
            select(Document).where(Document.transaction_id == txn_id)
        )
        docs = list(docs_result.scalars().all())

        dls_result = await db.execute(
            select(Deadline).where(Deadline.transaction_id == txn_id)
        )
        deadlines = list(dls_result.scalars().all())

        broker_alerts = [e for e in events if e.event_type == "broker_alert"]
        deadline_warnings = [
            e for e in events if e.event_type in ("deadline_warning_t3", "deadline_warning_t1")
        ]

        print("=" * 60)
        print("  Summary")
        print("=" * 60)
        print(f"  Events logged      : {len(events)}")
        print(f"  Deadlines created  : {len(deadlines)}")
        print(f"  Documents in list  : {len(docs)}")
        print(f"  Broker alerts fired: {len(broker_alerts)}")
        print(f"  Deadline warnings  : {len(deadline_warnings)}")
        print()

        # ── Assertions ────────────────────────────────────────────────────────
        print("=" * 60)
        print("  Assertions")
        print("=" * 60)
        _check(len(events) >= 2, "At least 2 events logged (transaction_created + contract_parsed)")
        _check(len(deadlines) > 0, "At least 1 deadline created from timeline")
        _check(len(docs) > 0, "At least 1 document in checklist")
        _check(extracted.get("property", {}).get("address") not in (None, ""), "Contract address extracted")
        _check(alerts_fired > 0, "check_deadlines() fired at least 1 alert for approaching deadline")
        collected_docs = [d for d in docs if d.status == DocumentStatus.collected]
        _check(len(collected_docs) >= 1, "At least 1 document marked as collected")
        print()
        print("=" * 60)
        print("  ALL CHECKS PASSED — E2E test complete.")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
