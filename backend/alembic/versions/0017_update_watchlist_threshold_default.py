"""update existing watchlist rows threshold 60 -> 40

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-29

Updates any market_watchlist rows still at the old default threshold of 60
to the new default of 40 so they start receiving alerts.
"""

from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "UPDATE market_watchlist SET alert_threshold = 40 WHERE alert_threshold = 60"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE market_watchlist SET alert_threshold = 60 WHERE alert_threshold = 40"
    )
