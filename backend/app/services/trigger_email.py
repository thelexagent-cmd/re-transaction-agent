"""Trigger-based automated email sending.

Fires the right email template when key events happen:
- Transaction status changes → matched template sent to parties
- Key documents received → confirmation sent to relevant parties

All sending is fire-and-forget wrapped in try/except so a failed email
never crashes an upload or update request.
"""

import asyncio
import logging
import re
from types import SimpleNamespace

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.email_template import EmailTemplate
from app.models.transaction import Transaction
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)

# Map transaction status string → template name to send on status change.
# Only "active" and "closed" are real DB enum values. Pipeline stage strings
# (under_contract, inspection, etc.) are passed as freeform status updates
# by the frontend and stored as-is if the column allows it.
STATUS_TRIGGERS: dict[str, str] = {
    "under_contract": "Under Contract Congratulations",
    "inspection":     "Inspection Reminder",
    "financing":      "Document Request — Lender",
    "clear_to_close": "Clear to Close",
    "closed":         "Post-Closing Thank You",
}

# Roles that should receive milestone emails (buyers + sellers, not internal parties)
RECIPIENT_ROLES = {"buyer", "seller", "buyers_agent", "listing_agent"}

# Fallback templates when broker has not customized email templates.
# Maps template name -> (subject, body) with {{placeholders}} for _fill_template.
DEFAULT_TEMPLATES: dict[str, tuple[str, str]] = {
    "Under Contract Congratulations": (
        "\U0001f389 Congratulations \u2014 You're Under Contract!",
        "Hi,\n\n"
        "Congratulations! You are now officially under contract on {{property_address}}.\n\n"
        "Your closing date is {{closing_date}}. We will keep you updated on every step.\n\n"
        "Thank you for trusting us with this transaction.\n\n"
        "Best regards",
    ),
    "Inspection Reminder": (
        "Inspection Scheduled \u2014 {{property_address}}",
        "Hi,\n\n"
        "This is a reminder that an inspection has been scheduled for {{property_address}}.\n\n"
        "Please make sure the property is accessible and any relevant documentation is ready.\n\n"
        "If you have questions, don\u2019t hesitate to reach out.\n\n"
        "Best regards",
    ),
    "Clear to Close": (
        "\u2705 Clear to Close \u2014 {{property_address}}",
        "Hi,\n\n"
        "Great news! {{property_address}} has been cleared to close.\n\n"
        "Your closing date is {{closing_date}}. The title company will reach out with "
        "final instructions and closing documents.\n\n"
        "Congratulations on reaching this milestone!\n\n"
        "Best regards",
    ),
    "Post-Closing Thank You": (
        "Thank You \u2014 {{property_address}} Closing",
        "Hi,\n\n"
        "Congratulations on the successful closing of {{property_address}}!\n\n"
        "Thank you for working with us on this transaction. It was a pleasure helping "
        "you through the process.\n\n"
        "If you ever need assistance with future real estate needs, please don\u2019t "
        "hesitate to reach out.\n\n"
        "Best regards",
    ),
}

# Document name keywords → template to fire
DOC_TRIGGERS: list[tuple[str, str]] = [
    ("inspection", "Inspection Results — Repair Request"),
    ("clear to close", "Clear to Close"),
    ("closing disclosure", "Clear to Close"),
    ("commitment letter", "Document Request — Lender"),
    ("proof of insurance", "Document Request — Lender"),
]


def _fill_template(body: str, tx: Transaction) -> str:
    """Replace {{variable}} placeholders with real transaction values."""
    replacements = {
        "property_address": tx.address or "",
        "closing_date": tx.closing_date.strftime("%B %d, %Y") if tx.closing_date else "TBD",
        "purchase_price": f"${tx.purchase_price:,.0f}" if tx.purchase_price else "TBD",
    }
    for key, val in replacements.items():
        body = body.replace("{{" + key + "}}", val)
    # Remove any remaining unfilled placeholders
    body = re.sub(r"\{\{[^}]+\}\}", "", body)
    return body


