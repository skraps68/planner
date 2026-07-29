"""add actuals completeness context and immutable temporal capture

Revision ID: f4a8c2d190b1
Revises: e41c8f2a7b10
"""
from alembic import op
import sqlalchemy as sa

from app.models.base import GUID, JSON


revision = "f4a8c2d190b1"
down_revision = "e41c8f2a7b10"
branch_labels = None
depends_on = None


def _base_columns():
    return [
        sa.Column("id", GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    ]


def upgrade() -> None:
    op.create_table(
        "actual_import_batches",
        sa.Column("source_type", sa.String(length=20), nullable=False),
        sa.Column("actuals_through_date", sa.Date(), nullable=False),
        sa.Column("file_name", sa.String(length=255), nullable=True),
        sa.Column("imported_by_user_id", GUID(), nullable=True),
        sa.Column("transaction_id", GUID(), nullable=False),
        sa.Column("record_count", sa.Integer(), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["imported_by_user_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("transaction_id"),
    )
    for column in (
        "id",
        "source_type",
        "actuals_through_date",
        "imported_by_user_id",
        "transaction_id",
    ):
        op.create_index(
            f"ix_actual_import_batches_{column}",
            "actual_import_batches",
            [column],
        )

    op.add_column("actuals", sa.Column("import_batch_id", GUID(), nullable=True))
    op.create_foreign_key(
        "fk_actuals_import_batch_id",
        "actuals",
        "actual_import_batches",
        ["import_batch_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_actuals_import_batch_id",
        "actuals",
        ["import_batch_id"],
    )

    op.create_table(
        "entity_revisions",
        sa.Column("entity_type", sa.String(length=100), nullable=False),
        sa.Column("entity_id", GUID(), nullable=False),
        sa.Column("entity_version", sa.Integer(), nullable=False),
        sa.Column("operation", sa.String(length=20), nullable=False),
        sa.Column("snapshot", JSON(), nullable=False),
        sa.Column("effective_from", sa.Date(), nullable=True),
        sa.Column("effective_to", sa.Date(), nullable=True),
        sa.Column("recorded_at", sa.DateTime(), nullable=False),
        sa.Column("actor_id", GUID(), nullable=True),
        sa.Column("transaction_id", GUID(), nullable=False),
        sa.Column(
            "is_tombstone",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["actor_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
    )
    for column in (
        "id",
        "entity_type",
        "entity_id",
        "operation",
        "effective_from",
        "effective_to",
        "recorded_at",
        "actor_id",
        "transaction_id",
    ):
        op.create_index(
            f"ix_entity_revisions_{column}",
            "entity_revisions",
            [column],
        )
    op.create_index(
        "ix_entity_revisions_entity_recorded",
        "entity_revisions",
        ["entity_type", "entity_id", "recorded_at"],
    )

    # PostgreSQL can seed full row snapshots without enumerating fields. This
    # marks the honest history boundary: state before this migration is not
    # reconstructed, while the current state and every later change are.
    connection = op.get_bind()
    if connection.dialect.name == "postgresql":
        seed_transaction = "00000000-0000-0000-0000-000000000001"
        tables = {
            "projects": ("start_date", "end_date"),
            "project_phases": ("start_date", "end_date"),
            "resources": ("NULL::date", "NULL::date"),
            "workers": ("NULL::date", "NULL::date"),
            "worker_types": ("NULL::date", "NULL::date"),
            "resource_roles": ("NULL::date", "NULL::date"),
            "rates": ("start_date", "end_date"),
            "resource_assignments": ("assignment_date", "assignment_date"),
            "nonlabor_plan_lines": ("schedule_start", "schedule_end"),
            "nonlabor_plan_occurrences": ("occurrence_date", "occurrence_date"),
            "nonlabor_plan_line_references": ("NULL::date", "NULL::date"),
            "resource_external_references": ("NULL::date", "NULL::date"),
            "external_references": ("NULL::date", "NULL::date"),
            "actuals": ("actual_date", "actual_date"),
        }
        for table_name, (effective_from, effective_to) in tables.items():
            connection.execute(sa.text(f"""
                INSERT INTO entity_revisions (
                    id, created_at, updated_at, version,
                    entity_type, entity_id, entity_version, operation,
                    snapshot, effective_from, effective_to, recorded_at,
                    actor_id, transaction_id, is_tombstone
                )
                SELECT
                    md5('temporal-seed:{table_name}:' || source.id::text)::uuid,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 1,
                    '{table_name}', source.id, source.version, 'SEED',
                    to_jsonb(source), {effective_from}, {effective_to},
                    CURRENT_TIMESTAMP, NULL, '{seed_transaction}'::uuid, false
                FROM {table_name} AS source
            """))


def downgrade() -> None:
    op.drop_table("entity_revisions")
    op.drop_index("ix_actuals_import_batch_id", table_name="actuals")
    op.drop_constraint(
        "fk_actuals_import_batch_id",
        "actuals",
        type_="foreignkey",
    )
    op.drop_column("actuals", "import_batch_id")
    op.drop_table("actual_import_batches")
