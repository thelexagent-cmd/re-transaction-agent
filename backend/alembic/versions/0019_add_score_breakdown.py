"""add score_breakdown column to market_properties

Revision ID: 0019
Revises: 0018
Create Date: 2026-04-27
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        ALTER TABLE market_properties
        ADD COLUMN IF NOT EXISTS score_breakdown JSONB;
    """)


def downgrade() -> None:
    op.execute("ALTER TABLE market_properties DROP COLUMN IF EXISTS score_breakdown;")
