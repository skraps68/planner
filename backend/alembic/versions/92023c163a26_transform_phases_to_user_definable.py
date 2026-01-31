"""transform_phases_to_user_definable

This migration transforms project phases from a fixed enum-based system (Planning/Execution)
to a flexible, user-definable timeline management system.

Key changes:
1. Add name, start_date, end_date, description fields to project_phases
2. Migrate existing Planning/Execution phases to user-defined phases with dates
3. Remove project_phase_id from resource_assignments (use date-based implicit relationships)
4. Remove phase_type enum field from project_phases

Revision ID: 92023c163a26
Revises: 976e6adbac6f
Create Date: 2026-01-31 04:11:11.059198

"""
from alembic import op
import sqlalchemy as sa
from datetime import timedelta
from app.models.base import GUID


# revision identifiers, used by Alembic.
revision = '92023c163a26'
down_revision = '976e6adbac6f'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Transform phases from enum-based to user-definable.
    
    Steps:
    1. Add new columns to project_phases (nullable initially)
    2. Migrate existing data (convert Planning/Execution to user-defined phases with dates)
    3. Make new columns non-nullable
    4. Remove phase_type column
    5. Remove project_phase_id from resource_assignments
    """
    connection = op.get_bind()
    
    # Step 1: Add new columns to project_phases (nullable for data migration)
    op.add_column('project_phases', sa.Column('name', sa.String(100), nullable=True))
    op.add_column('project_phases', sa.Column('start_date', sa.Date(), nullable=True))
    op.add_column('project_phases', sa.Column('end_date', sa.Date(), nullable=True))
    op.add_column('project_phases', sa.Column('description', sa.String(500), nullable=True))
    
    # Add indexes for date columns
    op.create_index('ix_project_phases_start_date', 'project_phases', ['start_date'])
    op.create_index('ix_project_phases_end_date', 'project_phases', ['end_date'])
    
    # Step 2: Migrate existing data
    # Get all projects with their phases
    projects = connection.execute(
        sa.text("SELECT id, start_date, end_date FROM projects")
    ).fetchall()
    
    for project in projects:
        project_id = project.id
        project_start = project.start_date
        project_end = project.end_date
        
        # Get planning and execution phases for this project
        planning_phase = connection.execute(
            sa.text("""
                SELECT id FROM project_phases 
                WHERE project_id = :project_id AND phase_type = 'PLANNING'
            """),
            {"project_id": project_id}
        ).fetchone()
        
        execution_phase = connection.execute(
            sa.text("""
                SELECT id FROM project_phases 
                WHERE project_id = :project_id AND phase_type = 'EXECUTION'
            """),
            {"project_id": project_id}
        ).fetchone()
        
        if planning_phase and execution_phase:
            # Both phases exist - split project duration at midpoint
            total_days = (project_end - project_start).days
            midpoint = project_start + timedelta(days=total_days // 2)
            
            # Update planning phase
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Planning', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": str(planning_phase.id),
                    "start_date": project_start,
                    "end_date": midpoint
                }
            )
            
            # Update execution phase
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Execution', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": str(execution_phase.id),
                    "start_date": midpoint + timedelta(days=1),
                    "end_date": project_end
                }
            )
        elif planning_phase:
            # Only planning phase exists - use entire project duration
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Planning', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": str(planning_phase.id),
                    "start_date": project_start,
                    "end_date": project_end
                }
            )
        elif execution_phase:
            # Only execution phase exists - use entire project duration
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Execution', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": str(execution_phase.id),
                    "start_date": project_start,
                    "end_date": project_end
                }
            )
    
    # Step 3: Make new columns non-nullable
    op.alter_column('project_phases', 'name', nullable=False)
    op.alter_column('project_phases', 'start_date', nullable=False)
    op.alter_column('project_phases', 'end_date', nullable=False)
    
    # Add check constraint for date ordering
    op.create_check_constraint(
        'check_phase_dates',
        'project_phases',
        'start_date <= end_date'
    )
    
    # Step 4: Remove phase_type column
    op.drop_column('project_phases', 'phase_type')
    
    # Step 5: Remove project_phase_id from resource_assignments
    # Drop foreign key constraint first
    op.drop_constraint(
        'resource_assignments_project_phase_id_fkey',
        'resource_assignments',
        type_='foreignkey'
    )
    
    # Drop index
    op.drop_index('ix_resource_assignments_project_phase_id', 'resource_assignments')
    
    # Drop column
    op.drop_column('resource_assignments', 'project_phase_id')
    
    # Verification: Log counts for validation
    phase_count = connection.execute(
        sa.text("SELECT COUNT(*) FROM project_phases WHERE name IS NULL OR start_date IS NULL OR end_date IS NULL")
    ).scalar()
    
    if phase_count > 0:
        raise Exception(f"Migration verification failed: {phase_count} phases have NULL required fields")


def downgrade() -> None:
    """
    Rollback migration: restore enum-based phase system.
    
    Steps:
    1. Re-add project_phase_id to resource_assignments
    2. Populate project_phase_id based on assignment_date
    3. Re-add phase_type column
    4. Populate phase_type from name
    5. Remove new columns from project_phases
    """
    connection = op.get_bind()
    
    # Step 1: Re-add project_phase_id to resource_assignments
    op.add_column('resource_assignments', 
        sa.Column('project_phase_id', GUID(), nullable=True)
    )
    op.create_index('ix_resource_assignments_project_phase_id', 
        'resource_assignments', ['project_phase_id']
    )
    
    # Step 2: Populate project_phase_id based on assignment_date
    assignments = connection.execute(
        sa.text("""
            SELECT id, project_id, assignment_date 
            FROM resource_assignments
        """)
    ).fetchall()
    
    unmatched_count = 0
    for assignment in assignments:
        # Find phase that contains this assignment date
        phase = connection.execute(
            sa.text("""
                SELECT id FROM project_phases
                WHERE project_id = :project_id
                AND start_date <= :assignment_date
                AND end_date >= :assignment_date
                LIMIT 1
            """),
            {
                "project_id": str(assignment.project_id),
                "assignment_date": assignment.assignment_date
            }
        ).fetchone()
        
        if phase:
            connection.execute(
                sa.text("""
                    UPDATE resource_assignments
                    SET project_phase_id = :phase_id
                    WHERE id = :assignment_id
                """),
                {
                    "phase_id": str(phase.id),
                    "assignment_id": str(assignment.id)
                }
            )
        else:
            # Assignment doesn't fall within any phase - assign to first phase
            unmatched_count += 1
            first_phase = connection.execute(
                sa.text("""
                    SELECT id FROM project_phases
                    WHERE project_id = :project_id
                    ORDER BY start_date
                    LIMIT 1
                """),
                {"project_id": str(assignment.project_id)}
            ).fetchone()
            
            if first_phase:
                connection.execute(
                    sa.text("""
                        UPDATE resource_assignments
                        SET project_phase_id = :phase_id
                        WHERE id = :assignment_id
                    """),
                    {
                        "phase_id": str(first_phase.id),
                        "assignment_id": str(assignment.id)
                    }
                )
    
    if unmatched_count > 0:
        print(f"Warning: {unmatched_count} assignments were outside phase date ranges and assigned to first phase")
    
    # Make project_phase_id non-nullable
    op.alter_column('resource_assignments', 'project_phase_id', nullable=False)
    
    # Re-add foreign key
    op.create_foreign_key(
        'resource_assignments_project_phase_id_fkey',
        'resource_assignments', 'project_phases',
        ['project_phase_id'], ['id']
    )
    
    # Step 3: Re-add phase_type column
    op.add_column('project_phases', 
        sa.Column('phase_type', sa.String(), nullable=True)
    )
    
    # Step 4: Populate phase_type from name
    connection.execute(
        sa.text("""
            UPDATE project_phases
            SET phase_type = CASE
                WHEN LOWER(name) LIKE '%planning%' THEN 'PLANNING'
                ELSE 'EXECUTION'
            END
        """)
    )
    
    op.alter_column('project_phases', 'phase_type', nullable=False)
    
    # Step 5: Drop check constraint and new columns
    op.drop_constraint('check_phase_dates', 'project_phases')
    
    op.drop_index('ix_project_phases_end_date', 'project_phases')
    op.drop_index('ix_project_phases_start_date', 'project_phases')
    
    op.drop_column('project_phases', 'description')
    op.drop_column('project_phases', 'end_date')
    op.drop_column('project_phases', 'start_date')
    op.drop_column('project_phases', 'name')