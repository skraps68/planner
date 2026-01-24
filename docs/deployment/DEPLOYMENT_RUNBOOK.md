# Deployment Runbook

## Overview

This runbook provides detailed step-by-step procedures for deploying updates to the Program and Project Management System in production.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Standard Deployment Procedure](#standard-deployment-procedure)
3. [Database Migration Procedure](#database-migration-procedure)
4. [Rollback Procedure](#rollback-procedure)
5. [Emergency Procedures](#emergency-procedures)
6. [Post-Deployment Verification](#post-deployment-verification)

---

## Pre-Deployment Checklist

### Before Every Deployment

- [ ] All tests passing in CI/CD pipeline
- [ ] Code review completed and approved
- [ ] Database migration scripts reviewed (if applicable)
- [ ] Backup of current database completed
- [ ] Deployment window scheduled and communicated
- [ ] Rollback plan prepared
- [ ] Monitoring and alerting systems checked
- [ ] Team members notified and available

### Environment Verification

```bash
# Verify current version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app python -c "from app.core.config import settings; print(settings.VERSION)"

# Check system resources
df -h  # Disk space
free -h  # Memory
docker stats --no-stream  # Container resources

# Verify database connectivity
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U planner_admin -d planner_production -c "SELECT version();"
```

---

## Standard Deployment Procedure

### Step 1: Create Backup

```bash
# Set backup timestamp
BACKUP_TIMESTAMP=$(date +%Y%m%d-%H%M%S)

# Backup database
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db pg_dump -U planner_admin planner_production > /var/backups/planner/pre-deploy-${BACKUP_TIMESTAMP}.sql

# Verify backup
ls -lh /var/backups/planner/pre-deploy-${BACKUP_TIMESTAMP}.sql

# Backup environment configuration
cp .env .env.backup-${BACKUP_TIMESTAMP}
```

### Step 2: Pull Latest Code

```bash
# Navigate to application directory
cd /path/to/planner

# Fetch latest changes
git fetch origin

# Check what will be deployed
git log HEAD..origin/main --oneline

# Pull latest code
git pull origin main

# Or checkout specific version
git checkout v1.2.3
```

### Step 3: Update Environment Variables (if needed)

```bash
# Compare environment files
diff .env .env.production.example

# Update .env if new variables added
nano .env

# Verify critical variables
grep -E "SECRET_KEY|POSTGRES_PASSWORD|REDIS_PASSWORD" .env
```

### Step 4: Build New Images

```bash
# Build production images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# Verify images built successfully
docker images | grep planner
```

### Step 5: Run Database Migrations (if applicable)

See [Database Migration Procedure](#database-migration-procedure) section.

### Step 6: Deploy New Version

```bash
# Stop current containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start new containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to be healthy
sleep 30
```

### Step 7: Verify Deployment

See [Post-Deployment Verification](#post-deployment-verification) section.

---

## Database Migration Procedure

### Pre-Migration Steps

```bash
# Review migration files
ls -la backend/alembic/versions/

# Check current migration version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic current

# Check pending migrations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic heads
```

### Migration Execution

```bash
# Dry run (if supported by your migrations)
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic upgrade head --sql > migration-preview.sql

# Review the SQL
cat migration-preview.sql

# Execute migrations
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic upgrade head

# Verify migration completed
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic current
```

### Post-Migration Verification

```bash
# Check database schema
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U planner_admin -d planner_production -c "\dt"

# Verify critical tables
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U planner_admin -d planner_production -c "SELECT COUNT(*) FROM programs;"

# Check for migration errors in logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app | grep -i "error\|exception"
```

---

## Rollback Procedure

### When to Rollback

- Critical bugs discovered in production
- Database migration failures
- Service health checks failing
- Significant performance degradation
- Security vulnerabilities introduced

### Rollback Steps

#### Step 1: Stop Current Services

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
```

#### Step 2: Revert Code

```bash
# Find previous version
git log --oneline -10

# Checkout previous version
git checkout <previous-commit-hash>

# Or checkout previous tag
git checkout v1.2.2
```

#### Step 3: Rollback Database (if migrations were run)

```bash
# Identify target migration version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic history

# Downgrade to previous version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app alembic downgrade <revision-id>

# Or restore from backup
BACKUP_FILE="/var/backups/planner/pre-deploy-<timestamp>.sql"
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U planner_admin -d planner_production < ${BACKUP_FILE}
```

#### Step 4: Rebuild and Restart

```bash
# Rebuild images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build

# Start services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Verify services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

#### Step 5: Verify Rollback

```bash
# Check application version
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app python -c "from app.core.config import settings; print(settings.VERSION)"

# Test health endpoint
curl https://your-domain.com/health

# Check logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app | tail -100
```

---

## Emergency Procedures

### Service Completely Down

```bash
# Check all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Check logs for all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=100

# Restart all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart

# If restart fails, recreate containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### Database Connection Lost

```bash
# Check database container
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps db

# Check database logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs db | tail -100

# Restart database
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart db

# Wait for database to be ready
sleep 10

# Restart application
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart app
```

### Out of Disk Space

```bash
# Check disk usage
df -h

# Clean up Docker resources
docker system prune -a --volumes

# Remove old backups (keep last 7 days)
find /var/backups/planner -name "*.sql" -mtime +7 -delete

# Remove old logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=0 app
```

### High Memory Usage

```bash
# Check container memory usage
docker stats --no-stream

# Restart high-memory containers
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart app

# If issue persists, increase memory limits in docker-compose.prod.yml
```

### Security Incident

```bash
# Immediately stop all services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Preserve logs for investigation
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs > /var/log/planner/incident-$(date +%Y%m%d-%H%M%S).log

# Rotate all secrets
# 1. Generate new SECRET_KEY
# 2. Update database passwords
# 3. Update Redis password
# 4. Regenerate SSL certificates if compromised

# Review and update .env file
nano .env

# Rebuild and restart with new secrets
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

---

## Post-Deployment Verification

### Automated Checks

```bash
# Health check
curl -f https://your-domain.com/health || echo "Health check failed!"

# API documentation accessible
curl -f https://your-domain.com/docs || echo "API docs not accessible!"

# Database connectivity
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app python -c "from app.db.session import SessionLocal; db = SessionLocal(); print('DB Connected')"
```

### Manual Verification

1. **Login Test**
   - Navigate to application URL
   - Attempt to log in with test credentials
   - Verify successful authentication

2. **Core Functionality Test**
   - Create a test program
   - Create a test project
   - Assign a resource
   - Verify data persists

3. **API Test**
   ```bash
   # Test authentication endpoint
   curl -X POST https://your-domain.com/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username":"test","password":"test"}'
   
   # Test programs endpoint
   curl https://your-domain.com/api/v1/programs \
     -H "Authorization: Bearer <token>"
   ```

4. **Performance Check**
   - Monitor response times
   - Check database query performance
   - Verify caching is working

5. **Log Review**
   ```bash
   # Check for errors
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app | grep -i "error\|exception\|critical"
   
   # Check for warnings
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app | grep -i "warning"
   ```

### Monitoring Dashboard Check

- Verify all metrics are reporting
- Check for any anomalies in:
  - Request rates
  - Error rates
  - Response times
  - Resource utilization

---

## Deployment Checklist Summary

### Pre-Deployment
- [ ] Backup database
- [ ] Backup environment configuration
- [ ] Review changes to be deployed
- [ ] Verify test results

### Deployment
- [ ] Pull latest code
- [ ] Update environment variables
- [ ] Build new images
- [ ] Run database migrations
- [ ] Deploy new version
- [ ] Verify services started

### Post-Deployment
- [ ] Health checks passing
- [ ] Login functionality working
- [ ] Core features operational
- [ ] No errors in logs
- [ ] Monitoring dashboards normal
- [ ] Team notified of completion

### If Issues Occur
- [ ] Execute rollback procedure
- [ ] Investigate root cause
- [ ] Document incident
- [ ] Plan remediation

---

## Contact Information

### Escalation Path

1. **Level 1**: On-call engineer
2. **Level 2**: Senior DevOps engineer
3. **Level 3**: Engineering manager
4. **Level 4**: CTO

### Emergency Contacts

- On-call rotation: [Link to PagerDuty/OpsGenie]
- Slack channel: #planner-production
- Email: devops@company.com

---

## Revision History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2024-01-24 | 1.0 | Initial runbook creation | DevOps Team |
