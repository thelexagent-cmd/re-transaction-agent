You are building Phase 4 of a Real Estate Transaction Agent. Read PRODUCT-SPEC.md first for full context. Read ALL existing code in backend/app/ before writing anything new.

## Phase 4: Communication Engine

Build the email and SMS sending layer. All the follow-up logic and milestone triggers from Phases 2-3 currently log Events — now wire them to actually send emails and SMS.

---

## What to Build

### 1. Email Service (`backend/app/services/email_service.py`)

Use SendGrid (sendgrid Python SDK).

Class: `EmailService`

Methods:
- `async def send(to_email, to_name, subject, html_body, text_body)` — send a single email
- `async def send_template(to_email, to_name, template_name, template_vars)` — render a template and send

Settings needed (add to config.py and .env.example):
- `SENDGRID_API_KEY`
- `FROM_EMAIL` (default: "transactions@lexagent.ai")
- `FROM_NAME` (default: "Lex Transaction Agent")

### 2. SMS Service (`backend/app/services/sms_service.py`)

Use Twilio Python SDK.

Class: `SMSService`

Methods:
- `async def send(to_phone, message)` — send SMS

Settings needed:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

### 3. Message Template System (`backend/app/services/templates/`)

Create a templates directory with Python string templates (not Jinja2 — keep it simple).

File: `backend/app/services/templates/__init__.py`

Define all templates from PRODUCT-SPEC.md Section 7B as Python dicts with `subject`, `html`, and `text` keys. Template variables use {buyer_name}, {property_address}, {deadline_date}, {document_name}, {agent_name}, {broker_name} style substitution.

Templates to build:
- `intro_buyer` — sent to buyer when deal opens
- `intro_seller` — sent to seller when deal opens
- `intro_agent` — sent to both agents when deal opens
- `intro_lender` — sent to lender when deal opens
- `intro_title` — sent to title company when deal opens
- `document_request_initial` — first document request
- `document_followup_t5` — T-5 follow-up (polite reminder)
- `document_followup_t3` — T-3 follow-up (escalated)
- `document_followup_t1` — T-1 follow-up (urgent)
- `deadline_reminder` — general deadline reminder
- `milestone_emd_confirmed` — buyer/seller update
- `milestone_inspection_complete` — buyer/seller update
- `milestone_loan_commitment` — buyer/seller update
- `milestone_ctc` — buyer/seller update
- `milestone_closing_disclosure` — buyer/seller update with wire fraud warning
- `milestone_closed` — congratulations email
- `broker_alert_email` — alert to broker for escalations

Wire fraud warning (MUST be included in milestone_closing_disclosure and any wire-related comms):
"Wire instructions will only come directly from [Title Company]. Never wire funds based on instructions received via email without first calling the title company to confirm. Wire fraud is the #1 scam in real estate."

### 4. Wire email/SMS into follow-up and milestone services

Update `backend/app/services/followup.py` (Phase 2):
- After logging the Event, actually call EmailService.send_template() to the responsible party
- T-1 follow-ups: also send SMS via SMSService if phone number is available

Update `backend/app/services/milestones.py` (Phase 3):
- After logging milestone Event, send appropriate email to buyer and seller

Update `backend/app/services/intake.py`:
- After contract is parsed and deal is created, send intro emails to all parties with contact info

### 5. Deal open intro sequence

In intake.py, after checklist is generated:
- For each party with an email address, send the appropriate intro template
- Log Event(type="intro_sent", description=f"Intro email sent to {party.role} {party.full_name}")
- If any intro email fails, log Event(type="email_failed") but don't crash the intake

### 6. Broker alert notifications

When a broker_alert Event is created anywhere in the system, also send an email to the broker using the `broker_alert_email` template.

Create a helper: `async def notify_broker(transaction_id, subject, message, db)` in email_service.py — fetches the broker's email from the transaction's user record and sends.

### 7. Update Celery worker

The follow-up check task (from Phase 2) now actually sends emails — no changes needed to the task itself since followup.py handles it, but make sure the Celery worker can import EmailService and SMSService correctly.

### 8. Update requirements.txt

Add:
- `sendgrid==6.11.0`
- `twilio==9.4.0`

### 9. Update .env.example

Add:
- `SENDGRID_API_KEY=your-key-here`
- `FROM_EMAIL=transactions@lexagent.ai`
- `FROM_NAME=Lex Transaction Agent`
- `TWILIO_ACCOUNT_SID=your-sid`
- `TWILIO_AUTH_TOKEN=your-token`
- `TWILIO_FROM_NUMBER=+1xxxxxxxxxx`

---

## Notes

- Email and SMS sending should be graceful — if credentials not set, log a warning but don't crash
- All outbound comms are logged as Events
- Templates must include the broker's name and brokerage name (pulled from user record)
- The wire fraud warning is non-negotiable — it must be in any closing-related email to buyer

When completely finished, run:
openclaw system event --text "Phase 4 complete: Communication engine built — SendGrid email, Twilio SMS, full template system, intro sequence, milestone emails, broker alert notifications." --mode now
