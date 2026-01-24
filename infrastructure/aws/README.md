# AWS ECS Fargate Infrastructure

This directory contains Terraform configuration for deploying the Program and Project Management System to AWS ECS Fargate.

## Architecture Overview

The infrastructure includes:

- **VPC**: Multi-AZ VPC with public and private subnets
- **ECS Fargate**: Containerized application with auto-scaling
- **RDS PostgreSQL**: Managed database with automated backups
- **ElastiCache Redis**: Managed cache cluster
- **Application Load Balancer**: HTTPS load balancer with SSL/TLS
- **S3**: Storage for application data and ALB logs
- **ECR**: Container image registry
- **CloudWatch**: Logging and monitoring
- **Secrets Manager**: Secure credential storage
- **SNS**: Alerting and notifications

## Prerequisites

1. **AWS Account**: Active AWS account with appropriate permissions
2. **Terraform**: Version 1.0 or higher
3. **AWS CLI**: Configured with credentials
4. **Domain Name**: (Optional) For custom domain and SSL certificate

## Initial Setup

### 1. Install Terraform

```bash
# macOS
brew install terraform

# Linux
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

### 2. Configure AWS Credentials

```bash
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
```

### 3. Create S3 Backend for Terraform State

```bash
# Create S3 bucket for Terraform state
aws s3api create-bucket \
  --bucket planner-terraform-state \
  --region us-east-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket planner-terraform-state \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name planner-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5 \
  --region us-east-1
```

### 4. Configure Variables

```bash
# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars
```

**Important Variables to Update:**
- `db_password`: Strong database password
- `secret_key`: Application secret key (generate with `openssl rand -hex 32`)
- `domain_name`: Your domain name (optional)
- `alert_email`: Email for CloudWatch alerts
- `app_image`: ECR image URL (will be available after first push)

## Deployment Steps

### 1. Initialize Terraform

```bash
terraform init
```

### 2. Review Plan

```bash
terraform plan
```

### 3. Apply Configuration

```bash
terraform apply
```

Review the changes and type `yes` to confirm.

### 4. Build and Push Docker Image

```bash
# Get ECR login command
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t planner-production-app:latest -f ../../Dockerfile --target production ../../

# Tag image
docker tag planner-production-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:latest

# Push image
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:latest
```

### 5. Update ECS Service

```bash
# Force new deployment with updated image
aws ecs update-service \
  --cluster planner-production-cluster \
  --service planner-production-service \
  --force-new-deployment \
  --region us-east-1
```

### 6. Run Database Migrations

```bash
# Get ECS task ARN
TASK_ARN=$(aws ecs list-tasks \
  --cluster planner-production-cluster \
  --service-name planner-production-service \
  --query 'taskArns[0]' \
  --output text \
  --region us-east-1)

# Run migrations
aws ecs execute-command \
  --cluster planner-production-cluster \
  --task $TASK_ARN \
  --container app \
  --interactive \
  --command "alembic upgrade head" \
  --region us-east-1
```

## Accessing the Application

After deployment, you can access the application at:

- **With custom domain**: `https://your-domain.com`
- **Without custom domain**: `https://<alb-dns-name>` (from Terraform outputs)

Get the ALB DNS name:

```bash
terraform output alb_dns_name
```

## Monitoring

### CloudWatch Dashboard

Access the CloudWatch dashboard:

```bash
# Get dashboard URL
echo "https://console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=planner-production-dashboard"
```

### View Logs

```bash
# View application logs
aws logs tail /ecs/planner-production-app --follow --region us-east-1

# View specific time range
aws logs tail /ecs/planner-production-app --since 1h --region us-east-1
```

### CloudWatch Alarms

Alarms are configured for:
- ECS CPU and memory utilization
- RDS CPU, memory, and storage
- ALB response time and errors
- ElastiCache CPU and memory
- Application errors

## Scaling

### Manual Scaling

```bash
# Scale ECS service
aws ecs update-service \
  --cluster planner-production-cluster \
  --service planner-production-service \
  --desired-count 4 \
  --region us-east-1
```

### Auto Scaling

Auto-scaling is configured based on:
- CPU utilization (target: 70%)
- Memory utilization (target: 80%)

Adjust thresholds in `variables.tf`:
- `autoscaling_target_cpu`
- `autoscaling_target_memory`

