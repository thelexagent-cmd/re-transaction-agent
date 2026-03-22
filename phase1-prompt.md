You are building Phase 1 of a Real Estate Transaction Agent. Read PRODUCT-SPEC.md first for full context.

## Phase 1: Contract Parser

The goal is to build a pipeline that takes a FR/BAR AS-IS contract PDF, extracts all critical data using Claude (Anthropic API), and returns structured JSON. This JSON then auto-populates the transaction record in the database.

There are sample PDFs in `samples/` — specifically `AS-IS-Contract-Main.pdf` is the primary test target.

---

## What to Build

### 1. PDF Text Extraction (`backend/app/services/parser.py`)

- Use `pdfplumber` to extract raw text from a PDF file
- Handle multi-page PDFs (the FR/BAR contract is ~10 pages)
- Clean the extracted text (remove excessive whitespace, normalize line breaks)
- Return the cleaned text as a string

### 2. Extraction Prompt (`backend/app/services/extractor.py`)

Build a structured extraction service using the Anthropic Python SDK (`anthropic` package).

Model: `claude-opus-4-5` (use `anthropic` Python SDK)

The prompt must extract ALL of these fields and return them as structured JSON:

```json
{
  "parties": {
    "buyer": { "name": "", "email": "", "phone": "" },
    "seller": { "name": "", "email": "", "phone": "" },
    "buyers_agent": { "name": "", "email": "", "phone": "", "license": "" },
    "listing_agent": { "name": "", "email": "", "phone": "", "license": "" },
    "lender": { "name": "", "email": "", "phone": "" },
    "title_company": { "name": "", "email": "", "phone": "" },
    "escrow_agent": { "name": "", "email": "", "phone": "" }
  },
  "property": {
    "address": "",
    "legal_description": "",
    "property_type": "",
    "year_built": null,
    "hoa_present": false,
    "flood_zone": ""
  },
  "financial": {
    "purchase_price": null,
    "earnest_money_deposit": null,
    "emd_escrow_agent": "",
    "financing_amount": null,
    "seller_concessions": null,
    "down_payment": null,
    "financing_type": ""
  },
  "dates": {
    "contract_execution_date": "",
    "emd_deadline": "",
    "inspection_period_end": "",
    "financing_contingency_deadline": "",
    "appraisal_deadline": "",
    "closing_date": ""
  },
  "compliance_flags": {
    "lead_paint_required": false,
    "hoa_docs_required": false,
    "flood_insurance_required": false,
    "septic_well_inspection": false
  },
  "raw_notes": ""
}
```

Rules for the prompt:
- If a field is not found, use null for numbers and empty string for strings
- All dates must be in ISO 8601 format (YYYY-MM-DD)
- `lead_paint_required` = true if year_built < 1978 OR if lead paint disclosure is referenced
- `hoa_docs_required` = true if property is condo or HOA is mentioned
- `raw_notes` = any important terms that don't fit the structured fields
- Return ONLY valid JSON, no markdown, no explanation

### 3. Timeline Generator (`backend/app/services/timeline.py`)

Takes the extracted JSON dates and generates the full deal timeline.

Function signature: `def generate_timeline(extracted_data: dict) -> list[dict]`

Returns a list of dicts: `{ "name": str, "due_date": date, "description": str }`

Rules:
- If `contract_execution_date` is present, calculate:
  - EMD due: execution_date + 3 business days (skip weekends)
  - If inspection_period_end not in contract, default to execution_date + 10 days
  - Financing contingency: use contract date or execution_date + 21 days
  - Insurance binder due: closing_date - 7 days
  - Final walkthrough: closing_date - 1 day
  - Closing Disclosure issued: closing_date - 3 days (TRID requirement)
- Use Python datetime and timedelta only — no external packages
- Business days: skip Saturday (weekday 5) and Sunday (weekday 6)

### 4. Contract Intake Service (`backend/app/services/intake.py`)

Orchestrates the full pipeline. Async function `process_contract(pdf_bytes: bytes, transaction_id: int, db: AsyncSession)` that:
1. Extracts text from PDF
2. Calls extractor to get structured JSON
3. Updates transaction record with extracted data
4. Updates/creates party records
5. Generates timeline and creates deadline records
6. Logs an event: "Contract parsed successfully"
7. Returns the full extracted data dict

### 5. New API endpoint

In `backend/app/routers/transactions.py`, add:

`POST /transactions/{id}/parse-contract`

- Accepts a PDF file upload (multipart)
- Calls `intake.process_contract()`
- Returns the extracted JSON plus list of deadlines created
- If parsing fails, return 422 with error detail

### 6. Update requirements.txt

Add:
- `pdfplumber==0.11.4`
- `anthropic==0.40.0`

### 7. Test script (`scripts/test_parser.py`)

Standalone test script that:
1. Reads `samples/AS-IS-Contract-Main.pdf`
2. Runs the full extraction pipeline (PDF extraction + LLM call)
3. Pretty-prints the extracted JSON to stdout
4. Does NOT require a running database
5. Reads `ANTHROPIC_API_KEY` from environment or `.env` file

### 8. Add to .env.example

Add `ANTHROPIC_API_KEY=your-key-here`

---

## Notes

- API key is `ANTHROPIC_API_KEY` in `.env` — already handled by pydantic-settings in `config.py`, just add the field
- The FR/BAR AS-IS contract has parties and property on page 1, financial terms on pages 2-3
- Handle blank template PDFs gracefully — return nulls, don't crash
- All LLM calls are async

Write production-quality code. Real implementations only.

When completely finished, run:
openclaw system event --text "Phase 1 complete: Contract parser built — PDF extraction, Claude-powered field extraction, timeline generator, intake orchestrator, and test script all done." --mode now