async def _load_template(template_name: str, user_id: int, db: AsyncSession):
    """Load a broker's custom template, falling back to a built-in default."""
    result = await db.execute(
        select(EmailTemplate).where(
            EmailTemplate.name == template_name,
            EmailTemplate.user_id == user_id,
        )
    )
    template = result.scalar_one_or_none()
    if template is not None:
        return template

    # Fallback to built-in default if available
    if template_name in DEFAULT_TEMPLATES:
        subject, body = DEFAULT_TEMPLATES[template_name]
        logger.info(
            "Using default template for '%s' (user %d has no custom template)",
            template_name, user_id,
        )
        return SimpleNamespace(subject=subject, body=body)

    return None


async def fire_status_trigger(transaction_id: int, new_status: str, db: AsyncSession) -> None:
    """Called when a transaction's status changes. Sends the matching template to parties."""
    template_name = STATUS_TRIGGERS.get(new_status)
    if not template_name:
        return

    try:
        tx_result = await db.execute(
            select(Transaction)
            .where(Transaction.id == transaction_id)
            .options(selectinload(Transaction.parties))
        )
        tx = tx_result.scalar_one_or_none()
        if not tx:
            logger.warning("fire_status_trigger: transaction %d not found", transaction_id)
            return

        template = await _load_template(template_name, tx.user_id, db)
        if not template:
            logger.warning(
                "fire_status_trigger: template '%s' not found for user %d — skipping",
                template_name, tx.user_id,
            )
            return

        body = _fill_template(template.body, tx)
        subject = _fill_template(template.subject, tx)

        email_service = EmailService()
        sent_count = 0
        for party in tx.parties:
            if party.role not in RECIPIENT_ROLES:
                continue
            if not party.email:
                continue
            try:
                await email_service.send(
                    to_email=party.email,
                    to_name=party.full_name,
                    subject=subject,
                    html_body=body,
                )
                sent_count += 1
                logger.info(
                    "Auto-email sent: template='%s' to='%s' tx=%d",
                    template_name, party.email, transaction_id,
                )
            except Exception as exc:
                logger.warning(
                    "Failed to send auto-email to '%s' for tx %d: %s",
                    party.email, transaction_id, exc,
                )

        if sent_count == 0:
            logger.info(
                "fire_status_trigger: no eligible recipients for tx %d (template='%s')",
                transaction_id, template_name,
            )

    except Exception as exc:
        logger.error("fire_status_trigger failed for tx %d: %s", transaction_id, exc)


async def fire_document_trigger(
    transaction_id: int,
    document_name: str,
    db: AsyncSession,
    doc_type: str | None = None,
) -> None:
    """Called when a document is received. Sends a trigger email if the doc name matches.

    Checks both ``document_name`` (display name / user-provided) and the
    structured ``doc_type`` returned by the classifier so that canonical type
    strings like "Commitment Letter" are matched reliably even when the display
    name differs.
    """
    candidates = [document_name.lower()]
    if doc_type:
        candidates.append(doc_type.lower())

    template_name = None
    for keyword, tmpl in DOC_TRIGGERS:
        if any(keyword in c for c in candidates):
            template_name = tmpl
            break

    if not template_name:
        return

    try:
        tx_result = await db.execute(
            select(Transaction)
            .where(Transaction.id == transaction_id)
            .options(selectinload(Transaction.parties))
        )
        tx = tx_result.scalar_one_or_none()
        if not tx:
            return

        template = await _load_template(template_name, tx.user_id, db)
        if not template:
            logger.warning(
                "fire_document_trigger: template '%s' not found — skipping", template_name
            )
            return

        body = _fill_template(template.body, tx)
        subject = _fill_template(template.subject, tx)

        email_service = EmailService()
        for party in tx.parties:
            if party.role not in {"buyer", "buyers_agent"}:
                continue
            if not party.email:
                continue
            try:
                await email_service.send(
                    to_email=party.email,
                    to_name=party.full_name,
                    subject=subject,
                    html_body=body,
                )
                logger.info(
                    "Auto-email sent (doc trigger): template='%s' to='%s' tx=%d",
                    template_name, party.email, transaction_id,
                )
            except Exception as exc:
                logger.warning("Doc trigger email failed for '%s': %s", party.email, exc)

    except Exception as exc:
        logger.error("fire_document_trigger failed for tx %d: %s", transaction_id, exc)
