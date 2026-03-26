# COORDINATION_DOCTOR.md — Security & Quality Audit Report

**Date:** 2026-03-26
**Auditor:** Doctor Agent (Claude)

---

## 1. AUTHORIZATION — Users only access their own data

**Status: PASS**

Every router was reviewed. All transaction-scoped endpoints use a `_require_transaction_ownership()` or `_get_transaction_or_404()` helper that filters by `Transaction.user_id == current_user.id`. Every protected endpoint depends on `get_current_user` (JWT-based `HTTPBearer`).

- `transactions.py` — All endpoints check ownership. Global endpoints (`/stats`, `/deadlines/all`, `/documents/all`, `/events/recent`, `/contacts/all`) all filter by `current_user.id`.
- `documents.py` — Uses `_get_transaction_or_404(transaction_id, current_user.id, db)`.
- `tasks.py` — Uses `_require_transaction_ownership()`.
- `compliance.py` — Uses `_require_transaction_ownership()`.
- `inspection.py` — Uses `_require_transaction_ownership()`.
- `templates.py` — Filters by `EmailTemplate.user_id == current_user.id`.
- `reports.py` — Filters by `Transaction.user_id == current_user.id`.
- `portal.py` — Token-creation endpoints require auth + ownership. Public portal endpoints only accept valid, unexpired tokens (48-byte `secrets.token_urlsafe`). Token-type is validated for lender endpoints. No auth leakage found.

No fixes needed.

---

## 2. INPUT VALIDATION / SANITIZATION

**Status: FIXED**

### Findings:
- **`update_party` endpoint accepted raw `dict`** instead of a typed Pydantic model. This bypasses all schema validation. FIXED: now uses `PartyUpdate` Pydantic schema.
- **Multiple schemas lacked max-length constraints** on string fields, allowing unbounded input that could cause DB errors or memory issues.
- No raw SQL queries found (only `text("SELECT 1")` in health check, which is parameterless).
- No `dangerouslySetInnerHTML` usage found in the frontend.
- **Inspection schemas** lacked enum validation for `severity` and `status` fields — any string was accepted. FIXED with allowlist validation.

### Fixes applied:
- `backend/app/routers/transactions.py` — Changed `update_party` body from `dict` to `PartyUpdate` Pydantic model.
- `backend/app/schemas/auth.py` — Added max-length validators: password (128), full_name (200), brokerage_name (200). Added required/strip checks.
- `backend/app/schemas/transaction.py` — Added max-length on `address` (500), `PartyCreate.full_name` (200), `NotesUpdate.content` (50000), `PartyUpdate.preferred_language` (10).
- `backend/app/schemas/email_template.py` — Added max-length on `name` (200), `subject` (500), `body` (50000) for both create and update.
- `backend/app/routers/tasks.py` — Added max-length on `title` (500), `assigned_role` (100) for TaskCreate and TaskUpdate.
- `backend/app/routers/inspection.py` — Added max-length on `description` (2000), `notes` (5000). Added allowlist validation for `severity` and `status` fields.
- `backend/app/routers/compliance.py` — Added max-length on `reviewed_by_name` (200).
- `backend/app/routers/portal.py` — Added max-length on `lender_name` (200), `lender_email` (300), `LenderDocUpload.name` (500).

---

## 3. CORS POLICY

**Status: FIXED**

### Finding:
`allow_origin_regex=r"https://.*\.(vercel\.app|up\.railway\.app)"` matched ANY Vercel or Railway subdomain — not just this project's deployments. An attacker could deploy their own app on Vercel and make credentialed cross-origin requests.

### Fix:
Replaced the regex with an explicit allowlist:
```python
allow_origins=[
    "http://localhost:3000",
    "https://frontend-rose-ten-64.vercel.app",
]
```

**File modified:** `backend/app/main.py`

---

## 4. RATE LIMITING

**Status: FIXED**

### Finding:
No rate limiting was in place. `slowapi` was not in `requirements.txt`.

### Fixes:
- Added `slowapi==0.1.9` to `backend/requirements.txt`.
- In `backend/app/main.py`: configured `Limiter` with `default_limits=["60/minute"]` globally, added `RateLimitExceeded` exception handler.
- In `backend/app/routers/auth.py`: applied `@limiter.limit("5/minute")` to `/register`, `/login`, and `/setup` endpoints to prevent credential-stuffing attacks.

**Files modified:** `backend/requirements.txt`, `backend/app/main.py`, `backend/app/routers/auth.py`

---

## 5. PASSWORD RESET / JWT EXPIRY

**Status: PASS (noted)**

