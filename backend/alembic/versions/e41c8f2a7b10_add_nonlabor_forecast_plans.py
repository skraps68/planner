"""add non-labor forecast plans and external references

Revision ID: e41c8f2a7b10
Revises: 9b2f6a1d3c40
"""
import uuid
from datetime import datetime

from alembic import op
import sqlalchemy as sa

from app.models.base import GUID


revision = "e41c8f2a7b10"
down_revision = "9b2f6a1d3c40"
branch_labels = None
depends_on = None


forecast_basis_enum = sa.Enum("CASH", name="nonlaborforecastbasis")
plan_method_enum = sa.Enum(
    "MANUAL", "STRAIGHT_LINE", name="nonlaborplanmethod"
)
cost_treatment_enum = sa.Enum(
    "CAPITAL", "EXPENSE", name="nonlaborcosttreatment"
)
frequency_enum = sa.Enum(
    "DAILY", "MONTHLY", "YEARLY", name="nonlaborfrequency"
)
placement_enum = sa.Enum(
    "PERIOD_START", "PERIOD_END", name="nonlaborperiodplacement"
)
plan_status_enum = sa.Enum("ACTIVE", "CANCELLED", name="nonlaborplanstatus")
occurrence_source_enum = sa.Enum(
    "MANUAL", "GENERATED", name="nonlaboroccurrencesource"
)


