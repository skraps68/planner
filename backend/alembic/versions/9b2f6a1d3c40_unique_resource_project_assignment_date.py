"""prevent duplicate resource assignment cells

Revision ID: 9b2f6a1d3c40
Revises: 6b947a2d15dc
"""
from alembic import op
import sqlalchemy as sa


revision = "9b2f6a1d3c40"
down_revision = "6b947a2d15dc"
branch_labels = None
depends_on = None


CONSTRAINT_NAME = "uq_resource_assignments_resource_project_date"


def upgrade() -> None:
    connection = op.get_bind()
    ambiguous_group_count = connection.execute(
        sa.text(
            """
            SELECT COUNT(*)
            FROM (
                SELECT resource_id, project_id, assignment_date
                FROM resource_assignments
                GROUP BY resource_id, project_id, assignment_date
                HAVING COUNT(*) FILTER (
                    WHERE capital_percentage <> 0 OR expense_percentage <> 0
                ) > 1
                AND COUNT(
                    DISTINCT (capital_percentage, expense_percentage)
                ) > 1
            ) AS ambiguous_assignment_groups
            """
        )
    ).scalar_one()

    if ambiguous_group_count:
        raise RuntimeError(
            "Cannot safely consolidate duplicate resource assignments: "
            f"found {ambiguous_group_count} group(s) with conflicting "
            "non-zero allocation values."
        )

    # Legacy data can contain a meaningful allocation plus a later 0/0
    # placeholder, or multiple identical placeholders. Prefer a non-zero row;
    # otherwise retain the most recently updated identical row.
    deleted_duplicate_count = connection.execute(
        sa.text(
            """
            WITH ranked_assignments AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY resource_id, project_id, assignment_date
                        ORDER BY
                            CASE
                                WHEN capital_percentage <> 0
                                  OR expense_percentage <> 0
                                THEN 0
                                ELSE 1
                            END,
                            updated_at DESC,
                            created_at DESC,
                            id DESC
                    ) AS duplicate_rank
                FROM resource_assignments
            )
            DELETE FROM resource_assignments
            WHERE id IN (
                SELECT id
                FROM ranked_assignments
                WHERE duplicate_rank > 1
            )
            """
        )
    ).rowcount
    if deleted_duplicate_count:
        print(
            "consolidated "
            f"{deleted_duplicate_count} duplicate resource assignment row(s)"
        )

    op.create_unique_constraint(
        CONSTRAINT_NAME,
        "resource_assignments",
        ["resource_id", "project_id", "assignment_date"],
    )


def downgrade() -> None:
    op.drop_constraint(
        CONSTRAINT_NAME,
        "resource_assignments",
        type_="unique",
    )
