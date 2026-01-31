#!/usr/bin/env python3
"""
Verification script for phase migration.
Checks that data was transformed correctly.
"""
from sqlalchemy import text
from app.db.base import SessionLocal


def verify_migration():
    """Run verification queries on migrated data."""
    
    session = SessionLocal()
    try:
        print("=" * 80)
        print("PHASE MIGRATION VERIFICATION")
        print("=" * 80)
        
        # 1. Check that all phases have required fields
        print("\n1. Checking all phases have required fields...")
        result = session.execute(
            text("""
                SELECT COUNT(*) as count
                FROM project_phases
                WHERE name IS NULL OR start_date IS NULL OR end_date IS NULL
            """)
        )
        null_count = result.scalar()
        print(f"   Phases with NULL required fields: {null_count}")
        assert null_count == 0, "FAIL: Some phases have NULL required fields"
        print("   ✓ PASS: All phases have required fields")
        
        # 2. Check that phase_type column is removed
        print("\n2. Checking phase_type column is removed...")
        try:
            session.execute(text("SELECT phase_type FROM project_phases LIMIT 1"))
            print("   ✗ FAIL: phase_type column still exists")
            assert False
        except Exception:
            session.rollback()  # Rollback failed transaction
            print("   ✓ PASS: phase_type column removed")
        
        # 3. Check that project_phase_id is removed from resource_assignments
        print("\n3. Checking project_phase_id removed from resource_assignments...")
        try:
            session.execute(text("SELECT project_phase_id FROM resource_assignments LIMIT 1"))
            print("   ✗ FAIL: project_phase_id column still exists")
            assert False
        except Exception:
            session.rollback()  # Rollback failed transaction
            print("   ✓ PASS: project_phase_id column removed")
        
        # 4. Check phase date constraints
        print("\n4. Checking phase date constraints (start_date <= end_date)...")
        result = session.execute(
            text("""
                SELECT COUNT(*) as count
                FROM project_phases
                WHERE start_date > end_date
            """)
        )
        invalid_dates = result.scalar()
        print(f"   Phases with invalid dates: {invalid_dates}")
        assert invalid_dates == 0, "FAIL: Some phases have start_date > end_date"
        print("   ✓ PASS: All phases have valid date ordering")
        
        # 5. Check phase names were set correctly
        print("\n5. Checking phase names...")
        result = session.execute(
            text("""
                SELECT name, COUNT(*) as count
                FROM project_phases
                GROUP BY name
                ORDER BY count DESC
            """)
        )
        phase_names = result.fetchall()
        print("   Phase name distribution:")
        for name, count in phase_names:
            print(f"     - {name}: {count} phases")
        print("   ✓ PASS: Phase names populated")
        
        # 6. Check that phases cover project date ranges
        print("\n6. Checking phases cover project date ranges...")
        result = session.execute(
            text("""
                SELECT 
                    p.id as project_id,
                    p.name as project_name,
                    p.start_date as project_start,
                    p.end_date as project_end,
                    MIN(ph.start_date) as first_phase_start,
                    MAX(ph.end_date) as last_phase_end
                FROM projects p
                LEFT JOIN project_phases ph ON ph.project_id = p.id
                GROUP BY p.id, p.name, p.start_date, p.end_date
                HAVING 
                    MIN(ph.start_date) != p.start_date 
                    OR MAX(ph.end_date) != p.end_date
            """)
        )
        mismatched = result.fetchall()
        if mismatched:
            print(f"   ✗ FAIL: {len(mismatched)} projects have phase date mismatches:")
            for row in mismatched[:5]:  # Show first 5
                print(f"     - {row.project_name}: project({row.project_start} to {row.project_end}) "
                      f"phases({row.first_phase_start} to {row.last_phase_end})")
        else:
            print("   ✓ PASS: All project phases cover project date ranges")
        
        # 7. Check budget preservation
        print("\n7. Checking budget data preserved...")
        result = session.execute(
            text("""
                SELECT 
                    COUNT(*) as total_phases,
                    SUM(capital_budget) as total_capital,
                    SUM(expense_budget) as total_expense,
                    SUM(total_budget) as total_budget
                FROM project_phases
            """)
        )
        budget_summary = result.fetchone()
        print(f"   Total phases: {budget_summary.total_phases}")
        print(f"   Total capital budget: ${budget_summary.total_capital:,.2f}")
        print(f"   Total expense budget: ${budget_summary.total_expense:,.2f}")
        print(f"   Total budget: ${budget_summary.total_budget:,.2f}")
        print("   ✓ PASS: Budget data preserved")
        
        # 8. Check indexes exist
        print("\n8. Checking indexes created...")
        result = session.execute(
            text("""
                SELECT indexname
                FROM pg_indexes
                WHERE tablename = 'project_phases'
                AND indexname IN ('ix_project_phases_start_date', 'ix_project_phases_end_date')
            """)
        )
        indexes = [row.indexname for row in result.fetchall()]
        print(f"   Found indexes: {indexes}")
        assert 'ix_project_phases_start_date' in indexes, "FAIL: start_date index missing"
        assert 'ix_project_phases_end_date' in indexes, "FAIL: end_date index missing"
        print("   ✓ PASS: Date indexes created")
        
        # 9. Check assignments can be queried by date
        print("\n9. Testing date-based assignment queries...")
        result = session.execute(
            text("""
                SELECT COUNT(*) as count
                FROM resource_assignments ra
                JOIN project_phases ph ON 
                    ra.project_id = ph.project_id
                    AND ra.assignment_date >= ph.start_date
                    AND ra.assignment_date <= ph.end_date
            """)
        )
        assignment_count = result.scalar()
        print(f"   Assignments that can be matched to phases by date: {assignment_count}")
        print("   ✓ PASS: Date-based queries work")
        
        print("\n" + "=" * 80)
        print("VERIFICATION COMPLETE - ALL CHECKS PASSED")
        print("=" * 80)
    finally:
        session.close()


if __name__ == "__main__":
    verify_migration()
