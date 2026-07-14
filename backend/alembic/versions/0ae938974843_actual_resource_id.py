"""actual_resource_id

Add Actual.resource_id (labor/non-labor classifier), backfill from
external_worker_id -> workers -> resources (all existing actuals are labor),
make labor-only columns nullable, drop write-only resource_assignment_id.
"""
from alembic import op
import sqlalchemy as sa

revision = '0ae938974843'
down_revision = '527d058114e2'
branch_labels = None
depends_on = None


from app.models.base import GUID  # project's GUID column type (see existing GUID FK migrations)


def upgrade() -> None:
    conn = op.get_bind()
    op.add_column('actuals', sa.Column('resource_id', GUID(), nullable=True))
    conn.execute(sa.text("""
        UPDATE actuals SET resource_id = (
            SELECT r.id FROM resources r
            JOIN workers w ON r.worker_id = w.id
            WHERE w.external_id = actuals.external_worker_id
        )
    """))
    op.alter_column('actuals', 'resource_id', nullable=False)
    op.create_index('ix_actuals_resource_id', 'actuals', ['resource_id'])
    op.create_foreign_key('fk_actuals_resource_id', 'actuals', 'resources', ['resource_id'], ['id'])
    op.alter_column('actuals', 'external_worker_id', nullable=True)
    op.alter_column('actuals', 'worker_name', nullable=True)
    op.alter_column('actuals', 'allocation_percentage', nullable=True)
    op.drop_constraint('check_actual_allocation_percentage', 'actuals', type_='check')
    op.create_check_constraint('check_actual_allocation_percentage', 'actuals',
        'allocation_percentage IS NULL OR (allocation_percentage >= 0 AND allocation_percentage <= 100)')
    # drop write-only assignment link
    op.drop_constraint('actuals_resource_assignment_id_fkey', 'actuals', type_='foreignkey')
    op.drop_index('ix_actuals_resource_assignment_id', table_name='actuals')
    op.drop_column('actuals', 'resource_assignment_id')
    count = conn.execute(sa.text("SELECT COUNT(*) FROM actuals WHERE resource_id IS NULL")).scalar()
    if count:
        raise Exception(f"resource_id backfill failed: {count} actuals unresolved")
    print("actual resource_id migration complete.")


def downgrade() -> None:
    # PRECONDITION: downgrade only supports the all-labor pre-migration state.
    # Restoring NOT NULL on external_worker_id/worker_name/allocation_percentage
    # will fail if non-labor actuals (NULL worker fields) exist — delete or
    # re-classify those rows first. This matches the plan's accepted posture.
    from app.models.base import GUID
    op.add_column('actuals', sa.Column('resource_assignment_id', GUID(), nullable=True))
    op.create_index('ix_actuals_resource_assignment_id', 'actuals', ['resource_assignment_id'])
    op.create_foreign_key('actuals_resource_assignment_id_fkey', 'actuals', 'resource_assignments', ['resource_assignment_id'], ['id'])
    op.alter_column('actuals', 'external_worker_id', nullable=False)
    op.alter_column('actuals', 'worker_name', nullable=False)
    op.alter_column('actuals', 'allocation_percentage', nullable=False)
    op.drop_constraint('fk_actuals_resource_id', 'actuals', type_='foreignkey')
    op.drop_index('ix_actuals_resource_id', table_name='actuals')
    op.drop_column('actuals', 'resource_id')
