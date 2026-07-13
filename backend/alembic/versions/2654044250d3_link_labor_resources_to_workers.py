"""link labor resources to workers

Revision ID: 2654044250d3
Revises: 7eda5195e204
Create Date: 2026-07-11 12:41:34.236303

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '2654044250d3'
down_revision = '7eda5195e204'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Nullable column first
    op.add_column("resources", sa.Column("worker_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True))
    op.create_foreign_key("fk_resources_worker_id", "resources", "workers", ["worker_id"], ["id"])

    conn = op.get_bind()

    # 2. Backfill LABOR resources by exact name match
    conn.execute(sa.text(
        "UPDATE resources r SET worker_id = w.id "
        "FROM workers w WHERE r.resource_type = 'LABOR' AND r.name = w.name"
    ))

    # 3. Purge LABOR resources with no matching worker, dependency-first,
    #    printing what was removed (user-approved strict consistency)
    orphans = conn.execute(sa.text(
        "SELECT id, name FROM resources WHERE resource_type = 'LABOR' AND worker_id IS NULL"
    )).fetchall()
    for rid, name in orphans:
        n_act = conn.execute(sa.text(
            "DELETE FROM actuals WHERE resource_assignment_id IN "
            "(SELECT id FROM resource_assignments WHERE resource_id = :rid)"
        ), {"rid": str(rid)}).rowcount
        n_asg = conn.execute(sa.text(
            "DELETE FROM resource_assignments WHERE resource_id = :rid"
        ), {"rid": str(rid)}).rowcount
        conn.execute(sa.text("DELETE FROM resources WHERE id = :rid"), {"rid": str(rid)})
        print(f"purged unlinked labor resource '{name}' ({rid}): {n_asg} assignment(s), {n_act} actual(s)")

    # 4. Tighten: conditional NOT NULL via CHECK + one-resource-per-worker
    op.create_check_constraint(
        "ck_resources_labor_worker",
        "resources",
        "(resource_type = 'LABOR' AND worker_id IS NOT NULL) OR "
        "(resource_type = 'NON_LABOR' AND worker_id IS NULL)",
    )
    op.create_index("ix_resources_worker_id", "resources", ["worker_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_resources_worker_id", table_name="resources")
    op.drop_constraint("ck_resources_labor_worker", "resources", type_="check")
    op.drop_constraint("fk_resources_worker_id", "resources", type_="foreignkey")
    op.drop_column("resources", "worker_id")
