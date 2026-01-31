# Phase Migration Runbook

## Overview

This runbook provides step-by-step instructions for migrating the project phases system from a fixed enum-based model (Planning/Execution) to a flexible, user-definable timeline management system.

**Migration ID**: `92023c163a26_transform_phases_to_user_definable`

**Estimated Duration**: 5-10 minutes (depending on database size)

**Downtime Required**: Yes (recommended during maintenance window)

## Pre-Migration Checks

### 1. Backup Database

**CRITICAL**: Always create a full database backup before running migrations.

```bash
# PostgreSQL backup
pg_dump -h <host> -U <user> -d <database> -F c -f backup_pre_phase_migration_$(date +%Y%m%d_%H%M%S).dump

# Verify backup was created
ls -lh backup_pre_phase_migration_*.dump
```

### 2. Verify Current Migration State

```bash
cd backend
alembic current
```

Expected output: `976e6adbac6f` (add_scope_performance_indexes)

If not at this revision, consult with the team before proceeding.

### 3. Check Database Connectivity

```bash
# Test database connection
python -c "from app.db.base import SessionLocal; session = SessionLocal(); print('Connection successful'); session.close()"
```

### 4. Verify Data Integrity

Run pre-migration data checks:

```bash
python -c "
from app.db.base import SessionLocal
from sqlalchemy import text

session = SessionLocal()
try:
    # Check for projects without phases
    result = session.execute(text('''
        SELECT COUNT(*) FROM projects p
        LEFT JOIN project_phases ph ON ph.project_id = p.id
        WHERE ph.id IS NULL
    '''))
    orphan_count = result.scalar()
    print(f'Projects without phases: {orphan_count}')
    
    # Check for assignments without projects
    result = session.execute(text('''
        SELECT COUNT(*) FROM resource_assignments ra
        LEFT JOIN projects p ON p.id = ra.project_id
        WHERE p.id IS NULL
    '''))
    orphan_assignments = result.scalar()
    print(f'Orphaned assignments: {orphan_assignments}')
    
    if orphan_count > 0 or orphan_assignments > 0:
        print('WARNING: Data integrity issues detected!')
    else:
        print('✓ Data integrity checks passed')
finally:
    session.close()
"
```

### 5. Notify Stakeholders

- Inform users of planned maintenance window
- Coordinate with team members
- Ensure no critical operations are scheduled during migration

## Migration Steps

### Step 1: Stop Application Services

```bash
# Stop backend services
docker-compose stop backend

# Or if using systemd
sudo systemctl stop planner-backend
```

### Step 2: Run Migration

```bash
cd backend
alembic upgrade head
```

Expected output:
```
INFO  [alembic.runtime.migration] Running upgrade 976e6adbac6f -> 92023c163a26, transform_phases_to_user_definable
```

### Step 3: Verify Migration Success

Run the verification script:

```bash
cd backend
python verify_migration.py
```

Expected output should show all checks passing:
```
================================================================================
PHASE MIGRATION VERIFICATION
================================================================================

1. Checking all phases have required fields...
   ✓ PASS: All phases have required fields

2. Checking phase_type column is removed...
   ✓ PASS: phase_type column removed

3. Checking project_phase_id removed from resource_assignments...
   ✓ PASS: project_phase_id column removed

4. Checking phase date constraints (start_date <= end_date)...
   ✓ PASS: All phases have valid date ordering

5. Checking phase names...
   ✓ PASS: Phase names populated

6. Checking phases cover project date ranges...
   ✓ PASS: All project phases cover project date ranges

7. Checking budget data preserved...
   ✓ PASS: Budget data preserved

8. Checking indexes created...
   ✓ PASS: Date indexes created

9. Testing date-based assignment queries...
   ✓ PASS: Date-based queries work

================================================================================
VERIFICATION COMPLETE - ALL CHECKS PASSED
================================================================================
```

### Step 4: Restart Application Services

```bash
# Restart backend services
docker-compose start backend

# Or if using systemd
sudo systemctl start planner-backend
```

### Step 5: Smoke Test Application

1. Access the application UI
2. Navigate to a project detail page
3. Verify phases are displayed correctly
4. Create a new project and verify default phase is created
5. Test phase CRUD operations
6. Verify resource assignments are displayed correctly

## Verification Steps

### Database-Level Verification

```sql
-- 1. Check all phases have required fields
SELECT COUNT(*) FROM project_phases 
WHERE name IS NULL OR start_date IS NULL OR end_date IS NULL;
-- Expected: 0

-- 2. Check phase_type column is removed
SELECT phase_type FROM project_phases LIMIT 1;
-- Expected: ERROR: column "phase_type" does not exist

-- 3. Check project_phase_id is removed from resource_assignments
SELECT project_phase_id FROM resource_assignments LIMIT 1;
-- Expected: ERROR: column "project_phase_id" does not exist

-- 4. Check phase date constraints
SELECT COUNT(*) FROM project_phases WHERE start_date > end_date;
-- Expected: 0

-- 5. Check phases cover project date ranges
SELECT 
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
    OR MAX(ph.end_date) != p.end_date;
-- Expected: 0 rows

-- 6. Check date-based assignment queries work
SELECT COUNT(*) 
FROM resource_assignments ra
JOIN project_phases ph ON 
    ra.project_id = ph.project_id
    AND ra.assignment_date >= ph.start_date
    AND ra.assignment_date <= ph.end_date;
-- Expected: Should match total assignment count (or close to it)
```

