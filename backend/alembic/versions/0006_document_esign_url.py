"""document esign url

Adds:
  - esign_url column to documents table

Revision ID: 0006
Revises: 0005
Create Date: 2026-03-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("documents", sa.Column("esign_url", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "esign_url")
