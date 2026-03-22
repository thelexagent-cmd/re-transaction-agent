"""Standalone test script for the contract parser pipeline.

Reads samples/AS-IS-Contract-Main.pdf, runs the full extraction pipeline
(PDF text extraction → Claude structured extraction → timeline generation),
and pretty-prints the results. Does NOT require a running database.

Usage (from project root):
    python scripts/test_parser.py

Requires ANTHROPIC_API_KEY in environment or backend/.env.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

# Resolve paths relative to this script
_SCRIPT_DIR = Path(__file__).resolve().parent
_PROJECT_ROOT = _SCRIPT_DIR.parent
_BACKEND_DIR = _PROJECT_ROOT / "backend"
_SAMPLE_PDF = _PROJECT_ROOT / "samples" / "AS-IS-Contract-Main.pdf"

# Add backend/ to sys.path so app modules are importable
sys.path.insert(0, str(_BACKEND_DIR))

# Load environment variables from backend/.env before importing app modules
from dotenv import load_dotenv  # noqa: E402 — must come before app imports

load_dotenv(_BACKEND_DIR / ".env")

# Provide required config values that aren't needed for this standalone script
os.environ.setdefault("DATABASE_URL", "postgresql+asyncpg://test:test@localhost:5432/test")
os.environ.setdefault("SECRET_KEY", "test-secret-key-not-used-in-this-script")


async def main() -> None:
    from app.services.extractor import extract_contract_data  # noqa: PLC0415
    from app.services.parser import extract_text  # noqa: PLC0415
    from app.services.timeline import generate_timeline  # noqa: PLC0415

    if not _SAMPLE_PDF.exists():
        print(f"ERROR: Sample PDF not found at {_SAMPLE_PDF}")
        sys.exit(1)

    print(f"Reading PDF: {_SAMPLE_PDF}")
    pdf_bytes = _SAMPLE_PDF.read_bytes()
    print(f"PDF size: {len(pdf_bytes):,} bytes\n")

    # ── Step 1: PDF text extraction ──────────────────────────────────────────
    print("Step 1/3  Extracting text with pdfplumber...")
    contract_text = extract_text(pdf_bytes)
    print(f"          Extracted {len(contract_text):,} characters")
    print(f"          First 300 chars:\n{contract_text[:300]!r}\n")

    # ── Step 2: Claude extraction ────────────────────────────────────────────
    print("Step 2/3  Sending to Claude for structured extraction")
    print("          (model: claude-opus-4-6 with adaptive thinking — may take 15-60s)...")
    extracted = await extract_contract_data(contract_text)
    print("          Done.\n")

    print("=" * 65)
    print("EXTRACTED CONTRACT DATA")
    print("=" * 65)
    print(json.dumps(extracted, indent=2, default=str))

    # ── Step 3: Timeline generation ──────────────────────────────────────────
    print("\nStep 3/3  Generating deal timeline...")
    timeline = generate_timeline(extracted)

    print("\n" + "=" * 65)
    print("GENERATED TIMELINE")
    print("=" * 65)
    if not timeline:
        print("  (no timeline items — contract may be a blank template)")
    else:
        for item in timeline:
            print(f"  {item['due_date']}  {item['name']}")
            print(f"               {item['description']}")
            print()

    print(f"Total deadlines generated: {len(timeline)}")


if __name__ == "__main__":
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("ERROR: ANTHROPIC_API_KEY is not set.")
        print("       Add it to backend/.env or export it in your shell.")
        sys.exit(1)

    asyncio.run(main())
