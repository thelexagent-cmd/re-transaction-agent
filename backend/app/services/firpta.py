"""FIRPTA Intelligence Engine.

Florida-specific rules for foreign seller withholding compliance.
IRS Form 8288 / 8288-A withholding requirements.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Federal FIRPTA withholding rates
FEDERAL_WITHHOLDING_RATE_STANDARD = 0.15   # 15% for sales >= $1,000,000
FEDERAL_WITHHOLDING_RATE_REDUCED = 0.10   # 10% for primary residence $300k-$1M
FEDERAL_WITHHOLDING_EXEMPT_THRESHOLD = 300_000.0  # Exempt if buyer primary residence < $300k

# Florida documentary stamp + surtax (informational, title company handles)
FL_DOC_STAMP_RATE = 0.007  # $0.70 per $100
FL_MIAMI_DADE_SURTAX = 0.005  # Additional $0.50 per $100 in Miami-Dade


@dataclass
class FirptaResult:
    is_firpta_applicable: bool
    withholding_amount: float
    withholding_rate: float
    gross_sales_price: float
    notes: list[str]
    action_items: list[str]


def analyze(
    purchase_price: float,
    has_foreign_seller: bool,
    buyer_intends_primary_residence: bool = False,
) -> FirptaResult:
    """Run FIRPTA analysis for a transaction.

    Args:
        purchase_price: Total purchase price in USD
        has_foreign_seller: True if any seller is a foreign national / non-resident alien
        buyer_intends_primary_residence: True if buyer stated primary residence intent

    Returns:
        FirptaResult with withholding amount and guidance
    """
    notes: list[str] = []
    action_items: list[str] = []

    if not has_foreign_seller:
        return FirptaResult(
            is_firpta_applicable=False,
            withholding_amount=0.0,
            withholding_rate=0.0,
            gross_sales_price=purchase_price,
            notes=["No foreign sellers identified — FIRPTA withholding not required."],
            action_items=[],
        )

    notes.append("Foreign seller identified — FIRPTA withholding applies under IRC §1445.")
    action_items.append("Obtain IRS Form W-8 (Certificate of Foreign Status) from seller.")
    action_items.append("Withholding agent (title/escrow) must file IRS Form 8288 within 20 days of closing.")
    action_items.append("File IRS Form 8288-A for each foreign seller.")

    # Determine rate
    if purchase_price < FEDERAL_WITHHOLDING_EXEMPT_THRESHOLD and buyer_intends_primary_residence:
        rate = 0.0
        withholding = 0.0
        notes.append(
            f"Purchase price ${purchase_price:,.0f} < $300,000 and buyer intends primary residence — "
            "FIRPTA withholding exempt under IRS §1445(b)(5)."
        )
        action_items.append("Obtain buyer's written statement of intent to use as primary residence.")
    elif purchase_price < 1_000_000 and buyer_intends_primary_residence:
        rate = FEDERAL_WITHHOLDING_RATE_REDUCED
        withholding = purchase_price * rate
        notes.append(
            f"Purchase price ${purchase_price:,.0f} between $300k and $999,999 with buyer primary residence intent — "
            f"reduced 10% withholding rate applies."
        )
        action_items.append("Obtain buyer's written statement of intent to use as primary residence.")
    else:
        rate = FEDERAL_WITHHOLDING_RATE_STANDARD
        withholding = purchase_price * rate
        notes.append(
            f"Standard 15% FIRPTA withholding applies. Amount: ${withholding:,.2f}."
        )

    # Miami-Dade specific
    notes.append(
        "Florida requires documentary stamp tax and Miami-Dade surtax on deed — "
        "coordinated by title company at closing."
    )
    action_items.append("Verify seller has ITIN (Individual Taxpayer Identification Number) or EIN.")
    action_items.append("Confirm withholding agent is properly registered with IRS.")

    return FirptaResult(
        is_firpta_applicable=True,
        withholding_amount=withholding,
        withholding_rate=rate,
        gross_sales_price=purchase_price,
        notes=notes,
        action_items=action_items,
    )
