# GitHub Actions Secrets Configuration

This document lists all the secrets required for the CI/CD pipelines to function properly.

## Required Secrets

Configure these secrets in your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

### AWS Credentials

#### `AWS_ACCESS_KEY_ID`
- **Description**: AWS access key ID for deployment operations
- **Required for**: All CD workflows
- **Permissions needed**:
  - ECR: Push/pull images
  - EKS: Update kubeconfig, describe cluster
  - RDS: Create snapshots (production only)
  - CloudWatch: Read logs
- **How to obtain**:
  1. Create IAM user for GitHub Actions
  2. Attach appropriate policies (see IAM Policy section below)
  3. Generate access key
  4. Copy access key ID

#### `AWS_SECRET_ACCESS_KEY`
- **Description**: AWS secret access key for deployment operations
- **Required for**: All CD workflows
- **How to obtain**: Generated with `AWS_ACCESS_KEY_ID`
- **Security**: Never commit or log this value

### Staging Environment

#### `STAGING_DB_HOST`
- **Description**: RDS database hostname for staging
- **Required for**: Staging deployments
- **Format**: `planner-staging-db.xxxxx.us-east-1.rds.amazonaws.com`
- **How to obtain**: From Terraform outputs or RDS console

#### `STAGING_DB_PORT`
- **Description**: RDS database port for staging
- **Required for**: Staging deployments
- **Format**: `5432`
- **Default**: `5432` for PostgreSQL

#### `STAGING_DB_NAME`
- **Description**: Database name for staging
- **Required for**: Staging deployments
- **Format**: `planner`

#### `STAGING_DB_USER`
- **Description**: Database username for staging
- **Required for**: Staging deployments
- **Format**: `planner_admin`

#### `STAGING_DB_PASSWORD`
- **Description**: Database password for staging
- **Required for**: Staging deployments
- **Security**: Store securely, never commit

#### `STAGING_REDIS_HOST`
- **Description**: ElastiCache Redis hostname for staging
- **Required for**: Staging deployments
- **Format**: `planner-staging-redis.xxxxx.cache.amazonaws.com`

#### `STAGING_REDIS_PORT`
- **Description**: Redis port for staging
- **Required for**: Staging deployments
- **Format**: `6379`
- **Default**: `6379`

#### `STAGING_SECRET_KEY`
- **Description**: Application secret key for staging
- **Required for**: Staging deployments
- **Security**: Generate a strong random key

#### `STAGING_APP_POD_ROLE_ARN`
- **Description**: IAM role ARN for application pods (IRSA)
- **Required for**: Staging deployments
- **Format**: `arn:aws:iam::123456789012:role/planner-staging-app-pod-role`
- **How to obtain**: From Terraform outputs

#### `STAGING_CERTIFICATE_ARN`
- **Description**: ACM certificate ARN for HTTPS (optional)
- **Required for**: Staging ingress with HTTPS
- **Format**: `arn:aws:acm:us-east-1:123456789012:certificate/xxxxx`

#### `STAGING_DOMAIN_NAME`
- **Description**: Domain name for staging environment (optional)
- **Required for**: Staging ingress
- **Format**: `staging.planner.example.com`

### Production Environment

#### `PRODUCTION_DB_HOST`
- **Description**: RDS database hostname for production
- **Required for**: Production deployments
- **Format**: `planner-production-db.xxxxx.us-east-1.rds.amazonaws.com`
- **How to obtain**: From Terraform outputs or RDS console

#### `PRODUCTION_DB_PORT`
- **Description**: RDS database port for production
- **Required for**: Production deployments
- **Format**: `5432`
- **Default**: `5432` for PostgreSQL

#### `PRODUCTION_DB_NAME`
- **Description**: Database name for production
- **Required for**: Production deployments
- **Format**: `planner`

#### `PRODUCTION_DB_USER`
- **Description**: Database username for production
- **Required for**: Production deployments
- **Format**: `planner_admin`

#### `PRODUCTION_DB_PASSWORD`
- **Description**: Database password for production
- **Required for**: Production deployments
- **Security**: Store securely, never commit

#### `PRODUCTION_REDIS_HOST`
- **Description**: ElastiCache Redis hostname for production
- **Required for**: Production deployments
- **Format**: `planner-production-redis.xxxxx.cache.amazonaws.com`

#### `PRODUCTION_REDIS_PORT`
- **Description**: Redis port for production
- **Required for**: Production deployments
- **Format**: `6379`
- **Default**: `6379`

#### `PRODUCTION_SECRET_KEY`
- **Description**: Application secret key for production
- **Required for**: Production deployments
- **Security**: Generate a strong random key

#### `PRODUCTION_APP_POD_ROLE_ARN`
- **Description**: IAM role ARN for application pods (IRSA)
- **Required for**: Production deployments
- **Format**: `arn:aws:iam::123456789012:role/planner-production-app-pod-role`
- **How to obtain**: From Terraform outputs

#### `PRODUCTION_CERTIFICATE_ARN`
- **Description**: ACM certificate ARN for HTTPS (optional)
- **Required for**: Production ingress with HTTPS
- **Format**: `arn:aws:acm:us-east-1:123456789012:certificate/xxxxx`

#### `PRODUCTION_DOMAIN_NAME`
- **Description**: Domain name for production environment (optional)
- **Required for**: Production ingress
- **Format**: `planner.example.com`

## Optional Secrets

### `CODECOV_TOKEN`
- **Description**: Token for uploading coverage reports to Codecov
- **Required for**: CI pipeline (optional)
- **How to obtain**: Sign up at codecov.io and get repository token

### `SLACK_WEBHOOK_URL`
- **Description**: Webhook URL for Slack notifications
- **Required for**: Deployment notifications (optional)
- **How to obtain**: Create incoming webhook in Slack workspace

