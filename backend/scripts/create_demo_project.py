"""
Create a demo project with actuals and forecast data for chart visualization.
- Project starts 2 months ago
- Actuals from start until today
- Forecast from today to 4 months in the future
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
from app.models.program import Program
from app.models.project import Project, ProjectPhase
from app.models.actual import Actual
from app.models.resource_assignment import ResourceAssignment
from app.models.resource import Resource, Worker


def create_demo_project():
    """Create a demo project with actuals and forecast data."""
    db: Session = SessionLocal()
    
    try:
        # Get the Digital Transformation Initiative program
        program = db.query(Program).filter(
            Program.name == "Digital Transformation Initiative"
        ).first()
        
        if not program:
            print("Error: Digital Transformation Initiative program not found")
            return
        
        print(f"Found program: {program.name}")
        
        # Define project dates
        today = date.today()
        start_date = today - timedelta(days=60)  # 2 months ago
        end_date = today + timedelta(days=120)  # 4 months in the future
        
        print(f"Creating project from {start_date} to {end_date}")
        print(f"Today is: {today}")
        
        # Create project
        project = Project(
            id=uuid4(),
            program_id=program.id,
            name="Cloud Infrastructure Modernization",
            business_sponsor="Michael Chen",
            project_manager="Lisa Anderson",
            technical_lead="David Kumar",
            start_date=start_date,
            end_date=end_date,
            cost_center_code="CC-2026-001",
            description="Modernize cloud infrastructure and migrate legacy systems"
        )
        
        db.add(project)
        db.flush()
        
        print(f"Created project: {project.name} (ID: {project.id})")
        
        # Create project phases
        phase_duration = (end_date - start_date).days // 3
        
        phases = [
            ProjectPhase(
                id=uuid4(),
                project_id=project.id,
                name="Planning & Design",
                start_date=start_date,
                end_date=start_date + timedelta(days=phase_duration),
                capital_budget=Decimal('150000.00'),
                expense_budget=Decimal('100000.00'),
                total_budget=Decimal('250000.00'),
                description="Initial planning and architecture design"
            ),
            ProjectPhase(
                id=uuid4(),
                project_id=project.id,
                name="Implementation",
                start_date=start_date + timedelta(days=phase_duration + 1),
                end_date=start_date + timedelta(days=phase_duration * 2),
                capital_budget=Decimal('300000.00'),
                expense_budget=Decimal('150000.00'),
                total_budget=Decimal('450000.00'),
                description="Core implementation and migration"
            ),
            ProjectPhase(
                id=uuid4(),
                project_id=project.id,
                name="Testing & Deployment",
                start_date=start_date + timedelta(days=phase_duration * 2 + 1),
                end_date=end_date,
                capital_budget=Decimal('100000.00'),
                expense_budget=Decimal('100000.00'),
                total_budget=Decimal('200000.00'),
                description="Testing, optimization, and deployment"
            )
        ]
        
        for phase in phases:
            db.add(phase)
        
        db.flush()
        print(f"Created {len(phases)} project phases")
        
        # Get workers for actuals
        workers = db.query(Worker).limit(5).all()
        if not workers:
            print("Error: No workers found")
            return
        
        print(f"Using {len(workers)} workers for actuals")
        
        # Generate actuals from start_date to today
        actuals_created = 0
        current_date = start_date
        
        while current_date <= today:
            # For each worker, generate actuals with some probability
            for worker in workers:
                # 70% chance of having actuals for this worker on this date
                if random.random() < 0.7:
                    # Random allocation between 30% and 100%
                    allocation = Decimal(str(random.randint(30, 100)))
                    
                    # Calculate cost (using a base rate)
                    daily_rate = Decimal(str(random.randint(900, 1300)))
                    actual_cost = (daily_rate * allocation) / Decimal('100')
                    
                    # Split between capital and expense (65/35 split)
                    capital_pct = Decimal('65')
                    
                    capital_amount = ((actual_cost * capital_pct) / Decimal('100')).quantize(Decimal('0.01'))
                    # Calculate expense as remainder to avoid rounding errors
                    expense_amount = actual_cost - capital_amount
                    
                    actual = Actual(
                        id=uuid4(),
                        project_id=project.id,
                        external_worker_id=worker.external_id,
                        worker_name=worker.name,
                        actual_date=current_date,
                        allocation_percentage=allocation,
                        actual_cost=actual_cost,
                        capital_amount=capital_amount,
                        expense_amount=expense_amount
                    )
                    
                    db.add(actual)
                    actuals_created += 1
            
            # Move to next week (7 days)
            current_date += timedelta(days=7)
        
        print(f"Created {actuals_created} actuals records from {start_date} to {today}")
        
        # Get resources for forecast
        resources = db.query(Resource).limit(6).all()
        if not resources:
            print("Error: No resources found")
            return
        
        print(f"Using {len(resources)} resources for forecast")
        
        # Generate forecast from today+1 to end_date
        assignments_created = 0
        current_date = today + timedelta(days=1)
        
        while current_date <= end_date:
            # For each resource, generate assignments with some probability
            for resource in resources:
                # 80% chance of having an assignment for this resource on this date
                if random.random() < 0.8:
                    # Random allocation between 40% and 100%
                    allocation = Decimal(str(random.randint(40, 100)))
                    
                    # Capital/expense split (60/40)
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
        
        print(f"Created {assignments_created} resource assignments from {today + timedelta(days=1)} to {end_date}")
        
        db.commit()
        
        print("\n" + "="*60)
        print("SUCCESS!")
        print("="*60)
        print(f"Project: {project.name}")
        print(f"Project ID: {project.id}")
        print(f"Program: {program.name}")
        print(f"Date Range: {start_date} to {end_date}")
        print(f"Actuals: {actuals_created} records (past data)")
        print(f"Forecast: {assignments_created} assignments (future data)")
        print("\nYou can now view this project in the Financials page!")
        print("="*60)
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    print("Creating demo project with actuals and forecast data...")
    print()
    create_demo_project()
    print("\nDone!")
