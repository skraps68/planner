#!/usr/bin/env python3
"""Verify resource assignment migration."""

from app.db.session import SessionLocal
from app.models.resource_assignment import ResourceAssignment
from sqlalchemy import func

def verify_migration():
    """Verify the migration was successful."""
    db = SessionLocal()
    
    try:
        # Count total assignments
        count = db.query(ResourceAssignment).count()
        print(f"✓ Total resource assignments: {count}")
        
        # Get sample assignments
        samples = db.query(ResourceAssignment).limit(5).all()
        print(f"\n✓ Sample assignments:")
        for i, assignment in enumerate(samples, 1):
            print(f"  {i}. capital={assignment.capital_percentage}%, "
                  f"expense={assignment.expense_percentage}%, "
                  f"sum={assignment.capital_percentage + assignment.expense_percentage}%")
        
        # Verify no allocation_percentage attribute exists
        sample = db.query(ResourceAssignment).first()
        if sample:
            try:
                _ = sample.allocation_percentage
                print("\n✗ ERROR: allocation_percentage still exists!")
                return False
            except AttributeError:
                print("\n✓ allocation_percentage attribute removed from model")
        
        # Verify constraint: capital + expense <= 100
        print("\n✓ Verifying constraint (capital + expense <= 100):")
        max_sum = db.query(
            func.max(ResourceAssignment.capital_percentage + ResourceAssignment.expense_percentage)
        ).scalar()
        print(f"  Maximum sum: {max_sum}%")
        
        if max_sum > 100:
            print(f"  ✗ ERROR: Found assignment with sum > 100%")
            return False
        else:
            print(f"  ✓ All assignments satisfy constraint")
        
        print("\n✓ Migration verification successful!")
        return True
        
    finally:
        db.close()

if __name__ == "__main__":
    verify_migration()
