# Staging Environment Migration Checklist

## Overview

This checklist provides guidance for running the phase migration on a staging environment before production deployment.

**Migration**: `92023c163a26_transform_phases_to_user_definable`

## Prerequisites

- [ ] Staging environment is available and accessible
- [ ] Staging database contains production-like data
- [ ] Team members are available for testing
- [ ] Rollback plan is reviewed and understood

## Pre-Migration Steps

### 1. Environment Verification

- [ ] Verify staging environment is at correct migration version (`976e6adbac6f`)
  ```bash
  ssh staging-server
  cd /path/to/backend
  alembic current
  ```

- [ ] Verify staging database connectivity
  ```bash
  python -c "from app.db.base import SessionLocal; session = SessionLocal(); print('Connected'); session.close()"
  ```

- [ ] Check staging environment configuration
  ```bash
  cat .env | grep DATABASE_URL
  ```

### 2. Data Backup

- [ ] Create full database backup
  ```bash
  pg_dump -h <staging-host> -U <user> -d <staging-db> -F c -f staging_backup_$(date +%Y%m%d_%H%M%S).dump
  ```

- [ ] Verify backup file size and integrity
  ```bash
  ls -lh staging_backup_*.dump
  pg_restore --list staging_backup_*.dump | head -20
  ```

- [ ] Store backup in secure location
  ```bash
  aws s3 cp staging_backup_*.dump s3://backups/staging/phase-migration/
  ```

### 3. Pre-Migration Data Snapshot

- [ ] Record current data counts
  ```sql
  SELECT 'projects' as table_name, COUNT(*) as count FROM projects
  UNION ALL
  SELECT 'project_phases', COUNT(*) FROM project_phases
  UNION ALL
  SELECT 'resource_assignments', COUNT(*) FROM resource_assignments;
  ```

- [ ] Record current phase distribution
  ```sql
  SELECT phase_type, COUNT(*) FROM project_phases GROUP BY phase_type;
  ```

- [ ] Record budget totals
  ```sql
  SELECT 
    SUM(capital_budget) as total_capital,
    SUM(expense_budget) as total_expense,
    SUM(total_budget) as total_budget
  FROM project_phases;
  ```

### 4. Stakeholder Notification

- [ ] Notify QA team of planned migration
- [ ] Schedule testing window with stakeholders
- [ ] Coordinate with DevOps team
- [ ] Post announcement in team communication channel

## Migration Execution

### 1. Stop Staging Services

- [ ] Stop backend application
  ```bash
  ssh staging-server
  docker-compose stop backend
  # Or: sudo systemctl stop planner-backend-staging
  ```

- [ ] Verify services are stopped
  ```bash
  docker-compose ps
  # Or: sudo systemctl status planner-backend-staging
  ```

- [ ] Verify no active database connections
  ```sql
  SELECT COUNT(*) FROM pg_stat_activity 
  WHERE datname = '<staging-db>' AND application_name != 'psql';
  ```

### 2. Run Migration

- [ ] Execute migration
  ```bash
  cd /path/to/backend
  alembic upgrade head
  ```

- [ ] Capture migration output
  ```bash
  alembic upgrade head 2>&1 | tee migration_output_$(date +%Y%m%d_%H%M%S).log
  ```

- [ ] Verify migration completed successfully
  ```bash
  alembic current
  # Expected: 92023c163a26
  ```

### 3. Run Verification Script

- [ ] Execute verification script
  ```bash
  python verify_migration.py 2>&1 | tee verification_output_$(date +%Y%m%d_%H%M%S).log
  ```

- [ ] Review verification output for any failures
- [ ] Document any warnings or issues

### 4. Verify Data Integrity

- [ ] Check data counts match pre-migration snapshot
  ```sql
  SELECT 'projects' as table_name, COUNT(*) as count FROM projects
  UNION ALL
  SELECT 'project_phases', COUNT(*) FROM project_phases
  UNION ALL
  SELECT 'resource_assignments', COUNT(*) FROM resource_assignments;
  ```

- [ ] Verify budget totals are preserved
  ```sql
  SELECT 
    SUM(capital_budget) as total_capital,
    SUM(expense_budget) as total_expense,
    SUM(total_budget) as total_budget
  FROM project_phases;
  ```

- [ ] Check phase names were set correctly
  ```sql
  SELECT name, COUNT(*) FROM project_phases GROUP BY name;
  ```

### 5. Restart Staging Services

- [ ] Start backend application
  ```bash
  docker-compose start backend
  # Or: sudo systemctl start planner-backend-staging
  ```

- [ ] Verify services are running
  ```bash
  docker-compose ps
  # Or: sudo systemctl status planner-backend-staging
  ```

- [ ] Check application logs for errors
  ```bash
  docker-compose logs -f backend --tail=100
  # Or: sudo journalctl -u planner-backend-staging -f
  ```

## Post-Migration Testing

### 1. Smoke Tests

- [ ] Access staging application UI
- [ ] Verify login functionality works
- [ ] Navigate to dashboard
- [ ] Check for any console errors

### 2. Phase Management Tests

- [ ] Navigate to existing project detail page
- [ ] Verify phases are displayed correctly
- [ ] Check phase names (should be "Planning" or "Execution")
- [ ] Verify phase dates align with project dates
- [ ] Check phase budgets are displayed correctly

### 3. Phase CRUD Operations

- [ ] Create a new project
  - [ ] Verify default phase is created automatically
  - [ ] Check default phase spans project dates
  - [ ] Verify default phase has zero budgets

