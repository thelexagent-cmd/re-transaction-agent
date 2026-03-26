# COORDINATION_V3 — Backend Agent Report

**Date:** 2026-03-26

---

## TASK 1: Quick Notes — CONFIRMED + ENHANCED

**Already working:**
- `notes` column exists on `transactions` table (migration 0004)
- `GET /transactions/{id}` returns `notes` via `TransactionDetail` schema
- Dedicated `GET /transactions/{id}/notes` and `POST /transactions/{id}/notes` endpoints exist

**Added:**
- `notes` field to `TransactionUpdate` schema so `PATCH /transactions/{id}` now accepts `notes` in the request body

---

## TASK 2: Email Templates — CONFIRMED (no changes needed)

All 4 CRUD endpoints exist and are registered in `main.py`:
- `GET /templates` — list all templates
- `POST /templates` — create template
- `PUT /templates/{id}` — update template
- `DELETE /templates/{id}` — delete template

---

## TASK 3: Contacts Endpoint — CONFIRMED (no changes needed)

`GET /transactions/contacts/all` exists as a static route before `/{transaction_id}`.

**Response shape:**
```json
{
  "contacts": [
    {
      "id": int,
      "full_name": str,
      "email": str | null,
      "phone": str | null,
      "role": str,
      "transaction_count": int,
      "transaction_ids": [int]
    }
  ],
  "total": int
}
```

**Note for frontend agent:** The response uses `full_name` (not `name`), includes `transaction_count` and `transaction_ids` (not `transaction_id` / `transaction_address`). The contacts are deduplicated by email or name+role. There are no `preferred_language` or `is_foreign_national` fields in the contacts response.

---

## TASK 4: Compliance and Tasks — CONFIRMED (no changes needed)

**Compliance endpoints (prefix: `/transactions/{id}/compliance`):**
- `GET /transactions/{id}/compliance` — get compliance items + review status
- `POST /transactions/{id}/compliance/initialize` — create default 20-item checklist
- `PATCH /transactions/{id}/compliance/items/{item_id}` — toggle checked status
- `POST /transactions/{id}/compliance/review` — submit broker review

**Tasks endpoints (prefix: `/transactions/{id}/tasks`):**
- `GET /transactions/{id}/tasks` — list tasks
- `POST /transactions/{id}/tasks` — create task
- `PATCH /transactions/{id}/tasks/{task_id}` — update task (note: uses PATCH, not PUT)
- `DELETE /transactions/{id}/tasks/{task_id}` — delete task
- `POST /transactions/{id}/tasks/bulk` — bulk create tasks

---

## TASK 5: Earnest Money Deposit (EMD) Tracker — ADDED

**Migration:** `0010_emd_fields.py` — adds 5 columns to `transactions` table

**New columns on `transactions`:**
- `emd_amount` — Numeric(12,2), nullable
- `emd_holder` — String(200), nullable
- `emd_due_date` — Date, nullable
- `emd_received` — Boolean, default false
- `emd_notes` — Text, nullable

**Schema updates:**
- `TransactionListItem` and `TransactionDetail` now include all EMD fields
- `TransactionUpdate` now includes all EMD fields (for PATCH /transactions/{id})

**New endpoint:**
- `PATCH /transactions/{id}/emd` — update only EMD fields

**EMD endpoint response shape:**
```json
{
  "id": int,
  "emd_amount": float | null,
  "emd_holder": str | null,
  "emd_due_date": "YYYY-MM-DD" | null,
  "emd_received": bool,
  "emd_notes": str | null
}
```

---

## TASK 6: Inspection Findings Tracker — ADDED

**New model:** `backend/app/models/inspection.py` — `InspectionItem`
**Migration:** `0011_inspection_items.py` — creates `inspection_items` table
**New router:** `backend/app/routers/inspection.py` — registered in `main.py`

**Endpoints (prefix: `/transactions/{transaction_id}/inspection`):**
- `GET /transactions/{id}/inspection` — list items
- `POST /transactions/{id}/inspection` — create item
- `PUT /transactions/{id}/inspection/{item_id}` — update item
- `DELETE /transactions/{id}/inspection/{item_id}` — delete item

**InspectionItem fields:**
- `id`, `transaction_id`, `description`, `severity` (minor/major/safety), `status` (open/negotiating/repaired/waived/credited), `repair_cost`, `notes`, `created_at`, `updated_at`

**Response shape (single item):**
```json
{
  "id": int,
  "transaction_id": int,
  "description": str,
  "severity": "minor" | "major" | "safety",
  "status": "open" | "negotiating" | "repaired" | "waived" | "credited",
  "repair_cost": float | null,
  "notes": str | null,
  "created_at": "ISO8601",
  "updated_at": "ISO8601"
}
```

