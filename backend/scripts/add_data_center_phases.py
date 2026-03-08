"""
Add phases to Data Center Consolidation project.
"""
from datetime import date
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.project import Project, ProjectPhase


def add_data_center_phases(db: Session):
    """Add phases to Data Center Consolidation project."""
    print("Adding phases to Data Center Consolidation project...")
    
    # Find the Data Center Consolidation project
    project = db.execute(
        select(Project).where(Project.name == "Data Center Consolidation")
    ).scalar_one_or_none()
    
    if not project:
        print("Error: Data Center Consolidation project not found!")
        return
    
    print(f"Found project: {project.name} (ID: {project.id})")
    print(f"Project dates: {project.start_date} to {project.end_date}")
    
    # Delete existing default phase
    existing_phases = db.execute(
        select(ProjectPhase).where(ProjectPhase.project_id == project.id)
    ).scalars().all()
    
    if existing_phases:
        print(f"\nDeleting {len(existing_phases)} existing phase(s)...")
        for phase in existing_phases:
            db.delete(phase)
        db.commit()
    
    # Create three phases
    phases = [
        ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Planning & Assessment",
            start_date=date(2024, 9, 1),
            end_date=date(2025, 2, 28),
            capital_budget=Decimal("200000.00"),
            expense_budget=Decimal("100000.00"),
            total_budget=Decimal("300000.00")
        ),
        ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Implementation & Migration",
            start_date=date(2025, 3, 1),
            end_date=date(2025, 12, 31),
            capital_budget=Decimal("800000.00"),
            expense_budget=Decimal("200000.00"),
            total_budget=Decimal("1000000.00")
        ),
        ProjectPhase(
            id=uuid4(),
            project_id=project.id,
            name="Testing & Cutover",
            start_date=date(2026, 1, 1),
            end_date=date(2026, 3, 31),
            capital_budget=Decimal("150000.00"),
            expense_budget=Decimal("150000.00"),
            total_budget=Decimal("300000.00")
        ),
    ]
    
    print(f"\nCreating {len(phases)} phases...")
    for phase in phases:
        db.add(phase)
        print(f"  - {phase.name}: {phase.start_date} to {phase.end_date}")
        print(f"    Budget: ${phase.total_budget:,.2f} (Capital: ${phase.capital_budget:,.2f}, Expense: ${phase.expense_budget:,.2f})")
    
    db.commit()
    print(f"\nSuccessfully created {len(phases)} phases for Data Center Consolidation project!")


def main():
    """Main function."""
    print("=" * 60)
    print("Adding Data Center Consolidation Phases")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        add_data_center_phases(db)
        
        print("=" * 60)
        print("Phase creation completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error creating phases: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
