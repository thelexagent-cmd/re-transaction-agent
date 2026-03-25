"""multilingual, FIRPTA flags, portal tokens

Adds:
  - parties.preferred_language (varchar, default 'en')
  - parties.is_foreign_national (bool, default false)
  - portal_tokens table (token-based public client portal access)

Revision ID: 0003
Revises: 0002
Create Date: 2026-03-25 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "parties",
        sa.Column("preferred_language", sa.String(10), nullable=False, server_default="en"),
    )
    op.add_column(
        "parties",
        sa.Column("is_foreign_national", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.create_table(
        "portal_tokens",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("token", sa.String(64), nullable=False, unique=True, index=True),
        sa.Column(
            "transaction_id",
            sa.Integer(),
            sa.ForeignKey("transactions.id", ondelete="CASCADE"),
            nullable=False,
            index=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("portal_tokens")
    op.drop_column("parties", "is_foreign_national")
    op.drop_column("parties", "preferred_language")