**Create request body:**
```json
{
  "description": str,        // required
  "severity": str,           // optional, default "minor"
  "status": str,             // optional, default "open"
  "repair_cost": float,      // optional
  "notes": str               // optional
}
```

---

## TASK 7: Lender Portal — ADDED

**Migration:** `0012_lender_portal.py` — adds 3 columns to `portal_tokens` table
**Model update:** `backend/app/models/portal_token.py`

**New columns on `portal_tokens`:**
- `token_type` — String(20), default "client" (values: "client" or "lender")
- `lender_name` — String(200), nullable
- `lender_email` — String(300), nullable

**New endpoints in `backend/app/routers/portal.py`:**

### `POST /portal/lender-token/{transaction_id}` (authenticated)
Creates a lender magic link token.
**Request body:**
```json
{
  "lender_name": str,         // required
  "lender_email": str | null  // optional
}
```
**Response:**
```json
{
  "token": str,
  "expires_at": "ISO8601",
  "transaction_id": int,
  "lender_name": str,
  "lender_email": str | null
}
```

### `GET /portal/lender/{token}` (public)
Returns lender portal data.
**Response:**
```json
{
  "transaction": {
    "id": int,
    "address": str,
    "status": str,
    "closing_date": "YYYY-MM-DD" | null
  },
  "lender_name": str,
  "required_docs": ["Commitment Letter", "Clear to Close", "Final Loan Approval", "Closing Disclosure"],
  "uploaded_docs": [
    {
      "id": int,
      "name": str,
      "status": str,
      "uploaded_at": "ISO8601"
    }
  ]
}
```

### `POST /portal/lender/{token}/upload` (public)
Lender submits a document record.
**Request body:**
```json
{
  "name": str,
  "status": str  // optional, default "pending"
}
```
**Response:**
```json
{
  "id": int,
  "transaction_id": int,
  "name": str,
  "status": str,
  "created_at": "ISO8601"
}
```

---

## Migration Chain (verified)

```
0001 -> 0002 -> 0003 -> 0003b -> 0004 -> 0005 -> 0006 -> 0007 -> 0008 -> 0009 -> 0010 -> 0011 -> 0012
```

---

## Files Modified
- `backend/app/schemas/transaction.py` — added `notes` and EMD fields to `TransactionUpdate` and `TransactionListItem`
- `backend/app/routers/transactions.py` — added notes/EMD handling in PATCH endpoint + dedicated EMD endpoint
- `backend/app/models/transaction.py` — added EMD columns + `inspection_items` relationship
- `backend/app/models/portal_token.py` — added `token_type`, `lender_name`, `lender_email`
- `backend/app/models/__init__.py` — registered `InspectionItem`
- `backend/app/routers/portal.py` — added lender portal endpoints
- `backend/app/main.py` — registered inspection router

## Files Created
- `backend/app/models/inspection.py` — InspectionItem model
- `backend/app/routers/inspection.py` — inspection CRUD router
- `backend/alembic/versions/0010_emd_fields.py`
- `backend/alembic/versions/0011_inspection_items.py`
- `backend/alembic/versions/0012_lender_portal.py`

## Issues / Notes
- Tasks router uses `PATCH` for updates (not `PUT`). Frontend should use PATCH for `/transactions/{id}/tasks/{task_id}`.
- Contacts endpoint returns `full_name` not `name`, and includes `transaction_count` + `transaction_ids` (not `transaction_address`). Frontend may need to adapt.
- The existing client portal token creation now explicitly sets `token_type="client"` for forward compatibility.

---
---

# COORDINATION_V3 — Frontend Agent Report

**Date:** 2026-03-26

---

## What Was Already Working
- Transaction list, detail page with Overview/Documents/Timeline/Activity/Alerts/Commission/Compliance/FIRPTA tabs
- Client portal link generation and public portal page (`/portal/[token]`)
- SWR data fetching for transactions, documents, deadlines, alerts, FIRPTA
- Commission calculator (client-side only, no backend needed)
- Quick Notes widget (localStorage only)
- Compliance checklist (localStorage only)
- Tasks page (localStorage only)
- Email Templates page (localStorage only)
- Contacts page (mock data only)

## What Was Wired Up / Changed

### TASK 1: Quick Notes -- Wired to Backend
- **File:** `frontend/app/transactions/[id]/page.tsx` (QuickNotes component)
- Now initializes from `txData?.notes` (from the transaction detail SWR response)
- Auto-saves to backend via `POST /transactions/{txId}/notes` with 1-second debounce
- Keeps localStorage as offline cache fallback
- Shows "Saving...", "Saved", or "Save failed" status indicators

