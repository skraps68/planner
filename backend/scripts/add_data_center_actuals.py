"""
Add actuals to Data Center Consolidation project.
Creates actuals from project start through today (Feb 2026).
"""
from datetime import date, timedelta
from decimal import Decimal
from uuid import uuid4

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.session import SessionLocal
from app.models.project import Project
from app.models.resource import Worker
from app.models.actual import Actual


def add_data_center_actuals(db: Session):
    """Add actuals to Data Center Consolidation project."""
    print("Adding actuals to Data Center Consolidation project...")
    
    # Find the Data Center Consolidation project
    project = db.execute(
        select(Project).where(Project.name == "Data Center Consolidation")
    ).scalar_one_or_none()
    
    if not project:
        print("Error: Data Center Consolidation project not found!")
        return
    
    print(f"Found project: {project.name} (ID: {project.id})")
    print(f"Project dates: {project.start_date} to {project.end_date}")
    
    # Find workers
    workers_data = {
        "John Smith": "EMP001",
        "Jane Doe": "EMP002",
        "Bob Johnson": "EMP003",
        "Alice Williams": "EMP004",
    }
    
    workers = {}
    for worker_name, external_id in workers_data.items():
        worker = db.execute(
            select(Worker).where(Worker.external_id == external_id)
        ).scalar_one_or_none()
        
        if worker:
            workers[worker_name] = worker
            print(f"Found worker: {worker_name}")
    
    if not workers:
        print("Error: No workers found!")
        return
    
    actuals = []
    today = date(2026, 2, 17)  # Current date
    
    # Phase 1: Planning & Assessment (Sep 2024 - Feb 2025) - COMPLETED
    # Jane Doe (Architect) - 80% allocation, $1600/day rate
    # John Smith (Senior Engineer) - 50% allocation, $1250/day rate
    print(f"\nCreating Phase 1 actuals (Planning): Sep 2024 - Feb 2025")
    start_date = date(2024, 9, 1)
    end_date = date(2025, 2, 28)
    
    current_date = start_date
    while current_date <= end_date:
        # Jane Doe - 80% allocation (68% capital + 12% expense)
        if "Jane Doe" in workers:
            daily_cost = Decimal("1600.00") * Decimal("0.80")  # $1280/day
            capital_amount = daily_cost * Decimal("0.85")  # 85% capital
            expense_amount = daily_cost * Decimal("0.15")  # 15% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP002",
                worker_name="Jane Doe",
                actual_date=current_date,
                allocation_percentage=Decimal("80.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        # John Smith - 50% allocation (35% capital + 15% expense)
        if "John Smith" in workers:
            daily_cost = Decimal("1250.00") * Decimal("0.50")  # $625/day
            capital_amount = daily_cost * Decimal("0.70")  # 70% capital
            expense_amount = daily_cost * Decimal("0.30")  # 30% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP001",
                worker_name="John Smith",
                actual_date=current_date,
                allocation_percentage=Decimal("50.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        current_date += timedelta(days=1)
    
    # Phase 2: Implementation & Migration (Mar 2025 - Dec 2025) - COMPLETED
    # John Smith - 100% allocation, $1250/day
    # Bob Johnson - 100% allocation, $950/day
    # Alice Williams - 75% allocation, $950/day
    print(f"Creating Phase 2 actuals (Implementation): Mar 2025 - Dec 2025")
    start_date = date(2025, 3, 1)
    end_date = date(2025, 12, 31)
    
    current_date = start_date
    while current_date <= end_date:
        # John Smith - 100% allocation (90% capital + 10% expense)
        if "John Smith" in workers:
            daily_cost = Decimal("1250.00") * Decimal("1.00")  # $1250/day
            capital_amount = daily_cost * Decimal("0.90")  # 90% capital
            expense_amount = daily_cost * Decimal("0.10")  # 10% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP001",
                worker_name="John Smith",
                actual_date=current_date,
                allocation_percentage=Decimal("100.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        # Bob Johnson - 100% allocation (85% capital + 15% expense)
        if "Bob Johnson" in workers:
            daily_cost = Decimal("950.00") * Decimal("1.00")  # $950/day
            capital_amount = daily_cost * Decimal("0.85")  # 85% capital
            expense_amount = daily_cost * Decimal("0.15")  # 15% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP003",
                worker_name="Bob Johnson",
                actual_date=current_date,
                allocation_percentage=Decimal("100.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        # Alice Williams - 75% allocation (60% capital + 15% expense)
        if "Alice Williams" in workers:
            daily_cost = Decimal("950.00") * Decimal("0.75")  # $712.50/day
            capital_amount = daily_cost * Decimal("0.80")  # 80% capital
            expense_amount = daily_cost * Decimal("0.20")  # 20% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP004",
                worker_name="Alice Williams",
                actual_date=current_date,
                allocation_percentage=Decimal("75.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        current_date += timedelta(days=1)
    
    # Phase 3: Testing & Cutover (Jan 2026 - today Feb 17, 2026) - IN PROGRESS
    # Bob Johnson - 50% allocation (30% capital + 20% expense)
    # Alice Williams - 100% allocation (50% capital + 50% expense)
    # Jane Doe - 25% allocation (10% capital + 15% expense)
    print(f"Creating Phase 3 actuals (Testing & Cutover): Jan 2026 - Feb 17, 2026")
    start_date = date(2026, 1, 1)
    end_date = today  # Through today
    
    current_date = start_date
    while current_date <= end_date:
        # Bob Johnson - 50% allocation (30% capital + 20% expense)
        if "Bob Johnson" in workers:
            daily_cost = Decimal("950.00") * Decimal("0.50")  # $475/day
            capital_amount = daily_cost * Decimal("0.60")  # 60% capital
            expense_amount = daily_cost * Decimal("0.40")  # 40% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP003",
                worker_name="Bob Johnson",
                actual_date=current_date,
                allocation_percentage=Decimal("50.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        # Alice Williams - 100% allocation (50% capital + 50% expense)
        if "Alice Williams" in workers:
            daily_cost = Decimal("950.00") * Decimal("1.00")  # $950/day
            capital_amount = daily_cost * Decimal("0.50")  # 50% capital
            expense_amount = daily_cost * Decimal("0.50")  # 50% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP004",
                worker_name="Alice Williams",
                actual_date=current_date,
                allocation_percentage=Decimal("100.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        # Jane Doe - 25% allocation (10% capital + 15% expense)
        if "Jane Doe" in workers:
            daily_cost = Decimal("1600.00") * Decimal("0.25")  # $400/day
            capital_amount = daily_cost * Decimal("0.40")  # 40% capital
            expense_amount = daily_cost * Decimal("0.60")  # 60% expense
            
            actuals.append(Actual(
                id=uuid4(),
                project_id=project.id,
                external_worker_id="EMP002",
                worker_name="Jane Doe",
                actual_date=current_date,
                allocation_percentage=Decimal("25.00"),
                actual_cost=daily_cost,
                capital_amount=capital_amount,
                expense_amount=expense_amount
            ))
        
        current_date += timedelta(days=1)
    
    # Add all actuals to database
    print(f"\nAdding {len(actuals)} actuals to database...")
    for actual in actuals:
        db.add(actual)
    
    db.commit()
    
    # Calculate totals
    total_cost = sum(a.actual_cost for a in actuals)
    total_capital = sum(a.capital_amount for a in actuals)
    total_expense = sum(a.expense_amount for a in actuals)
    
    print(f"\nSuccessfully created {len(actuals)} actuals for Data Center Consolidation project!")
    print(f"\nActuals Summary:")
    print(f"  Total Cost: ${total_cost:,.2f}")
    print(f"  Capital: ${total_capital:,.2f}")
    print(f"  Expense: ${total_expense:,.2f}")
    print(f"\n  Phase 1 (Sep 2024 - Feb 2025): COMPLETED")
    print(f"  Phase 2 (Mar 2025 - Dec 2025): COMPLETED")
    print(f"  Phase 3 (Jan 2026 - Feb 17, 2026): IN PROGRESS")
    print(f"\n  Total Budget: $1,600,000")
    print(f"  Actuals to Date: ${total_cost:,.2f} ({(total_cost / Decimal('1600000.00') * 100):.1f}% of budget)")


def main():
    """Main function."""
    print("=" * 60)
    print("Adding Data Center Consolidation Actuals")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        add_data_center_actuals(db)
        
        print("=" * 60)
        print("Actuals creation completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"Error creating actuals: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
