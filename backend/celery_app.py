"""Celery application instance and Beat schedule configuration."""

from celery import Celery
from celery.schedules import crontab

# Import settings lazily to avoid circular import issues at module load
from app.config import settings

celery_app = Celery(
    "real_estate_agent",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.worker"],
)

celery_app.conf.update(
    # Serialization
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    # Timezone
    timezone="UTC",
    enable_utc=True,
    # Beat schedule
    beat_schedule={
        "run-followup-check-hourly": {
            "task": "app.worker.run_followup_check",
            "schedule": 3600.0,
        },
        "run-deadline-check-hourly": {
            "task": "app.worker.run_deadline_check",
            "schedule": 3600.0,
        },
        "run-insurance-check-daily": {
            "task": "app.worker.run_insurance_check",
            "schedule": 86400.0,
        },
        "run-ctc-check-daily": {
            "task": "app.worker.run_ctc_check",
            "schedule": 86400.0,
        },
        "run-market-scan-nightly": {
            "task": "app.worker.run_market_scan",
            "schedule": crontab(hour=7, minute=0),  # 07:00 UTC = ~2am ET
        },
    },
    # Retry policy defaults
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
