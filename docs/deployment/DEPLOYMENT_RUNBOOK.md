# Deployment Runbook

## Overview

This runbook provides detailed step-by-step procedures for deploying updates to the Program and Project Management System in production on AWS EKS (Elastic Kubernetes Service) Fargate.

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
# Update kubeconfig for EKS cluster
aws eks update-kubeconfig --name planner-production-cluster --region us-east-1

# Update deployment with new image
kubectl set image deployment/planner-app app=<account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:latest -n planner-production

# Or apply updated manifests
kubectl apply -f infrastructure/kubernetes/deployment.yaml

# Wait for rollout to complete
kubectl rollout status deployment/planner-app -n planner-production

# Verify pods are running
kubectl get pods -n planner-production
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
# Execute migrations using Kubernetes Job
kubectl apply -f infrastructure/kubernetes/job-migration.yaml

# Monitor job progress
kubectl get jobs -n planner-production -w

# Check job logs
kubectl logs job/planner-migration -n planner-production

# Verify migration completed successfully
kubectl get jobs planner-migration -n planner-production -o jsonpath='{.status.succeeded}'

# Or connect to a running pod to check migration status
POD_NAME=$(kubectl get pods -n planner-production -l app=planner-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD_NAME -n planner-production -- alembic current
```

### Post-Migration Verification

```bash
# Check database schema (connect to RDS endpoint)
psql -h <rds-endpoint> -U planner_admin -d planner_production -c "\dt"

# Verify critical tables
psql -h <rds-endpoint> -U planner_admin -d planner_production -c "SELECT COUNT(*) FROM programs;"

# Check for migration errors in logs
kubectl logs job/planner-migration -n planner-production | grep -i "error\|exception"

# Or check application pod logs
kubectl logs -l app=planner-app -n planner-production | grep -i "error\|exception"
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

#### Step 1: Rollback Kubernetes Deployment

```bash
# Rollback to previous revision
kubectl rollout undo deployment/planner-app -n planner-production

# Or rollback to specific revision
kubectl rollout undo deployment/planner-app -n planner-production --to-revision=2

# Monitor rollback progress
kubectl rollout status deployment/planner-app -n planner-production
```

#### Step 2: Revert Code (if needed)

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
# Create a Kubernetes Job to run migration rollback
# Or connect to a pod to run alembic downgrade
POD_NAME=$(kubectl get pods -n planner-production -l app=planner-app -o jsonpath='{.items[0].metadata.name}')

# Identify target migration version
kubectl exec -it $POD_NAME -n planner-production -- alembic history

# Downgrade to previous version
kubectl exec -it $POD_NAME -n planner-production -- alembic downgrade <revision-id>

# Or restore from RDS snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier planner-production-db-restored \
  --db-snapshot-identifier <snapshot-id> \
  --region us-east-1
```

#### Step 4: Rebuild and Deploy (if needed)

```bash
# Build and push new image with previous version
docker build -t planner-production-app:v1.2.2 -f Dockerfile --target production .
docker tag planner-production-app:v1.2.2 <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:v1.2.2
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:v1.2.2

# Update deployment with previous image
kubectl set image deployment/planner-app app=<account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:v1.2.2 -n planner-production

# Wait for rollout
kubectl rollout status deployment/planner-app -n planner-production
```

#### Step 5: Verify Rollback

```bash
# Check pod status
kubectl get pods -n planner-production

# Check application version
POD_NAME=$(kubectl get pods -n planner-production -l app=planner-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD_NAME -n planner-production -- python -c "from app.core.config import settings; print(settings.VERSION)"

# Test health endpoint
curl https://your-domain.com/health

# Check logs
kubectl logs -l app=planner-app -n planner-production --tail=100
```

---

## Emergency Procedures

### Service Completely Down

```bash
# Check all pods
kubectl get pods -n planner-production

# Check pod logs
kubectl logs -l app=planner-app -n planner-production --tail=100

# Check deployment status
kubectl describe deployment planner-app -n planner-production

# Restart pods (delete and let deployment recreate)
kubectl rollout restart deployment/planner-app -n planner-production

# If restart fails, check events
kubectl get events -n planner-production --sort-by='.lastTimestamp'
```

### Database Connection Lost

```bash
# Check RDS instance status
aws rds describe-db-instances \
  --db-instance-identifier planner-production-db \
  --query 'DBInstances[0].DBInstanceStatus' \
  --region us-east-1

# Check RDS events
aws rds describe-events \
  --source-identifier planner-production-db \
  --source-type db-instance \
  --region us-east-1

# Restart application pods
kubectl rollout restart deployment/planner-app -n planner-production

# Check pod logs for connection errors
kubectl logs -l app=planner-app -n planner-production --tail=100
```

### Out of Disk Space

```bash
# Check EBS volume usage (if using persistent volumes)
kubectl get pv

# Check pod ephemeral storage
kubectl top pods -n planner-production

# Clean up old images from ECR
aws ecr list-images \
  --repository-name planner-production-app \
  --region us-east-1

# Delete old images
aws ecr batch-delete-image \
  --repository-name planner-production-app \
  --image-ids imageTag=old-tag \
  --region us-east-1

# Clean up completed jobs
kubectl delete jobs --field-selector status.successful=1 -n planner-production
```

### High Memory Usage

```bash
# Check pod memory usage
kubectl top pods -n planner-production

# Check pod resource limits
kubectl describe pod -l app=planner-app -n planner-production | grep -A 5 "Limits:"

# Restart high-memory pods
kubectl rollout restart deployment/planner-app -n planner-production

# If issue persists, increase memory limits in deployment.yaml
```

### Security Incident

```bash
# Immediately scale down deployment
kubectl scale deployment planner-app --replicas=0 -n planner-production

# Preserve logs for investigation
kubectl logs -l app=planner-app -n planner-production --all-containers=true > /var/log/planner/incident-$(date +%Y%m%d-%H%M%S).log

# Rotate all secrets
# 1. Generate new SECRET_KEY
# 2. Update database passwords in AWS Secrets Manager
# 3. Update Redis password in AWS Secrets Manager
# 4. Regenerate SSL certificates if compromised

# Update Kubernetes secrets
kubectl create secret generic planner-secrets \
  --from-literal=SECRET_KEY=<new-key> \
  --from-literal=POSTGRES_PASSWORD=<new-password> \
  --from-literal=REDIS_PASSWORD=<new-password> \
  --dry-run=client -o yaml | kubectl apply -f - -n planner-production

# Rebuild and redeploy with new secrets
docker build -t planner-production-app:secure -f Dockerfile --target production .
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:secure
kubectl set image deployment/planner-app app=<account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:secure -n planner-production
kubectl scale deployment planner-app --replicas=2 -n planner-production
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
POD_NAME=$(kubectl get pods -n planner-production -l app=planner-app -o jsonpath='{.items[0].metadata.name}')
kubectl exec -it $POD_NAME -n planner-production -- python -c "from app.db.session import SessionLocal; db = SessionLocal(); print('DB Connected')"
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
   kubectl logs -l app=planner-app -n planner-production | grep -i "error\|exception\|critical"
   
   # Check for warnings
   kubectl logs -l app=planner-app -n planner-production | grep -i "warning"
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
