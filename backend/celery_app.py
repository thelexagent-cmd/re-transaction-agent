"""Celery application instance and Beat schedule configuration."""

from celery import Celery

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
    # Beat schedule: follow-up check every hour
    beat_schedule={
        "run-followup-check-hourly": {
            "task": "app.worker.run_followup_check",
            "schedule": 3600.0,  # seconds
        },
    },
    # Retry policy defaults
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)
