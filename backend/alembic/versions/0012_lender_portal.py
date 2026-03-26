"""lender portal fields

Adds token_type, lender_name, lender_email columns to portal_tokens table.

Revision ID: 0012
Revises: 0011
Create Date: 2026-03-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("portal_tokens", sa.Column("token_type", sa.String(20), nullable=False, server_default="client"))
    op.add_column("portal_tokens", sa.Column("lender_name", sa.String(200), nullable=True))
    op.add_column("portal_tokens", sa.Column("lender_email", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("portal_tokens", "lender_email")
    op.drop_column("portal_tokens", "lender_name")
    op.drop_column("portal_tokens", "token_type")
