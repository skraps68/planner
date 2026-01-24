# CI/CD Pipeline Guide

This document describes the Continuous Integration and Continuous Deployment (CI/CD) pipelines for the Planner application.

## Overview

The CI/CD pipeline is implemented using GitHub Actions and consists of:

1. **CI Pipeline** - Automated testing and validation on every push/PR
2. **CD Staging Pipeline** - Automated deployment to staging on develop branch
3. **CD Production Pipeline** - Automated deployment to production on main branch
4. **Manual Deployment** - On-demand deployment with custom options

The application is deployed to AWS EKS (Elastic Kubernetes Service) on Fargate for serverless container orchestration.

## CI Pipeline

**Workflow File**: `.github/workflows/ci.yml`

**Triggers**:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop` branches

**Jobs**:

### 1. Backend Tests
- Sets up Python 3.11 environment
- Starts PostgreSQL and Redis services
- Runs linting (flake8)
- Runs type checking (mypy)
- Executes pytest with coverage reporting
- Uploads coverage reports to Codecov

### 2. Frontend Tests
- Sets up Node.js 18 environment
- Runs ESLint for code quality
- Runs TypeScript type checking
- Executes frontend tests with coverage
- Builds production bundle
- Archives build artifacts

### 3. Docker Build Test
- Tests Docker image builds for both development and production targets
- Uses Docker Buildx for efficient caching
- Validates Dockerfile syntax and build process

### 4. Security Scanning
- Runs Trivy vulnerability scanner on filesystem
- Executes Bandit security linter for Python code
- Uploads security reports to GitHub Security tab
- Archives security reports as artifacts

### 5. Integration Tests
- Starts full application stack with Docker Compose
- Runs database migrations
- Executes integration test suite
- Validates service health endpoints
- Provides logs on failure

## CD Staging Pipeline

**Workflow File**: `.github/workflows/cd-staging.yml`

**Triggers**:
- Push to `develop` branch
- Manual workflow dispatch

**Environment**: `staging`

**Deployment Steps**:

1. **Build and Push Image**
   - Builds production Docker image
   - Tags with commit SHA and `staging-latest`
   - Pushes to Amazon ECR

2. **Database Migration**
   - Runs Alembic migrations in Kubernetes Job
   - Waits for job completion
   - Validates migration success

3. **EKS Deployment**
   - Updates Kubernetes deployment with new image
   - Deploys to EKS Fargate
   - Waits for rollout completion

4. **Verification**
   - Checks health endpoint
   - Validates service is responding

5. **Rollback on Failure**
   - Automatically rolls back to previous task definition if deployment fails
   - Notifies about rollback status

## CD Production Pipeline

**Workflow File**: `.github/workflows/cd-production.yml`

**Triggers**:
- Push to `main` branch
- Git tags matching `v*.*.*` pattern
- Manual workflow dispatch

**Environment**: `production`

**Deployment Steps**:

1. **Build and Push Image**
   - Builds production Docker image
   - Tags with version/SHA and `production-latest`
   - Pushes to Amazon ECR

2. **Database Backup**
   - Creates RDS snapshot before migration
   - Waits for backup completion
   - Provides backup identifier for recovery

3. **Database Migration**
   - Runs Alembic migrations in Kubernetes Job
   - Monitors job execution
   - Validates migration exit code

4. **EKS Deployment**
   - Updates Kubernetes deployment with new image
   - Deploys to EKS Fargate
   - Waits for rollout completion

5. **Verification**
   - Extended health checks (60s wait)
   - Validates multiple endpoints
   - Runs smoke tests

6. **GitHub Release**
   - Creates GitHub release for version tags
   - Documents deployment details
   - Links to deployed service

7. **Rollback on Failure**
   - Automatically rolls back to previous task definition if deployment fails
   - Provides detailed rollback information

## Manual Deployment Workflow

**Workflow File**: `.github/workflows/deploy-manual.yml`

**Trigger**: Manual workflow dispatch only

**Input Parameters**:

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `environment` | choice | Target environment (staging/production) | Required |
| `image_tag` | string | Docker image tag to deploy | latest |
| `skip_migrations` | boolean | Skip database migrations | false |
| `force_deployment` | boolean | Force new deployment | false |

**Use Cases**:

1. **Deploy Specific Version**
   ```
   environment: production
   image_tag: v1.2.3
   skip_migrations: false
   force_deployment: false
   ```

2. **Hotfix Deployment**
   ```
   environment: production
   image_tag: hotfix-abc123
   skip_migrations: true
   force_deployment: true
   ```

3. **Rollback to Previous Version**
   ```
   environment: production
   image_tag: v1.2.2
   skip_migrations: true
   force_deployment: true
   ```

## Required GitHub Secrets

Configure these secrets in your GitHub repository settings:

### AWS Credentials
- `AWS_ACCESS_KEY_ID` - AWS access key for deployment
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for deployment
- `AWS_REGION` - AWS region (default: us-east-1)

### EKS Configuration
- `EKS_CLUSTER_NAME` - EKS cluster name (e.g., planner-production-cluster)
- `KUBE_CONFIG_DATA` - Base64-encoded kubeconfig (optional, generated from EKS)

## EKS Deployment Helper Script

**Script**: `scripts/deploy-eks.sh`

A command-line tool for manual EKS operations:

### Commands

```bash
# Deploy to environment
./scripts/deploy-eks.sh deploy staging
./scripts/deploy-eks.sh deploy production --image-tag v1.2.3

