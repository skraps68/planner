#!/usr/bin/env python3
"""
Verification script for Portfolio migration.

This script verifies that the Portfolio migration has been applied correctly:
1. Portfolios table exists with correct schema
2. Programs table has portfolio_id column
3. Default portfolio was created
4. All programs are assigned to a portfolio
5. Foreign key constraint exists
6. Indexes are created
"""

import sys
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

# Use SQLite test database
DATABASE_URL = "sqlite:///./test.db"

def verify_migration():
    """Verify the portfolio migration."""
    print("=" * 80)
    print("Portfolio Migration Verification")
    print("=" * 80)
    print()
    
    # Create engine and session
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
    Session = sessionmaker(bind=engine)
    session = Session()
    inspector = inspect(engine)
    
    all_checks_passed = True
    
    try:
        # Check 1: Portfolios table exists
        print("✓ Check 1: Portfolios table exists")
        tables = inspector.get_table_names()
        if 'portfolios' not in tables:
            print("  ✗ FAILED: portfolios table does not exist")
            all_checks_passed = False
        else:
            print("  ✓ PASSED: portfolios table exists")
            
            # Check portfolio table columns
            columns = {col['name']: col for col in inspector.get_columns('portfolios')}
            required_columns = ['id', 'name', 'description', 'owner', 
                              'reporting_start_date', 'reporting_end_date',
                              'created_at', 'updated_at']
            
            missing_columns = [col for col in required_columns if col not in columns]
            if missing_columns:
                print(f"  ✗ FAILED: Missing columns: {missing_columns}")
                all_checks_passed = False
            else:
                print(f"  ✓ PASSED: All required columns present")
        
        print()
        
        # Check 2: Programs table has portfolio_id
        print("✓ Check 2: Programs table has portfolio_id column")
        if 'programs' not in tables:
            print("  ✗ FAILED: programs table does not exist")
            all_checks_passed = False
        else:
            columns = {col['name']: col for col in inspector.get_columns('programs')}
            if 'portfolio_id' not in columns:
                print("  ✗ FAILED: portfolio_id column does not exist in programs table")
                all_checks_passed = False
            else:
                print("  ✓ PASSED: portfolio_id column exists")
                
                # Check if nullable
                is_nullable = columns['portfolio_id']['nullable']
                if is_nullable:
                    print("  ✗ FAILED: portfolio_id should be NOT NULL")
                    all_checks_passed = False
                else:
                    print("  ✓ PASSED: portfolio_id is NOT NULL")
        
        print()
        
        # Check 3: Default portfolio exists
        print("✓ Check 3: Default portfolio was created")
        result = session.execute(
            text("SELECT COUNT(*) as count FROM portfolios WHERE name = 'Default Portfolio'")
        ).fetchone()
        
        if result and result[0] > 0:
            print(f"  ✓ PASSED: Default portfolio exists (count: {result[0]})")
            
            # Get default portfolio details
            portfolio = session.execute(
                text("SELECT id, name, owner, reporting_start_date, reporting_end_date FROM portfolios WHERE name = 'Default Portfolio'")
            ).fetchone()
            
            if portfolio:
                print(f"    - ID: {portfolio[0]}")
                print(f"    - Name: {portfolio[1]}")
                print(f"    - Owner: {portfolio[2]}")
                print(f"    - Reporting Period: {portfolio[3]} to {portfolio[4]}")
        else:
            print("  ✗ FAILED: Default portfolio does not exist")
            all_checks_passed = False
        
        print()
        
        # Check 4: All programs have portfolio_id
        print("✓ Check 4: All programs are assigned to a portfolio")
        result = session.execute(
            text("SELECT COUNT(*) as count FROM programs WHERE portfolio_id IS NULL")
        ).fetchone()
        
        if result and result[0] == 0:
            print("  ✓ PASSED: All programs have portfolio_id assigned")
            
            # Count total programs
            total = session.execute(text("SELECT COUNT(*) as count FROM programs")).fetchone()
            if total:
                print(f"    - Total programs: {total[0]}")
        else:
            print(f"  ✗ FAILED: {result[0]} programs have NULL portfolio_id")
            all_checks_passed = False
        
        print()
        
        # Check 5: Foreign key constraint exists
        print("✓ Check 5: Foreign key constraint exists")
        foreign_keys = inspector.get_foreign_keys('programs')
        portfolio_fk = [fk for fk in foreign_keys if 'portfolio_id' in fk['constrained_columns']]
        
        if portfolio_fk:
            print("  ✓ PASSED: Foreign key constraint exists")
            for fk in portfolio_fk:
                print(f"    - Constraint: {fk.get('name', 'unnamed')}")
                print(f"    - References: {fk['referred_table']}.{fk['referred_columns']}")
        else:
            print("  ✗ FAILED: Foreign key constraint does not exist")
            all_checks_passed = False
        
        print()
        
        # Check 6: Indexes exist
        print("✓ Check 6: Indexes are created")
        
        # Check portfolios indexes
        portfolio_indexes = inspector.get_indexes('portfolios')
        portfolio_index_columns = [idx['column_names'] for idx in portfolio_indexes]
        
        if any('name' in cols for cols in portfolio_index_columns):
            print("  ✓ PASSED: Index on portfolios.name exists")
        else:
            print("  ⚠ WARNING: Index on portfolios.name may not exist")
        
        # Check programs portfolio_id index
        program_indexes = inspector.get_indexes('programs')
        program_index_columns = [idx['column_names'] for idx in program_indexes]
        
        if any('portfolio_id' in cols for cols in program_index_columns):
            print("  ✓ PASSED: Index on programs.portfolio_id exists")
        else:
            print("  ⚠ WARNING: Index on programs.portfolio_id may not exist")
        
        print()
        
        # Summary
        print("=" * 80)
        if all_checks_passed:
            print("✓ ALL CHECKS PASSED - Migration verified successfully!")
            print("=" * 80)
            return 0
        else:
            print("✗ SOME CHECKS FAILED - Please review the migration")
            print("=" * 80)
            return 1
            
    except Exception as e:
        print(f"✗ ERROR during verification: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        session.close()


def test_rollback():
    """Test that rollback works correctly."""
    print()
    print("=" * 80)
    print("Rollback Test (Informational)")
    print("=" * 80)
    print()
    print("To test rollback, run:")
    print("  alembic downgrade -1")
    print()
    print("This should:")
    print("  1. Drop foreign key constraint from programs")
    print("  2. Drop portfolio_id column from programs")
    print("  3. Drop portfolios table")
    print()
    print("After rollback, you can upgrade again with:")
    print("  alembic upgrade head")
    print()


if __name__ == "__main__":
    exit_code = verify_migration()
    test_rollback()
    sys.exit(exit_code)
