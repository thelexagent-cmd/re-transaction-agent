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


# ── Periodic task: deadline check ────────────────────────────────────────────

@shared_task(name="app.worker.run_deadline_check", bind=True, max_retries=3)
def run_deadline_check(self) -> int:
    """Hourly task: scan all deadlines and fire T-3/T-1/T=0 broker alerts."""
    try:
        return asyncio.run(_run_deadline_check_async())
    except Exception as exc:
        logger.exception("run_deadline_check failed: %s", exc)
        raise self.retry(exc=exc, countdown=60) from exc


async def _run_deadline_check_async() -> int:
    from app.database import AsyncSessionLocal
    from app.services.deadline_alerts import check_deadlines

    async with AsyncSessionLocal() as db:
        try:
            count = await check_deadlines(db)
            return count
        except Exception:
            await db.rollback()
            raise


# ── Periodic task: insurance gap check ───────────────────────────────────────

@shared_task(name="app.worker.run_insurance_check", bind=True, max_retries=3)
def run_insurance_check(self) -> int:
    """Hourly task: alert broker when insurance binder is missing near closing."""
    try:
        return asyncio.run(_run_insurance_check_async())
    except Exception as exc:
        logger.exception("run_insurance_check failed: %s", exc)
        raise self.retry(exc=exc, countdown=60) from exc


async def _run_insurance_check_async() -> int:
    from app.database import AsyncSessionLocal
    from app.services.insurance_alerts import check_insurance_gaps

    async with AsyncSessionLocal() as db:
        try:
            count = await check_insurance_gaps(db)
            return count
        except Exception:
            await db.rollback()
            raise


# ── Periodic task: CTC gap check ─────────────────────────────────────────────

@shared_task(name="app.worker.run_ctc_check", bind=True, max_retries=3)
def run_ctc_check(self) -> int:
    """Hourly task: alert broker when Clear to Close is missing near closing."""
    try:
        return asyncio.run(_run_ctc_check_async())
    except Exception as exc:
        logger.exception("run_ctc_check failed: %s", exc)
        raise self.retry(exc=exc, countdown=60) from exc


async def _run_ctc_check_async() -> int:
    from app.database import AsyncSessionLocal
    from app.services.closing_alerts import check_ctc_gap

    async with AsyncSessionLocal() as db:
        try:
            count = await check_ctc_gap(db)
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


# ── Periodic task: market scan ────────────────────────────────────────────────

@shared_task(name="app.worker.run_market_scan", bind=True, max_retries=2)
def run_market_scan(self) -> dict:
    """Nightly task: scan all active watchlist ZIPs, score listings, fire alerts."""
    try:
        return asyncio.run(_run_market_scan_async())
    except Exception as exc:
        logger.exception("run_market_scan failed: %s", exc)
        raise self.retry(exc=exc, countdown=300) from exc


async def _run_market_scan_async() -> dict:
    from app.database import AsyncSessionLocal
    from app.models.market import MarketWatchlist
    from app.services.market_alerts import maybe_fire_alert
    from app.services.market_scanner import scan_zip
    from sqlalchemy import select, update
    from datetime import datetime, timezone

    total_scanned = 0
    total_alerted = 0

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(MarketWatchlist).where(MarketWatchlist.status == "active")
            )
            watchlist = result.scalars().all()

            for entry in watchlist:
                property_results = await scan_zip(entry.zip_code, db)
                for prop_id, score in property_results:
                    total_scanned += 1
                    fired = await maybe_fire_alert(
                        db=db, user_id=entry.user_id, property_id=prop_id,
                        current_score=score, threshold=entry.alert_threshold,
                    )
                    if fired:
                        total_alerted += 1
                await db.execute(
                    update(MarketWatchlist)
                    .where(MarketWatchlist.id == entry.id)
                    .values(last_scanned_at=datetime.now(timezone.utc))
                )

            await db.commit()
        except Exception:
            await db.rollback()
            raise

    logger.info("Market scan complete: %d properties, %d alerts fired", total_scanned, total_alerted)
    return {"scanned": total_scanned, "alerted": total_alerted}
