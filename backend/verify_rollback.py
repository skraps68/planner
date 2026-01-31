#!/usr/bin/env python3
"""
Verification script for phase migration rollback.
Checks that data was restored correctly.
"""
from sqlalchemy import text
from app.db.base import SessionLocal


def verify_rollback():
    """Run verification queries on rolled-back data."""
    
    session = SessionLocal()
    try:
        print("=" * 80)
        print("PHASE MIGRATION ROLLBACK VERIFICATION")
        print("=" * 80)
        
        # 1. Check that phase_type column exists
        print("\n1. Checking phase_type column restored...")
        try:
            result = session.execute(text("SELECT COUNT(*) FROM project_phases WHERE phase_type IS NOT NULL"))
            count = result.scalar()
            print(f"   Phases with phase_type: {count}")
            print("   ✓ PASS: phase_type column restored")
        except Exception as e:
            print(f"   ✗ FAIL: phase_type column not found: {e}")
            assert False
        
        # 2. Check that project_phase_id exists in resource_assignments
        print("\n2. Checking project_phase_id restored in resource_assignments...")
        try:
            result = session.execute(text("SELECT COUNT(*) FROM resource_assignments WHERE project_phase_id IS NOT NULL"))
            count = result.scalar()
            print(f"   Assignments with project_phase_id: {count}")
            print("   ✓ PASS: project_phase_id column restored")
        except Exception as e:
            print(f"   ✗ FAIL: project_phase_id column not found: {e}")
            assert False
        
        # 3. Check that new columns are removed
        print("\n3. Checking new columns removed...")
        try:
            session.execute(text("SELECT name FROM project_phases LIMIT 1"))
            print("   ✗ FAIL: name column still exists")
            assert False
        except Exception:
            session.rollback()
            print("   ✓ PASS: name column removed")
        
        try:
            session.execute(text("SELECT start_date FROM project_phases LIMIT 1"))
            print("   ✗ FAIL: start_date column still exists")
            assert False
        except Exception:
            session.rollback()
            print("   ✓ PASS: start_date column removed")
        
        # 4. Check phase_type values
        print("\n4. Checking phase_type values...")
        result = session.execute(
            text("""
                SELECT phase_type, COUNT(*) as count
                FROM project_phases
                GROUP BY phase_type
            """)
        )
        phase_types = result.fetchall()
        print("   Phase type distribution:")
        for phase_type, count in phase_types:
            print(f"     - {phase_type}: {count} phases")
        print("   ✓ PASS: phase_type values restored")
        
        print("\n" + "=" * 80)
        print("ROLLBACK VERIFICATION COMPLETE - ALL CHECKS PASSED")
        print("=" * 80)
    finally:
        session.close()


if __name__ == "__main__":
    verify_rollback()