## IAM Policy for GitHub Actions

Create an IAM user with the following policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ECRAccess",
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "ecr:PutImage",
        "ecr:InitiateLayerUpload",
        "ecr:UploadLayerPart",
        "ecr:CompleteLayerUpload",
        "ecr:DescribeRepositories"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EKSAccess",
      "Effect": "Allow",
      "Action": [
        "eks:DescribeCluster",
        "eks:ListClusters"
      ],
      "Resource": "*"
    },
    {
      "Sid": "RDSSnapshots",
      "Effect": "Allow",
      "Action": [
        "rds:CreateDBSnapshot",
        "rds:DescribeDBSnapshots"
      ],
      "Resource": "*"
    },
    {
      "Sid": "CloudWatchLogs",
      "Effect": "Allow",
      "Action": [
        "logs:GetLogEvents",
        "logs:FilterLogEvents",
        "logs:DescribeLogStreams"
      ],
      "Resource": "*"
    }
  ]
}
```

**Note**: The GitHub Actions workflows use `kubectl` to interact with EKS. The IAM user needs permissions to update kubeconfig, which is provided by the `eks:DescribeCluster` permission. Kubernetes RBAC within the cluster controls what operations can be performed.

## Environment Configuration

GitHub Actions environments provide additional security and approval workflows.

### Configure Environments

1. Go to **Settings → Environments**
2. Create two environments:
   - `staging`
   - `production`

### Staging Environment

- **Protection rules**: None (auto-deploy)
- **Secrets**: Can use repository secrets
- **Reviewers**: Optional

### Production Environment

- **Protection rules**:
  - ✅ Required reviewers (at least 1)
  - ✅ Wait timer: 5 minutes
  - ✅ Deployment branches: `main` only
- **Secrets**: Can override repository secrets if needed
- **Reviewers**: Add senior engineers/DevOps team

## Verification

After configuring secrets, verify they work:

### Test AWS Credentials

```bash
# Set secrets as environment variables locally
export AWS_ACCESS_KEY_ID="your-key-id"
export AWS_SECRET_ACCESS_KEY="your-secret-key"

# Test ECR access
aws ecr describe-repositories --region us-east-1

# Test EKS access
aws eks list-clusters --region us-east-1
aws eks describe-cluster --name planner-production-cluster --region us-east-1
```

### Test kubectl Access

```bash
# Update kubeconfig
aws eks update-kubeconfig --region us-east-1 --name planner-production-cluster

# Test cluster access
kubectl cluster-info
kubectl get nodes
kubectl get namespaces
```

### Test Workflow

1. Push a commit to `develop` branch
2. Check Actions tab for workflow run
3. Verify all jobs complete successfully
4. Check staging deployment:
   ```bash
   kubectl get pods -n planner-app
   kubectl get deployment -n planner-app
   ```

## Security Best Practices

### Rotation Schedule

- **AWS credentials**: Rotate every 90 days
- **Webhook URLs**: Rotate if compromised
- **Review access**: Quarterly audit

### Access Control

- Limit repository access to necessary personnel
- Use environment protection rules for production
- Enable branch protection on `main` and `develop`
- Require pull request reviews

### Monitoring

- Enable AWS CloudTrail for API calls
- Monitor GitHub Actions usage
- Set up alerts for failed deployments
- Review audit logs regularly

### Secrets Management

- Never commit secrets to repository
- Use GitHub Secrets, not environment variables in workflows
- Rotate compromised secrets immediately
- Document all secrets in this file

## Troubleshooting

### "Error: Credentials could not be loaded"

**Cause**: AWS credentials not configured or invalid

**Solution**:
1. Verify `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are set
2. Check IAM user has required permissions
3. Verify credentials are not expired

### "Error: Unable to describe cluster"

**Cause**: EKS cluster doesn't exist or insufficient permissions

**Solution**:
1. Verify cluster exists in AWS
2. Check IAM policy includes `eks:DescribeCluster`
3. Verify AWS region is correct
4. Ensure cluster name matches environment

### "Error: Unable to connect to cluster"

**Cause**: kubectl cannot connect to EKS cluster

**Solution**:
1. Verify kubeconfig is updated correctly
2. Check cluster endpoint is accessible
3. Verify IAM permissions for EKS
4. Check network connectivity

### "Error: Forbidden - User cannot create resource"

**Cause**: Kubernetes RBAC permissions insufficient

**Solution**:
1. Verify IAM role has proper Kubernetes RBAC bindings
2. Check if user/role is mapped in aws-auth ConfigMap
3. Ensure service account has necessary permissions
4. Review Kubernetes RBAC roles and bindings

### "Error: Migration job failed"

**Cause**: Database migration job failed

**Solution**:
1. Check migration job logs: `kubectl logs -n planner-app job/planner-migration-xxxxx`
2. Verify database credentials are correct
3. Check database connectivity from pods
4. Review Alembic migration scripts

### "Error: Pods not starting"

**Cause**: Various pod startup issues

**Solution**:
1. Check pod status: `kubectl describe pod <pod-name> -n planner-app`
2. View pod logs: `kubectl logs <pod-name> -n planner-app`
3. Verify secrets exist: `kubectl get secrets -n planner-app`
4. Check resource limits and node capacity
5. Verify image exists in ECR

## Additional Resources

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [AWS IAM Best Practices](https://docs.aws.amazon.com/IAM/latest/UserGuide/best-practices.html)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)

## Support

For issues with secrets configuration:
1. Check this documentation
2. Verify secrets in GitHub UI
3. Test AWS credentials locally
4. Contact DevOps team

---

**Last Updated**: 2024-01-24  
**Maintained By**: DevOps Team
