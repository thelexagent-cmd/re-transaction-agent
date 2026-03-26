# COORDINATION_DOCTOR.md -- Expanded Audit Report

**Audit Date:** 2026-03-26
**Auditor:** DOCTOR Agent (Claude Opus 4.6)

---

## PART A: 10-POINT SECURITY CHECKLIST

### 1. AUTHORIZATION -- PASS

Every router filters by `user_id` via `_require_transaction_ownership()` or equivalent:

- `transactions.py`: All endpoints use `_require_transaction_ownership(transaction_id, current_user.id, db)` or filter by `Transaction.user_id == current_user.id`.
- `documents.py`: Uses `_get_transaction_or_404(transaction_id, current_user.id, db)`.
- `tasks.py`: Uses `_require_transaction_ownership(transaction_id, current_user.id, db)`.
- `compliance.py`: Uses `_require_transaction_ownership(transaction_id, current_user.id, db)`.
- `inspection.py`: Uses `_require_transaction_ownership(transaction_id, current_user.id, db)`.
- `portal.py`: Authenticated endpoints (token creation) filter by `Transaction.user_id == current_user.id`. Public endpoints use token-based auth (the token IS the credential).
- `templates.py`: Filters by `EmailTemplate.user_id == current_user.id`.
- `reports.py`: Filters by `Transaction.user_id == current_user.id`.

No fixes needed.

### 2. INPUT VALIDATION -- PASS

All Pydantic schemas have typed fields with validators and max_length constraints:

- `auth.py`: `EmailStr` for email, password 8-128 chars, full_name max 200, brokerage_name max 200.
- `transaction.py`: address max 500, purchase_price positive, closing_date future check, phone 10-digit US validation, notes max 50000.
- `document.py`: Properly typed with enums.
- `email_template.py`: name max 200, subject max 500, body max 50000.
- Inline schemas in routers (tasks, compliance, inspection, portal) all have field validators with max_length.

No fixes needed.

### 3. CORS POLICY -- PASS

`backend/app/main.py` lines 37-46:
```python
allow_origins=[
    "http://localhost:3000",
    "https://frontend-rose-ten-64.vercel.app",
]
```

Correctly restricted. Not using `["*"]`.

No fixes needed.

### 4. RATE LIMITING -- PASS

- `slowapi==0.1.9` is in `backend/requirements.txt`.
- `backend/app/main.py` sets up `Limiter(key_func=get_remote_address, default_limits=["60/minute"])`.
- Auth endpoints (`/auth/register`, `/auth/login`, `/auth/setup`) have `@limiter.limit("5/minute")`.

No fixes needed.

### 5. JWT EXPIRY -- PASS

`backend/app/config.py`: `access_token_expire_minutes: int = 1440` (24 hours).
Token created with `timedelta(minutes=settings.access_token_expire_minutes)` in `auth.py`.

Expiry: 24 hours. Reasonable for a broker-facing SaaS app.

### 6. FRONTEND ERROR HANDLING -- PASS

- `frontend/app/error.tsx` exists: Shows "Something went wrong" with a "Try Again" button. No stack traces exposed.
- `frontend/app/not-found.tsx` exists: Shows "Page Not Found" with a "Back to Dashboard" link.

No fixes needed.

### 7. DATABASE INDEXING -- PASS

`backend/alembic/versions/0013_add_indexes.py` exists with:
- `ix_transactions_user_id` on `transactions.user_id`
- `ix_transactions_status` on `transactions.status`
- `ix_portal_tokens_token` on `portal_tokens.token` (unique)
- `ix_inspection_items_transaction_id` on `inspection_items.transaction_id`
- `ix_compliance_items_transaction_id` on `compliance_items.transaction_id`
- `ix_tasks_transaction_id` on `tasks.transaction_id`

Revision chain: 0012 -> 0013. Correct.

No fixes needed.

### 8. LOGGING -- PASS

- `backend/app/logging_config.py` exists with structured JSON logging support.
- Configurable via `LOG_LEVEL` and `LOG_FORMAT` env vars.
- Request logging middleware logs method, path, status code, and duration.
- `main.py` imports and calls `configure_logging()` at startup.
- Global error handlers log exceptions via `logger.error()` / `logger.exception()`.

No fixes needed.

### 9. ALERTS -- PASS

Railway handles infrastructure alerts.

### 10. ROLLBACK -- PASS

Vercel handles rollback via deployment history.

---

## PART B: FEATURE COMPLETENESS AUDIT

### B1. Tab Rendering -- FIXED

All 4 new tabs are defined and wired in `frontend/app/transactions/[id]/page.tsx`:

| Tab | Component | Wired At | Verdict |
|---|---|---|---|
| Commission | `CommissionTab` (line 574) | `activeTab === 'Commission'` (line 1914) | PASS |
| Compliance | `ComplianceTab` (line 1181) | `activeTab === 'Compliance'` (line 1915) | FIXED |
| EMD | `EmdTab` (line 1310) | `activeTab === 'EMD'` (line 1917) | PASS |
| Inspection | `InspectionTab` (line 1478) | `activeTab === 'Inspection'` (line 1918) | PASS |

**Issue found and fixed in ComplianceTab:**

The frontend `ComplianceItem` type had field name mismatches with the backend API response:
- Frontend used `item_text` but backend returns `label`
- Frontend used `checked` but backend returns `is_checked`
- Frontend `getCompliance()` returned the raw response, but backend wraps items in `{ items: [...], review: ..., total: ... }`

