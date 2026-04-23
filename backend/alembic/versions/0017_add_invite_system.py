"""add invite system — brokerages, user roles, invites

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-16

Creates:
  - brokerages table
  - invites table
  - users.role column (broker | agent), default 'broker'
  - users.brokerage_id FK column

Backfill:
  - For every existing user, create a Brokerage row from their brokerage_name
    (or email prefix if brokerage_name is null), then point user.brokerage_id at it.
  - Set role = 'broker' for all existing users.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── 1. Create brokerages table ────────────────────────────────────────────
    op.create_table(
        "brokerages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_brokerages_id", "brokerages", ["id"], unique=False)

    # ── 2. Add role + brokerage_id to users ───────────────────────────────────
    op.add_column(
        "users",
        sa.Column(
            "role",
            sa.String(20),
            nullable=False,
            server_default="broker",
        ),
    )
    op.add_column(
        "users",
        sa.Column("brokerage_id", sa.Integer(), nullable=True),
    )

    # ── 3. Backfill: create one Brokerage per existing user ───────────────────
    # Use raw SQL so we can read + insert in one migration without ORM models.
    conn = op.get_bind()

    users = conn.execute(
        sa.text("SELECT id, email, brokerage_name FROM users ORDER BY id")
    ).fetchall()

    for user_id, email, brokerage_name in users:
        name = brokerage_name if brokerage_name else email.split("@")[0].title() + " Realty"
        result = conn.execute(
            sa.text(
                "INSERT INTO brokerages (name) VALUES (:name) RETURNING id"
            ),
            {"name": name},
        )
        brokerage_id = result.fetchone()[0]
        conn.execute(
            sa.text(
                "UPDATE users SET brokerage_id = :bid, role = 'broker' WHERE id = :uid"
            ),
            {"bid": brokerage_id, "uid": user_id},
        )

    # ── 4. Add FK constraint + index on users.brokerage_id ───────────────────
    op.create_foreign_key(
        "fk_users_brokerage_id",
        "users",
        "brokerages",
        ["brokerage_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_users_brokerage_id", "users", ["brokerage_id"], unique=False)

    # ── 5. Create invites table ───────────────────────────────────────────────
    op.create_table(
        "invites",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("token", sa.String(64), nullable=False),
        sa.Column("brokerage_id", sa.Integer(), nullable=False),
        sa.Column("invited_by_id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(255), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("used", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("used_by_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("token", name="uq_invites_token"),
        sa.ForeignKeyConstraint(
            ["brokerage_id"], ["brokerages.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["invited_by_id"], ["users.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["used_by_id"], ["users.id"], ondelete="SET NULL"
        ),
    )
    op.create_index("ix_invites_id", "invites", ["id"], unique=False)
    op.create_index("ix_invites_token", "invites", ["token"], unique=True)
    op.create_index("ix_invites_brokerage_id", "invites", ["brokerage_id"], unique=False)


def downgrade() -> None:
    op.drop_table("invites")
    op.drop_constraint("fk_users_brokerage_id", "users", type_="foreignkey")
    op.drop_index("ix_users_brokerage_id", table_name="users")
    op.drop_column("users", "brokerage_id")
    op.drop_column("users", "role")
    op.drop_table("brokerages")
