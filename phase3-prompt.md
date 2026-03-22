You are building Phase 3 of a Real Estate Transaction Agent. Read PRODUCT-SPEC.md first for full context. Read ALL existing code in backend/app/ before writing anything new.

## Phase 3: Deadline Engine + Alerts

The deadline tracking and alert system. Monitors all deal deadlines and fires broker alerts at T-3, T-1, and T=0.

---

## What to Build

### 1. Deadline Alert Service (`backend/app/services/deadline_alerts.py`)

Function: `async def check_deadlines(db: AsyncSession) -> int`

Returns count of alerts fired.

Logic (per PRODUCT-SPEC.md Section 5B):
- Query all deadlines with status = "upcoming" or "warning" where transaction is active
- For each deadline, calculate days until due:
  - T-3: set status to "warning", create Event(type="deadline_warning_t3", description=f"Deadline '{name}' is in 3 days ({due_date})")
  - T-1: create Event(type="deadline_warning_t1"), send broker alert Event(type="broker_alert")
  - T=0 (today >= due_date, not completed): set status to "missed", create Event(type="deadline_missed"), broker alert
- Use `alert_t3_sent` and `alert_t1_sent` bool fields on Deadline model to prevent duplicate alerts
- Only fire each alert once per deadline

### 2. HOA Rescission Sub-workflow (`backend/app/services/hoa_workflow.py`)

Function: `async def start_hoa_rescission_clock(transaction_id: int, delivery_date: date, db: AsyncSession)`

- Called when HOA docs are marked as delivered to buyer
- Creates a new Deadline: "HOA Rescission Period Ends", due_date = delivery_date + 3 business days
- Creates Event(type="hoa_rescission_started")
- Creates Event(type="broker_alert", description="HOA rescission clock started. Buyer has 3 business days to cancel.")

Function: `async def confirm_hoa_rescission_cleared(transaction_id: int, db: AsyncSession)`

- Called when rescission period passes without cancellation
- Marks the deadline as completed
- Creates Event(type="hoa_rescission_cleared")

### 3. Insurance Gap Alert (`backend/app/services/insurance_alerts.py`)

Function: `async def check_insurance_gaps(db: AsyncSession) -> int`

- Query all active transactions with a closing_date
- If closing_date - today <= 7 and no insurance binder document is collected, fire broker alert
- Event(type="broker_alert", description="Insurance binder not received. Closing in X days.")
- Track with a flag on the transaction to avoid duplicate alerts (add `insurance_alert_sent: bool` column or use Event history check)

### 4. CTC Gap Alert

In the same file or a new `backend/app/services/closing_alerts.py`:

Function: `async def check_ctc_gap(db: AsyncSession) -> int`

- If closing_date - today <= 5 and no "Clear to Close" document is collected, fire broker alert
- Event(type="broker_alert", description="Clear to Close not received. Closing in X days.")

### 5. Milestone Event Triggers (`backend/app/services/milestones.py`)

Function: `async def check_and_fire_milestones(transaction_id: int, db: AsyncSession)`

Called after any document status change. Checks if a milestone has been hit and fires a client update event.

Milestones (per PRODUCT-SPEC.md Section 5C):
- EMD confirmed received -> Event(type="milestone", description="Earnest money deposit confirmed received.")
- Inspection complete -> Event(type="milestone")
- Inspection contingency resolved -> Event(type="milestone")
- Loan commitment received -> Event(type="milestone")
- CTC received -> Event(type="milestone")
- Closing Disclosure issued -> Event(type="milestone")
- Closing complete -> set transaction status to "closed", Event(type="milestone", description="Transaction closed.")

Each milestone maps to a specific document being marked collected. Define the mapping clearly in the code.

### 6. Wire alerts into Celery worker

In `backend/app/worker.py` (already exists from Phase 2), add periodic tasks:
- `run_deadline_check` — runs every hour, calls `check_deadlines()`
- `run_insurance_check` — runs every hour, calls `check_insurance_gaps()`
- `run_ctc_check` — runs every hour, calls `check_ctc_gap()`

### 7. Alert endpoints

Add to `backend/app/routers/transactions.py`:

- `GET /transactions/{id}/alerts` — returns all unresolved broker_alert events for a transaction
- `POST /transactions/{id}/alerts/{event_id}/dismiss` — broker dismisses an alert (add `dismissed: bool` field to Event model or a separate status field)
- `GET /transactions/{id}/deadlines` — returns all deadlines sorted by due_date with status

### 8. HOA workflow endpoint

Add to `backend/app/routers/transactions.py`:
- `POST /transactions/{id}/hoa/docs-delivered` — body: `{ "delivery_date": "YYYY-MM-DD" }` — starts rescission clock
- `POST /transactions/{id}/hoa/rescission-cleared` — confirms rescission passed

### 9. Update alembic migration

If you added any new columns (e.g. `dismissed` on Event, `insurance_alert_sent` on Transaction), create a new alembic migration:
`alembic revision --autogenerate -m "phase3 alert fields"`

---

## Notes

- All alert logic must be idempotent — safe to run multiple times per day
- Use the existing Event model for all alerts and milestones — do not create new tables
- Business days helper already exists in timeline.py — import and reuse it
- Read deadline.py, event.py, document.py models carefully before writing

When completely finished, run:
openclaw system event --text "Phase 3 complete: Deadline engine and alert system built — T-3/T-1/T=0 alerts, HOA rescission workflow, insurance/CTC gap alerts, milestone triggers, Celery periodic tasks." --mode now
