You are building Phase 6 of a Real Estate Transaction Agent. Read PRODUCT-SPEC.md first for full context. Read ALL existing code before writing anything new.

## Phase 6: Beta Prep

Final hardening before the beta user goes live. This is about making the system reliable, testable, and deployable.

---

## What to Build

### 1. End-to-end test script (`scripts/test_e2e.py`)

Standalone script that simulates a full transaction lifecycle without a running server:
1. Create a mock transaction in an in-memory SQLite DB (use SQLAlchemy with sqlite+aiosqlite)
2. Parse the sample contract from `samples/AS-IS-Contract-Main.pdf` (calls real Anthropic API)
3. Generate the document checklist
4. Generate the timeline/deadlines
5. Simulate a document being collected (mark one doc as collected, check milestone fires)
6. Simulate a deadline approaching (set a deadline's due_date to today+2, run check_deadlines())
7. Print a summary of: events logged, deadlines created, documents in checklist, alerts fired
8. Assert nothing crashed and all expected records were created

Requires: `ANTHROPIC_API_KEY` in environment

### 2. Broker onboarding flow

Add a simple onboarding endpoint:
`POST /auth/setup` — first-time broker setup (only works if no users exist yet)
- Creates the first broker account
- Returns JWT

This prevents needing to call register + login separately on first deploy.

### 3. Error handling audit

Go through all routers and services and ensure:
- Every 404 has a clear message ("Transaction not found", "Document not found", etc.)
- Every 422 has a field-level error message
- Database errors are caught and return 500 with a safe message (no stack traces to client)
- File upload errors (wrong type, too large) return 415 or 413 with clear message
- PDF parsing failures return 422 with: `{ "detail": "Contract parsing failed", "reason": "..." }`

### 4. Input validation

- Transaction creation: validate closing_date is in the future
- Document upload: validate file is PDF (check magic bytes, not just extension)
- Party emails: validate format
- Phone numbers: strip non-digits, validate 10-digit US format

### 5. Logging setup (`backend/app/logging_config.py`)

Set up structured logging:
- Use Python's `logging` module with JSON formatter in production
- Log level from env: `LOG_LEVEL=INFO`
- Log all inbound requests (method, path, status, duration) via middleware
- Log all outbound emails/SMS (to, template, success/failure)
- Log all Celery task executions (task name, duration, success/failure)

### 6. Health check improvements

Update `GET /health` to check:
- Database connectivity (run a simple query)
- Redis connectivity (ping)
- Return: `{ "status": "ok", "db": "ok", "redis": "ok" }` or 503 if any fail

### 7. Docker setup

Create `docker-compose.yml` at project root:

Services:
- `postgres` — postgres:16-alpine, port 5432, volume for data persistence
- `redis` — redis:7-alpine, port 6379
- `backend` — builds from backend/, port 8000, depends on postgres + redis
- `worker` — same image as backend, runs `celery -A celery_app worker --beat`

Create `backend/Dockerfile`:
- python:3.12-slim base
- Install requirements
- Run with uvicorn

Create `.env.example` at root with all vars needed to run docker-compose.

### 8. README.md update

Rewrite the README with:
- What this is (1 paragraph)
- Quick start: docker-compose up
- Manual setup instructions (venv, pip install, alembic upgrade, uvicorn)
- Environment variables reference (table)
- API overview (link to /docs — FastAPI auto-docs)
- How to run the test scripts
- Current status: which phases are complete

### 9. Final alembic migration

Run `alembic revision --autogenerate -m "phase3-6 schema updates"` to capture any schema changes from phases 3-5.

---

## Notes

- Do not deploy to production — just make it production-ready
- The docker-compose should work with `docker-compose up` and a filled-in .env
- README should be good enough that Nico could hand it to a developer and they'd understand the project

When completely finished, run:
openclaw system event --text "Phase 6 complete: Beta prep done — E2E test, error handling, validation, logging, Docker setup, README. Full build complete and ready for beta." --mode now
