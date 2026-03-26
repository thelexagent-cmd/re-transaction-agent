"""add performance indexes

Adds indexes on commonly queried foreign key and lookup columns to
improve query performance at scale.

Revision ID: 0013
Revises: 0012
Create Date: 2026-03-26 00:00:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"])
    op.create_index("ix_transactions_status", "transactions", ["status"])
    op.create_index("ix_portal_tokens_token", "portal_tokens", ["token"], unique=True)
    op.create_index("ix_inspection_items_transaction_id", "inspection_items", ["transaction_id"])
    op.create_index("ix_compliance_items_transaction_id", "compliance_items", ["transaction_id"])
    op.create_index("ix_tasks_transaction_id", "tasks", ["transaction_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_transaction_id", "tasks")
    op.drop_index("ix_compliance_items_transaction_id", "compliance_items")
    op.drop_index("ix_inspection_items_transaction_id", "inspection_items")
    op.drop_index("ix_portal_tokens_token", "portal_tokens")
    op.drop_index("ix_transactions_status", "transactions")
    op.drop_index("ix_transactions_user_id", "transactions")
