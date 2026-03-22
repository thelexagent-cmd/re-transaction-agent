You are building Phase 2 of a Real Estate Transaction Agent. Read PRODUCT-SPEC.md first for full context. The Phase 0 and Phase 1 code is already built — read the existing files in backend/app/ before writing anything.

## Phase 2: Document Tracking Engine

The goal is to auto-generate a required document checklist from the parsed contract data, track the status of each document, and trigger automated follow-up sequences when documents go overdue.

---

## What to Build

### 1. Document Checklist Generator (`backend/app/services/checklist.py`)

Function: `generate_checklist(transaction_id: int, extracted_data: dict) -> list[dict]`

Takes the output from the Phase 1 parser and generates the full required document list for the deal. Returns a list of document dicts ready to insert into the `documents` table.

Each document dict:
```
{
  "transaction_id": int,
  "phase": int (1-6),
  "name": str,
  "status": "pending",
  "responsible_party_role": str,  # buyer / seller / buyers_agent / listing_agent / lender / title / hoa / broker
  "due_date": date or None
}
```

Use the full document list from PRODUCT-SPEC.md (Section 4A). The checklist is phase-aware and Florida-specific:

- Always include the base documents for each phase
- Conditionally include:
  - Lead-Based Paint Disclosure ONLY if `compliance_flags.lead_paint_required` is true
  - HOA Documents Package ONLY if `compliance_flags.hoa_docs_required` is true
  - HOA Estoppel Certificate ONLY if `compliance_flags.hoa_docs_required` is true
  - HOA Rescission period confirmation ONLY if `compliance_flags.hoa_docs_required` is true
  - Flood Insurance Binder ONLY if `compliance_flags.flood_insurance_required` is true
  - WDO inspection ONLY if financing is conventional/FHA/VA (lenders require it)
- Due dates: calculate from the deadlines already in the transaction where applicable (e.g. inspection-phase docs due by inspection_period_end)

### 2. Follow-up Scheduler (`backend/app/services/followup.py`)

This is the automated follow-up engine. It runs on a schedule and checks for overdue documents.

Function: `async def check_and_send_followups(db: AsyncSession) -> int`

Returns count of follow-ups sent.

Logic:
- Query all documents with status = "pending" or "overdue"
- For each document, check if it has a due_date and how far we are from it
- Apply follow-up logic from PRODUCT-SPEC.md Section 4B:
  - T-5 days: first follow-up (status stays "pending")
  - T-3 days: second follow-up (escalated tone)
  - T-1 day: third follow-up + flag document as "overdue" + create broker alert event
  - T=0 (due date hit, still not collected): mark as "overdue", fire broker alert event
- Track last_followup_at on the document record to avoid duplicate sends within 12 hours
- For now, log the follow-up action as an Event record (don't actually send email yet — that's Phase 4). Event type: "followup_sent", description includes document name, party, and T-minus day.
- If a broker alert fires, create a separate Event with type "broker_alert"

### 3. Celery + Redis Setup (`backend/app/worker.py` and `backend/celery_app.py`)

Set up Celery with Redis as the broker.

`backend/celery_app.py`:
- Create Celery app instance
- Configure Redis broker URL from settings (REDIS_URL env var)
- Set task serializer to json

`backend/app/worker.py`:
- Define a periodic task: `run_followup_check` — runs every hour via Celery Beat
- The task calls `check_and_send_followups()`
- Define a task: `process_contract_async(transaction_id, pdf_path)` — background contract parsing after upload

`backend/app/routers/transactions.py`:
- Update the `parse-contract` endpoint to enqueue `process_contract_async` via Celery instead of running inline
- Return 202 Accepted immediately with a task_id
- Add endpoint: `GET /transactions/{id}/parse-status/{task_id}` — returns task status (pending/processing/complete/failed) and result when done

### 4. Document status endpoints

Add to `backend/app/routers/documents.py`:

- `GET /transactions/{id}/documents` — list all documents for a transaction, grouped by phase, with status
- `GET /transactions/{id}/documents/summary` — returns counts: total, collected, pending, overdue per phase
- `PATCH /transactions/{id}/documents/{doc_id}/snooze` — broker can snooze a follow-up by N days (updates due_date, clears last_followup_at)

### 5. Update intake.py

After contract parsing, call `generate_checklist()` to auto-populate the documents table for the transaction. Wire it into `process_contract()` in intake.py.

### 6. Update requirements.txt

Add:
- `celery[redis]==5.4.0`
- `redis==5.2.0`

### 7. Update .env.example

Add:
- `REDIS_URL=redis://localhost:6379/0`

### 8. Test script (`scripts/test_checklist.py`)

Standalone script that:
1. Creates a mock extracted_data dict (use realistic sample data from a Florida deal)
2. Calls generate_checklist() with it
3. Prints the full checklist grouped by phase

---

## Important Notes

- Read the existing models carefully before writing — Document, Deadline, Event, Party models are already defined
- The `documents` table already has: id, transaction_id, phase, name, status (enum: pending/collected/overdue), responsible_party_role, due_date, collected_at, storage_key, last_followup_at, created_at
- Do not redefine models — import and use what exists
- Celery tasks must handle their own DB sessions (not share the FastAPI session)
- follow-up logic must be idempotent — safe to run multiple times

When completely finished, run:
openclaw system event --text "Phase 2 complete: Document tracking engine built — checklist generator, follow-up scheduler, Celery worker, document status endpoints all done." --mode now
