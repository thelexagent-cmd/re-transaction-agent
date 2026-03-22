"""SendGrid email service.

Usage:
    svc = EmailService()
    await svc.send(to_email, to_name, subject, html_body, text_body)
    await svc.send_template(to_email, to_name, "intro_buyer", {"buyer_name": "Jane"})

    # Broker-alert helper (module-level):
    await notify_broker(transaction_id, subject="...", message="...", db=db)

If SENDGRID_API_KEY is not configured, all sends log a warning and silently skip.
Send failures are logged as errors but never propagate — callers are not interrupted.
"""

from __future__ import annotations

import asyncio
import logging
from functools import partial

logger = logging.getLogger(__name__)


class EmailService:
    """Thin async wrapper around the synchronous SendGrid Python SDK."""

    def __init__(self) -> None:
        from app.config import settings

        self._api_key: str = settings.sendgrid_api_key
        self._from_email: str = settings.from_email
        self._from_name: str = settings.from_name

    async def send(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_body: str,
        text_body: str | None = None,
    ) -> None:
        """Send a single email via SendGrid.

        Args:
            to_email:  Recipient email address.
            to_name:   Recipient display name.
            subject:   Email subject line.
            html_body: HTML content.
            text_body: Optional plain-text fallback.
        """
        if not self._api_key:
            logger.warning(
                "SENDGRID_API_KEY not configured — skipping email to %s.", to_email
            )
            return

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                partial(
                    self._send_sync,
                    to_email,
                    to_name,
                    subject,
                    html_body,
                    text_body,
                ),
            )
        except Exception as exc:
            logger.error(
                "Email to %s ('%s') failed: %s", to_email, subject, exc
            )

    def _send_sync(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_body: str,
        text_body: str | None,
    ) -> None:
        from sendgrid import SendGridAPIClient  # type: ignore[import]
        from sendgrid.helpers.mail import Mail  # type: ignore[import]

        message = Mail(
            from_email=(self._from_email, self._from_name),
            to_emails=(to_email, to_name),
            subject=subject,
            html_content=html_body,
        )
        if text_body:
            message.plain_text_content = text_body

        sg = SendGridAPIClient(self._api_key)
        response = sg.send(message)
        logger.info(
            "Email sent to %s — subject: '%s' (HTTP %s)",
            to_email,
            subject,
            response.status_code,
        )

    async def send_template(
        self,
        to_email: str,
        to_name: str,
        template_name: str,
        template_vars: dict[str, str],
    ) -> None:
        """Render a named template and send the resulting email.

        Args:
            to_email:      Recipient email address.
            to_name:       Recipient display name.
            template_name: Key in TEMPLATES dict.
            template_vars: Variables to substitute into the template.
        """
        from app.services.templates import render_template

        try:
            subject, html, text = render_template(template_name, **template_vars)
        except KeyError:
            logger.error("Unknown email template: '%s'", template_name)
            return

        await self.send(to_email, to_name, subject, html, text)


# ---------------------------------------------------------------------------
# Module-level helper: send a broker alert email for a transaction
# ---------------------------------------------------------------------------

async def notify_broker(
    transaction_id: int,
    subject: str,
    message: str,
    db,  # AsyncSession — imported lazily to avoid circular deps
) -> None:
    """Fetch the broker for a transaction and send a broker_alert_email.

    Silently no-ops if the transaction or broker record cannot be found,
    or if email credentials are not configured.

    Args:
        transaction_id: ID of the transaction that triggered the alert.
        subject:        Short alert subject (used in email subject line).
        message:        Full alert message / description.
        db:             Async SQLAlchemy session (caller manages lifecycle).
    """
    from sqlalchemy import select

    from app.models.transaction import Transaction
    from app.models.user import User

    try:
        txn_result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            logger.warning(
                "notify_broker: transaction %d not found.", transaction_id
            )
            return

        user_result = await db.execute(
            select(User).where(User.id == txn.user_id)
        )
        broker = user_result.scalar_one_or_none()
        if broker is None or not broker.email:
            logger.warning(
                "notify_broker: broker not found for transaction %d.",
                transaction_id,
            )
            return

        svc = EmailService()
        await svc.send_template(
            to_email=broker.email,
            to_name=broker.full_name,
            template_name="broker_alert_email",
            template_vars={
                "broker_name": broker.full_name,
                "brokerage_name": broker.brokerage_name or "",
                "property_address": txn.address,
                "alert_subject": subject,
                "alert_message": message,
            },
        )
    except Exception as exc:
        logger.error(
            "notify_broker failed for transaction %d: %s", transaction_id, exc
        )
