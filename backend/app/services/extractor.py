"""Claude-powered contract data extraction service."""

import json
import re

import anthropic

from app.config import settings

_SYSTEM_PROMPT = """You are a real estate contract data extraction specialist with deep expertise \
in Florida FR/BAR AS-IS purchase agreements.

Your task: extract structured data from contract text and return it as a single valid JSON object.
Extract exactly what is written in the contract — do not infer or fabricate information.
If a field is absent, use null for numbers/booleans and empty string "" for text."""

_USER_TEMPLATE = """\
Extract all data from the following real estate contract and return ONLY a valid JSON object \
matching the exact structure below. No markdown, no explanation — just the raw JSON.

Required structure:
{{
  "parties": {{
    "buyer": {{"name": "", "email": "", "phone": ""}},
    "seller": {{"name": "", "email": "", "phone": ""}},
    "buyers_agent": {{"name": "", "email": "", "phone": "", "license": ""}},
    "listing_agent": {{"name": "", "email": "", "phone": "", "license": ""}},
    "lender": {{"name": "", "email": "", "phone": ""}},
    "title_company": {{"name": "", "email": "", "phone": ""}},
    "escrow_agent": {{"name": "", "email": "", "phone": ""}}
  }},
  "property": {{
    "address": "",
    "legal_description": "",
    "property_type": "",
    "year_built": null,
    "hoa_present": false,
    "flood_zone": ""
  }},
  "financial": {{
    "purchase_price": null,
    "earnest_money_deposit": null,
    "emd_escrow_agent": "",
    "financing_amount": null,
    "seller_concessions": null,
    "down_payment": null,
    "financing_type": ""
  }},
  "dates": {{
    "contract_execution_date": "",
    "emd_deadline": "",
    "inspection_period_end": "",
    "financing_contingency_deadline": "",
    "appraisal_deadline": "",
    "closing_date": ""
  }},
  "compliance_flags": {{
    "lead_paint_required": false,
    "hoa_docs_required": false,
    "flood_insurance_required": false,
    "septic_well_inspection": false
  }},
  "raw_notes": ""
}}

Extraction rules:
- Use null for any numeric field not found; use "" for any string field not found
- All dates MUST be ISO 8601 (YYYY-MM-DD); use "" if a date is absent or illegible
- lead_paint_required = true if year_built < 1978 OR if lead paint disclosure is mentioned
- hoa_docs_required = true if the property is a condo OR if HOA fees/docs are referenced
- flood_insurance_required = true if a flood zone designation or flood insurance is mentioned
- septic_well_inspection = true if a septic system or well water supply is mentioned
- purchase_price, earnest_money_deposit, financing_amount, seller_concessions, down_payment: \
numeric value only (strip $ signs and commas)
- raw_notes: capture riders, addenda, unusual clauses, or terms that don't fit above fields

Contract text:
{contract_text}"""


def _parse_json_response(text: str) -> dict:
    """Parse JSON from Claude's response, stripping markdown fences if present."""
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*\n?", "", text, flags=re.MULTILINE)
        text = re.sub(r"\n?```\s*$", "", text, flags=re.MULTILINE)
        text = text.strip()
    return json.loads(text)


async def extract_contract_data(contract_text: str) -> dict:
    """Extract structured contract data using Claude.

    Args:
        contract_text: Cleaned text extracted from a contract PDF.

    Returns:
        Dictionary with structured contract data matching the schema above.

    Raises:
        ValueError: If Claude returns a response that cannot be parsed as JSON.
    """
    api_key = settings.anthropic_api_key or None
    client = anthropic.AsyncAnthropic(api_key=api_key, timeout=60.0)

    user_message = _USER_TEMPLATE.format(contract_text=contract_text)

    response = await client.messages.create(
        model="claude-opus-4-6",
        max_tokens=16000,
        system=_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    text_content = next(
        (block.text for block in response.content if block.type == "text"),
        None,
    )

    if not text_content:
        raise ValueError("Claude returned no text content in the response")

    try:
        return _parse_json_response(text_content)
    except json.JSONDecodeError as exc:
        preview = text_content[:500]
        raise ValueError(
            f"Claude returned invalid JSON: {exc}\nResponse preview: {preview}"
        ) from exc
