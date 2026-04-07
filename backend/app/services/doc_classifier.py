"""Use Claude Haiku to identify uploaded document type from filename + PDF text."""

import io
import json
import logging
import os
import re

import anthropic
import pdfplumber

logger = logging.getLogger(__name__)

KNOWN_DOC_TYPES = [
    "Purchase Agreement", "Addendum", "Inspection Report",
    "Commitment Letter", "Clear to Close", "Closing Disclosure",
    "Proof of Insurance", "Title Commitment", "Survey",
    "HOA Documents", "Seller Disclosure", "Lead Paint Disclosure",
    "FIRPTA Certificate", "W-9", "Wire Instructions",
    "Bank Statement", "Tax Return", "Pay Stub",
    "Photo ID / Driver's License", "Earnest Money Receipt",
    "Final Walkthrough", "Deed", "Settlement Statement (HUD-1/CD)",
    "Other / Unknown",
]


def _extract_text_preview(content: bytes) -> str:
    try:
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            parts: list[str] = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    parts.append(text)
                if sum(len(t) for t in parts) >= 2000:
                    break
            return "\n".join(parts)[:2000]
    except Exception as exc:
        logger.warning("pdfplumber text extraction failed: %s", exc)
        return ""


async def classify_document(filename: str, content: bytes) -> dict:
    """Classify a document using its filename and PDF text preview.

    Returns dict with keys: doc_type, confidence (high/medium/low), suggested_name.
    Never raises — always returns a fallback on any error.
    """
    fallback = {"doc_type": "Other / Unknown", "confidence": "low", "suggested_name": filename}

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        logger.warning("ANTHROPIC_API_KEY not set — skipping document classification")
        return fallback

    text_preview = ""
    if filename.lower().endswith(".pdf"):
        text_preview = _extract_text_preview(content)

    doc_types_list = "\n".join(f"- {dt}" for dt in KNOWN_DOC_TYPES)
    prompt = (
        f'Document filename: "{filename}"\n'
        f'Text preview (first ~2000 chars, may be empty):\n"""\n{text_preview}\n"""\n\n'
        f"Which real estate document type is this?\n{doc_types_list}\n\n"
        f'Reply with JSON only: {{"doc_type": "...", "confidence": "high/medium/low", "suggested_name": "..."}}'
    )

    try:
        client = anthropic.AsyncAnthropic(api_key=api_key)
        msg = await client.messages.create(
            model="claude-haiku-4-5",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()

        # Safely extract JSON — handle fenced or unfenced responses
        json_match = re.search(r'\{[^{}]*\}', raw, re.DOTALL)
        if not json_match:
            logger.warning("No JSON object found in classifier response for '%s'", filename)
            return fallback
        raw = json_match.group(0)

        result = json.loads(raw)
        doc_type = result.get("doc_type", "Other / Unknown")
        if doc_type not in KNOWN_DOC_TYPES:
            doc_type = "Other / Unknown"
        confidence = result.get("confidence", "low")
        if confidence not in ("high", "medium", "low"):
            confidence = "low"
        # Sanitize suggested_name: strip control chars, cap at 500 chars
        raw_name = str(result.get("suggested_name", filename)).strip() or filename
        suggested_name = re.sub(r'[\x00-\x1f\x7f]', '', raw_name)[:500].strip() or filename

        logger.info("Classified '%s' → %s (%s)", filename, doc_type, confidence)
        return {"doc_type": doc_type, "confidence": confidence, "suggested_name": suggested_name}

    except Exception as exc:
        logger.warning("Document classification failed for '%s': %s", filename, exc)
        return fallback
