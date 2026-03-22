"""Celery task definitions for background processing.

Tasks manage their own database sessions via AsyncSessionLocal — they do not
share the FastAPI request session.

Usage:
    Start worker:    celery -A celery_app worker --loglevel=info
    Start scheduler: celery -A celery_app beat --loglevel=info
"""

import asyncio
import logging

from celery import shared_task

logger = logging.getLogger(__name__)


# ── Periodic task: follow-up check ───────────────────────────────────────────

@shared_task(name="app.worker.run_followup_check", bind=True, max_retries=3)
def run_followup_check(self) -> int:
    """Hourly task: scan all pending documents and fire overdue follow-ups.

    Returns:
        Number of follow-up actions taken.
    """
    try:
        return asyncio.run(_run_followup_check_async())
    except Exception as exc:
        logger.exception("run_followup_check failed: %s", exc)
        raise self.retry(exc=exc, countdown=60) from exc


async def _run_followup_check_async() -> int:
    from app.database import AsyncSessionLocal
    from app.services.followup import check_and_send_followups

    async with AsyncSessionLocal() as db:
        try:
            count = await check_and_send_followups(db)
            return count
        except Exception:
            await db.rollback()
            raise


# ── One-off task: async contract parsing ─────────────────────────────────────

@shared_task(name="app.worker.process_contract_async", bind=True, max_retries=3)
def process_contract_async(self, transaction_id: int, storage_key: str) -> dict:
    """Parse a contract PDF stored at *storage_key* and populate the transaction.

    Args:
        transaction_id: ID of the transaction to update.
        storage_key:    Storage key returned by storage.upload_document().

    Returns:
        Extracted contract data dict (same shape as process_contract()).
    """
    try:
        return asyncio.run(_process_contract_async(transaction_id, storage_key))
    except Exception as exc:
        logger.exception(
            "process_contract_async failed for transaction %d: %s", transaction_id, exc
        )
        raise self.retry(exc=exc, countdown=30) from exc


async def _process_contract_async(transaction_id: int, storage_key: str) -> dict:
    from app.database import AsyncSessionLocal
    from app.services import storage
    from app.services.intake import process_contract

    pdf_bytes = await storage.download_document(storage_key)

    async with AsyncSessionLocal() as db:
        try:
            result = await process_contract(pdf_bytes, transaction_id, db)
            return result
        except Exception:
            await db.rollback()
            raise
