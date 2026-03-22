"""phase3-6 schema updates

Audit of phases 3–6 confirms no additional schema changes beyond what was
captured in 0001 (initial schema) and 0002 (phase3 alert fields):

Phase 3 — Deadline Engine + Alerts:
  Deadline.alert_t3_sent, Deadline.alert_t1_sent      → in 0001
  Transaction.insurance_alert_sent                    → in 0002
  Transaction.ctc_alert_sent                          → in 0002
  Event.dismissed                                     → in 0002

Phase 4 — Communication Engine:
  No schema changes. Email/SMS services are application-layer only.

Phase 5 — Dashboard:
  No schema changes. Dashboard reads from existing tables.

Phase 6 — Beta Prep:
  No schema changes. Logging, Docker, error handling are infrastructure-layer.

This migration is a bookkeeping entry to advance the alembic head to 0003.

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-22 00:00:00.000000

"""

from collections.abc import Sequence

# revision identifiers, used by Alembic.
revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # No schema changes required for phases 3–6.
    pass


def downgrade() -> None:
    pass
