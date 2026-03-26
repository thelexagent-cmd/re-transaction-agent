# Coordination — Real Estate Transaction CRM (Lex Transaction Agent)

## Backend Agent - COMPLETED

### Endpoints Implemented

#### Transaction Notes
- `GET /transactions/{id}/notes` — returns `{"notes": "...text..."}`
- `POST /transactions/{id}/notes` — body `{"content": "..."}`, saves to transaction.notes, returns updated notes

#### Global Contacts
- `GET /transactions/contacts/all` — returns all unique parties across broker's transactions, deduplicated by email or name+role, with transaction_count and transaction_ids

#### Transaction Status Update
- `PATCH /transactions/{id}` — updates status, closing_date, purchase_price, and/or contract_execution_date; returns updated TransactionDetail

#### Dashboard Stats
- `GET /transactions/stats` — returns total_active, closing_this_month, overdue_documents, missed_deadlines

#### Email Templates
- `GET /templates` — list all templates for current user
- `POST /templates` — create template (name, subject, body)
- `PUT /templates/{id}` — update template fields
- `DELETE /templates/{id}` — delete template (204)

#### Deal Health Score
- `GET /transactions/{id}/health-score` — returns score (0–100), level (healthy/warning/critical), and contributing factors

### Migrations Created
- `0004_transaction_notes` — adds `notes` TEXT column to transactions table
- `0005_email_templates` — creates email_templates table (id, user_id FK, name, subject, body, created_at, updated_at)

### Model Changes
- `Transaction` model: added `notes: Mapped[str | None]` (Text, nullable)
- New `EmailTemplate` model at `backend/app/models/email_template.py`
- `User` model: added `email_templates` relationship back-reference
- `models/__init__.py`: exports `EmailTemplate`

### Schema Changes (backend/app/schemas/transaction.py)
- `TransactionListItem` + `TransactionDetail`: now include `notes: str | None`
- New schemas: `NotesResponse`, `NotesUpdate`, `TransactionUpdate`, `DashboardStats`, `ContactItem`, `ContactsResponse`, `HealthFactor`, `HealthScoreResponse`
- New file: `backend/app/schemas/email_template.py` with `EmailTemplateCreate`, `EmailTemplateUpdate`, `EmailTemplateResponse`

### New Router
- `backend/app/routers/templates.py` — registered in `main.py` as `app.include_router(templates.router)`

### Known Issues
- Two `0003` migration files exist (`0003_phase6_no_schema_changes.py` and `0003_multilingual_firpta_portal.py`). Both have `revision = "0003"` and `down_revision = "0002"`. This is a branching conflict in alembic history that was pre-existing before this agent ran. Migration `0004` sets `down_revision = "0003"` which will follow whichever 0003 is the current head on the deployed database. This may require manual resolution if both files are present.
- The `PATCH /transactions/{id}` endpoint does not allow clearing fields back to `None` (e.g., cannot unset closing_date) since `None` values are skipped. This is intentional per spec (only update provided fields).

---

## Frontend Agent - COMPLETED

### Features Implemented

#### High Priority (Competitor Feature Parity)

1. **Transaction Progress Bar** — Visual pipeline stepper (Contract → Inspection → Financing → Title → Pre-Close → Closed) on transaction detail Overview tab; current phase determined by which document phases have collected docs
   - `frontend/app/transactions/[id]/page.tsx` — `TransactionProgressBar` component

2. **Commission Tracker** — "Commission" tab on transaction detail page with live calculation. Also standalone page `/commission` with summary cards and transaction table
   - Transaction tab: `frontend/app/transactions/[id]/page.tsx` — `CommissionTab`
   - Standalone: `frontend/app/commission/page.tsx` + `frontend/app/commission/layout.tsx`
   - Fields: sale price, commission %, co-broke split %, agent split % → gross commission, co-broke $, agent net, effective rate

3. **Quick Notes** — Floating sticky-note widget (bottom-right) on transaction detail; debounced autosave (800ms) to localStorage; shows last saved timestamp
   - `frontend/app/transactions/[id]/page.tsx` — `QuickNotes` component
   - localStorage key: `lex_notes_tx_{id}`
   - API functions `saveNotes` / `getNotes` added to `frontend/lib/api.ts` ready for backend

4. **Search & Filter on Dashboard** — Search bar (address/property type) + status dropdown + property type dropdown; all client-side on existing data
   - `frontend/app/transactions/page.tsx`

5. **Notification Center** — Bell icon in dashboard header + sidebar footer; dropdown with unread count badge, recent events, mark-as-read per item and mark-all-read
   - `frontend/components/notification-center.tsx` — `NotificationCenter` + `NotificationBell`
   - Read IDs stored in localStorage key `lex_read_events`

6. **Email Templates Manager** — Full `/templates` page; left panel list with category filters; right panel with editor/preview toggle
   - `frontend/app/templates/page.tsx` + `frontend/app/templates/layout.tsx`
   - 6 default templates: Intro to Buyer, Inspection Scheduled, Clear to Close, Closing Day, Document Reminder, Contract Executed
   - Variable highlighting `{{variable_name}}`; variable insertion buttons; copy-to-clipboard
   - localStorage key: `lex_email_templates` (backend agent has added `/templates` CRUD endpoints)

7. **Transaction Timeline** — Redesigned Timeline tab: gradient vertical spine, color-coded icons per status, ring halos, days remaining/overdue indicators
   - `frontend/app/transactions/[id]/page.tsx` — `TimelineTab` (fully rewritten)

