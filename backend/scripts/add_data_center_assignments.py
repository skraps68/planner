"""
Add resource assignments to Data Center Consolidation project for forecast data.
"""
import asyncio
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.project import Project
from app.models.resource import Resource, Worker, ResourceType
from app.models.resource_assignment import ResourceAssignment


def add_data_center_assignments(db: Session):
    """Add resource assignments to Data Center Consolidation project."""
    print("Adding resource assignments to Data Center Consolidation project...")
    
    # Find the Data Center Consolidation project
    project = db.execute(
        select(Project).where(Project.name == "Data Center Consolidation")
    ).scalar_one_or_none()
    
    if not project:
        print("Error: Data Center Consolidation project not found!")
        return
    
    print(f"Found project: {project.name} (ID: {project.id})")
    print(f"Project dates: {project.start_date} to {project.end_date}")
    
    # Find workers and their labor resources
    workers_data = [
        ("John Smith", "EMP001"),
        ("Jane Doe", "EMP002"),
        ("Bob Johnson", "EMP003"),
        ("Alice Williams", "EMP004"),
    ]
    
    labor_resources = {}
    for worker_name, external_id in workers_data:
        worker = db.execute(
            select(Worker).where(Worker.external_id == external_id)
        ).scalar_one_or_none()
        
        if worker:
            # Find the labor resource for this worker
            labor_resource = db.execute(
                select(Resource).where(
                    Resource.name == worker_name,
                    Resource.resource_type == ResourceType.LABOR
                )
            ).scalar_one_or_none()
            
            if labor_resource:
                labor_resources[worker_name] = labor_resource
                print(f"Found labor resource for {worker_name}")
    
    if not labor_resources:
        print("Error: No labor resources found!")
        return
    
    assignments = []
    
    # Create assignments for the project timeline (Sep 2024 - Mar 2026)
    # Phase 1: Planning (Sep 2024 - Feb 2025) - 6 months
    start_date = date(2024, 9, 1)
    end_date = date(2025, 2, 28)
    
    print(f"\nCreating Phase 1 assignments (Planning): {start_date} to {end_date}")
    current_date = start_date
    while current_date <= end_date:
        # Jane Doe (Architect) - 80% total (68% capital + 12% expense)
        if "Jane Doe" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["Jane Doe"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("68.00"),
                expense_percentage=Decimal("12.00")
            ))
        
        # John Smith (Senior Engineer) - 50% total (35% capital + 15% expense)
        if "John Smith" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["John Smith"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("35.00"),
                expense_percentage=Decimal("15.00")
            ))
        
        current_date += timedelta(days=1)
    
    # Phase 2: Implementation (Mar 2025 - Dec 2025) - 10 months
    start_date = date(2025, 3, 1)
    end_date = date(2025, 12, 31)
    
    print(f"Creating Phase 2 assignments (Implementation): {start_date} to {end_date}")
    current_date = start_date
    while current_date <= end_date:
        # John Smith (Senior Engineer) - 100% total (90% capital + 10% expense)
        if "John Smith" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["John Smith"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("90.00"),
                expense_percentage=Decimal("10.00")
            ))
        
        # Bob Johnson (Engineer) - 100% total (85% capital + 15% expense)
        if "Bob Johnson" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["Bob Johnson"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("85.00"),
                expense_percentage=Decimal("15.00")
            ))
        
        # Alice Williams (Engineer) - 75% total (60% capital + 15% expense)
        if "Alice Williams" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["Alice Williams"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("60.00"),
                expense_percentage=Decimal("15.00")
            ))
        
        current_date += timedelta(days=1)
    
    # Phase 3: Testing & Cutover (Jan 2026 - Mar 2026) - 3 months
    start_date = date(2026, 1, 1)
    end_date = date(2026, 3, 31)
    
    print(f"Creating Phase 3 assignments (Testing & Cutover): {start_date} to {end_date}")
    current_date = start_date
    while current_date <= end_date:
        # Bob Johnson (Engineer) - 50% total (30% capital + 20% expense)
        if "Bob Johnson" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["Bob Johnson"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("30.00"),
                expense_percentage=Decimal("20.00")
            ))
        
        # Alice Williams (Engineer) - 100% total (50% capital + 50% expense)
        if "Alice Williams" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["Alice Williams"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("50.00"),
                expense_percentage=Decimal("50.00")
            ))
        
        # Jane Doe (Architect) - 25% total (10% capital + 15% expense)
        if "Jane Doe" in labor_resources:
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=labor_resources["Jane Doe"].id,
                project_id=project.id,
                assignment_date=current_date,
                capital_percentage=Decimal("10.00"),
                expense_percentage=Decimal("15.00")
            ))
        
        current_date += timedelta(days=1)
    
    # Add all assignments to database
    print(f"\nAdding {len(assignments)} assignments to database...")
    for assignment in assignments:
        db.add(assignment)
    
    db.commit()
    print(f"Successfully created {len(assignments)} resource assignments for Data Center Consolidation project!")
    
    # Print summary
    print("\nAssignment Summary:")
    print("  Phase 1 (Planning): Sep 2024 - Feb 2025")
    print("    - Jane Doe (Architect): 80% total (68% capital + 12% expense)")
    print("    - John Smith (Senior Engineer): 50% total (35% capital + 15% expense)")
    print("  Phase 2 (Implementation): Mar 2025 - Dec 2025")
    print("    - John Smith: 100% total (90% capital + 10% expense)")
    print("    - Bob Johnson: 100% total (85% capital + 15% expense)")
    print("    - Alice Williams: 75% total (60% capital + 15% expense)")
    print("  Phase 3 (Testing & Cutover): Jan 2026 - Mar 2026")
    print("    - Bob Johnson: 50% total (30% capital + 20% expense)")
    print("    - Alice Williams: 100% total (50% capital + 50% expense)")
    print("    - Jane Doe: 25% total (10% capital + 15% expense)")


def main():
    """Main function."""
    print("=" * 60)
    print("Adding Data Center Consolidation Assignments")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        add_data_center_assignments(db)
        
        print("=" * 60)
        print("Assignment creation completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error creating assignments: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
