# Resource Assignment Migration Guide

## Overview

This guide documents the migration process for removing the `allocation_percentage` field from the `resource_assignments` table and updating the data model constraints.

**Migration ID:** `7c6a22c3f524`  
**Migration Name:** `remove_allocation_percentage_from_resource_assignments`  
**Revises:** `847b37d80156` (add_portfolio_entity)

## What Changed

### Database Schema Changes

#### Removed
- **Column:** `allocation_percentage` (NUMERIC(5,2))
- **Constraint:** `check_accounting_split` (capital_percentage + expense_percentage = 100)

#### Added
- **Constraint:** `check_allocation_sum` (capital_percentage + expense_percentage <= 100)

#### Preserved
- **Column:** `capital_percentage` (NUMERIC(5,2)) - unchanged
- **Column:** `expense_percentage` (NUMERIC(5,2)) - unchanged
- **Constraint:** `check_capital_percentage` (0 <= capital_percentage <= 100)
- **Constraint:** `check_expense_percentage` (0 <= expense_percentage <= 100)

### Conceptual Model Change

**Before:**
- `allocation_percentage`: Total allocation (0-100%)
- `capital_percentage`: Portion of allocation for capital (0-100%)
- `expense_percentage`: Portion of allocation for expense (0-100%)
- Constraint: `capital_percentage + expense_percentage = 100`

**After:**
- `capital_percentage`: Direct time allocation for capital work (0-100%)
- `expense_percentage`: Direct time allocation for expense work (0-100%)
- Constraint (per assignment): `capital_percentage + expense_percentage <= 100`
- Constraint (cross-project): Sum of all (capital + expense) for a resource on a date <= 100%

## Migration Steps

### Prerequisites

1. **Backup Database**
   ```bash
   # For PostgreSQL
   pg_dump -h localhost -U postgres -d planner_db > backup_before_migration.sql
   ```

2. **Verify Current Migration State**
   ```bash
   cd backend
   alembic current
   # Should show: 847b37d80156
   ```

3. **Check Data Integrity**
   ```bash
   python verify_assignment_migration.py
   ```

### Running the Migration

#### Development Environment

1. **Run Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```

2. **Verify Migration Success**
   ```bash
   # Check migration applied
   alembic current
   # Should show: 7c6a22c3f524
   
   # Verify schema changes
   python verify_assignment_migration.py
   ```

3. **Test Application**
   ```bash
   # Start the API
   python -m uvicorn app.main:app --reload
   
   # In another terminal, test API startup
   python test_api_startup.py
   ```

#### Staging/Production Environment

1. **Schedule Maintenance Window**
   - Coordinate with stakeholders
   - Plan for brief downtime (< 5 minutes for typical database sizes)

2. **Pre-Migration Checklist**
   - [ ] Database backup completed
   - [ ] Current migration state verified
   - [ ] Rollback plan reviewed
   - [ ] Team notified of maintenance window

3. **Execute Migration**
   ```bash
   cd backend
   
   # Run migration
   alembic upgrade head
   
   # Verify success
   alembic current
   python verify_assignment_migration.py
   ```

4. **Post-Migration Verification**
   - [ ] Schema changes verified
   - [ ] Data integrity confirmed
   - [ ] API starts successfully
   - [ ] Sample API requests work
   - [ ] Frontend loads without errors

## Validation Steps

### 1. Schema Validation

Verify the schema changes were applied correctly:

```python
from app.db.session import SessionLocal
from sqlalchemy import inspect

db = SessionLocal()
inspector = inspect(db.bind)

# Check columns
columns = inspector.get_columns('resource_assignments')
column_names = [col['name'] for col in columns]

assert 'allocation_percentage' not in column_names, "allocation_percentage should be removed"
assert 'capital_percentage' in column_names, "capital_percentage should exist"
assert 'expense_percentage' in column_names, "expense_percentage should exist"

# Check constraints
constraints = inspector.get_check_constraints('resource_assignments')
constraint_names = [c['name'] for c in constraints]

assert 'check_accounting_split' not in constraint_names, "old constraint should be removed"
assert 'check_allocation_sum' in constraint_names, "new constraint should exist"

print("✓ Schema validation passed")
db.close()
```

### 2. Data Integrity Validation

Verify that existing data was preserved:

```python
from app.db.session import SessionLocal
from app.models.resource_assignment import ResourceAssignment
from sqlalchemy import func

db = SessionLocal()

# Count total assignments
count = db.query(ResourceAssignment).count()
print(f"Total assignments: {count}")

# Verify constraint satisfaction
max_sum = db.query(
    func.max(ResourceAssignment.capital_percentage + ResourceAssignment.expense_percentage)
).scalar()

assert max_sum <= 100, f"Found assignment with sum > 100%: {max_sum}%"
print(f"✓ All assignments satisfy constraint (max sum: {max_sum}%)")

# Sample data
samples = db.query(ResourceAssignment).limit(5).all()
for i, assignment in enumerate(samples, 1):
    total = assignment.capital_percentage + assignment.expense_percentage
    print(f"  Sample {i}: capital={assignment.capital_percentage}%, "
          f"expense={assignment.expense_percentage}%, sum={total}%")

