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
  - ECS: Update services, run tasks, describe services
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

#### `STAGING_SUBNET_IDS`
- **Description**: Comma-separated list of subnet IDs for staging ECS tasks
- **Required for**: Staging deployments, migration tasks
- **Format**: `subnet-abc123,subnet-def456`
- **How to obtain**:
  ```bash
  aws ec2 describe-subnets \
    --filters "Name=tag:Environment,Values=staging" \
    --query 'Subnets[*].SubnetId' \
    --output text | tr '\t' ','
  ```

#### `STAGING_SECURITY_GROUP`
- **Description**: Security group ID for staging ECS tasks
- **Required for**: Staging deployments, migration tasks
- **Format**: `sg-abc123def`
- **How to obtain**:
  ```bash
  aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=planner-staging-ecs-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text
  ```

### Production Environment

#### `PRODUCTION_SUBNET_IDS`
- **Description**: Comma-separated list of subnet IDs for production ECS tasks
- **Required for**: Production deployments, migration tasks
- **Format**: `subnet-abc123,subnet-def456`
- **How to obtain**:
  ```bash
  aws ec2 describe-subnets \
    --filters "Name=tag:Environment,Values=production" \
    --query 'Subnets[*].SubnetId' \
    --output text | tr '\t' ','
  ```

#### `PRODUCTION_SECURITY_GROUP`
- **Description**: Security group ID for production ECS tasks
- **Required for**: Production deployments, migration tasks
- **Format**: `sg-abc123def`
- **How to obtain**:
  ```bash
  aws ec2 describe-security-groups \
    --filters "Name=tag:Name,Values=planner-production-ecs-sg" \
    --query 'SecurityGroups[0].GroupId' \
    --output text
  ```

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
      "Sid": "ECSAccess",
      "Effect": "Allow",
      "Action": [
        "ecs:DescribeTaskDefinition",
        "ecs:RegisterTaskDefinition",
        "ecs:UpdateService",
        "ecs:DescribeServices",
        "ecs:RunTask",
        "ecs:DescribeTasks",
        "ecs:ListTasks"
      ],
      "Resource": "*"
    },
    {
      "Sid": "IAMPassRole",
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::*:role/ecsTaskExecutionRole",
        "arn:aws:iam::*:role/planner-*-task-role"
      ]
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
    },
    {
      "Sid": "ELBAccess",
      "Effect": "Allow",
      "Action": [
        "elasticloadbalancing:DescribeLoadBalancers",
        "elasticloadbalancing:DescribeTargetGroups",
        "elasticloadbalancing:DescribeTargetHealth"
      ],
      "Resource": "*"
    },
    {
      "Sid": "EC2NetworkInfo",
      "Effect": "Allow",
      "Action": [
        "ec2:DescribeSubnets",
        "ec2:DescribeSecurityGroups"
      ],
      "Resource": "*"
    }
  ]
}
```

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

# Test ECS access
aws ecs list-clusters --region us-east-1
```

### Test Workflow

1. Push a commit to `develop` branch
2. Check Actions tab for workflow run
3. Verify all jobs complete successfully
4. Check staging deployment

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

### "Error: Unable to describe task definition"

**Cause**: ECS task definition doesn't exist or insufficient permissions

**Solution**:
1. Verify task definition exists in AWS
2. Check IAM policy includes `ecs:DescribeTaskDefinition`
3. Verify AWS region is correct

### "Error: Unable to run task"

**Cause**: Subnet or security group not found

**Solution**:
1. Verify `STAGING_SUBNET_IDS` or `PRODUCTION_SUBNET_IDS` are correct
2. Verify `STAGING_SECURITY_GROUP` or `PRODUCTION_SECURITY_GROUP` are correct
3. Check resources exist in correct AWS region

### "Error: Access denied"

**Cause**: IAM permissions insufficient

**Solution**:
1. Review IAM policy above
2. Add missing permissions
3. Verify IAM user is attached to policy

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