**Files modified:**
- `frontend/lib/api.ts`: Updated `ComplianceItem` type fields (`item_text` -> `label`, `checked` -> `is_checked`, added `sort_order`, `checked_at`). Updated `getCompliance()` and `initializeCompliance()` to extract `.items` from the wrapper response.
- `frontend/app/transactions/[id]/page.tsx`: Updated all references from `item.checked` to `item.is_checked` and `item.item_text` to `item.label` (5 occurrences fixed).

### B2. Lender Portal Backend -- PASS

All 3 endpoints exist in `backend/app/routers/portal.py`:

| Endpoint | Line | Status |
|---|---|---|
| `POST /portal/lender-token/{transaction_id}` | 178 | PASS |
| `GET /portal/lender/{token}` | 222 | PASS |
| `POST /portal/lender/{token}/upload` | 283 | PASS |

Portal router is registered in `main.py` line 98: `app.include_router(portal.router)`.

### B3. Frontend Lender Portal Page -- PASS

`frontend/app/portal/lender/[token]/page.tsx` exists (185 lines):
- Fetches from `${API_URL}/portal/lender/${token}` -- correct endpoint.
- Handles loading state (lines 22-27).
- Handles error state with "Link Expired" message (lines 30-38).
- Renders transaction details, required docs checklist, uploaded docs, deadlines, and parties.

### B4. SWR Keys Match API Routes -- PASS

Verified all `authFetch()` paths in `frontend/lib/api.ts`:

| Frontend Path | Backend Route | Match |
|---|---|---|
| `/auth/login` | `POST /auth/login` | Yes |
| `/auth/me` | `GET /auth/me` | Yes |
| `/transactions` | `GET /transactions` | Yes |
| `/transactions/${id}` | `GET /transactions/{id}` | Yes |
| `/transactions/${id}/documents` | `GET /{tid}/documents` | Yes |
| `/transactions/${id}/documents/summary` | `GET /{tid}/documents/summary` | Yes |
| `/transactions/${id}/deadlines` | `GET /{tid}/deadlines` | Yes |
| `/transactions/${id}/alerts` | `GET /{tid}/alerts` | Yes |
| `/transactions/${id}/firpta` | `GET /{tid}/firpta` | Yes |
| `/transactions/${txId}/portal-token` | `POST /transactions/{tid}/portal-token` | Yes |
| `/transactions/${txId}/compliance` | `GET /transactions/{tid}/compliance` | Yes |
| `/transactions/${txId}/inspection` | `GET /transactions/{tid}/inspection` | Yes |
| `/transactions/${txId}/tasks` | `GET /transactions/{tid}/tasks` | Yes |
| `/transactions/${txId}/emd` | `PATCH /transactions/{tid}/emd` | Yes |
| `/templates` | `GET /templates` | Yes |
| `/reports/summary` | `GET /reports/summary` | Yes |
| `/portal/lender-token/${txId}` | `POST /portal/lender-token/{tid}` | Yes |

`API_URL` uses `process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'` -- env var with localhost fallback is correct pattern.

### B5. Inspection Router Registered -- PASS

`backend/app/main.py` line 16: `from app.routers import auth, compliance, documents, inspection, tasks, transactions`
Line 97: `app.include_router(inspection.router)`

### B6. Production Launch Readiness -- PASS

| Check | Status | Detail |
|---|---|---|
| Hardcoded localhost in api.ts | PASS | Behind `NEXT_PUBLIC_API_URL` env var (line 3) |
| Leftover `print()` statements | PASS | Zero found in `backend/app/` |
| Alembic migration chain | PASS | Linear: 0001 -> 0002 -> 0003 -> 0003b -> 0004 -> 0005 -> 0006 -> 0007 -> 0008 -> 0009 -> 0010 -> 0011 -> 0012 -> 0013 |
| Models __init__.py imports | PASS | All 12 models imported: User, Transaction, Party, Document, Deadline, Event, PortalToken, EmailTemplate, Task, ComplianceItem, ComplianceReview, InspectionItem |

---

## SUMMARY TABLE

| # | Check | Verdict |
|---|---|---|
| A1 | Authorization | PASS |
| A2 | Input Validation | PASS |
| A3 | CORS Policy | PASS |
| A4 | Rate Limiting | PASS |
| A5 | JWT Expiry (24h) | PASS |
| A6 | Frontend Error Handling | PASS |
| A7 | Database Indexing | PASS |
| A8 | Logging | PASS |
| A9 | Alerts (Railway) | PASS |
| A10 | Rollback (Vercel) | PASS |
| B1 | Tab Rendering | **FIXED** |
| B2 | Lender Portal Backend | PASS |
| B3 | Lender Portal Frontend | PASS |
| B4 | SWR Keys Match Routes | PASS |
| B5 | Inspection Router | PASS |
| B6 | Production Readiness | PASS |

**15/16 PASS, 1/16 FIXED**

## FILES MODIFIED IN THIS AUDIT

1. `frontend/lib/api.ts` -- Fixed `ComplianceItem` type to match backend response fields; fixed `getCompliance()` and `initializeCompliance()` to extract `.items` from wrapper object.
2. `frontend/app/transactions/[id]/page.tsx` -- Fixed ComplianceTab to use `is_checked` instead of `checked` and `label` instead of `item_text` (5 occurrences).

## ITEMS REQUIRING NICO'S ATTENTION

1. **Vercel env var `NEXT_PUBLIC_API_URL`**: Must be set to `https://backend-production-bb87.up.railway.app` in the Vercel project settings. Without it, the frontend falls back to `http://localhost:8000` which will fail in production. (If already set, no action needed.)

2. **Railway env var `LOG_FORMAT=json`**: Recommended for structured logging in production (enables JSON log output for easier aggregation). Optional.

3. **Migration 0013 (indexes)**: Run `alembic upgrade head` on the Railway database if not already applied. This adds performance indexes on frequently-queried columns.
