"""add_portfolio_entity

This migration adds the Portfolio entity to the database schema and establishes
the relationship between Portfolio and Program entities.

Key changes:
1. Create portfolios table with all required fields
2. Add portfolio_id foreign key to programs table
3. Create default portfolio and assign all existing programs to it
4. Add indexes for performance

Revision ID: 847b37d80156
Revises: 92023c163a26
Create Date: 2026-02-04 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import date, datetime
from app.models.base import GUID
import uuid


# revision identifiers, used by Alembic.
revision = '847b37d80156'
down_revision = '92023c163a26'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add Portfolio entity and establish Portfolio-Program relationship.
    
    Steps:
    1. Create portfolios table
    2. Add portfolio_id to programs table (nullable initially)
    3. Create default portfolio
    4. Assign all existing programs to default portfolio
    5. Make portfolio_id non-nullable
    6. Add foreign key constraint
    7. Create indexes
    """
    connection = op.get_bind()
    
    # Step 1: Create portfolios table
    op.create_table(
        'portfolios',
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.String(1000), nullable=False),
        sa.Column('owner', sa.String(255), nullable=False),
        sa.Column('reporting_start_date', sa.Date(), nullable=False),
        sa.Column('reporting_end_date', sa.Date(), nullable=False),
        sa.Column('id', GUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.CheckConstraint('reporting_start_date < reporting_end_date', name='check_portfolio_dates'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_portfolios_id'), 'portfolios', ['id'], unique=False)
    op.create_index(op.f('ix_portfolios_name'), 'portfolios', ['name'], unique=False)
    
    # Step 2: Add portfolio_id to programs table (nullable initially for data migration)
    op.add_column('programs', sa.Column('portfolio_id', GUID(), nullable=True))
    
    # Step 3: Create default portfolio
    default_portfolio_id = str(uuid.uuid4())
    connection.execute(
        sa.text("""
            INSERT INTO portfolios (id, name, description, owner, reporting_start_date, reporting_end_date, created_at, updated_at)
            VALUES (:id, :name, :description, :owner, :start_date, :end_date, :created_at, :updated_at)
        """),
        {
            "id": default_portfolio_id,
            "name": "Default Portfolio",
            "description": "Default portfolio for existing programs",
            "owner": "System",
            "start_date": date(2024, 1, 1),
            "end_date": date(2024, 12, 31),
            "created_at": datetime.now(),
            "updated_at": datetime.now()
        }
    )
    
    # Step 4: Assign all existing programs to default portfolio
    connection.execute(
        sa.text("""
            UPDATE programs
            SET portfolio_id = :portfolio_id
            WHERE portfolio_id IS NULL
        """),
        {"portfolio_id": default_portfolio_id}
    )
    
    # Step 5: Make portfolio_id non-nullable
    op.alter_column('programs', 'portfolio_id', nullable=False)
    
    # Step 6: Add foreign key constraint
    op.create_foreign_key(
        'programs_portfolio_id_fkey',
        'programs', 'portfolios',
        ['portfolio_id'], ['id']
    )
    
    # Step 7: Create index on portfolio_id
    op.create_index(op.f('ix_programs_portfolio_id'), 'programs', ['portfolio_id'], unique=False)


def downgrade() -> None:
    """
    Rollback migration: remove Portfolio entity and relationship.
    
    Steps:
    1. Drop foreign key constraint
    2. Drop index on portfolio_id
    3. Drop portfolio_id column from programs
    4. Drop portfolios table
    """
    # Step 1: Drop foreign key constraint
    op.drop_constraint('programs_portfolio_id_fkey', 'programs', type_='foreignkey')
    
    # Step 2: Drop index
    op.drop_index(op.f('ix_programs_portfolio_id'), 'programs')
    
    # Step 3: Drop portfolio_id column
    op.drop_column('programs', 'portfolio_id')
    
    # Step 4: Drop portfolios table
    op.drop_index(op.f('ix_portfolios_name'), 'portfolios')
    op.drop_index(op.f('ix_portfolios_id'), 'portfolios')
    op.drop_table('portfolios')
