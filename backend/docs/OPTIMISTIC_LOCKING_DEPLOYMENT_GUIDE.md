# Optimistic Locking Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the optimistic locking feature to production. The deployment adds version-based concurrency control to all user-editable entities, preventing silent data loss from concurrent modifications.

### Key Information

- **Migration Required**: Yes (adds version columns to 13 tables)
- **Downtime Required**: No
- **Backwards Compatible**: Yes (existing data initialized with version=1)
- **Rollback Supported**: Yes (fully reversible)
- **Performance Impact**: Minimal (< 5% overhead)

## Pre-Deployment Checklist

### 1. Review Requirements

- [ ] All backend tests passing (unit, property, integration)
- [ ] All frontend tests passing
- [ ] Code review completed
- [ ] Documentation reviewed
- [ ] Staging environment tested

### 2. Database Preparation

- [ ] Database backup completed
- [ ] Backup verified and tested
- [ ] Database connection credentials available
- [ ] Sufficient disk space for migration (minimal space needed)
- [ ] Database user has ALTER TABLE permissions

### 3. Application Preparation

- [ ] Frontend build completed
- [ ] Backend dependencies installed
- [ ] Environment variables configured
- [ ] Monitoring and logging configured

### 4. Communication

- [ ] Stakeholders notified of deployment
- [ ] Support team briefed on new feature
- [ ] User documentation prepared
- [ ] Rollback plan communicated

## Deployment Steps

### Step 1: Backup Database

**Critical**: Always backup before running migrations.

```bash
# PostgreSQL backup
pg_dump -U <username> -h <host> -d <database> -F c -f backup_before_optimistic_locking_$(date +%Y%m%d_%H%M%S).dump

# Verify backup
pg_restore --list backup_before_optimistic_locking_*.dump | head -20

# Store backup securely
aws s3 cp backup_before_optimistic_locking_*.dump s3://your-backup-bucket/
```

**Estimated Time**: 2-10 minutes (depending on database size)

### Step 2: Deploy Backend Code

Deploy the backend application with the optimistic locking changes:

```bash
# Pull latest code
git pull origin main

# Install dependencies (if needed)
cd backend
pip install -r requirements.txt

# Verify migration file exists
ls alembic/versions/ceaed8172152_add_version_columns_for_optimistic_.py
```

**Estimated Time**: 2-5 minutes

### Step 3: Run Database Migration

Run the Alembic migration to add version columns:

```bash
cd backend

# Check current migration state
alembic current

# Preview migration
alembic upgrade head --sql > migration_preview.sql
cat migration_preview.sql

# Run migration
alembic upgrade head

# Verify migration completed
alembic current
```

**Expected Output**:
```
INFO  [alembic.runtime.migration] Running upgrade 976e6adbac6f -> ceaed8172152, Add version columns for optimistic locking
```

**Estimated Time**: 1-3 minutes

### Step 4: Verify Migration

Verify that version columns were added correctly:

```bash
# Connect to database
psql -U <username> -h <host> -d <database>

# Check portfolios table
\d portfolios

# Verify version column exists and has correct constraints
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'portfolios' AND column_name = 'version';

# Expected output:
# column_name | data_type | is_nullable | column_default
# version     | integer   | NO          | 1

# Verify existing data has version=1
SELECT id, name, version FROM portfolios LIMIT 5;

# Verify all 13 tables have version column
SELECT table_name 
FROM information_schema.columns 
WHERE column_name = 'version' 
  AND table_schema = 'public'
ORDER BY table_name;

# Expected tables:
# actuals
# portfolios
# programs
# project_phases
# projects
# rates
# resource_assignments
# resources
# scope_assignments
# user_roles
# users
# worker_types
# workers
```

**Estimated Time**: 2-5 minutes

### Step 5: Restart Application

Restart the backend application to load the new code:

```bash
# Docker Compose
docker-compose restart backend

# Kubernetes
kubectl rollout restart deployment/planner-backend -n planner

# Systemd
sudo systemctl restart planner-backend

# Verify application started successfully
curl http://localhost:8000/health
```

**Estimated Time**: 1-2 minutes

**Note**: No downtime is required. The application can continue running during migration, though it's recommended to restart after migration completes.

### Step 6: Deploy Frontend Code

Deploy the frontend application with optimistic locking support:

```bash
# Build frontend
cd frontend
npm run build

# Deploy to hosting (example: S3 + CloudFront)
aws s3 sync dist/ s3://your-frontend-bucket/
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"

# Or deploy to Kubernetes
kubectl rollout restart deployment/planner-frontend -n planner
```

**Estimated Time**: 3-10 minutes

