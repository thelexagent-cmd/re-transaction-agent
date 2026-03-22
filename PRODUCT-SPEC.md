# Product Spec — Real Estate Transaction Agent (Beta v1)
*Author: Lex — 2026-03-21*
*Status: Draft v1 — Pending Nico Review*

---

## 1. What We're Building

A transaction management agent that ingests a signed purchase agreement and then runs the administrative layer of the deal autonomously — extracting all critical data, generating the full workflow, chasing missing documents, tracking deadlines, and communicating proactively with all parties.

The broker sees one dashboard. The agent does the work between conversations.

**Target user (beta):** Active Miami broker, 10–20 transactions/month. Currently handles TC work herself on complex deals. Pain is document chasing and deadline tracking — estimated 30–80 hours/month wasted.

**Beta success criterion:** She runs 3 live transactions through the system and says it saved her meaningful time without creating new problems.

---

## 2. The Core Loop

```
1. Contract uploaded (PDF)
       ↓
2. Parser extracts all data (parties, dates, amounts, flags)
       ↓
3. System generates deal file: timeline + task checklist + document list
       ↓
4. Intro emails sent automatically to all parties
       ↓
5. System monitors:
   - Deadlines (T-3 warning, T-1 escalation)
   - Missing documents (auto-follow-up every X hours)
   - Milestone completions (triggers client update)
       ↓
6. Broker sees dashboard: what's done, what's pending, what needs her
       ↓
7. Pre-closing checklist confirms file is complete before close
       ↓
8. Closing confirmed → file archived
```

The broker only gets pulled in when judgment is required or escalation fires. Everything else runs automatically.

---

## 3. Contract Parser — What It Must Extract

This is the foundation. If the parser fails, everything downstream fails.

### 3A. Party Information
| Field | Notes |
|-------|-------|
| Buyer name(s) | Full legal names |
| Buyer email + phone | For automated follow-up |
| Seller name(s) | Full legal names |
| Seller email + phone | For automated follow-up |
| Buyer's agent name + contact | For coordination |
| Listing agent name + contact | For coordination |
| Buyer's lender name + contact | If listed |
| Title company name + contact | If listed |
| Escrow company | If different from title |

### 3B. Property Information
| Field | Notes |
|-------|-------|
| Property address | Full address |
| Legal description | For title work |
| Property type | SFH / Condo / Townhouse / Multi-family |
| Year built | **Triggers lead paint flag if pre-1978** |
| HOA/condo indicator | **Triggers HOA doc tracking + rescission clock** |
| Flood zone | If noted; flags insurance requirement |

### 3C. Financial Terms
| Field | Notes |
|-------|-------|
| Purchase price | |
| Earnest money deposit amount | |
| EMD escrow agent | |
| Financing amount | If applicable |
| Seller concessions/credits | If applicable |
| Down payment amount | |

### 3D. Critical Dates (Florida-Specific)
| Date | Source | Notes |
|------|--------|-------|
| Contract execution date | Contract | Day 0 — all relative deadlines calculate from here |
| EMD deadline | Calculated | 3 business days from execution (FL standard) |
| Inspection period end | Contract | Hard deadline — buyer loses walk right if missed |
| HOA doc delivery deadline | Calculated | Tracked separately; buyer has 3 days to rescind after receipt |
| Financing contingency deadline | Contract | |
| Appraisal deadline | Contract or estimated | |
| Closing date | Contract | |

### 3E. Florida Compliance Flags (Auto-Detected at Intake)
| Flag | Trigger | Action |
|------|---------|--------|
| Lead paint disclosure required | Year built < 1978 | Add to required doc list; alert broker |
| HOA/condo doc package required | Property type = condo or HOA indicator present | Open HOA tracking sub-workflow |
| Flood zone insurance required | Flood zone designation present | Add insurance flag to checklist |
| Septic/well inspection | Noted in contract or address indicates rural | Add to required inspection list |

---

## 4. Document Tracking Engine

### 4A. Required Documents by Phase

The system maintains a master checklist, auto-generated from the contract intake. Documents are flagged as: **Collected ✅ / Pending ⏳ / Missing + Following Up 🔄 / Overdue ⚠️**

