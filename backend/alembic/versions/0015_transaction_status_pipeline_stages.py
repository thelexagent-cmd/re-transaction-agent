"""Add pipeline stage values to transaction_status_enum

STATUS_TRIGGERS in trigger_email.py fires emails for under_contract,
inspection, financing, and clear_to_close transitions, but those values were
never in the DB enum — so they could never be stored and the trigger never
fired.  This migration extends the PostgreSQL enum so those status values can
be written and the trigger emails work end-to-end.

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-07 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0015"
down_revision: str | None = "0014"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE is the only way to extend a Postgres enum without
    # dropping and recreating it (which would require a table rewrite).
    # ADD VALUE is idempotent when preceded by IF NOT EXISTS (PG 9.6+).
    op.execute("ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'under_contract'")
    op.execute("ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'inspection'")
    op.execute("ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'financing'")
    op.execute("ALTER TYPE transaction_status_enum ADD VALUE IF NOT EXISTS 'clear_to_close'")


def downgrade() -> None:
    # PostgreSQL does not support removing values from an enum without a full
    # type rebuild.  A true downgrade would require:
    #   1. UPDATE transactions SET status = 'active' WHERE status IN (...)
    #   2. Recreate the enum without the added values
    #   3. ALTER TABLE transactions ALTER COLUMN status TYPE ... USING ...
    # That is destructive; raise instead to prevent accidental rollbacks.
    raise NotImplementedError(
        "Downgrading transaction_status_enum is not supported automatically. "
        "Manually remove 'under_contract', 'inspection', 'financing', 'clear_to_close' "
        "if needed."
    )