db.close()
```

### 3. Application Functionality Validation

Test that the application works with the new schema:

```bash
# Test API startup
python test_api_startup.py

# Run unit tests
pytest tests/unit/test_assignment_service_unit.py -v

# Run property tests
pytest tests/unit/test_assignment_service_properties.py -v

# Run integration tests (if test database is migrated)
pytest tests/integration/test_assignment_api.py -v
```

## Rollback Procedure

If issues are encountered, the migration can be rolled back:

### Rollback Steps

1. **Stop Application**
   ```bash
   # Stop all running instances of the application
   ```

2. **Run Downgrade**
   ```bash
   cd backend
   alembic downgrade -1
   ```

3. **Verify Rollback**
   ```bash
   # Check migration state
   alembic current
   # Should show: 847b37d80156
   
   # Verify schema restored
   python -c "from app.db.session import SessionLocal; from sqlalchemy import inspect; db = SessionLocal(); inspector = inspect(db.bind); columns = [col['name'] for col in inspector.get_columns('resource_assignments')]; print('allocation_percentage' in columns)"
   # Should print: True
   ```

4. **Restart Application**
   ```bash
   # Restart application with previous code version
   ```

### Rollback Verification

The downgrade migration will:
1. Add `allocation_percentage` column back (nullable initially)
2. Populate `allocation_percentage` from `capital_percentage + expense_percentage`
3. Make `allocation_percentage` non-nullable
4. Drop `check_allocation_sum` constraint
5. Restore `check_accounting_split` constraint

Verify rollback success:

```python
from app.db.session import SessionLocal
from app.models.resource_assignment import ResourceAssignment
from sqlalchemy import inspect

db = SessionLocal()

# Verify column exists
inspector = inspect(db.bind)
columns = [col['name'] for col in inspector.get_columns('resource_assignments')]
assert 'allocation_percentage' in columns, "allocation_percentage should be restored"

# Verify data populated
null_count = db.query(ResourceAssignment).filter(
    ResourceAssignment.allocation_percentage == None
).count()
assert null_count == 0, f"Found {null_count} assignments with NULL allocation_percentage"

print("✓ Rollback verification passed")
db.close()
```

## Impact Assessment

### Breaking Changes

This is a **breaking change** that affects:

1. **Backend API**
   - Request schemas no longer accept `allocation_percentage`
   - Response schemas no longer return `allocation_percentage`
   - Validation logic changed from `capital + expense = 100` to `capital + expense <= 100`

2. **Frontend**
   - TypeScript interfaces updated
   - API calls no longer send `allocation_percentage`
   - Validation logic updated

3. **Database**
   - Column removed
   - Constraint changed

### Deployment Requirements

- **Backend and frontend must be deployed together**
- **Database migration must be run before deploying new code**
- **Brief downtime required during migration**

### Performance Considerations

- Migration is fast (< 1 second for typical database sizes)
- No data transformation required (only schema changes)
- New constraint validation is efficient (single row check)

## Troubleshooting

### Issue: Migration Fails with Constraint Violation

**Symptom:** Migration fails when adding new constraint

**Cause:** Existing data violates new constraint (capital + expense > 100)

**Solution:**
```sql
-- Find violating records
SELECT id, capital_percentage, expense_percentage, 
       (capital_percentage + expense_percentage) as total
FROM resource_assignments
WHERE capital_percentage + expense_percentage > 100;

-- Fix data before migration
-- (Adjust percentages as needed based on business rules)
```

### Issue: Application Fails to Start After Migration

**Symptom:** API returns 500 errors or fails to start

**Cause:** Code still references `allocation_percentage`

**Solution:**
1. Verify all code changes were deployed
2. Check for any remaining references to `allocation_percentage`
3. Restart application servers

### Issue: Tests Fail After Migration

**Symptom:** Tests fail with schema errors

**Cause:** Test database not migrated or test fixtures still use `allocation_percentage`

**Solution:**
1. Migrate test database: `alembic upgrade head`
2. Update test fixtures to remove `allocation_percentage`
3. Clear test database and re-run migrations

## Migration Timeline

### Estimated Duration

- **Development:** 5 minutes
- **Staging:** 10 minutes (including verification)
- **Production:** 15 minutes (including backup and verification)

### Recommended Schedule

1. **Development:** Immediate
2. **Staging:** Next deployment window
3. **Production:** Coordinate with stakeholders, schedule maintenance window

## Support

For issues or questions:
- Review this guide
- Check troubleshooting section
- Contact development team
- Review spec documentation: `.kiro/specs/resource-assignment-refactor/`

## References

- **Spec Requirements:** `.kiro/specs/resource-assignment-refactor/requirements.md`
- **Spec Design:** `.kiro/specs/resource-assignment-refactor/design.md`
- **Spec Tasks:** `.kiro/specs/resource-assignment-refactor/tasks.md`
- **Migration File:** `backend/alembic/versions/7c6a22c3f524_remove_allocation_percentage_from_.py`
- **Verification Script:** `backend/verify_assignment_migration.py`
