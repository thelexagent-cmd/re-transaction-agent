# COORDINATION_TEMPLATES.md

Session date: 2026-03-26
Task: Email template library + automation trigger labels + client portal document upload

---

## Part 1 — Backend: Default Template Seeding

**File changed:** `backend/app/routers/auth.py`

- Added `from app.models.email_template import EmailTemplate` import
- Added `_DEFAULT_TEMPLATES` list — 15 complete templates with name/subject/body
- Added `seed_default_templates(user_id, db)` async helper:
  - Checks if the user already has templates (idempotent — skips if count > 0)
  - Creates all 15 EmailTemplate records for the new user
  - Calls `db.flush()` — committed by the surrounding session
- Wired into both `register` and `setup` endpoints — called after user creation

NOTE: The `email_templates` table has no `category` column (see migration 0005).
Category is a frontend-only concept managed in DEFAULT_TEMPLATES. The DB stores
name/subject/body only. The `inferTrigger()` function on the frontend maps
template names to trigger labels.

No new migrations were created.

---

## Part 2 — Frontend: Templates Page

**File changed:** `frontend/app/templates/page.tsx`

- Expanded `DEFAULT_TEMPLATES` from 1 to 15 templates with IDs -1 through -15
- Added `trigger` field to `TemplateView` interface
- Added `inferTrigger(name)` function — maps template name to trigger label:
  - "Under Contract Congratulations" -> "Auto: Under Contract" (blue)
  - "Inspection Results — Repair Request" -> "Auto: Inspection Done" (orange)
  - "Clear to Close" -> "Auto: Clear to Close" (teal)
  - "Closing Date Reminder" -> "Auto: 3 Days to Close" (red)
  - "Post-Closing Thank You" -> "Auto: Closed" (green)
  - All others -> "Manual only" (gray)
- Added `TriggerBadge` component — shows colored pill with Zap icon for auto triggers
- Updated `CATEGORIES` filter: ['All', 'Onboarding', 'Milestones', 'Follow-Up', 'Compliance']
- Added `Compliance` option to category select in edit form
- Added 2 new common variables to the variable picker: `{{inspection_deadline}}`, `{{emd_amount}}`
- Trigger badges appear on both the template list cards and the detail header view
- Triggers are visual-only (not wired to automation yet — future feature)

Template categories:
- Onboarding: Introduction to Buyer, Introduction to Seller, Title Insurance Explanation
- Milestones: Inspection Reminder, Under Contract Congratulations, Closing Date Reminder,
  Document Request (Buyer), Document Request (Lender), EMD Reminder,
  Inspection Results Repair Request, Clear to Close
- Follow-Up: Post-Closing Thank You
- Compliance: FIRPTA Notice, Wire Fraud Warning, Foreign National Welcome

---

## Part 3 — Client Portal: Document Upload

**Backend file changed:** `backend/app/routers/portal.py`

- Added `POST /portal/{token}/upload` endpoint before the lender portal section
- Accepts any valid (non-expired) portal token — no token_type filter,
  so both client and other token types can use it
- Uploads file to R2 via `storage.upload_document()`
- Creates a `Document` record with `responsible_party_role="client"`, `phase=1`
- Returns: `{id, transaction_id, name, status, created_at}`

**Frontend file changed:** `frontend/app/portal/[token]/page.tsx`

- Added `useState` and `useRef` imports
- Added upload state: `uploading`, `uploadMsg`, `uploadedFiles`, `docName`, `fileInputRef`
- Added `handleUpload()` async form handler:
  - Builds FormData with file + optional document_name
  - POSTs to `${API_URL}/portal/${token}/upload`
  - Appends successful upload to `uploadedFiles` list for session display
- Added "Upload Documents" card section between pending documents and key deadlines:
  - Optional document name input
  - File input accepting PDF, Word, Excel, image formats
  - Submit button with loading state
  - Success/error message display
  - Session-uploaded files list with green "Received" badges
