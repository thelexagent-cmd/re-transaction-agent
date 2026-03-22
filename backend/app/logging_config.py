"""Structured logging configuration for the Real Estate Transaction Agent.

Usage:
    Call configure_logging() once at application startup (in main.py).

Behavior:
    - Log level controlled by LOG_LEVEL env var (default: INFO).
    - In production (LOG_FORMAT=json), emits newline-delimited JSON records.
    - In development (default), emits human-readable text records.
    - Request logging, email/SMS sends, and Celery task executions all use
      standard Python loggers that inherit this configuration.
"""

import json
import logging
import logging.config
import os
import time


class _JSONFormatter(logging.Formatter):
    """Formats log records as single-line JSON objects."""

    def format(self, record: logging.LogRecord) -> str:
        log_obj: dict = {
            "timestamp": self.formatTime(record, datefmt="%Y-%m-%dT%H:%M:%S"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Include structured extras set via logger.info("msg", extra={...})
        _standard_attrs = {
            "args", "created", "exc_info", "exc_text", "filename", "funcName",
            "levelname", "levelno", "lineno", "message", "module", "msecs",
            "msg", "name", "pathname", "process", "processName", "relativeCreated",
            "stack_info", "thread", "threadName", "taskName",
        }
        for key, value in record.__dict__.items():
            if key not in _standard_attrs and not key.startswith("_"):
                log_obj[key] = value

        if record.exc_info:
            log_obj["exception"] = self.formatException(record.exc_info)

        return json.dumps(log_obj, default=str)


def configure_logging() -> None:
    """Configure root logger based on environment variables.

    Environment variables:
        LOG_LEVEL:  DEBUG | INFO | WARNING | ERROR  (default: INFO)
        LOG_FORMAT: json | text                      (default: text)
    """
    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    use_json = os.environ.get("LOG_FORMAT", "text").lower() == "json"

    if use_json:
        formatter = _JSONFormatter()
    else:
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    handler = logging.StreamHandler()
    handler.setFormatter(formatter)

    root_logger = logging.getLogger()
    root_logger.setLevel(level)
    # Avoid adding duplicate handlers if configure_logging() is called twice
    if not root_logger.handlers:
        root_logger.addHandler(handler)
    else:
        root_logger.handlers.clear()
        root_logger.addHandler(handler)

    # Quiet noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)


# ── Request logging middleware ────────────────────────────────────────────────

_request_logger = logging.getLogger("app.requests")


async def log_requests_middleware(request, call_next):
    """ASGI middleware that logs every inbound HTTP request with duration."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = round((time.perf_counter() - start) * 1000, 1)

    _request_logger.info(
        "%s %s %d",
        request.method,
        request.url.path,
        response.status_code,
        extra={
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "duration_ms": duration_ms,
        },
    )
    return response