- [ ] Add a new phase to existing project
  - [ ] Test phase creation with valid dates
  - [ ] Verify validation prevents gaps
  - [ ] Verify validation prevents overlaps

- [ ] Update an existing phase
  - [ ] Modify phase name
  - [ ] Modify phase dates
  - [ ] Modify phase budgets
  - [ ] Verify validation works

- [ ] Delete a phase
  - [ ] Verify cannot delete if it creates gap
  - [ ] Verify cannot delete last phase
  - [ ] Successfully delete phase when valid

### 4. Resource Assignment Tests

- [ ] View resource assignments for a project
- [ ] Verify assignments are displayed correctly
- [ ] Check assignments are associated with correct phases
- [ ] Create new assignment and verify phase association

### 5. Reporting Tests

- [ ] Generate budget vs actual report
  - [ ] Verify phase-level data is correct
  - [ ] Check project-level aggregations
  - [ ] Verify calculations are accurate

- [ ] Generate forecast report
  - [ ] Verify phase forecasts are calculated
  - [ ] Check date-based filtering works
  - [ ] Verify totals match expectations

- [ ] Generate resource utilization report
  - [ ] Verify assignments are counted correctly
  - [ ] Check phase-based filtering works

### 6. API Tests

- [ ] Test phase API endpoints
  ```bash
  # List phases for a project
  curl -X GET "https://staging.example.com/api/v1/projects/{project_id}/phases" \
    -H "Authorization: Bearer $TOKEN"
  
  # Create phase
  curl -X POST "https://staging.example.com/api/v1/projects/{project_id}/phases" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Test Phase",
      "start_date": "2026-02-01",
      "end_date": "2026-03-31",
      "capital_budget": 10000,
      "expense_budget": 5000,
      "total_budget": 15000
    }'
  
  # Update phase
  curl -X PUT "https://staging.example.com/api/v1/phases/{phase_id}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"name": "Updated Phase Name"}'
  
  # Delete phase
  curl -X DELETE "https://staging.example.com/api/v1/phases/{phase_id}" \
    -H "Authorization: Bearer $TOKEN"
  ```

### 7. Performance Tests

- [ ] Measure page load times
  - [ ] Project list page
  - [ ] Project detail page
  - [ ] Reports pages

- [ ] Check database query performance
  ```sql
  -- Enable query timing
  \timing on
  
  -- Test date-based assignment query
  SELECT COUNT(*) 
  FROM resource_assignments ra
  JOIN project_phases ph ON 
    ra.project_id = ph.project_id
    AND ra.assignment_date >= ph.start_date
    AND ra.assignment_date <= ph.end_date;
  
  -- Test phase lookup by date
  SELECT * FROM project_phases
  WHERE project_id = '<project_id>'
  AND start_date <= '2026-02-15'
  AND end_date >= '2026-02-15';
  ```

- [ ] Monitor application logs for slow queries

### 8. Edge Case Tests

- [ ] Test project with single phase
- [ ] Test project with many phases (10+)
- [ ] Test phase spanning entire project duration
- [ ] Test phase with zero budgets
- [ ] Test assignments at phase boundaries
- [ ] Test assignments outside phase date ranges

## Error Monitoring

### 1. Application Logs

- [ ] Review application logs for errors
  ```bash
  docker-compose logs backend | grep -i error
  ```

- [ ] Check for database connection errors
- [ ] Look for validation errors
- [ ] Monitor for performance issues

### 2. Database Logs

- [ ] Review PostgreSQL logs
  ```bash
  tail -f /var/log/postgresql/postgresql-*.log
  ```

- [ ] Check for constraint violations
- [ ] Look for slow queries
- [ ] Monitor for deadlocks

### 3. User Feedback

- [ ] Collect feedback from QA team
- [ ] Document any issues or concerns
- [ ] Track bug reports in issue tracker

## Rollback Decision

If critical issues are found:

- [ ] Assess severity of issues
- [ ] Consult with team lead
- [ ] Make rollback decision
- [ ] Follow rollback procedure in PHASE_MIGRATION_RUNBOOK.md

## Sign-Off

### Migration Execution

- [ ] Migration completed successfully
- [ ] Verification script passed all checks
- [ ] Data integrity confirmed
- [ ] Services restarted successfully

**Executed by**: ________________  
**Date/Time**: ________________  
**Duration**: ________________

### Testing Completion

- [ ] All smoke tests passed
- [ ] Phase CRUD operations work correctly
- [ ] Resource assignments function properly
- [ ] Reports generate correctly
- [ ] API endpoints respond as expected
- [ ] Performance is acceptable
- [ ] No critical errors found

**Tested by**: ________________  
**Date/Time**: ________________  
**Issues found**: ________________

### Approval for Production

- [ ] Staging migration successful
- [ ] All tests passed
- [ ] No critical issues identified
- [ ] Team confident in production deployment
- [ ] Rollback procedure tested and understood

**Approved by**: ________________  
**Date/Time**: ________________  
**Production deployment scheduled for**: ________________

## Notes

Use this section to document any issues, observations, or lessons learned:

```
[Add notes here]
```

## Next Steps

After successful staging migration:

1. [ ] Schedule production migration
2. [ ] Update production runbook with any staging learnings
3. [ ] Prepare production communication plan
4. [ ] Coordinate with operations team
5. [ ] Set up production monitoring

## References

- Migration Runbook: `backend/docs/PHASE_MIGRATION_RUNBOOK.md`
- Verification Script: `backend/verify_migration.py`
- Rollback Verification: `backend/verify_rollback.py`
- Requirements: 7.1, 7.6
