"""Document checklist generator: auto-generates required documents from contract data."""

from datetime import date, timedelta


def _parse_date(date_str: str | None) -> date | None:
    """Parse an ISO 8601 date string; return None on missing or invalid input."""
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


def generate_checklist(transaction_id: int, extracted_data: dict) -> list[dict]:
    """Generate the full required document checklist from parsed contract data.

    Produces a list of document dicts ready to insert into the documents table.
    Documents are phase-aware and Florida-specific. Conditional documents (lead
    paint, HOA, flood insurance, WDO) are included only when the relevant flags
    are set in the extracted data.

    Args:
        transaction_id: ID of the parent transaction.
        extracted_data: Dictionary returned by extract_contract_data().

    Returns:
        List of dicts, each with keys:
            transaction_id, phase, name, status, responsible_party_role, due_date
    """
    dates = extracted_data.get("dates", {})
    compliance = extracted_data.get("compliance_flags", {})
    financial = extracted_data.get("financial", {})

    # Parse key contract dates
    execution_date = _parse_date(dates.get("contract_execution_date"))
    inspection_end = _parse_date(dates.get("inspection_period_end"))
    financing_deadline = _parse_date(dates.get("financing_contingency_deadline"))
    closing_date = _parse_date(dates.get("closing_date"))

    # Derive missing dates using Florida standard timelines
    if execution_date and not inspection_end:
        inspection_end = execution_date + timedelta(days=10)
    if execution_date and not financing_deadline:
        financing_deadline = execution_date + timedelta(days=21)

    phase1_due = (execution_date + timedelta(days=3)) if execution_date else None
    insurance_due = (closing_date - timedelta(days=7)) if closing_date else None
    cd_due = (closing_date - timedelta(days=3)) if closing_date else None

    # Compliance flags
    lead_paint = bool(compliance.get("lead_paint_required"))
    hoa_required = bool(compliance.get("hoa_docs_required"))
    flood_insurance = bool(compliance.get("flood_insurance_required"))

    # WDO required for any lender-financed deal (conventional / FHA / VA)
    financing_type = (financial.get("financing_type") or "").lower().strip()
    has_lender_financing = any(
        ft in financing_type for ft in ("conventional", "fha", "va")
    )
    # If financing type unspecified but there is a financing amount, assume lender-financed
    if not has_lender_financing and financial.get("financing_amount"):
        has_lender_financing = True

    docs: list[dict] = []

    def add(phase: int, name: str, role: str, due_date: date | None = None) -> None:
        docs.append(
            {
                "transaction_id": transaction_id,
                "phase": phase,
                "name": name,
                "status": "pending",
                "responsible_party_role": role,
                "due_date": due_date,
            }
        )

    # ── Phase 1 — Contract Execution (Day 0–3) ────────────────────────────────
    add(1, "Fully Executed Purchase and Sale Agreement", "buyers_agent", execution_date)
    add(1, "Property Tax Disclosure (F.S. 689.261)", "listing_agent", phase1_due)
    add(1, "Radon Gas Disclosure", "listing_agent", phase1_due)
    add(1, "Seller's Property Disclosure Form", "seller", phase1_due)
    if lead_paint:
        add(1, "Lead-Based Paint Disclosure", "seller", phase1_due)
    add(1, "Energy Efficiency Brochure Receipt", "buyers_agent", phase1_due)
    add(1, "Brokerage Relationship Disclosure", "buyers_agent", phase1_due)
    add(1, "Agency Agreements (Both Sides)", "buyers_agent", phase1_due)
    add(1, "EMD Receipt Confirmation", "title", phase1_due)

    # ── Phase 2 — Inspection Period (Days 1–15) ───────────────────────────────
    add(2, "Inspection Scheduled Confirmation", "buyers_agent", inspection_end)
    add(2, "Home Inspection Report", "buyers_agent", inspection_end)
    add(
        2,
        "Inspection Contingency Resolution (Waiver or Walk Notice)",
        "buyers_agent",
        inspection_end,
    )
    add(2, "Repair Addendum (if applicable)", "buyers_agent", inspection_end)
    if has_lender_financing:
        add(
            2,
            "WDO (Wood-Destroying Organism / Termite) Inspection Report",
            "buyers_agent",
            inspection_end,
        )

    # ── Phase 3 — Financing (Days 5–30) ──────────────────────────────────────
    add(3, "Lender Confirmation: Contract and Docs Received", "lender", financing_deadline)
    add(3, "Appraisal Ordered Confirmation", "lender", financing_deadline)
    add(3, "Appraisal Report", "lender", financing_deadline)
    add(3, "Loan Commitment Letter / Clear to Close", "lender", financing_deadline)
    add(3, "Homeowner's Insurance Binder", "buyers_agent", insurance_due)
    if flood_insurance:
        add(3, "Flood Insurance Binder", "buyers_agent", insurance_due)

    # ── Phase 4 — Title and HOA (Days 1–35) ──────────────────────────────────
    add(4, "Title Search Ordered Confirmation", "title", None)
    add(4, "Preliminary Title Report / Title Commitment", "title", None)
    if hoa_required:
        add(4, "HOA Documents Package Delivered to Buyer", "hoa", None)
        add(4, "HOA Rescission Period Confirmed Cleared", "hoa", None)
        add(4, "HOA Estoppel Certificate Received", "hoa", None)
    add(4, "Title Insurance Commitment (Owner's + Lender's)", "title", None)
    add(4, "Lien Search Results", "title", None)

    # ── Phase 5 — Pre-Closing (Days 30–43) ───────────────────────────────────
    add(5, "Clear to Close (CTC) Received from Lender", "lender", cd_due)
    add(5, "Closing Disclosure Issued and 3-Day TRID Clock Confirmed", "title", cd_due)
    add(5, "Final Walkthrough Scheduled", "buyers_agent", closing_date)
    add(5, "Final Walkthrough Completed and Sign-Off", "buyers_agent", closing_date)
    add(5, "Buyer Wire Instructions Confirmed with Title", "title", cd_due)
    add(5, "All Outstanding Documents Collected (Checklist Complete)", "buyers_agent", closing_date)

    # ── Phase 6 — Closing ─────────────────────────────────────────────────────
    add(6, "Closing Appointment Confirmed (Time, Location, Parties)", "title", closing_date)
    add(6, "Buyer Funds Confirmed Received by Title", "title", closing_date)
    add(6, "Deed Recording Number Received", "title", closing_date)
    add(6, "Final ALTA Settlement Statement Collected", "title", closing_date)
    add(6, "Commission Disbursement Instructions Sent to Broker", "broker", closing_date)
    add(6, "All Closing Docs Uploaded to File", "buyers_agent", closing_date)
    add(6, "Closing Confirmation Email Sent to All Parties", "broker", closing_date)
    add(6, "File Archived", "broker", closing_date)

    return docs
