"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-03-22 00:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- Enums ---
    property_type_enum = sa.Enum(
        "sfh", "condo", "townhouse", "multi_family", "other",
        name="property_type_enum",
    )
    transaction_status_enum = sa.Enum(
        "active", "closed", "cancelled",
        name="transaction_status_enum",
    )
    party_role_enum = sa.Enum(
        "buyer", "seller", "buyers_agent", "listing_agent",
        "lender", "title", "escrow", "hoa",
        name="party_role_enum",
    )
    document_status_enum = sa.Enum(
        "pending", "collected", "overdue",
        name="document_status_enum",
    )
    deadline_status_enum = sa.Enum(
        "upcoming", "warning", "missed", "completed",
        name="deadline_status_enum",
    )

    # --- users ---
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("brokerage_name", sa.String(255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # --- transactions ---
    op.create_table(
        "transactions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("property_type", property_type_enum, nullable=False),
        sa.Column("status", transaction_status_enum, nullable=False),
        sa.Column("purchase_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("closing_date", sa.Date(), nullable=True),
        sa.Column("contract_execution_date", sa.Date(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_transactions_id", "transactions", ["id"])
    op.create_index("ix_transactions_user_id", "transactions", ["user_id"])
    op.create_index("ix_transactions_status", "transactions", ["status"])

    # --- parties ---
    op.create_table(
        "parties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("role", party_role_enum, nullable=False),
        sa.Column("full_name", sa.String(255), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("phone", sa.String(50), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_parties_id", "parties", ["id"])
    op.create_index("ix_parties_transaction_id", "parties", ["transaction_id"])

    # --- documents ---
    op.create_table(
        "documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("phase", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("status", document_status_enum, nullable=False),
        sa.Column("responsible_party_role", sa.String(50), nullable=True),
        sa.Column("due_date", sa.Date(), nullable=True),
        sa.Column("collected_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("storage_key", sa.String(1000), nullable=True),
        sa.Column("last_followup_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_id", "documents", ["id"])
    op.create_index("ix_documents_transaction_id", "documents", ["transaction_id"])
    op.create_index("ix_documents_status", "documents", ["status"])

    # --- deadlines ---
    op.create_table(
        "deadlines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("status", deadline_status_enum, nullable=False),
        sa.Column("alert_t3_sent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("alert_t1_sent", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_deadlines_id", "deadlines", ["id"])
    op.create_index("ix_deadlines_transaction_id", "deadlines", ["transaction_id"])
    op.create_index("ix_deadlines_status", "deadlines", ["status"])

    # --- events ---
    op.create_table(
        "events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("transaction_id", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["transaction_id"], ["transactions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_events_id", "events", ["id"])
    op.create_index("ix_events_transaction_id", "events", ["transaction_id"])
    op.create_index("ix_events_event_type", "events", ["event_type"])


def downgrade() -> None:
    op.drop_table("events")
    op.drop_table("deadlines")
    op.drop_table("documents")
    op.drop_table("parties")
    op.drop_table("transactions")
    op.drop_table("users")

    # Drop enums (PostgreSQL requires explicit cleanup)
    sa.Enum(name="deadline_status_enum").drop(op.get_bind())
    sa.Enum(name="document_status_enum").drop(op.get_bind())
    sa.Enum(name="party_role_enum").drop(op.get_bind())
    sa.Enum(name="transaction_status_enum").drop(op.get_bind())
    sa.Enum(name="property_type_enum").drop(op.get_bind())
