"""invite system — add invites table and role/broker_id to users

Revision ID: 0017
Revises: 0016
Create Date: 2026-04-16

"""

from alembic import op
import sqlalchemy as sa

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add role column to users (existing users become brokers)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'broker';
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)

    # Add broker_id self-referential FK on users
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE users ADD COLUMN IF NOT EXISTS broker_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
        EXCEPTION WHEN duplicate_column THEN NULL;
        END $$;
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_users_broker_id ON users (broker_id);
    """)

    # Create invites table
    op.execute("""
        CREATE TABLE IF NOT EXISTS invites (
            id SERIAL PRIMARY KEY,
            token VARCHAR(64) NOT NULL,
            broker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            invitee_email VARCHAR(255),
            used BOOLEAN NOT NULL DEFAULT FALSE,
            used_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        );
    """)
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_invites_token ON invites (token);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invites_broker_id ON invites (broker_id);")
    op.execute("CREATE INDEX IF NOT EXISTS ix_invites_id ON invites (id);")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS invites;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS broker_id;")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS role;")
