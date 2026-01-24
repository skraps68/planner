"""add_scope_performance_indexes

Revision ID: 976e6adbac6f
Revises: 540d8be25367
Create Date: 2026-01-24 10:44:46.384301

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '976e6adbac6f'
down_revision = '540d8be25367'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add composite indexes for scope-based query performance optimization."""
    
    # Composite index for user role lookups with active status
    op.create_index(
        'ix_user_roles_user_active',
        'user_roles',
        ['user_id', 'is_active'],
        unique=False
    )
    
    # Composite index for scope assignment lookups with active status
    op.create_index(
        'ix_scope_assignments_role_active',
        'scope_assignments',
        ['user_role_id', 'is_active'],
        unique=False
    )
    
    # Composite index for scope assignments by program and active status
    op.create_index(
        'ix_scope_assignments_program_active',
        'scope_assignments',
        ['program_id', 'is_active'],
        unique=False
    )
    
    # Composite index for scope assignments by project and active status
    op.create_index(
        'ix_scope_assignments_project_active',
        'scope_assignments',
        ['project_id', 'is_active'],
        unique=False
    )
    
    # Composite index for resource assignments by resource and date
    op.create_index(
        'ix_resource_assignments_resource_date',
        'resource_assignments',
        ['resource_id', 'assignment_date'],
        unique=False
    )
    
    # Composite index for resource assignments by project and date
    op.create_index(
        'ix_resource_assignments_project_date',
        'resource_assignments',
        ['project_id', 'assignment_date'],
        unique=False
    )
    
    # Composite index for actuals by worker and date (for allocation validation)
    op.create_index(
        'ix_actuals_worker_date',
        'actuals',
        ['external_worker_id', 'actual_date'],
        unique=False
    )
    
    # Composite index for actuals by project and date
    op.create_index(
        'ix_actuals_project_date',
        'actuals',
        ['project_id', 'actual_date'],
        unique=False
    )
    
    # Composite index for rates temporal queries
    op.create_index(
        'ix_rates_worker_type_dates',
        'rates',
        ['worker_type_id', 'start_date', 'end_date'],
        unique=False
    )
    
    # Composite index for audit logs by entity
    op.create_index(
        'ix_audit_logs_entity',
        'audit_logs',
        ['entity_type', 'entity_id', 'created_at'],
        unique=False
    )


def downgrade() -> None:
    """Remove composite indexes for scope-based query performance optimization."""
    
    # Drop all composite indexes in reverse order
    op.drop_index('ix_audit_logs_entity', table_name='audit_logs')
    op.drop_index('ix_rates_worker_type_dates', table_name='rates')
    op.drop_index('ix_actuals_project_date', table_name='actuals')
    op.drop_index('ix_actuals_worker_date', table_name='actuals')
    op.drop_index('ix_resource_assignments_project_date', table_name='resource_assignments')
    op.drop_index('ix_resource_assignments_resource_date', table_name='resource_assignments')
    op.drop_index('ix_scope_assignments_project_active', table_name='scope_assignments')
    op.drop_index('ix_scope_assignments_program_active', table_name='scope_assignments')
    op.drop_index('ix_scope_assignments_role_active', table_name='scope_assignments')
    op.drop_index('ix_user_roles_user_active', table_name='user_roles')