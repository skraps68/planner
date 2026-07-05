"""add_version_column_to_audit_logs

The AuditLog model inherits from BaseModel, which declares a `version`
column and configures it as the SQLAlchemy `version_id_col`. The prior
optimistic locking migration (ceaed8172152) intentionally skipped
audit_logs since audit entries are immutable, but the ORM model still
expects the column to exist on every INSERT, causing
"column \"version\" of relation \"audit_logs\" does not exist" errors
on any audit-logged write (user create/update/delete, role changes, etc).

Revision ID: 35744cbabc7e
Revises: ceaed8172152
Create Date: 2026-06-11 09:20:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '35744cbabc7e'
down_revision = 'ceaed8172152'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'audit_logs',
        sa.Column('version', sa.Integer(), nullable=False, server_default='1')
    )


def downgrade() -> None:
    op.drop_column('audit_logs', 'version')
