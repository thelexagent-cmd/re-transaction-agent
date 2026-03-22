"""PDF text extraction service using pdfplumber."""

import io
import re

import pdfplumber


def extract_text(pdf_bytes: bytes) -> str:
    """Extract and clean text from a PDF file.

    Handles multi-page PDFs and normalizes whitespace for downstream processing.

    Args:
        pdf_bytes: Raw PDF file bytes.

    Returns:
        Cleaned text as a single string, or empty string if no text found.
    """
    text_parts: list[str] = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)

    if not text_parts:
        return ""

    raw = "\n".join(text_parts)

    # Collapse runs of blank lines to a single blank line
    cleaned = re.sub(r"\n{3,}", "\n\n", raw)
    # Collapse horizontal whitespace (tabs, multiple spaces) to a single space
    cleaned = re.sub(r"[ \t]+", " ", cleaned)
    # Strip trailing spaces from each line
    cleaned = "\n".join(line.rstrip() for line in cleaned.splitlines())

    return cleaned.strip()