#### Phase 1 — Contract Execution (Day 0–3)
- [ ] Fully executed Purchase and Sale Agreement (all signatures)
- [ ] Property Tax Disclosure (F.S. 689.261) — Day 0 statutory requirement
- [ ] Radon Gas Disclosure — must be in contract
- [ ] Seller's Property Disclosure form
- [ ] Lead-Based Paint Disclosure *(if pre-1978)*
- [ ] Energy Efficiency Brochure receipt
- [ ] Brokerage Relationship Disclosure (single agent or transaction broker notice)
- [ ] Agency Agreements (both sides)
- [ ] EMD receipt confirmation

#### Phase 2 — Inspection Period (Days 1–15)
- [ ] Inspection scheduled confirmation
- [ ] Home Inspection Report
- [ ] Inspection contingency resolution (waiver OR walk notice — one must be received before deadline)
- [ ] Repair addendum *(if applicable)*
- [ ] WDO (wood-destroying organism / termite) inspection *(if required by lender)*

#### Phase 3 — Financing (Days 5–30)
- [ ] Lender confirmation: contract and docs received
- [ ] Appraisal ordered confirmation
- [ ] Appraisal Report
- [ ] Loan Commitment Letter / Clear to Close
- [ ] Homeowner's Insurance Binder *(flag if not received by T-7 from closing — critical in Florida)*
- [ ] Flood Insurance Binder *(if flood zone)*

#### Phase 4 — Title and HOA (Days 1–35, ongoing)
- [ ] Title Search ordered confirmation
- [ ] Preliminary Title Report / Title Commitment
- [ ] HOA Documents Package delivered to buyer *(if applicable)*
- [ ] HOA Rescission period confirmed cleared *(3 business days after buyer receives docs)*
- [ ] HOA Estoppel Certificate received
- [ ] Title Insurance Commitment (owner's + lender's)
- [ ] Lien search results

#### Phase 5 — Pre-Closing (Days 30–43)
- [ ] Clear to Close (CTC) received from lender
- [ ] Closing Disclosure issued and 3-day TRID clock confirmed
- [ ] Final walkthrough scheduled
- [ ] Final walkthrough completed + sign-off
- [ ] Buyer wire instructions confirmed with title (flag — wire fraud risk)
- [ ] All outstanding documents collected (checklist 100% complete)

#### Phase 6 — Closing
- [ ] Closing appointment confirmed (time, location, parties)
- [ ] Buyer funds confirmed received by title
- [ ] Deed recording number received
- [ ] Final ALTA Settlement Statement collected
- [ ] Commission disbursement instructions sent to broker
- [ ] All closing docs uploaded to file
- [ ] Closing confirmation email sent to all parties
- [ ] File archived

### 4B. Automated Follow-Up Logic

When a document is missing and its deadline is approaching:

```
T-5 days: First follow-up email/SMS to responsible party
T-3 days: Second follow-up (escalated tone)
T-1 day:  Third follow-up + alert fired to broker dashboard
T=0:      Deadline hit → broker alerted immediately, deal flagged
```

**Responsible party assignment** (auto-determined from document type):
- Buyer docs → buyer's agent CC'd, buyer contacted directly
- Lender docs → loan officer contacted
- Title docs → escrow officer contacted
- HOA docs → HOA/management company contacted
- Seller docs → listing agent contacted