## Backup and Recovery

### Database Backups

Automated backups are configured:
- **Retention**: 7 days (configurable)
- **Backup window**: 03:00-04:00 UTC
- **Maintenance window**: Sunday 04:00-05:00 UTC

### Manual Backup

```bash
# Create manual snapshot
aws rds create-db-snapshot \
  --db-instance-identifier planner-production-db \
  --db-snapshot-identifier planner-manual-backup-$(date +%Y%m%d-%H%M%S) \
  --region us-east-1
```

### Restore from Backup

```bash
# List available snapshots
aws rds describe-db-snapshots \
  --db-instance-identifier planner-production-db \
  --region us-east-1

# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier planner-production-db-restored \
  --db-snapshot-identifier <snapshot-id> \
  --region us-east-1
```

## Cost Optimization

### Estimated Monthly Costs

- **ECS Fargate** (2 tasks): ~$60
- **RDS db.t3.medium**: ~$70
- **ElastiCache cache.t3.medium**: ~$50
- **ALB**: ~$20
- **Data Transfer**: Variable
- **CloudWatch**: ~$10
- **Total**: ~$210/month

### Cost Reduction Tips

1. **Use Reserved Instances** for RDS and ElastiCache
2. **Enable S3 Lifecycle Policies** for old logs
3. **Adjust Auto-Scaling** thresholds
4. **Use Spot Instances** for non-critical workloads
5. **Review CloudWatch Logs** retention

## Troubleshooting

### ECS Tasks Not Starting

```bash
# Check service events
aws ecs describe-services \
  --cluster planner-production-cluster \
  --services planner-production-service \
  --region us-east-1

# Check task logs
aws logs tail /ecs/planner-production-app --follow --region us-east-1
```

### Database Connection Issues

```bash
# Test database connectivity from ECS task
aws ecs execute-command \
  --cluster planner-production-cluster \
  --task $TASK_ARN \
  --container app \
  --interactive \
  --command "psql -h $POSTGRES_SERVER -U $POSTGRES_USER -d $POSTGRES_DB" \
  --region us-east-1
```

### High Costs

```bash
# Check cost breakdown
aws ce get-cost-and-usage \
  --time-period Start=2024-01-01,End=2024-01-31 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --group-by Type=SERVICE \
  --region us-east-1
```

## Updating Infrastructure

### Update Terraform Configuration

```bash
# Make changes to .tf files
nano variables.tf

# Review changes
terraform plan

# Apply changes
terraform apply
```

### Update Application

```bash
# Build and push new image
docker build -t planner-production-app:v1.1.0 -f ../../Dockerfile --target production ../../
docker tag planner-production-app:v1.1.0 <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:v1.1.0
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:v1.1.0

# Update task definition with new image
# Then force new deployment
aws ecs update-service \
  --cluster planner-production-cluster \
  --service planner-production-service \
  --force-new-deployment \
  --region us-east-1
```

## Destroying Infrastructure

**WARNING**: This will delete all resources and data!

```bash
# Disable deletion protection on RDS
aws rds modify-db-instance \
  --db-instance-identifier planner-production-db \
  --no-deletion-protection \
  --apply-immediately \
  --region us-east-1

# Wait for modification to complete
aws rds wait db-instance-available \
  --db-instance-identifier planner-production-db \
  --region us-east-1

# Destroy infrastructure
terraform destroy
```

## Security Best Practices

1. **Use Secrets Manager** for all sensitive data
2. **Enable MFA** on AWS account
3. **Restrict IAM permissions** to minimum required
4. **Enable VPC Flow Logs** for network monitoring
5. **Regular security audits** with AWS Security Hub
6. **Keep dependencies updated** in Docker images
7. **Enable AWS GuardDuty** for threat detection
8. **Use AWS WAF** on ALB for additional protection

## Support

For issues or questions:
- Check CloudWatch logs
- Review Terraform state
- Contact DevOps team
- Refer to AWS documentation

## Additional Resources

- [Terraform AWS Provider Documentation](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
- [AWS ECS Documentation](https://docs.aws.amazon.com/ecs/)
- [AWS RDS Documentation](https://docs.aws.amazon.com/rds/)
- [AWS Best Practices](https://aws.amazon.com/architecture/well-architected/)
