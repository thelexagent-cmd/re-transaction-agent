"""FastAPI application entry point."""

import logging

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.logging_config import configure_logging, log_requests_middleware
from app.routers import auth, compliance, documents, tasks, transactions
from app.routers import portal, reports, templates

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Real Estate Transaction Agent API",
    description="Backend API for the Real Estate Transaction Agent.",
    version="1.0.0",
)

# ── Middleware ────────────────────────────────────────────────────────────────

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_origin_regex=r"https://.*\.(vercel\.app|up\.railway\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    return await log_requests_middleware(request, call_next)


# ── Global error handlers ─────────────────────────────────────────────────────


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    """Return field-level validation errors as 422 with structured detail."""
    errors = []
    for error in exc.errors():
        field = " → ".join(str(loc) for loc in error["loc"] if loc != "body")
        errors.append({"field": field or "body", "message": error["msg"]})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Validation error", "errors": errors},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error_handler(request: Request, exc: SQLAlchemyError):
    """Catch unhandled database errors; return 500 without exposing internals."""
    logger.error("Unhandled database error on %s %s: %s", request.method, request.url.path, exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "A database error occurred. Please try again or contact support."},
    )


@app.exception_handler(Exception)
async def generic_error_handler(request: Request, exc: Exception):
    """Catch-all for unexpected server errors; log full traceback, return 500."""
    import traceback
    tb = traceback.format_exc()
    logger.exception("Unexpected error on %s %s", request.method, request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": str(exc), "traceback": tb},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(auth.router)
app.include_router(transactions.router)
app.include_router(documents.router)
app.include_router(tasks.router)
app.include_router(compliance.router)
app.include_router(portal.router)
app.include_router(reports.router)
app.include_router(templates.router)


# ── Health check ──────────────────────────────────────────────────────────────


@app.get("/health", tags=["system"])
async def health() -> dict:
    """Extended health check: verifies database and Redis connectivity.

    Returns 200 when all services are reachable, 503 if any check fails.
    """
    from app.config import settings
    from app.database import engine

    db_status = "ok"
    redis_status = "ok"

    # Database check
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as exc:
        logger.warning("Health check: database unavailable: %s", exc)
        db_status = "error"

    # Redis check
    try:
        import redis.asyncio as aioredis  # noqa: PLC0415

        r = aioredis.from_url(settings.redis_url, socket_connect_timeout=2)
        await r.ping()
        await r.aclose()
    except Exception as exc:
        logger.warning("Health check: Redis unavailable: %s", exc)
        redis_status = "error"

    overall = "ok" if db_status == "ok" and redis_status == "ok" else "degraded"

    response_body = {"status": overall, "db": db_status, "redis": redis_status}

    # Only fail the health check when the database is unreachable — the app cannot
    # serve any requests without it.  Redis being unavailable degrades background
    # task processing but should not prevent Railway from routing traffic here.
    if db_status != "ok":
        return JSONResponse(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, content=response_body)

    return response_body