- JWT expiry is set to `access_token_expire_minutes = 1440` (24 hours) in `backend/app/config.py`.
- Token expiry is properly checked in `backend/app/middleware/auth.py` via both `jose.jwt.decode()` (which validates `exp` claim) and a manual expiry check.
- No password reset endpoint exists. This is noted as a future enhancement but not a blocker for the current single-broker use case.

---

## 6. FRONTEND ERROR HANDLING

**Status: FIXED**

### Finding:
No `error.tsx` or `not-found.tsx` existed. Unhandled errors would show raw Next.js error screens in production, potentially leaking implementation details.

### Fixes:
- Created `frontend/app/error.tsx` — client-side error boundary with a clean "Something went wrong" UI and a "Try Again" button.
- Created `frontend/app/not-found.tsx` — clean 404 page with a "Back to Dashboard" link.

**Files created:** `frontend/app/error.tsx`, `frontend/app/not-found.tsx`

---

## 7. DATABASE INDEXING

**Status: FIXED**

### Finding:
No index migration existed. Commonly queried foreign key columns had no indexes, which would cause full table scans at scale.

### Fix:
Created `backend/alembic/versions/0013_add_indexes.py` with indexes on:
- `transactions.user_id` — every auth-scoped query filters on this
- `transactions.status` — dashboard stats filter by status
- `portal_tokens.token` (unique) — portal lookups by token string
- `inspection_items.transaction_id` — inspection item listing
- `compliance_items.transaction_id` — compliance item listing
- `tasks.transaction_id` — task listing

**File created:** `backend/alembic/versions/0013_add_indexes.py`

**NOTE:** Run `alembic upgrade head` on Railway after deploy.

---

## 8. LOGGING IN PRODUCTION

**Status: PASS**

Logging is already well-configured:
- `backend/app/logging_config.py` provides structured JSON logging when `LOG_FORMAT=json` env var is set.
- `configure_logging()` is called at startup in `main.py`.
- Request logging middleware logs method, path, status code, and duration for every request.
- SQLAlchemy and database errors are caught and logged via global exception handlers.
- Noisy third-party loggers (uvicorn.access, sqlalchemy.engine, httpx) are suppressed to WARNING level.

### Additional fix:
The generic 500 error handler was leaking `str(exc)` and full Python tracebacks to the client. FIXED: now returns a generic message while still logging the full exception server-side via `logger.exception()`.

**File modified:** `backend/app/main.py`

---

## 9. ALERTS

**Status: PASS (no code changes needed)**

Railway dashboard handles infrastructure-level alerts. Celery deadline alerts (T-3 and T-1 day broker alerts) are already built into the application's background task pipeline.

---

## 10. ROLLBACK

**Status: PASS (no code changes needed)**

Vercel maintains all deployment history with instant rollback capability. Railway keeps deployment history for the backend. No code changes required.

---

## FILES MODIFIED

| File | Change |
|------|--------|
| `backend/app/main.py` | CORS lockdown, rate limiter setup, error handler leak fix |
| `backend/app/routers/auth.py` | Rate limiting on login/register/setup (5/min) |
| `backend/requirements.txt` | Added `slowapi==0.1.9` |
| `backend/app/routers/transactions.py` | `update_party` body typed as `PartyUpdate` instead of `dict` |
| `backend/app/schemas/auth.py` | Max-length validators on all string fields |
| `backend/app/schemas/transaction.py` | Max-length on address, full_name, notes, preferred_language |
| `backend/app/schemas/email_template.py` | Max-length validators on name, subject, body |
| `backend/app/routers/tasks.py` | Max-length on title, assigned_role |
| `backend/app/routers/inspection.py` | Max-length + allowlist validation on severity/status |
| `backend/app/routers/compliance.py` | Max-length on reviewed_by_name |
| `backend/app/routers/portal.py` | Max-length on lender_name, lender_email, doc name |
| `frontend/app/error.tsx` | **NEW** — global error boundary |
| `frontend/app/not-found.tsx` | **NEW** — 404 page |
| `backend/alembic/versions/0013_add_indexes.py` | **NEW** — performance indexes |

## REMAINING CONCERNS

1. **No password reset flow** — acceptable for single-broker but should be added if multi-user.
2. **No CSRF protection** — mitigated by JWT Bearer auth (not cookie-based), but worth noting.
3. **Portal tokens have no revocation endpoint** — tokens can only expire (30 days). Consider adding a revoke endpoint.
4. **`recent_events` `limit` query parameter** has no upper bound — an attacker could request `?limit=999999`. Consider capping at 100.