### Application-Level Verification

1. **Project Creation**: Create a new project and verify default phase is created
2. **Phase CRUD**: Test creating, updating, and deleting phases
3. **Phase Validation**: Attempt to create invalid phase configurations (gaps, overlaps)
4. **Resource Assignments**: Verify assignments are correctly associated with phases
5. **Reporting**: Check that phase-based reports display correctly
6. **Budget Calculations**: Verify phase budget calculations are accurate

## Rollback Procedure

If issues are detected, follow these steps to rollback:

### Step 1: Stop Application Services

```bash
docker-compose stop backend
# Or: sudo systemctl stop planner-backend
```

### Step 2: Run Rollback Migration

```bash
cd backend
alembic downgrade -1
```

**Note**: The rollback will assign assignments that fall outside phase date ranges to the first phase of their project. This is expected behavior.

Expected output:
```
INFO  [alembic.runtime.migration] Running downgrade 92023c163a26 -> 976e6adbac6f, transform_phases_to_user_definable
Warning: X assignments were outside phase date ranges and assigned to first phase
```

### Step 3: Verify Rollback Success

```bash
cd backend
python verify_rollback.py
```

Expected output should show all checks passing:
```
================================================================================
PHASE MIGRATION ROLLBACK VERIFICATION
================================================================================

1. Checking phase_type column restored...
   ✓ PASS: phase_type column restored

2. Checking project_phase_id restored in resource_assignments...
   ✓ PASS: project_phase_id column restored

3. Checking new columns removed...
   ✓ PASS: name column removed
   ✓ PASS: start_date column removed

4. Checking phase_type values...
   ✓ PASS: phase_type values restored

================================================================================
ROLLBACK VERIFICATION COMPLETE - ALL CHECKS PASSED
================================================================================
```

### Step 4: Restore from Backup (If Needed)

If rollback fails or data is corrupted:

```bash
# Stop services
docker-compose stop backend

# Restore from backup
pg_restore -h <host> -U <user> -d <database> -c backup_pre_phase_migration_*.dump

# Verify restoration
psql -h <host> -U <user> -d <database> -c "SELECT COUNT(*) FROM project_phases;"
```

### Step 5: Restart Application Services

```bash
docker-compose start backend
# Or: sudo systemctl start planner-backend
```

## Troubleshooting

### Issue: Migration Fails with "NULL value in column"

**Symptom**: Migration fails during data transformation with NULL constraint violation

**Cause**: Some projects may not have proper date ranges or phases

**Solution**:
1. Rollback the migration
2. Identify problematic projects:
   ```sql
   SELECT id, name, start_date, end_date FROM projects 
   WHERE start_date IS NULL OR end_date IS NULL;
   ```
3. Fix data issues
4. Re-run migration

### Issue: Verification Shows Phase Date Mismatches

**Symptom**: Verification step 6 shows projects with phase date mismatches

**Cause**: Phase dates don't align with project dates

**Solution**:
1. Identify affected projects from verification output
2. Manually adjust phase dates:
   ```sql
   UPDATE project_phases 
   SET start_date = (SELECT start_date FROM projects WHERE id = project_id),
       end_date = (SELECT end_date FROM projects WHERE id = project_id)
   WHERE project_id = '<project_id>';
   ```

### Issue: Assignments Outside Phase Date Ranges

**Symptom**: Some assignments cannot be matched to phases by date

**Cause**: Assignments exist outside project/phase date ranges

**Solution**:
This is expected for some historical data. The system will handle this gracefully:
- Queries will only return assignments within phase date ranges
- Reports may show fewer assignments than before
- Consider extending phase date ranges if needed

### Issue: Rollback Fails

**Symptom**: Rollback migration fails with errors

**Cause**: Database state is inconsistent

**Solution**:
1. Restore from backup (see Rollback Step 4)
2. Contact database administrator
3. Review migration logs for specific errors

## Post-Migration Tasks

### 1. Monitor Application Performance

- Check database query performance
- Monitor API response times
- Review application logs for errors

### 2. Update Documentation

- Mark migration as completed in deployment log
- Update system architecture documentation
- Notify team of successful migration

### 3. Clean Up

- Archive backup files after 30 days
- Remove temporary verification scripts (optional)
- Update monitoring dashboards if needed

### 4. User Communication

- Notify users that maintenance is complete
- Provide documentation on new phase management features
- Offer training sessions if needed

## Migration Metadata

- **Migration File**: `backend/alembic/versions/92023c163a26_transform_phases_to_user_definable.py`
- **Verification Script**: `backend/verify_migration.py`
- **Rollback Verification Script**: `backend/verify_rollback.py`
- **Requirements**: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7

## Contact Information

For issues or questions during migration:
- Database Team: [contact info]
- Backend Team: [contact info]
- On-Call Engineer: [contact info]

## Revision History

| Date | Version | Author | Changes |
|------|---------|--------|---------|
| 2026-01-31 | 1.0 | System | Initial runbook creation |
