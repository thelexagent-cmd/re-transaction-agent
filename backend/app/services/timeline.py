"""Deal timeline generator: calculates all critical deadlines from contract dates."""

from datetime import date, timedelta


def _add_business_days(start: date, days: int) -> date:
    """Return the date that is *days* business days after *start*, skipping weekends."""
    current = start
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() not in (5, 6):  # 5 = Saturday, 6 = Sunday
            added += 1
    return current


def _parse_date(date_str: str | None) -> date | None:
    """Parse an ISO 8601 date string; return None on missing or invalid input."""
    if not date_str:
        return None
    try:
        return date.fromisoformat(date_str)
    except (ValueError, TypeError):
        return None


def generate_timeline(extracted_data: dict) -> list[dict]:
    """Generate the full deal timeline from extracted contract dates.

    Calculates standard Florida real estate deadlines using only Python's
    datetime/timedelta — no external packages required.

    Args:
        extracted_data: Dictionary returned by extract_contract_data().

    Returns:
        List of dicts, each with keys:
            - name (str): Deadline label
            - due_date (date): Calculated or extracted due date
            - description (str): Plain-language explanation of the deadline
        Items are sorted by due_date ascending.
    """
    dates = extracted_data.get("dates", {})

    execution_date = _parse_date(dates.get("contract_execution_date"))
    closing_date = _parse_date(dates.get("closing_date"))

    if not execution_date and not closing_date:
        return []

    items: list[dict] = []

    # ── Execution-anchored deadlines ──────────────────────────────────────────
    if execution_date:
        # Earnest Money Deposit: 3 business days after execution
        emd_deadline = _parse_date(dates.get("emd_deadline"))
        if not emd_deadline:
            emd_deadline = _add_business_days(execution_date, 3)
        items.append({
            "name": "Earnest Money Deposit Due",
            "due_date": emd_deadline,
            "description": (
                "Buyer must deliver earnest money deposit to the designated escrow agent."
            ),
        })

        # Inspection period end: from contract or execution + 10 days
        inspection_end = _parse_date(dates.get("inspection_period_end"))
        if not inspection_end:
            inspection_end = execution_date + timedelta(days=10)
        items.append({
            "name": "Inspection Period Ends",
            "due_date": inspection_end,
            "description": (
                "Last day for buyer to complete all property inspections and, "
                "if unsatisfied, cancel the contract under the AS-IS rider."
            ),
        })

        # Financing contingency: from contract or execution + 21 days
        financing_deadline = _parse_date(dates.get("financing_contingency_deadline"))
        if not financing_deadline:
            financing_deadline = execution_date + timedelta(days=21)
        items.append({
            "name": "Financing Contingency Deadline",
            "due_date": financing_deadline,
            "description": (
                "Buyer must obtain written loan approval; "
                "failure to notify seller may waive the financing contingency."
            ),
        })

        # Appraisal deadline: include only when explicitly present in the contract
        appraisal_deadline = _parse_date(dates.get("appraisal_deadline"))
        if appraisal_deadline:
            items.append({
                "name": "Appraisal Deadline",
                "due_date": appraisal_deadline,
                "description": "Property appraisal must be completed and results reviewed by this date.",
            })

    # ── Closing-anchored deadlines ────────────────────────────────────────────
    if closing_date:
        # Closing Disclosure issued: closing - 3 days (TRID requirement)
        cd_date = closing_date - timedelta(days=3)
        items.append({
            "name": "Closing Disclosure Issued",
            "due_date": cd_date,
            "description": (
                "Lender must provide the Closing Disclosure to buyer "
                "(federal TRID / Know Before You Owe requirement)."
            ),
        })

        # Insurance binder due: closing - 7 days
        insurance_date = closing_date - timedelta(days=7)
        items.append({
            "name": "Insurance Binder Due",
            "due_date": insurance_date,
            "description": (
                "Buyer must provide proof of homeowner's insurance binder to the lender."
            ),
        })

        # Final walkthrough: closing - 1 day
        walkthrough_date = closing_date - timedelta(days=1)
        items.append({
            "name": "Final Walkthrough",
            "due_date": walkthrough_date,
            "description": (
                "Buyer conducts final walkthrough to confirm property condition "
                "before transfer of ownership."
            ),
        })

        # Closing itself
        items.append({
            "name": "Closing",
            "due_date": closing_date,
            "description": "Property closing, fund disbursement, and transfer of ownership.",
        })

    items.sort(key=lambda x: x["due_date"])
    return items
