"""add worker cost_center_code

Adds a required (non-unique) cost center to workers. The server_default
backfills existing rows in this single ALTER and lets direct-ORM
constructions (tests/scripts) omit the field; real requiredness is enforced
by the WorkerCreate schema.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c0570e17c0de'
down_revision = '27f01e1d45e6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "workers",
        sa.Column("cost_center_code", sa.String(50), nullable=False, server_default=sa.text("'CC-0000'")),
    )
    op.create_index("ix_workers_cost_center_code", "workers", ["cost_center_code"])


def downgrade() -> None:
    op.drop_index("ix_workers_cost_center_code", table_name="workers")
    op.drop_column("workers", "cost_center_code")
