"""add_version_columns_for_optimistic_locking

This migration adds version columns to all user-editable entities for optimistic locking
concurrency control. The version column is used to detect concurrent modifications and
prevent silent data loss when multiple users edit the same entity simultaneously.

Key changes:
1. Add version column (INTEGER NOT NULL DEFAULT 1) to all 13 user-editable entity tables
2. Initialize existing rows with version=1
3. Ensure migration works on both PostgreSQL and SQLite

Affected tables:
- portfolios
- programs
- projects
- project_phases
- resources
- worker_types
- workers
- resource_assignments
- rates
- actuals
- users
- user_roles
- scope_assignments

Revision ID: ceaed8172152
Revises: 7c6a22c3f524
Create Date: 2026-02-13 09:44:39.313937

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ceaed8172152'
down_revision = '7c6a22c3f524'
branch_labels = None
depends_on = None


# List of all user-editable entity tables that need version columns
USER_EDITABLE_TABLES = [
    'portfolios',
    'programs',
    'projects',
    'project_phases',
    'resources',
    'worker_types',
    'workers',
    'resource_assignments',
    'rates',
    'actuals',
    'users',
    'user_roles',
    'scope_assignments',
]


def upgrade() -> None:
    """
    Add version column to all user-editable entity tables.
    
    Steps:
    1. Add version column as INTEGER NOT NULL DEFAULT 1 to each table
    2. Existing rows automatically get version=1 due to DEFAULT constraint
    
    The version column will be used by SQLAlchemy's version_id_col feature
    to automatically increment on updates and detect concurrent modifications.
    """
    connection = op.get_bind()
    
    # Add version column to all user-editable tables
    for table_name in USER_EDITABLE_TABLES:
        op.add_column(
            table_name,
            sa.Column('version', sa.Integer(), nullable=False, server_default='1')
        )
    
    # Verification: Ensure all tables have the version column
    for table_name in USER_EDITABLE_TABLES:
        result = connection.execute(
            sa.text(f"SELECT COUNT(*) FROM {table_name} WHERE version IS NULL")
        ).scalar()
        
        if result > 0:
            raise Exception(
                f"Migration verification failed: {result} rows in {table_name} have NULL version"
            )


def downgrade() -> None:
    """
    Rollback migration: remove version columns from all tables.
    
    This allows rolling back the optimistic locking feature if needed.
    """
    # Remove version column from all user-editable tables
    for table_name in USER_EDITABLE_TABLES:
        op.drop_column(table_name, 'version')