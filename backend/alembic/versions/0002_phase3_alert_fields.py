"""phase3 alert fields

Adds:
  - events.dismissed (bool, default false) — broker can dismiss a broker_alert
  - transactions.insurance_alert_sent (bool, default false) — dedup insurance gap alert
  - transactions.ctc_alert_sent (bool, default false) — dedup CTC gap alert

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # events: add dismissed flag
    op.add_column(
        "events",
        sa.Column(
            "dismissed",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # transactions: add insurance_alert_sent flag
    op.add_column(
        "transactions",
        sa.Column(
            "insurance_alert_sent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )

    # transactions: add ctc_alert_sent flag
    op.add_column(
        "transactions",
        sa.Column(
            "ctc_alert_sent",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )


def downgrade() -> None:
    op.drop_column("transactions", "ctc_alert_sent")
    op.drop_column("transactions", "insurance_alert_sent")
    op.drop_column("events", "dismissed")
