"""remove_allocation_percentage_from_resource_assignments

This migration removes the allocation_percentage field from resource_assignments
and updates the constraints to support the new conceptual model where capital_percentage
and expense_percentage represent direct time allocations.

Key changes:
1. Drop check_accounting_split constraint (capital + expense = 100)
2. Drop allocation_percentage column
3. Add new check_allocation_sum constraint (capital + expense <= 100)

Revision ID: 7c6a22c3f524
Revises: 847b37d80156
Create Date: 2026-02-08 10:23:15.194570

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '7c6a22c3f524'
down_revision = '847b37d80156'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Remove allocation_percentage and update constraints.
    
    Steps:
    1. Drop check_accounting_split constraint
    2. Drop allocation_percentage column
    3. Add new check_allocation_sum constraint
    """
    connection = op.get_bind()
    
    # Step 1: Drop old constraint (capital + expense = 100)
    op.drop_constraint('check_accounting_split', 'resource_assignments', type_='check')
    
    # Step 2: Drop allocation_percentage column
    op.drop_column('resource_assignments', 'allocation_percentage')
    
    # Step 3: Add new constraint (capital + expense <= 100)
    op.create_check_constraint(
        'check_allocation_sum',
        'resource_assignments',
        'capital_percentage + expense_percentage <= 100'
    )
    
    # Verification: Log counts for validation
    assignment_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM resource_assignments")
    ).scalar()
    
    print(f"Migration completed successfully. {assignment_count} resource assignments migrated.")


def downgrade() -> None:
    """
    Rollback migration: restore allocation_percentage and old constraints.
    
    Steps:
    1. Add allocation_percentage column back (nullable initially)
    2. Populate allocation_percentage from capital + expense
    3. Make allocation_percentage non-nullable
    4. Drop new check_allocation_sum constraint
    5. Add old check_accounting_split constraint back
    """
    connection = op.get_bind()
    
    # Step 1: Add allocation_percentage column back (nullable for data migration)
    op.add_column('resource_assignments',
                 sa.Column('allocation_percentage', sa.Numeric(5, 2), nullable=True))
    
    # Step 2: Populate allocation_percentage from capital + expense
    connection.execute(
        sa.text("""
            UPDATE resource_assignments 
            SET allocation_percentage = capital_percentage + expense_percentage
        """)
    )
    
    # Step 3: Make column non-nullable
    op.alter_column('resource_assignments', 'allocation_percentage', nullable=False)
    
    # Step 4: Drop new constraint (capital + expense <= 100)
    op.drop_constraint('check_allocation_sum', 'resource_assignments', type_='check')
    
    # Step 5: Add old constraint back (capital + expense = 100)
    op.create_check_constraint(
        'check_accounting_split',
        'resource_assignments',
        'capital_percentage + expense_percentage = 100'
    )
    
    # Verification: Log counts for validation
    assignment_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM resource_assignments WHERE allocation_percentage IS NULL")
    ).scalar()
    
    if assignment_count > 0:
        raise Exception(f"Downgrade verification failed: {assignment_count} assignments have NULL allocation_percentage")
    
    print("Downgrade completed successfully. allocation_percentage restored.")