def _base_columns():
    return [
        sa.Column("id", GUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.Column("version", sa.Integer(), server_default="1", nullable=False),
        sa.PrimaryKeyConstraint("id"),
    ]


def upgrade() -> None:
    connection = op.get_bind()
    legacy_count = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM resource_assignments ra
            JOIN resources r ON r.id = ra.resource_id
            WHERE r.resource_type = 'NON_LABOR'
            """
        )
    ).scalar_one()
    if legacy_count:
        raise RuntimeError(
            "Cannot add non-labor forecast plans while percentage-based "
            "assignments exist for non-labor resources "
            f"({legacy_count} row(s)). "
            "Review and remove or manually convert those rows first."
        )

    op.add_column(
        "projects",
        sa.Column(
            "currency_code",
            sa.String(length=3),
            server_default="USD",
            nullable=False,
        ),
    )

    op.create_table(
        "external_reference_types",
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=False),
        sa.Column(
            "is_active",
            sa.Boolean(),
            server_default="true",
            nullable=False,
        ),
        *_base_columns(),
        sa.UniqueConstraint("name"),
    )
    op.create_index(
        "ix_external_reference_types_id",
        "external_reference_types",
        ["id"],
    )
    op.create_index(
        "ix_external_reference_types_name",
        "external_reference_types",
        ["name"],
    )

    op.create_table(
        "external_references",
        sa.Column("reference_type_id", GUID(), nullable=False),
        sa.Column("value", sa.String(length=32), nullable=False),
        sa.Column("normalized_value", sa.String(length=32), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["reference_type_id"],
            ["external_reference_types.id"],
        ),
        sa.UniqueConstraint(
            "reference_type_id",
            "normalized_value",
            name="uq_external_reference_type_value",
        ),
    )
    op.create_index(
        "ix_external_references_id",
        "external_references",
        ["id"],
    )
    op.create_index(
        "ix_external_references_reference_type_id",
        "external_references",
        ["reference_type_id"],
    )
    op.create_index(
        "ix_external_references_normalized_value",
        "external_references",
        ["normalized_value"],
    )

    op.create_table(
        "nonlabor_plan_lines",
        sa.Column("project_id", GUID(), nullable=False),
        sa.Column("resource_id", GUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.String(length=1000), nullable=True),
        sa.Column("forecast_basis", forecast_basis_enum, nullable=False),
        sa.Column("method", plan_method_enum, nullable=False),
        sa.Column("cost_treatment", cost_treatment_enum, nullable=False),
        sa.Column(
            "currency_code",
            sa.String(length=3),
            server_default="USD",
            nullable=False,
        ),
        sa.Column(
            "total_amount",
            sa.Numeric(precision=19, scale=4),
            nullable=False,
        ),
        sa.Column("schedule_start", sa.Date(), nullable=True),
        sa.Column("schedule_end", sa.Date(), nullable=True),
        sa.Column("frequency", frequency_enum, nullable=True),
        sa.Column("period_placement", placement_enum, nullable=True),
        sa.Column("status", plan_status_enum, nullable=False),
        sa.Column("created_by_user_id", GUID(), nullable=True),
        sa.Column("updated_by_user_id", GUID(), nullable=True),
        *_base_columns(),
        sa.CheckConstraint(
            "total_amount >= 0",
            name="check_nonlabor_plan_total_nonnegative",
        ),
        sa.CheckConstraint(
            "(method = 'MANUAL') OR "
            "(schedule_start IS NOT NULL AND schedule_end IS NOT NULL "
            "AND frequency IS NOT NULL AND period_placement IS NOT NULL)",
            name="check_nonlabor_plan_schedule_fields",
        ),
        sa.CheckConstraint(
            "schedule_start IS NULL OR schedule_end IS NULL OR "
            "schedule_start <= schedule_end",
            name="check_nonlabor_plan_dates",
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["project_id"], ["projects.id"]),
        sa.ForeignKeyConstraint(["resource_id"], ["resources.id"]),
        sa.ForeignKeyConstraint(["updated_by_user_id"], ["users.id"]),
    )
    op.create_index(
        "ix_nonlabor_plan_lines_id",
        "nonlabor_plan_lines",
        ["id"],
    )
    op.create_index(
        "ix_nonlabor_plan_lines_project_id",
        "nonlabor_plan_lines",
        ["project_id"],
    )
    op.create_index(
        "ix_nonlabor_plan_lines_resource_id",
        "nonlabor_plan_lines",
        ["resource_id"],
    )

    op.create_table(
        "nonlabor_plan_occurrences",
        sa.Column("plan_line_id", GUID(), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column(
            "base_amount",
            sa.Numeric(precision=19, scale=4),
            nullable=False,
        ),
        sa.Column(
            "override_amount",
            sa.Numeric(precision=19, scale=4),
            nullable=True,
        ),
        sa.Column("source", occurrence_source_enum, nullable=False),
        *_base_columns(),
        sa.CheckConstraint(
            "base_amount >= 0",
            name="check_nonlabor_occurrence_base_nonnegative",
        ),
        sa.CheckConstraint(
            "override_amount IS NULL OR override_amount >= 0",
            name="check_nonlabor_occurrence_override_nonnegative",
        ),
        sa.ForeignKeyConstraint(
            ["plan_line_id"],
            ["nonlabor_plan_lines.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "plan_line_id",
            "occurrence_date",
            name="uq_nonlabor_plan_occurrence_date",
        ),
    )
    op.create_index(
        "ix_nonlabor_plan_occurrences_id",
        "nonlabor_plan_occurrences",
        ["id"],
    )
    op.create_index(
        "ix_nonlabor_plan_occurrences_plan_line_id",
        "nonlabor_plan_occurrences",
        ["plan_line_id"],
    )
    op.create_index(
        "ix_nonlabor_plan_occurrences_occurrence_date",
        "nonlabor_plan_occurrences",
        ["occurrence_date"],
    )

    op.create_table(
        "resource_external_references",
        sa.Column("resource_id", GUID(), nullable=False),
        sa.Column("external_reference_id", GUID(), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["external_reference_id"],
            ["external_references.id"],
        ),
        sa.ForeignKeyConstraint(
            ["resource_id"],
            ["resources.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "resource_id",
            "external_reference_id",
            name="uq_resource_external_reference",
        ),
    )
    op.create_index(
        "ix_resource_external_references_id",
        "resource_external_references",
        ["id"],
    )
    op.create_index(
        "ix_resource_external_references_resource_id",
        "resource_external_references",
        ["resource_id"],
    )
    op.create_index(
        "ix_resource_external_references_external_reference_id",
        "resource_external_references",
        ["external_reference_id"],
    )

    op.create_table(
        "nonlabor_plan_line_references",
        sa.Column("plan_line_id", GUID(), nullable=False),
        sa.Column("external_reference_id", GUID(), nullable=False),
        *_base_columns(),
        sa.ForeignKeyConstraint(
            ["external_reference_id"],
            ["external_references.id"],
        ),
        sa.ForeignKeyConstraint(
            ["plan_line_id"],
            ["nonlabor_plan_lines.id"],
            ondelete="CASCADE",
        ),
        sa.UniqueConstraint(
            "plan_line_id",
            "external_reference_id",
            name="uq_nonlabor_plan_line_reference",
        ),
    )
    op.create_index(
        "ix_nonlabor_plan_line_references_id",
        "nonlabor_plan_line_references",
        ["id"],
    )
    op.create_index(
        "ix_nonlabor_plan_line_references_plan_line_id",
        "nonlabor_plan_line_references",
        ["plan_line_id"],
    )
    op.create_index(
        "ix_nonlabor_plan_line_references_external_reference_id",
        "nonlabor_plan_line_references",
        ["external_reference_id"],
    )

    reference_types = sa.table(
        "external_reference_types",
        sa.column("id", GUID()),
        sa.column("name", sa.String()),
        sa.column("description", sa.String()),
        sa.column("is_active", sa.Boolean()),
        sa.column("created_at", sa.DateTime()),
        sa.column("updated_at", sa.DateTime()),
        sa.column("version", sa.Integer()),
    )
    seeded_at = datetime.utcnow()
    op.bulk_insert(
        reference_types,
        [
            {
                "id": uuid.uuid4(),
                "name": "Contract ID",
                "description": "Vendor or service contract identifier",
                "is_active": True,
                "created_at": seeded_at,
                "updated_at": seeded_at,
                "version": 1,
            },
            {
                "id": uuid.uuid4(),
                "name": "Engagement ID",
                "description": "Consulting engagement identifier",
                "is_active": True,
                "created_at": seeded_at,
                "updated_at": seeded_at,
                "version": 1,
            },
            {
                "id": uuid.uuid4(),
                "name": "SOW ID",
                "description": "Statement of work identifier",
                "is_active": True,
                "created_at": seeded_at,
                "updated_at": seeded_at,
                "version": 1,
            },
        ],
    )


def downgrade() -> None:
    op.drop_table("nonlabor_plan_line_references")
    op.drop_table("resource_external_references")
    op.drop_table("nonlabor_plan_occurrences")
    op.drop_table("nonlabor_plan_lines")
    op.drop_table("external_references")
    op.drop_table("external_reference_types")
    op.drop_column("projects", "currency_code")

    occurrence_source_enum.drop(op.get_bind(), checkfirst=True)
    plan_status_enum.drop(op.get_bind(), checkfirst=True)
    placement_enum.drop(op.get_bind(), checkfirst=True)
    frequency_enum.drop(op.get_bind(), checkfirst=True)
    cost_treatment_enum.drop(op.get_bind(), checkfirst=True)
    plan_method_enum.drop(op.get_bind(), checkfirst=True)
    forecast_basis_enum.drop(op.get_bind(), checkfirst=True)
