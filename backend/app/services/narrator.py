"""AI Deal Narrator — sends milestone update emails to parties.

Called whenever a key event happens (document collected, deadline completed, etc.).
Uses Claude to generate personalized, warm update messages.
Translates to Spanish or Portuguese based on party.preferred_language.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Key events that trigger client notifications
NARRATOR_EVENTS = {
    "document_collected": "A required document has been collected",
    "deadline_completed": "A key deadline has been met",
    "contract_parsed": "The purchase contract has been reviewed",
    "transaction_created": "Your transaction has been opened",
    "hoa_rescission_cleared": "The HOA rescission period has cleared",
    "clear_to_close": "You have received Clear to Close",
}

LANGUAGE_NAMES = {
    "en": "English",
    "es": "Spanish",
    "pt": "Portuguese",
}


async def send_milestone_update(
    transaction_id: int,
    event_type: str,
    event_description: str,
    db: "AsyncSession",
) -> None:
    """Send a personalized milestone update to all client parties on the transaction."""
    from sqlalchemy import select

    from app.models.party import Party, PartyRole
    from app.models.transaction import Transaction

    # Roles that receive client updates
    CLIENT_ROLES = {PartyRole.buyer, PartyRole.seller}

    try:
        txn_result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            return

        parties_result = await db.execute(
            select(Party).where(
                Party.transaction_id == transaction_id,
                Party.role.in_(list(CLIENT_ROLES)),
                Party.email.isnot(None),
            )
        )
        parties = list(parties_result.scalars().all())

        for party in parties:
            await _notify_party(party, txn, event_type, event_description)

    except Exception as exc:
        logger.error("narrator.send_milestone_update failed for tx %d: %s", transaction_id, exc)


async def _notify_party(party, txn, event_type: str, event_description: str) -> None:
    from app.services.email_service import EmailService

    lang = getattr(party, "preferred_language", "en") or "en"
    lang_name = LANGUAGE_NAMES.get(lang, "English")

    message = await _generate_message(
        party_name=party.full_name,
        party_role=party.role.value,
        property_address=txn.address,
        event_type=event_type,
        event_description=event_description,
        language=lang_name,
    )

    subject_map = {
        "en": f"Update on Your Transaction — {txn.address}",
        "es": f"Actualización de Su Transacción — {txn.address}",
        "pt": f"Atualização da Sua Transação — {txn.address}",
    }
    subject = subject_map.get(lang, subject_map["en"])

    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <div style="background:#1e40af;color:white;padding:16px 20px;border-radius:8px 8px 0 0;">
        <h2 style="margin:0;font-size:18px;">Lex Transaction Agent</h2>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.85;">{txn.address}</p>
      </div>
      <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;">
        {message.replace(chr(10), '<br>')}
      </div>
      <p style="font-size:11px;color:#94a3b8;text-align:center;margin-top:16px;">
        Lex Transaction Agent &bull; Miami, FL
      </p>
    </div>
    """

    svc = EmailService()
    await svc.send(
        to_email=party.email,
        to_name=party.full_name,
        subject=subject,
        html_body=html,
        text_body=message,
    )
    logger.info("Milestone update sent to %s (%s) for tx %d", party.email, lang, txn.id)


async def _generate_message(
    party_name: str,
    party_role: str,
    property_address: str,
    event_type: str,
    event_description: str,
    language: str,
) -> str:
    """Use Claude to write a warm, personalized milestone update message."""
    try:
        import anthropic

        client = anthropic.AsyncAnthropic()
        role_display = party_role.replace("_", " ").title()
        prompt = (
            f"Write a short, warm, professional real estate transaction update email body "
            f"(2-3 sentences, no subject line, no greeting header) for a {role_display} named {party_name} "
            f"regarding the property at {property_address}. "
            f"The update is: {event_description}. "
            f"Write it in {language}. Be concise, reassuring, and professional."
        )
        response = await client.messages.create(
            model="claude-opus-4-6",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        return response.content[0].text.strip()
    except Exception as exc:
        logger.warning("Claude narrator failed, using fallback: %s", exc)
        return f"Dear {party_name},\n\nWe have an update regarding your transaction at {property_address}: {event_description}.\n\nThank you for your trust in Lex Transaction Agent."
