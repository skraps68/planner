"""add user settings

Revision ID: 6b947a2d15dc
Revises: c0570e17c0de
"""
from alembic import op
import sqlalchemy as sa

from app.models.base import GUID, JSON


revision = "6b947a2d15dc"
down_revision = "c0570e17c0de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_settings",
        sa.Column("user_id", GUID(), nullable=False),
        sa.Column("settings_schema_version", sa.Integer(), server_default="1", nullable=False),
        sa.Column("settings", JSON(), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("id", GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )
    op.create_index("ix_user_settings_id", "user_settings", ["id"])
    op.create_index("ix_user_settings_user_id", "user_settings", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_settings_user_id", table_name="user_settings")
    op.drop_index("ix_user_settings_id", table_name="user_settings")
    op.drop_table("user_settings")
