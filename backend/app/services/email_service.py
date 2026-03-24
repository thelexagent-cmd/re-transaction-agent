"""Gmail SMTP email service.

Usage:
    svc = EmailService()
    await svc.send(to_email, to_name, subject, html_body, text_body)
    await svc.send_template(to_email, to_name, "intro_buyer", {"buyer_name": "Jane"})

    # Broker-alert helper (module-level):
    await notify_broker(transaction_id, subject="...", message="...", db=db)

If GMAIL_USER / GMAIL_APP_PASSWORD are not configured, all sends log a warning and
silently skip. Send failures are logged as errors but never propagate.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from functools import partial

logger = logging.getLogger(__name__)


class EmailService:
    """Thin async wrapper around smtplib for Gmail SMTP."""

    def __init__(self) -> None:
        from app.config import settings

        self._gmail_user: str = settings.gmail_user
        self._gmail_app_password: str = settings.gmail_app_password
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
        if not self._gmail_user or not self._gmail_app_password:
            logger.warning(
                "GMAIL_USER/GMAIL_APP_PASSWORD not configured — skipping email to %s.", to_email
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
            logger.error("Email to %s ('%s') failed: %s", to_email, subject, exc)

    def _send_sync(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_body: str,
        text_body: str | None,
    ) -> None:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = f"{self._from_name} <{self._from_email}>"
        msg["To"] = f"{to_name} <{to_email}>" if to_name else to_email

        if text_body:
            msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP("smtp.gmail.com", 587) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(self._gmail_user, self._gmail_app_password)
            smtp.sendmail(self._from_email, to_email, msg.as_string())

        logger.info("Email sent to %s — subject: '%s'", to_email, subject)

    async def send_template(
        self,
        to_email: str,
        to_name: str,
        template_name: str,
        template_vars: dict[str, str],
    ) -> None:
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
    """Fetch the broker for a transaction and send a broker_alert_email."""
    from sqlalchemy import select

    from app.models.transaction import Transaction
    from app.models.user import User

    try:
        txn_result = await db.execute(
            select(Transaction).where(Transaction.id == transaction_id)
        )
        txn = txn_result.scalar_one_or_none()
        if txn is None:
            logger.warning("notify_broker: transaction %d not found.", transaction_id)
            return

        user_result = await db.execute(
            select(User).where(User.id == txn.user_id)
        )
        broker = user_result.scalar_one_or_none()
        if broker is None or not broker.email:
            logger.warning(
                "notify_broker: broker not found for transaction %d.", transaction_id
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
        logger.error("notify_broker failed for transaction %d: %s", transaction_id, exc)