**Note**: Frontend deployment can happen before or after backend deployment. The frontend gracefully handles both versioned and non-versioned APIs.

### Step 7: Verify Deployment

Test the deployed application:

```bash
# Test API health
curl https://your-api-domain.com/health

# Test version field in API response
curl -H "Authorization: Bearer <token>" \
  https://your-api-domain.com/api/v1/portfolios | jq '.[0].version'

# Expected output: 1 (or higher if entity was updated)

# Test frontend loads
curl -I https://your-frontend-domain.com

# Expected: HTTP 200 OK
```

**Manual Testing**:
1. Log into the application
2. Open a portfolio (or any entity)
3. Verify version field is displayed (if UI shows it)
4. Make an update
5. Verify update succeeds
6. Open two browser tabs with the same entity
7. Update in tab 1
8. Update in tab 2 with stale data
9. Verify conflict dialog appears

**Estimated Time**: 5-10 minutes

### Step 8: Monitor Application

Monitor the application for any issues:

```bash
# Check application logs
kubectl logs -f deployment/planner-backend -n planner

# Check for errors
kubectl logs deployment/planner-backend -n planner | grep ERROR

# Monitor conflict rate
# (Check your monitoring dashboard for 409 responses)
```

**What to Monitor**:
- Error rate (should remain stable)
- Response times (should increase < 5%)
- 409 Conflict responses (track frequency)
- Database CPU/memory (should remain stable)

**Estimated Time**: Ongoing (first 30 minutes critical)

## Post-Deployment Verification

### Functional Testing

Test key workflows to ensure optimistic locking works correctly:

#### Test 1: Single User Update
```
1. User opens Portfolio A (version=1)
2. User updates Portfolio A name
3. Verify update succeeds
4. Verify version incremented to 2
5. Verify updated_at timestamp changed
```

#### Test 2: Concurrent Update Conflict
```
1. User A opens Portfolio B (version=1)
2. User B opens Portfolio B (version=1)
3. User A updates Portfolio B (version becomes 2)
4. User B attempts to update Portfolio B with version=1
5. Verify User B receives 409 Conflict
6. Verify conflict response includes current state
7. Verify User B can refresh and retry
```

#### Test 3: Bulk Update Partial Success
```
1. User opens Resource Assignment Calendar
2. User modifies 10 assignments
3. Another user updates 2 of those assignments
4. User saves all 10 assignments
5. Verify 8 succeed, 2 fail with conflicts
6. Verify UI shows which assignments failed
7. Verify user can retry failed assignments
```

### Performance Testing

Verify performance impact is minimal:

```bash
# Before deployment baseline (from monitoring)
# Average response time: X ms
# 95th percentile: Y ms

# After deployment
# Average response time: should be < X * 1.05 (5% increase)
# 95th percentile: should be < Y * 1.05

# Database query count
# Should remain the same (no additional queries)

# Database CPU usage
# Should remain stable
```

### Data Integrity Verification

Verify all existing data has correct version:

```sql
-- Check all tables have version column
SELECT 
  table_name,
  COUNT(*) as row_count,
  MIN(version) as min_version,
  MAX(version) as max_version
FROM (
  SELECT 'portfolios' as table_name, version FROM portfolios
  UNION ALL
  SELECT 'programs', version FROM programs
  UNION ALL
  SELECT 'projects', version FROM projects
  UNION ALL
  SELECT 'project_phases', version FROM project_phases
  UNION ALL
  SELECT 'resources', version FROM resources
  UNION ALL
  SELECT 'worker_types', version FROM worker_types
  UNION ALL
  SELECT 'workers', version FROM workers
  UNION ALL
  SELECT 'resource_assignments', version FROM resource_assignments
  UNION ALL
  SELECT 'rates', version FROM rates
  UNION ALL
  SELECT 'actuals', version FROM actuals
  UNION ALL
  SELECT 'users', version FROM users
  UNION ALL
  SELECT 'user_roles', version FROM user_roles
  UNION ALL
  SELECT 'scope_assignments', version FROM scope_assignments
) all_versions
GROUP BY table_name
ORDER BY table_name;

-- Expected: All tables have min_version=1, max_version>=1
```

## Rollback Procedure

If issues are discovered, rollback using these steps:

### Step 1: Assess Impact

Determine if rollback is necessary:

- **Minor Issues**: Can be fixed with a hotfix (preferred)
- **Major Issues**: Require full rollback

**Rollback Triggers**:
- Application crashes or errors
- Data corruption
- Unacceptable performance degradation
- Critical functionality broken

### Step 2: Rollback Database Migration

```bash
cd backend

# Check current migration
alembic current

# Rollback one migration
alembic downgrade -1

# Verify rollback
alembic current

# Expected: Previous migration (976e6adbac6f)
```