### TASK 2: Email Templates -- Wired to Backend
- **File:** `frontend/app/templates/page.tsx` (full rewrite)
- Replaced all localStorage reads/writes with SWR + `authFetch` mutations
- Uses `GET /templates`, `POST /templates`, `PUT /templates/{id}`, `DELETE /templates/{id}`
- Falls back to a single default template if API returns empty or fails

### TASK 3: Contacts -- Wired to Backend
- **File:** `frontend/app/contacts/page.tsx` (full rewrite)
- Replaced mock data with `GET /transactions/contacts/all` via `getAllContacts()`
- Removed the "Backend Integration Pending" banner
- Matches backend response shape: `full_name`, `role`, `transaction_count`, `transaction_ids`

### TASK 4: Compliance Checklist -- Wired to Backend
- **File:** `frontend/app/transactions/[id]/page.tsx` (ComplianceTab component, full rewrite)
- Replaced localStorage with SWR fetching from `GET /transactions/{id}/compliance`
- Added "Initialize" button that calls `POST /transactions/{id}/compliance/initialize`
- Toggle calls `PATCH /transactions/{id}/compliance/items/{item_id}` with `{ checked: boolean }`
- Groups items by `section` field from the backend

### TASK 5: Tasks -- Wired to Backend
- **File:** `frontend/app/tasks/page.tsx` (full rewrite)
- Replaced localStorage with SWR + `authFetch` for all CRUD operations
- Uses `PATCH` (not PUT) for task updates, matching backend
- `GET /transactions/{id}/tasks`, `POST /transactions/{id}/tasks`, `PATCH /transactions/{id}/tasks/{task_id}`, `DELETE /transactions/{id}/tasks/{task_id}`

## New UI Added

### TASK 6: EMD Tab
- **File:** `frontend/app/transactions/[id]/page.tsx` (EmdTab component)
- Added "EMD" to TABS array
- Form with: EMD Amount ($), Who Holds It, Due Date, Received (checkbox), Notes
- Save button calls `PATCH /transactions/{id}/emd`
- Shows summary card when amount is set

### TASK 7: Inspection Findings Tab
- **File:** `frontend/app/transactions/[id]/page.tsx` (InspectionTab component)
- Added "Inspection" to TABS array
- Table with: Description, Severity badge (minor/major/safety), Status badge (open/negotiating/repaired/waived/credited), Repair Cost, Notes
- Inline "Add Item" form (no modal)
- Edit and Delete actions per item
- Shows total estimated repair cost

### TASK 8: Lender Portal
- Added "Generate Lender Portal Link" button to OverviewTab with lender name/email inputs
- Calls `POST /portal/lender-token/{transaction_id}` with `{ lender_name, lender_email }`
- Created public lender portal page at `frontend/app/portal/lender/[token]/page.tsx`
- Layout at `frontend/app/portal/lender/[token]/layout.tsx` (no sidebar)
- Fetches from `GET /portal/lender/{token}`
- Shows: transaction address, required docs checklist, uploaded docs, parties, deadlines
- Green-themed header to distinguish from client portal
- Handles both nested (`data.transaction`) and flat response shapes

## API Functions Added to `frontend/lib/api.ts`
- Exported `authFetch` for direct use
- `getTemplates`, `createTemplate`, `updateTemplate`, `deleteTemplate`
- `getCompliance`, `initializeCompliance`, `toggleComplianceItem`
- `getTasks`, `createTask`, `updateTask` (PATCH), `deleteTask`
- `updateEmd`
- `getInspectionItems`, `createInspectionItem`, `updateInspectionItem`, `deleteInspectionItem`
- `createLenderPortalToken` (with lender_name, lender_email params)

## Files Modified
- `frontend/lib/api.ts` -- Added all new API types and helper functions, exported authFetch
- `frontend/app/transactions/[id]/page.tsx` -- Tasks 1, 4, 6, 7, 8
- `frontend/app/templates/page.tsx` -- Task 2 (full rewrite)
- `frontend/app/contacts/page.tsx` -- Task 3 (full rewrite)
- `frontend/app/tasks/page.tsx` -- Task 5 (full rewrite)

## Files Created
- `frontend/app/portal/lender/[token]/page.tsx` -- Task 8
- `frontend/app/portal/lender/[token]/layout.tsx` -- Task 8

## TypeScript Notes
- Used `Record<string, unknown>` casts for accessing fields not yet on `TransactionDetail` type (e.g., `txData.notes`, `txData.emd_amount`) since these fields come from the backend but aren't in the frontend TS type yet
- All new API types are defined in `frontend/lib/api.ts`
- TABS array is `as const` with EMD and Inspection added
