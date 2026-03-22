"""Standalone test script for the document checklist generator.

Creates a realistic mock extracted_data dict for a Florida deal, calls
generate_checklist(), and prints the full checklist grouped by phase.
Does NOT require a running database or any API keys.

Usage (from project root):
    python scripts/test_checklist.py
"""

import os
import sys
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent
_BACKEND_DIR = _PROJECT_ROOT / "backend"

sys.path.insert(0, str(_BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-in-this-script")


# ── Mock extracted data — realistic Miami SFH deal, pre-1978, flood zone ─────

MOCK_EXTRACTED_DATA = {
    "parties": {
        "buyer": {"name": "Carlos and Maria Reyes", "email": "creyes@gmail.com", "phone": "305-555-1234"},
        "seller": {"name": "Robert Goldstein", "email": "rgoldstein@yahoo.com", "phone": "305-555-5678"},
        "buyers_agent": {"name": "Sophia Navarro", "email": "sophia@miamiproperties.com", "phone": "305-555-9012", "license": "BK3456789"},
        "listing_agent": {"name": "James Whitfield", "email": "james@coastalrealty.com", "phone": "305-555-3456", "license": "BK9876543"},
        "lender": {"name": "Chase Bank — Tony Morales", "email": "tmorales@chase.com", "phone": "305-555-7890"},
        "title_company": {"name": "Sunshine Title & Escrow", "email": "closings@sunshinetitle.com", "phone": "305-555-2345"},
        "escrow_agent": {"name": "Sunshine Title & Escrow", "email": "escrow@sunshinetitle.com", "phone": "305-555-2345"},
    },
    "property": {
        "address": "1427 SW 34th Avenue, Miami, FL 33145",
        "legal_description": "Lot 12, Block 5, Coral Gables Terrace, Plat Book 22, Page 47",
        "property_type": "single family",
        "year_built": 1965,
        "hoa_present": False,
        "flood_zone": "AE",
    },
    "financial": {
        "purchase_price": 725000,
        "earnest_money_deposit": 21750,
        "emd_escrow_agent": "Sunshine Title & Escrow",
        "financing_amount": 580000,
        "seller_concessions": 7250,
        "down_payment": 145000,
        "financing_type": "conventional",
    },
    "dates": {
        "contract_execution_date": "2026-03-21",
        "emd_deadline": "2026-03-26",
        "inspection_period_end": "2026-04-04",
        "financing_contingency_deadline": "2026-04-11",
        "appraisal_deadline": "2026-04-08",
        "closing_date": "2026-04-30",
    },
    "compliance_flags": {
        "lead_paint_required": True,    # year_built 1965 < 1978
        "hoa_docs_required": False,
        "flood_insurance_required": True,  # flood zone AE
        "septic_well_inspection": False,
    },
    "raw_notes": "AS-IS Rider attached. Seller to provide a $7,250 closing cost credit.",
}


# ── HOA variant — condo deal for coverage testing ────────────────────────────

MOCK_EXTRACTED_HOA = {
    **MOCK_EXTRACTED_DATA,
    "property": {
        **MOCK_EXTRACTED_DATA["property"],
        "address": "801 Brickell Key Dr #1204, Miami, FL 33131",
        "property_type": "condo",
        "year_built": 2003,
        "hoa_present": True,
        "flood_zone": "",
    },
    "financial": {
        **MOCK_EXTRACTED_DATA["financial"],
        "financing_type": "cash",
        "financing_amount": None,
    },
    "compliance_flags": {
        "lead_paint_required": False,   # built 2003
        "hoa_docs_required": True,      # condo
        "flood_insurance_required": False,
        "septic_well_inspection": False,
    },
}


def print_checklist(label: str, transaction_id: int, extracted: dict) -> None:
    from app.services.checklist import generate_checklist  # noqa: PLC0415

    docs = generate_checklist(transaction_id, extracted)

    print("\n" + "=" * 70)
    print(f"CHECKLIST: {label}  (transaction_id={transaction_id})")
    print("=" * 70)
    print(f"Total documents: {len(docs)}\n")

    # Group by phase
    by_phase: dict[int, list[dict]] = {}
    for doc in docs:
        by_phase.setdefault(doc["phase"], []).append(doc)

    phase_labels = {
        1: "Phase 1 — Contract Execution (Day 0–3)",
        2: "Phase 2 — Inspection Period (Days 1–15)",
        3: "Phase 3 — Financing (Days 5–30)",
        4: "Phase 4 — Title and HOA (Days 1–35)",
        5: "Phase 5 — Pre-Closing (Days 30–43)",
        6: "Phase 6 — Closing",
    }

    for phase in sorted(by_phase):
        phase_docs = by_phase[phase]
        print(f"── {phase_labels.get(phase, f'Phase {phase}')}  ({len(phase_docs)} docs)")
        for doc in phase_docs:
            due = doc["due_date"].isoformat() if doc["due_date"] else "TBD"
            party = doc["responsible_party_role"] or "—"
            print(f"   [ ] {doc['name']}")
            print(f"       Responsible: {party:20s}  Due: {due}")
        print()


def main() -> None:
    print_checklist("Miami SFH — Pre-1978, Flood Zone AE, Conventional Loan", 101, MOCK_EXTRACTED_DATA)
    print_checklist("Brickell Condo — HOA Required, Cash Deal, No Flood", 102, MOCK_EXTRACTED_HOA)


if __name__ == "__main__":
    main()
