"""
Add future resource assignments for Digital Transformation projects.
This script adds assignments from February 2026 onwards to generate forecast data.
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.resource_assignment import ResourceAssignment
from app.models.project import Project
from app.models.resource import Resource
from app.models.project import ProjectPhase


def add_future_assignments():
    """Add future resource assignments for forecast testing."""
    db = SessionLocal()
    
    try:
        print("Adding future resource assignments...")
        
        # Get Digital Transformation projects
        mobile_app = db.query(Project).filter(
            Project.name == "Mobile Application Development"
        ).first()
        
        web_portal = db.query(Project).filter(
            Project.name == "Web Portal Redesign"
        ).first()
        
        if not mobile_app or not web_portal:
            print("ERROR: Could not find Digital Transformation projects")
            return
        
        print(f"Found Mobile App project: {mobile_app.id}")
        print(f"Found Web Portal project: {web_portal.id}")
        
        # Get execution phases
        mobile_exec = db.query(ProjectPhase).filter(
            ProjectPhase.project_id == mobile_app.id
        ).first()
        
        web_exec = db.query(ProjectPhase).filter(
            ProjectPhase.project_id == web_portal.id
        ).first()
        
        if not mobile_exec or not web_exec:
            print("ERROR: Could not find project phases")
            return
        
        # Get some resources (workers)
        resources = db.query(Resource).limit(4).all()
        
        if len(resources) < 4:
            print("ERROR: Not enough resources in database")
            return
        
        print(f"Found {len(resources)} resources")
        
        assignments = []
        
        # Add future assignments for Mobile App (Feb 2026 - May 2026, 120 days)
        start_date = date(2026, 2, 1)
        
        for i in range(120):
            assignment_date = start_date + timedelta(days=i)
            
            # Resource 1 - 80% allocation, 60% capital / 40% expense
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=resources[0].id,
                project_id=mobile_app.id,
                project_phase_id=mobile_exec.id,
                assignment_date=assignment_date,
                allocation_percentage=Decimal("80.00"),
                capital_percentage=Decimal("60.00"),
                expense_percentage=Decimal("40.00")
            ))
            
            # Resource 2 - 60% allocation, 70% capital / 30% expense
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=resources[1].id,
                project_id=mobile_app.id,
                project_phase_id=mobile_exec.id,
                assignment_date=assignment_date,
                allocation_percentage=Decimal("60.00"),
                capital_percentage=Decimal("70.00"),
                expense_percentage=Decimal("30.00")
            ))
        
        # Add future assignments for Web Portal (Feb 2026 - Apr 2026, 90 days)
        for i in range(90):
            assignment_date = start_date + timedelta(days=i)
            
            # Resource 3 - 100% allocation, 50% capital / 50% expense
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=resources[2].id,
                project_id=web_portal.id,
                project_phase_id=web_exec.id,
                assignment_date=assignment_date,
                allocation_percentage=Decimal("100.00"),
                capital_percentage=Decimal("50.00"),
                expense_percentage=Decimal("50.00")
            ))
            
            # Resource 4 - 40% allocation, 80% capital / 20% expense
            assignments.append(ResourceAssignment(
                id=uuid4(),
                resource_id=resources[3].id,
                project_id=web_portal.id,
                project_phase_id=web_exec.id,
                assignment_date=assignment_date,
                allocation_percentage=Decimal("40.00"),
                capital_percentage=Decimal("80.00"),
                expense_percentage=Decimal("20.00")
            ))
        
        # Add all assignments to database
        for assignment in assignments:
            db.add(assignment)
        
        db.commit()
        print(f"✓ Successfully added {len(assignments)} future resource assignments")
        print(f"  - Mobile App: {120 * 2} assignments (Feb-May 2026)")
        print(f"  - Web Portal: {90 * 2} assignments (Feb-Apr 2026)")
        print("\nForecast data should now be visible in the Portfolio Dashboard!")
        
    except Exception as e:
        print(f"ERROR: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    add_future_assignments()
