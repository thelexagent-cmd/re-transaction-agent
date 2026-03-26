"""earnest money deposit fields

Adds:
  - emd_amount, emd_holder, emd_due_date, emd_received, emd_notes columns to transactions table

Revision ID: 0010
Revises: 0009
Create Date: 2026-03-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("emd_amount", sa.Numeric(12, 2), nullable=True))
    op.add_column("transactions", sa.Column("emd_holder", sa.String(200), nullable=True))
    op.add_column("transactions", sa.Column("emd_due_date", sa.Date(), nullable=True))
    op.add_column("transactions", sa.Column("emd_received", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("transactions", sa.Column("emd_notes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("transactions", "emd_notes")
    op.drop_column("transactions", "emd_received")
    op.drop_column("transactions", "emd_due_date")
    op.drop_column("transactions", "emd_holder")
    op.drop_column("transactions", "emd_amount")