All follow-up messages are templated but personalized with deal-specific data (address, deadline, what's missing).

---

## 5. Deadline Tracking Engine

### 5A. Timeline Auto-Generation

On contract upload, the system generates the full deal timeline automatically. No manual date entry.

Example output for a contract executed March 21 with 10-day inspection, 21-day financing, closing April 30:

```
Mar 21 — Contract execution (Day 0)
Mar 24 — EMD due (3 business days)
Mar 31 — Inspection period ends (Day 10) ⚠️ Hard deadline
Apr 1  — Lender: contract + docs should be confirmed received
Apr 11 — Financing contingency deadline (Day 21)
Apr 14 — Appraisal expected complete
Apr 23 — CTC expected from lender
Apr 25 — Insurance binder due (T-7)
Apr 27 — Closing Disclosure issued; 3-day TRID clock starts
Apr 30 — Final walkthrough
Apr 30 — CLOSING
```

### 5B. Alert Logic

| Alert Type | Trigger | Sent To |
|-----------|---------|---------|
| Deadline warning (T-3) | 3 days before any tracked deadline | Broker dashboard + email |
| Deadline warning (T-1) | 1 day before | Broker + SMS |
| Deadline missed | Day of, not resolved | Broker immediate alert |
| Document overdue | Follow-up sent, no response 48 hrs | Broker notified |
| HOA rescission clock | Activated on doc delivery, 3-day countdown | Broker alert |
| Insurance gap | T-7 from closing, no binder received | Broker alert |
| CTC not received | T-5 from closing, no CTC | Broker alert |

### 5C. Milestone Events → Client Updates

When these milestones complete, an automatic status update is sent to buyer and seller:

| Milestone | Client Update Sent |
|-----------|-------------------|
| Contract executed | "Your transaction is officially underway. Here's what happens next..." |
| EMD confirmed received | "Your earnest money deposit has been confirmed." |
| Inspection complete | "The home inspection is complete." |
| Inspection contingency resolved | "The inspection period has been successfully completed." |
| Loan commitment received | "Great news — your financing has been approved." |
| CTC received | "Your lender has issued a Clear to Close." |
| Closing Disclosure issued | "Your Closing Disclosure has been issued. Closing is confirmed for [date]." |
| Closing complete | "Congratulations — you're closed! Here's a summary of your transaction." |

Client updates are concise, warm, and written in plain language. No jargon.

---

## 6. Broker Dashboard

Single-page web interface. No app required for beta.

### Deal List View
- All active transactions in one list
- Status indicator per deal: On Track / At Risk / Needs Attention
- Days until closing for each deal
- Quick-glance: # documents pending, # deadlines in next 7 days

### Deal Detail View (per transaction)
- Full timeline with visual progress bar
- Document checklist: collected / pending / overdue, with last-follow-up timestamp
- Upcoming deadlines panel (next 7 days)
- Activity log: every action taken by the system (email sent, follow-up triggered, doc received)
- Escalation inbox: issues that need broker decision

### What the Broker Can Do
- Mark a document as received (manual override)
- Dismiss or snooze an alert
- Add a note to a deal
- Adjust a deadline (if parties agree to extension)
- View full communication log per party

What the broker cannot do in beta: edit party contact info post-intake, split transactions, merge deals. Out of scope.

---

## 7. Communication Layer

### 7A. Outbound Communication
- **Email:** Primary channel for all parties. Gmail/Outlook integration.
- **SMS:** Secondary, for deadline escalations to agents and time-sensitive alerts.
- **No portal login required for external parties in beta** — all communication via email/SMS.

### 7B. Message Templates
All templates are parameterized with deal data. Variables include:
`{buyer_name}`, `{property_address}`, `{deadline_date}`, `{document_name}`, `{agent_name}`, `{broker_name}`

Template categories:
- Intro email (sent to each party type at deal open)
- Document request (initial)
- Document follow-up (T-5, T-3, T-1 variants)
- Deadline reminder (to relevant parties)
- Milestone notification (to buyer/seller)
- Escalation alert (to broker)

All templates editable by broker in settings.

### 7C. Wire Fraud Warning (Florida Compliance)
All communication to buyer regarding wire transfers includes a mandatory warning:
> "Wire instructions will only come directly from [Title Company]. Never wire funds based on instructions received via email without first calling the title company to confirm. Wire fraud is the #1 scam in real estate."

This warning fires automatically when: Closing Disclosure is issued, wire confirmation step appears on checklist.

---

## 8. What the System Does NOT Do (Beta Scope)

Hard limits — do not automate, do not attempt:
- Title issue resolution (legal complexity, human judgment required)
- Low appraisal renegotiation (multi-party negotiation)
- Wire transfer initiation or verification (human must call title)
- Inspection repair negotiation
- Any action when a deal is at risk of collapsing (broker takes over)
- Financial decisions or disbursements
- Production deployment without Nico's approval

---

## 9. Tech Stack (Recommended)

### Contract Parser
- **PDF ingestion:** PyMuPDF or pdfplumber (extract raw text from contract PDFs)
- **Extraction model:** GPT-4o or Claude via API — structured JSON output
- **Prompt design:** Few-shot examples of FR/BAR AS-IS contract with labeled extraction targets
- **Validation layer:** Confirm all required fields extracted; flag missing fields for broker review

### Backend
- **Language:** Python (FastAPI)
- **Database:** PostgreSQL — transactions, documents, deadlines, parties, communication log
- **Task queue:** Celery + Redis — background jobs for follow-up scheduling, deadline checks
- **Scheduler:** APScheduler or Celery Beat — runs deadline checks on a cron schedule (every hour)

### Email/SMS
- **Email:** SendGrid or Resend (transactional email API, simple integration)
- **SMS:** Twilio
- **Gmail/Outlook integration:** OAuth2 for reading incoming docs from broker's inbox *(Phase 2)*

### Frontend (Dashboard)
- **Framework:** Next.js (React) — simple, fast to build
- **Styling:** Tailwind CSS
- **Auth:** Clerk or Auth.js (simple auth for beta, single broker user)
- **Hosting:** Vercel (frontend) + Railway or Render (backend API)

### File Storage
- **Documents:** AWS S3 or Cloudflare R2 (cheaper) — store all uploaded contract PDFs and received documents
- **CDN:** Cloudflare

### Infrastructure
- All managed services for beta — no self-hosted infra
- Target: fully functional for < $50/month in infrastructure costs during beta

---

## 10. Build Order

### Phase 0 — Foundation (Week 1–2)
- [ ] Set up repo, project structure, basic FastAPI backend
- [ ] PostgreSQL schema: transactions, parties, documents, deadlines, events
- [ ] Contract upload endpoint (accept PDF, store to S3)
- [ ] Basic auth (broker login)

### Phase 1 — Contract Parser (Week 2–3)
- [ ] Build PDF text extraction pipeline
- [ ] Design extraction prompt (structured JSON output)
- [ ] Test on 5–10 real FR/BAR AS-IS contracts
- [ ] Validate output: all required fields, Florida compliance flags
- [ ] Auto-generate timeline from extracted dates

### Phase 2 — Document Tracking (Week 3–4)
- [ ] Build document checklist engine (phase-aware, Florida-specific)
- [ ] Document upload endpoint (for received docs)
- [ ] Status tracking: collected / pending / overdue
- [ ] Manual override (broker marks doc as received)

### Phase 3 — Deadline Engine + Alerts (Week 4–5)
- [ ] Celery Beat scheduler for deadline checks
- [ ] Alert logic: T-3, T-1, T=0 triggers
- [ ] HOA rescission clock (separate sub-workflow)
- [ ] Insurance gap alert (T-7 from closing)
- [ ] Broker alert routing (dashboard + email)

### Phase 4 — Communication Engine (Week 5–6)
- [ ] SendGrid integration
- [ ] Twilio SMS integration
- [ ] Message template system (parameterized, editable)
- [ ] Intro email automation (fires on deal creation)
- [ ] Follow-up automation (fires on document overdue)
- [ ] Milestone trigger → client update

### Phase 5 — Dashboard (Week 6–8)
- [ ] Deal list view
- [ ] Deal detail view
- [ ] Document checklist UI
- [ ] Deadline timeline UI
- [ ] Activity log
- [ ] Alert/escalation inbox

### Phase 6 — Beta Prep (Week 8–9)
- [ ] End-to-end test with one mock transaction
- [ ] Broker onboarding flow (how to create first deal)
- [ ] Error handling and edge cases
- [ ] Deploy to production
- [ ] Onboard beta user (Nico's mom) on one live deal

---

## 11. Decisions (Locked — 2026-03-21)

1. **Dotloop integration:** Manual upload for beta. Dotloop integration is a Phase 2 item.

2. **Pricing model:** Flat monthly — $99–149/month per broker, unlimited transactions. Revisit per-transaction model post-beta with real usage data.

3. **Beta duration:** Run until Nico determines the product is ready for market. No fixed end date.

4. **GitHub repo:** Created under thelexagent-cmd. See: https://github.com/thelexagent-cmd/re-transaction-agent

---

*All research inputs: beta-scope.md, transaction-lifecycle.md, florida-rules-and-competitor-pricing.md*
*Next step: Nico reviews and approves spec → Lex begins Phase 0 build*