**What This Does**:
- Removes version columns from all 13 tables
- Preserves all other data
- Restores database to pre-migration state

**Estimated Time**: 1-2 minutes

### Step 3: Verify Rollback

```sql
-- Verify version columns removed
SELECT table_name 
FROM information_schema.columns 
WHERE column_name = 'version' 
  AND table_schema = 'public';

-- Expected: No results (version columns removed)

-- Verify data integrity
SELECT COUNT(*) FROM portfolios;
SELECT COUNT(*) FROM programs;
-- etc.

-- Expected: Same counts as before migration
```

### Step 4: Rollback Application Code

```bash
# Revert to previous version
git revert <commit-hash>
git push origin main

# Or checkout previous tag
git checkout <previous-tag>

# Redeploy backend
docker-compose restart backend
# or
kubectl rollout undo deployment/planner-backend -n planner

# Redeploy frontend
# (Frontend should work with or without version field)
```

**Estimated Time**: 5-10 minutes

### Step 5: Verify Rollback Complete

```bash
# Test API
curl https://your-api-domain.com/health

# Verify version field not in response
curl -H "Authorization: Bearer <token>" \
  https://your-api-domain.com/api/v1/portfolios | jq '.[0] | has("version")'

# Expected: false

# Test application functionality
# (All features should work as before)
```

### Step 6: Restore from Backup (If Needed)

If data corruption occurred (unlikely):

```bash
# Stop application
docker-compose stop backend
# or
kubectl scale deployment/planner-backend --replicas=0 -n planner

# Restore database
pg_restore -U <username> -h <host> -d <database> -c backup_before_optimistic_locking_*.dump

# Verify restore
psql -U <username> -h <host> -d <database> -c "SELECT COUNT(*) FROM portfolios;"

# Restart application
docker-compose start backend
# or
kubectl scale deployment/planner-backend --replicas=3 -n planner
```

**Estimated Time**: 10-30 minutes (depending on database size)

## Monitoring for Conflict Frequency

After deployment, monitor conflict frequency to identify issues:

### Metrics to Track

1. **Overall Conflict Rate**
   ```
   Conflicts per hour = (409 responses) / (total update requests)
   Target: < 5%
   ```

2. **Conflict Rate by Entity Type**
   ```
   Track which entities have the most conflicts
   High conflict rate may indicate:
   - High concurrency on specific entities
   - UI issues (not refreshing data)
   - User workflow issues
   ```

3. **Conflict Rate by User**
   ```
   Track which users experience the most conflicts
   High conflict rate may indicate:
   - Training needed
   - Workflow issues
   - Multiple users sharing accounts (bad practice)
   ```

4. **Retry Success Rate**
   ```
   Successful retries / Total conflicts
   Target: > 80%
   Low rate may indicate:
   - UI issues
   - User confusion
   - Rapid concurrent edits
   ```

### Setting Up Monitoring

#### Application Logs

Conflicts are logged with structured data:

```json
{
  "level": "WARNING",
  "message": "Version conflict on portfolio 123e4567-e89b-12d3-a456-426614174000",
  "entity_type": "portfolio",
  "entity_id": "123e4567-e89b-12d3-a456-426614174000",
  "expected_version": 5,
  "actual_version": 6,
  "user_id": "user-uuid",
  "timestamp": "2024-02-13T10:30:00Z"
}
```

#### CloudWatch Metrics (AWS)

```python
# In your error handler
cloudwatch.put_metric_data(
    Namespace='Planner/OptimisticLocking',
    MetricData=[
        {
            'MetricName': 'VersionConflicts',
            'Value': 1,
            'Unit': 'Count',
            'Dimensions': [
                {'Name': 'EntityType', 'Value': entity_type},
                {'Name': 'Environment', 'Value': 'production'}
            ]
        }
    ]
)
```

#### Prometheus Metrics

```python
from prometheus_client import Counter

version_conflicts = Counter(
    'version_conflicts_total',
    'Total number of version conflicts',
    ['entity_type', 'environment']
)

# In your error handler
version_conflicts.labels(
    entity_type=entity_type,
    environment='production'
).inc()
```

#### Grafana Dashboard

Create a dashboard with:
- Conflict rate over time (line chart)
- Conflicts by entity type (bar chart)
- Conflicts by user (table)
- Retry success rate (gauge)

### Alerting Rules

Set up alerts for:

```yaml
# High overall conflict rate
- alert: HighConflictRate
  expr: rate(version_conflicts_total[5m]) > 0.05
  for: 10m
  annotations:
    summary: "High version conflict rate detected"
    description: "Conflict rate is {{ $value }} (> 5%)"

# High conflict rate for specific entity
- alert: HighEntityConflictRate
  expr: rate(version_conflicts_total{entity_type="portfolio"}[5m]) > 0.10
  for: 10m
  annotations:
    summary: "High conflict rate for {{ $labels.entity_type }}"
    description: "Conflict rate is {{ $value }} (> 10%)"

# Repeated conflicts for same entity
- alert: RepeatedEntityConflicts
  expr: increase(version_conflicts_total{entity_id="..."}[1h]) > 10
  annotations:
    summary: "Repeated conflicts on entity {{ $labels.entity_id }}"
    description: "Entity has {{ $value }} conflicts in the last hour"
```

## Troubleshooting

### Issue: Migration Fails

**Symptoms**: Alembic migration fails with error

**Possible Causes**:
- Insufficient database permissions
- Version column already exists
- Database connection issues

**Resolution**:
```bash
# Check database permissions
psql -U <username> -h <host> -d <database> -c "SELECT current_user, session_user;"

# Check if version column already exists
psql -U <username> -h <host> -d <database> -c "\d portfolios"

# If column exists, migration may have partially completed
# Check migration state
alembic current

# If needed, manually complete or rollback
```

### Issue: High Conflict Rate

**Symptoms**: > 10% of updates result in conflicts

**Possible Causes**:
- Multiple users editing same entities simultaneously
- UI not refreshing data before edits
- Automated processes conflicting with user edits

**Resolution**:
1. Identify which entities have high conflict rate
2. Check if specific users are affected
3. Review UI refresh logic
4. Consider adding optimistic UI updates
5. Review automated processes

### Issue: Frontend Not Showing Conflicts

**Symptoms**: Users report lost changes, no conflict dialog

**Possible Causes**:
- Frontend not handling 409 responses
- Frontend not sending version in updates
- Frontend error handling broken

**Resolution**:
```javascript
// Verify 409 handling
console.log('Checking conflict handling...');
try {
  await updateEntity(id, data, oldVersion);
} catch (error) {
  console.log('Error status:', error.response?.status);
  console.log('Error data:', error.response?.data);
  // Should log 409 and conflict details
}

// Verify version being sent
console.log('Update payload:', { ...data, version });
// Should include version field
```

### Issue: Performance Degradation

**Symptoms**: Response times increased > 5%

**Possible Causes**:
- Missing database indexes
- Inefficient version checking
- Database lock contention

**Resolution**:
```sql
-- Check for missing indexes
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename IN ('portfolios', 'programs', 'projects', ...);

-- Check for lock contention
SELECT * FROM pg_stat_activity 
WHERE wait_event_type = 'Lock';

-- Analyze query performance
EXPLAIN ANALYZE 
UPDATE portfolios 
SET name = 'Test', version = version + 1 
WHERE id = '...' AND version = 5;
```

## Support and Escalation

### Support Contacts

- **Development Team**: dev-team@example.com
- **Database Team**: dba-team@example.com
- **DevOps Team**: devops-team@example.com
- **On-Call**: Use PagerDuty or on-call rotation

### Escalation Path

1. **Level 1**: Check this deployment guide
2. **Level 2**: Contact development team
3. **Level 3**: Initiate rollback procedure
4. **Level 4**: Restore from backup

### Documentation

- [Optimistic Locking API Documentation](./OPTIMISTIC_LOCKING_API.md)
- [API Documentation Index](./API_DOCUMENTATION_INDEX.md)
- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)
- [Database Migrations](../../docs/deployment/DATABASE_MIGRATIONS.md)

## Deployment Checklist Summary

Use this checklist during deployment:

### Pre-Deployment
- [ ] All tests passing
- [ ] Code review completed
- [ ] Database backup completed
- [ ] Stakeholders notified

### Deployment
- [ ] Backend code deployed
- [ ] Database migration run
- [ ] Migration verified
- [ ] Application restarted
- [ ] Frontend code deployed
- [ ] Deployment verified

### Post-Deployment
- [ ] Functional testing completed
- [ ] Performance verified
- [ ] Monitoring configured
- [ ] Alerts set up
- [ ] Team notified of completion

### Rollback (If Needed)
- [ ] Impact assessed
- [ ] Database migration rolled back
- [ ] Application code reverted
- [ ] Rollback verified
- [ ] Incident documented

## Conclusion

The optimistic locking deployment is straightforward and low-risk:

- **No downtime required**
- **Fully backwards compatible**
- **Minimal performance impact**
- **Fully reversible**

Follow this guide carefully, and the deployment should complete smoothly in 15-30 minutes.

For questions or issues, contact the development team or refer to the documentation links above.