# Rollback deployment
./scripts/deploy-eks.sh rollback production

# Check deployment status
./scripts/deploy-eks.sh status staging

# View logs
./scripts/deploy-eks.sh logs production
./scripts/deploy-eks.sh logs staging pod-name-123

# Run migrations
./scripts/deploy-eks.sh migrate staging

# Scale deployment
./scripts/deploy-eks.sh scale staging 3
```

### Options

- `--image-tag <tag>` - Specify image tag (default: latest)
- `--skip-migrations` - Skip database migrations
- `--force` - Force new deployment

### Prerequisites

1. AWS CLI installed and configured
2. `kubectl` installed and configured
3. `jq` installed for JSON processing
4. Appropriate AWS credentials with EKS permissions
5. Environment variables set:
   - `AWS_REGION` (default: us-east-1)
   - `ECR_REPOSITORY` (default: planner-app)
   - `EKS_CLUSTER_NAME` (default: planner-production-cluster)

## Deployment Workflow

### Staging Deployment

1. **Developer pushes to develop branch**
2. CI pipeline runs automatically
3. If CI passes, CD staging pipeline triggers
4. Application deploys to staging environment
5. Automated verification runs
6. Team tests in staging environment

### Production Deployment

1. **Create release branch from develop**
2. Merge release branch to main via PR
3. CI pipeline validates the merge
4. CD production pipeline triggers automatically
5. Database backup created
6. Migrations run
7. Application deploys to production
8. Automated verification runs
9. GitHub release created

### Hotfix Deployment

1. **Create hotfix branch from main**
2. Fix the issue and test locally
3. Merge hotfix to main via PR
4. CD production pipeline triggers
5. Or use manual deployment for faster deployment

## Rollback Procedures

### Automatic Rollback

Both staging and production pipelines include automatic rollback:
- Triggered on deployment failure
- Reverts to previous deployment revision
- Maintains service availability

### Manual Rollback

Using GitHub Actions:
1. Go to Actions → Manual Deployment
2. Select environment
3. Enter previous version tag
4. Check "skip_migrations" and "force_deployment"
5. Run workflow

Using CLI script:
```bash
./scripts/deploy-eks.sh rollback production
```

Using kubectl:
```bash
# Rollback to previous revision
kubectl rollout undo deployment/planner-app -n planner-production

# Rollback to specific revision
kubectl rollout undo deployment/planner-app -n planner-production --to-revision=2
```

## Monitoring Deployments

### GitHub Actions UI
- View workflow runs in Actions tab
- Check job logs for detailed information
- Download artifacts (coverage reports, security scans)

### AWS CloudWatch
- View EKS pod logs
- Check container logs
- Monitor CloudWatch alarms

### EKS Console
- View deployment status
- Check pod health
- Review deployment history

### CLI Monitoring
```bash
# Check deployment status
./scripts/deploy-eks.sh status production

# View real-time logs
./scripts/deploy-eks.sh logs production

# Check deployment events
kubectl describe deployment planner-app -n planner-production

# View pod status
kubectl get pods -n planner-production
```

## Troubleshooting

### Deployment Fails at Migration Step

**Symptoms**: Migration task exits with non-zero code

**Solutions**:
1. Check migration logs in CloudWatch
2. Verify database connectivity
3. Review migration scripts for errors
4. Rollback and fix migration
5. Redeploy with corrected migration

### Service Fails Health Checks

**Symptoms**: Kubernetes deployment doesn't reach ready state

**Solutions**:
1. Check pod logs with kubectl
2. Verify environment variables in deployment manifest
3. Check security group rules
4. Verify database and Redis connectivity
5. Review application startup logs

### Image Push Fails

**Symptoms**: ECR push fails in workflow

**Solutions**:
1. Verify AWS credentials are valid
2. Check ECR repository exists
3. Verify IAM permissions for ECR
4. Check Docker build succeeds locally

### Rollback Doesn't Work

**Symptoms**: Automatic rollback fails

**Solutions**:
1. Use manual rollback via kubectl
2. Check previous deployment revision exists
3. Verify Kubernetes service account permissions
4. Force new deployment with known good version

## Best Practices

### Version Tagging
- Use semantic versioning (v1.2.3)
- Tag releases in Git
- Document changes in release notes

### Database Migrations
- Test migrations in staging first
- Keep migrations backward compatible
- Create database backups before production migrations
- Have rollback plan for migrations

### Deployment Timing
- Deploy to staging during business hours
- Deploy to production during low-traffic periods
- Notify team before production deployments
- Have team available during production deployments

### Monitoring
- Watch CloudWatch alarms during deployment
- Monitor application logs for errors
- Check health endpoints after deployment
- Verify key functionality works

### Security
- Rotate AWS credentials regularly
- Use least-privilege IAM policies
- Keep secrets in AWS Secrets Manager
- Review security scan results

## Additional Resources

- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Alembic Migration Guide](https://alembic.sqlalchemy.org/)

## Support

For deployment issues:
1. Check this guide first
2. Review workflow logs in GitHub Actions
3. Check CloudWatch logs
4. Contact DevOps team
5. Create incident ticket if critical
