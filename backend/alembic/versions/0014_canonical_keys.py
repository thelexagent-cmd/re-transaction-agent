"""add canonical_key to documents and deadlines

Adds a stable, normalized matching key to every document checklist item and
deadline record.  The column stores the output of normalize_name() at insert
time so that re-parse matching never depends on raw string equality.

Existing rows will have canonical_key = NULL.  intake.py backfills the column
on the first re-parse that touches each record, so no bulk UPDATE is needed
here and Railway deploy stays fast.

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-07 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0014"
down_revision: str | None = "0013"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE documents ADD COLUMN IF NOT EXISTS canonical_key VARCHAR(500)"
    )
    op.execute(
        "ALTER TABLE deadlines ADD COLUMN IF NOT EXISTS canonical_key VARCHAR(255)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_documents_canonical_key ON documents (canonical_key)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_deadlines_canonical_key ON deadlines (canonical_key)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_documents_canonical_key")
    op.execute("DROP INDEX IF EXISTS ix_deadlines_canonical_key")
    op.execute("ALTER TABLE documents DROP COLUMN IF EXISTS canonical_key")
    op.execute("ALTER TABLE deadlines DROP COLUMN IF EXISTS canonical_key")
