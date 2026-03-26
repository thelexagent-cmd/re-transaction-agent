"""commission disbursement fields

Adds:
  - commission_status, commission_disbursed_at, commission_notes columns to transactions table

Revision ID: 0009
Revises: 0008
Create Date: 2026-03-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("commission_status", sa.String(50), nullable=True))
    op.add_column("transactions", sa.Column("commission_disbursed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("transactions", sa.Column("commission_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "commission_notes")
    op.drop_column("transactions", "commission_disbursed_at")
    op.drop_column("transactions", "commission_status")