8. **Export Transaction to PDF** — "Export PDF" button triggers `window.print()`; print CSS hides sidebar, nav, sticky widgets; shows all transaction details cleanly
   - `frontend/app/transactions/[id]/page.tsx` — Export PDF button
   - `frontend/app/globals.css` — `.no-print`, `.print-block` CSS classes

9. **Contacts/Parties Global Page** — `/contacts` page showing parties with roles, transactions, email/WhatsApp actions; deduplication by email
   - `frontend/app/contacts/page.tsx` + `frontend/app/contacts/layout.tsx`
   - Currently shows sample mock data; will switch to real data from `GET /transactions/contacts/all` (backend has added this endpoint)
   - `getAllContacts()` function added to `frontend/lib/api.ts`

10. **Dashboard Stats Bar** — 4-card stats row: Active Deals, Total Transactions, Closing This Month, Overdue Items (missed deadlines + overdue docs)
    - `frontend/app/transactions/page.tsx`

#### Innovative Features (Not on Market)

11. **AI Deal Health Score** — Score 0-100 per transaction; computed from days-to-close, doc collection %, missed deadlines, overdue items
    - `frontend/components/deal-health-score.tsx` — `computeHealthScore`, `HealthBadge`, `HealthGauge`, `DealHealthScore`
    - Circular SVG gauge on transaction detail header (green/yellow/red)
    - Small colored badge on dashboard deal cards

12. **WhatsApp Quick-Send** — WhatsApp button on every party card; opens `https://wa.me/{phone}?text=...` with pre-filled message
    - Transaction detail: `frontend/app/transactions/[id]/page.tsx` — `WhatsAppBtn`
    - Contacts page: `frontend/app/contacts/page.tsx` — `WhatsAppButton`

13. **Closing Countdown Widget** — Dashboard widget showing next 3 closings as countdown timers, color-coded (red=today, orange=≤7 days, blue=future)
    - `frontend/app/transactions/page.tsx` — `ClosingCountdown`

#### Also Implemented

14. **Mobile hamburger menu** — Already existed; preserved and working in updated sidebar

15. **Dark/light mode toggle** — Sun/Moon toggle in sidebar footer, persists to `lex_dark_mode` localStorage, toggles `.dark` class on `<html>`
    - `frontend/components/layout/sidebar.tsx`
    - `frontend/app/globals.css` — `html.dark` CSS variables

16. **Breadcrumb navigation** — "Dashboard > {address}" breadcrumbs on transaction detail
    - `frontend/app/transactions/[id]/page.tsx`

### New Files Created

| File | Purpose |
|------|---------|
| `frontend/components/notification-center.tsx` | NotificationCenter + NotificationBell components |
| `frontend/components/deal-health-score.tsx` | Health score calculation + UI components |
| `frontend/app/contacts/page.tsx` | Global contacts page |
| `frontend/app/contacts/layout.tsx` | Contacts layout with Sidebar + AuthGuard |
| `frontend/app/commission/page.tsx` | Commission calculator + tracker page |
| `frontend/app/commission/layout.tsx` | Commission layout with Sidebar + AuthGuard |
| `frontend/app/templates/page.tsx` | Email templates manager page |
| `frontend/app/templates/layout.tsx` | Templates layout with Sidebar + AuthGuard |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/components/layout/sidebar.tsx` | New nav items (Contacts, Commission, Templates), dark mode toggle, notification bell |
| `frontend/app/transactions/page.tsx` | Expanded stats bar, search/filter, closing countdown, health score badges |
| `frontend/app/transactions/[id]/page.tsx` | Progress bar, Commission tab, Quick Notes, health gauge, WhatsApp buttons, breadcrumbs, export PDF, enhanced timeline |
| `frontend/lib/api.ts` | Added `TransactionNote` type + `getNotes`/`saveNotes`/`getAllContacts`/`ContactEntry` |
| `frontend/app/globals.css` | Dark mode CSS variables, print/PDF CSS |

### API Endpoints Needed from Backend Agent

All needed endpoints have already been implemented by the Backend Agent above. Summary:

- `POST /transactions/{id}/notes` — save quick notes ✅ (backend done)
- `GET /transactions/{id}/notes` — get notes ✅ (backend done)
- `GET /transactions/contacts/all` — all unique parties ✅ (backend done)
- `GET /templates`, `POST /templates`, `PUT /templates/{id}`, `DELETE /templates/{id}` ✅ (backend done)

### Known Issues / TODOs

- **Contacts page**: Still shows mock data. To wire up real data, replace `mockContacts` in `frontend/app/contacts/page.tsx` with a `useSWR('/contacts/all', getAllContacts)` call and group by email for deduplication. The `getAllContacts()` function is already in `lib/api.ts`.
- **Quick Notes**: localStorage-only for now. To sync with backend, update the `saveNotes` call in the `QuickNotes` component to also call `saveNotes(txId, content)` from `lib/api.ts`.
- **Email Templates**: localStorage-only. To sync with backend, swap `loadTemplates`/`saveTemplates` in `frontend/app/templates/page.tsx` to use SWR + the `/templates` CRUD endpoints.
- **Deal Health Score on dashboard**: Makes N×2 SWR requests (doc summary + deadlines per transaction). Backend's `GET /transactions/{id}/health-score` endpoint can be used instead for a single call per card.
- **Dark mode**: Uses CSS variable approach. Tailwind `dark:` variants won't work without `darkMode: 'class'` in tailwind config if those are needed in future.

---

## Doctor Agent - PENDING
