You are building Phase 5 of a Real Estate Transaction Agent. Read PRODUCT-SPEC.md first for full context. Read ALL existing code in backend/app/ before writing anything new.

## Phase 5: Broker Dashboard (Next.js Frontend)

Build the single-page broker dashboard. No mobile app — web only. This is the interface the broker uses to see all her deals.

---

## What to Build

Create a new directory: `frontend/` at the project root (alongside `backend/`).

### Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui components (use npx shadcn@latest init to set up)
- Clerk for auth (or simple JWT auth with localStorage if Clerk adds complexity)
- SWR for data fetching

Initialize with: `npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir --import-alias "@/*"`

### Pages / Routes

#### 1. `/` — Deal List (main dashboard)

Shows all active transactions for the broker.

Per deal card:
- Property address
- Status badge: "On Track" (green) / "At Risk" (yellow) / "Needs Attention" (red)
  - On Track: no overdue docs, no missed deadlines
  - At Risk: has T-3 warnings or pending follow-ups
  - Needs Attention: has overdue docs, missed deadlines, or unread broker alerts
- Days until closing (large number)
- Quick stats: # docs pending, # deadlines in next 7 days, # unread alerts
- Click to go to deal detail

Also show a summary bar at top: total active deals, total alerts pending, deals closing this week.

#### 2. `/transactions/[id]` — Deal Detail

Full deal view. Tabs:
- **Overview** — property info, parties list, key dates, status
- **Documents** — checklist grouped by phase (Phase 1-6). Each doc shows: name, status (collected/pending/overdue), due date, last follow-up sent, responsible party. Broker can click to mark as collected.
- **Timeline** — visual timeline of all deadlines. Each deadline: name, due date, status (upcoming/warning/missed/completed). Color coded.
- **Activity** — full event log, newest first. Each event: timestamp, type (icon), description.
- **Alerts** — unresolved broker alerts. Each alert has a Dismiss button.

#### 3. `/transactions/new` — Create New Transaction

Simple form to create a transaction manually (before contract upload):
- Property address
- Buyer name + email + phone
- Seller name + email + phone
- Closing date (estimated)
- Submit creates the transaction via POST /transactions

Then show an upload button to upload the contract PDF (calls POST /transactions/{id}/parse-contract).

#### 4. `/login` — Auth page

Simple email/password login form that calls POST /auth/login and stores JWT in localStorage.

---

## API Integration

Create `frontend/lib/api.ts` — typed API client that wraps fetch with auth headers.

Include typed functions for:
- `getTransactions()` — GET /transactions
- `getTransaction(id)` — GET /transactions/{id}
- `createTransaction(data)` — POST /transactions
- `getDocuments(id)` — GET /transactions/{id}/documents
- `markDocumentCollected(txId, docId)` — PATCH /transactions/{id}/documents/{docId}
- `getDeadlines(id)` — GET /transactions/{id}/deadlines
- `getAlerts(id)` — GET /transactions/{id}/alerts
- `dismissAlert(txId, eventId)` — POST /transactions/{id}/alerts/{eventId}/dismiss
- `parseContract(txId, file)` — POST /transactions/{id}/parse-contract (multipart)
- `getParseStatus(txId, taskId)` — GET /transactions/{id}/parse-status/{taskId}

---

## UI Details

- Dark sidebar with deal list on left, main content on right (standard SaaS layout)
- Color scheme: clean, professional — white background, slate-900 sidebar, blue accents
- Status badges use colored dots (green/yellow/red)
- Timeline is a vertical list with colored status indicators — not a complex chart
- Document checklist uses checkboxes — checked = collected, unchecked = pending, red = overdue
- Activity log uses icons per event type (upload icon for documents, bell for alerts, flag for milestones, clock for deadlines)
- Mobile: not required for beta, but don't break it horribly

---

## Notes

- Use the backend API — hardcode `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local.example`
- No real-time updates needed for beta — SWR polling every 30s is fine
- Error states: show a simple error message when API calls fail, don't crash the page
- Loading states: skeleton loaders on the deal list and detail page
- Keep it functional and clean — this is a beta tool for one user, not a polished product

When completely finished, run:
openclaw system event --text "Phase 5 complete: Broker dashboard built — deal list, deal detail with docs/timeline/alerts/activity, create transaction flow, contract upload UI." --mode now
