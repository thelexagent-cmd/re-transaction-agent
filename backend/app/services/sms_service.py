"""Twilio SMS service.

Usage:
    svc = SMSService()
    await svc.send(to_phone="+13055551234", message="Your document is due tomorrow.")

If any Twilio credential (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)
is not configured, the send is skipped with a warning log.
Send failures are logged as errors but never propagate.
"""

from __future__ import annotations

import asyncio
import logging
from functools import partial

logger = logging.getLogger(__name__)


class SMSService:
    """Thin async wrapper around the synchronous Twilio Python SDK."""

    def __init__(self) -> None:
        from app.config import settings

        self._account_sid: str = settings.twilio_account_sid
        self._auth_token: str = settings.twilio_auth_token
        self._from_number: str = settings.twilio_from_number

    async def send(self, to_phone: str, message: str) -> None:
        """Send an SMS message via Twilio.

        Args:
            to_phone: Recipient phone number in E.164 format (e.g. +13055551234).
            message:  Text body (max 160 chars for single segment; longer messages
                      will be split automatically by Twilio).
        """
        if not all([self._account_sid, self._auth_token, self._from_number]):
            logger.warning(
                "Twilio credentials not fully configured — skipping SMS to %s.",
                to_phone,
            )
            return

        loop = asyncio.get_event_loop()
        try:
            await loop.run_in_executor(
                None,
                partial(self._send_sync, to_phone, message),
            )
        except Exception as exc:
            logger.error("SMS to %s failed: %s", to_phone, exc)

    def _send_sync(self, to_phone: str, message: str) -> None:
        from twilio.rest import Client  # type: ignore[import]

        client = Client(self._account_sid, self._auth_token)
        msg = client.messages.create(
            body=message,
            from_=self._from_number,
            to=to_phone,
        )
        logger.info("SMS sent to %s (SID: %s)", to_phone, msg.sid)
