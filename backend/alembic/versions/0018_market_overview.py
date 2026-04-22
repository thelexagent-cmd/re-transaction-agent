"""market overview — watchlist, properties, alerts

Revision ID: 0018
Revises: 0017
Create Date: 2026-04-22

Creates:
  - market_watchlist — ZIP codes Nico watches
  - market_properties — cached listing data per scan
  - market_alerts — fired alert log with deal status
"""

from alembic import op
import sqlalchemy as sa

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_watchlist",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("zip_code", sa.String(10), nullable=False),
        sa.Column("alert_threshold", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("status", sa.String(20), nullable=False, server_default="active"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_scanned_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "zip_code", name="uq_watchlist_user_zip"),
    )
    op.create_index("ix_market_watchlist_id", "market_watchlist", ["id"])
    op.create_index("ix_market_watchlist_user_id", "market_watchlist", ["user_id"])

    op.create_table(
        "market_properties",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("zip_code", sa.String(10), nullable=False),
        sa.Column("zillow_id", sa.String(50), nullable=False),
        sa.Column("address", sa.String(500), nullable=False),
        sa.Column("price", sa.Integer(), nullable=True),
        sa.Column("bedrooms", sa.Integer(), nullable=True),
        sa.Column("bathrooms", sa.Float(), nullable=True),
        sa.Column("living_area", sa.Integer(), nullable=True),
        sa.Column("year_built", sa.Integer(), nullable=True),
        sa.Column("days_on_market", sa.Integer(), nullable=True),
        sa.Column("zestimate", sa.Integer(), nullable=True),
        sa.Column("price_reduction_30d", sa.Integer(), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitude", sa.Float(), nullable=True),
        sa.Column("img_src", sa.String(1000), nullable=True),
        sa.Column("nearest_permit_distance_mi", sa.Float(), nullable=True),
        sa.Column("nearest_permit_type", sa.String(200), nullable=True),
        sa.Column("nearest_permit_date", sa.String(50), nullable=True),
        sa.Column("nearest_permit_address", sa.String(500), nullable=True),
        sa.Column("opportunity_score", sa.Integer(), nullable=True),
        sa.Column("claude_summary", sa.Text(), nullable=True),
        sa.Column("first_seen_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("zillow_id", name="uq_market_properties_zillow_id"),
    )
    op.create_index("ix_market_properties_id", "market_properties", ["id"])
    op.create_index("ix_market_properties_zip_code", "market_properties", ["zip_code"])
    op.create_index("ix_market_properties_zillow_id", "market_properties", ["zillow_id"])

    op.create_table(
        "market_alerts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("property_id", sa.Integer(), nullable=False),
        sa.Column("score_at_alert", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
        sa.Column("alerted_via", sa.String(50), nullable=False, server_default="both"),
        sa.Column("fired_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["property_id"], ["market_properties.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_market_alerts_id", "market_alerts", ["id"])
    op.create_index("ix_market_alerts_user_id", "market_alerts", ["user_id"])
    op.create_index("ix_market_alerts_property_id", "market_alerts", ["property_id"])


def downgrade() -> None:
    op.drop_table("market_alerts")
    op.drop_table("market_properties")
    op.drop_table("market_watchlist")
