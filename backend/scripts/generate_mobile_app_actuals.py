"""
Generate actuals data for Mobile Application Development project.
This script creates actuals from the project start date to approximately the middle of the project.
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
from app.models.project import Project
from app.models.actual import Actual
from app.models.resource import Worker


def generate_actuals():
    """Generate actuals for Mobile Application Development project."""
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
        
        # Calculate middle date
        project_duration = (project.end_date - project.start_date).days
        middle_date = project.start_date + timedelta(days=project_duration // 2)
        
        print(f"Generating actuals from {project.start_date} to {middle_date}")
        
        # Get all workers
        workers = db.query(Worker).all()
        if not workers:
            print("Error: No workers found")
            return
        
        print(f"Found {len(workers)} workers")
        
        # Select a subset of workers for this project (3-5 workers)
        num_workers = min(random.randint(3, 5), len(workers))
        project_workers = random.sample(workers, num_workers)
        
        print(f"Using {num_workers} workers for actuals")
        
        actuals_created = 0
        current_date = project.start_date
        
        # Generate actuals for each week
        while current_date <= middle_date:
            # For each worker, generate actuals with some probability
            for worker in project_workers:
                # 70% chance of having actuals for this worker on this date
                if random.random() < 0.7:
                    # Random allocation between 20% and 100%
                    allocation = Decimal(str(random.randint(20, 100)))
                    
                    # Calculate cost (simplified - using a base rate)
                    # Assuming average daily rate of $800-1200
                    daily_rate = Decimal(str(random.randint(800, 1200)))
                    actual_cost = (daily_rate * allocation) / Decimal('100')
                    
                    # Split between capital and expense (60/40 split typically)
                    capital_pct = Decimal('60')
                    expense_pct = Decimal('40')
                    
                    capital_amount = (actual_cost * capital_pct) / Decimal('100')
                    expense_amount = (actual_cost * expense_pct) / Decimal('100')
                    
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
            
            # Move to next week (5 business days)
            current_date += timedelta(days=7)
        
        db.commit()
        print(f"\nSuccessfully created {actuals_created} actuals records")
        print(f"Date range: {project.start_date} to {middle_date}")
        
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    print("Generating actuals for Mobile Application Development project...")
    generate_actuals()
    print("Done!")
