"""
Generate resource assignments (forecast data) for Mobile Application Development project.
This script creates assignments from approximately the middle of the project to the end.
"""
import sys
import os
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4
import random

# Add parent directory to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.project import Project, ProjectPhase
from app.models.resource_assignment import ResourceAssignment
from app.models.resource import Resource


def generate_assignments():
    """Generate resource assignments for Mobile Application Development project."""
    db: Session = SessionLocal()
    
    try:
        # Find the Mobile Application Development project
        project = db.query(Project).filter(
            Project.name == "Mobile Application Development"
        ).first()
        
        if not project:
            print("Error: Mobile Application Development project not found")
            return
        
        print(f"Found project: {project.name}")
        print(f"Project dates: {project.start_date} to {project.end_date}")
        
        # Get project phases
        phases = db.query(ProjectPhase).filter(
            ProjectPhase.project_id == project.id
        ).all()
        
        if not phases:
            print("Error: No project phases found")
            return
        
        print(f"Found {len(phases)} project phases")
        
        # Calculate middle date (where actuals end)
        project_duration = (project.end_date - project.start_date).days
        middle_date = project.start_date + timedelta(days=project_duration // 2)
        
        # Start assignments from middle date + 1 week
        start_date = middle_date + timedelta(days=7)
        
        print(f"Generating assignments from {start_date} to {project.end_date}")
        
        # Get all resources
        resources = db.query(Resource).all()
        if not resources:
            print("Error: No resources found")
            return
        
        print(f"Found {len(resources)} resources")
        
        # Select a subset of resources for this project (4-6 resources)
        num_resources = min(random.randint(4, 6), len(resources))
        project_resources = random.sample(resources, num_resources)
        
        print(f"Using {num_resources} resources for assignments")
        
        # Use the first phase (or any phase that covers the project dates)
        # With user-defined phases, we just pick the first phase
        execution_phase = phases[0] if phases else None
        if not execution_phase:
            print("Error: No phases found for project")
            return
        
        assignments_created = 0
        current_date = start_date
        
        # Generate assignments for each week until project end
        while current_date <= project.end_date:
            # For each resource, generate assignments with some probability
            for resource in project_resources:
                # 80% chance of having an assignment for this resource on this date
                if random.random() < 0.8:
                    # Random allocation between 30% and 100%
                    allocation = Decimal(str(random.randint(30, 100)))
                    
                    # Capital/expense split (60/40 typically)
                    capital_pct = Decimal('60')
                    expense_pct = Decimal('40')
                    
                    assignment = ResourceAssignment(
                        id=uuid4(),
                        resource_id=resource.id,
                        project_id=project.id,
                        assignment_date=current_date,
                        allocation_percentage=allocation,
                        capital_percentage=capital_pct,
                        expense_percentage=expense_pct
                    )
                    
                    db.add(assignment)
                    assignments_created += 1
            
            # Move to next week (7 days)
            current_date += timedelta(days=7)
        
        db.commit()
        print(f"\nSuccessfully created {assignments_created} resource assignment records")
        print(f"Date range: {start_date} to {project.end_date}")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Generating resource assignments for Mobile Application Development project...")
    generate_assignments()
    print("Done!")
