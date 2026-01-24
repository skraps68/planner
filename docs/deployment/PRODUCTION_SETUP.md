# Production Environment Setup Guide

## Overview

This guide provides step-by-step instructions for setting up the Program and Project Management System in a production environment on AWS EKS (Elastic Kubernetes Service) Fargate.

## Prerequisites

### System Requirements

- **Cloud Platform**: AWS Account with appropriate permissions
- **Kubernetes**: kubectl CLI tool
- **AWS CLI**: Version 2.0 or higher
- **Terraform**: Version 1.0 or higher
- **Docker**: Version 20.10 or higher (for local builds)
- **Domain name**: Optional, for HTTPS setup
- **SSL certificates**: For HTTPS (can use AWS Certificate Manager)

### Required Access

- AWS account with permissions for:
  - EKS cluster creation and management
  - VPC and networking resources
  - RDS database instances
  - ElastiCache clusters
  - ECR repositories
  - IAM roles and policies
  - Secrets Manager
  - CloudWatch logs and metrics
- Domain name (optional, for custom domain)
- SSL certificates (can use AWS Certificate Manager)

## Installation Steps

### 1. Install Required Tools

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install -o root -g root -m 0755 kubectl /usr/local/bin/kubectl

# Install Terraform
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Verify installations
aws --version
kubectl version --client
terraform --version
```

### 2. Configure AWS Credentials

```bash
# Configure AWS CLI
aws configure
# Enter your AWS Access Key ID
# Enter your AWS Secret Access Key
# Enter your default region (e.g., us-east-1)
# Enter your default output format (json)
```

### 3. Clone the Repository

```bash
# Clone the repository
git clone <repository-url>
cd planner

# Checkout the desired version/tag
git checkout main  # or specific version tag
```

### 4. Deploy AWS Infrastructure with Terraform

```bash
# Navigate to infrastructure directory
cd infrastructure/aws

# Copy example variables file
cp terraform.tfvars.example terraform.tfvars

# Edit with your values
nano terraform.tfvars

# Initialize Terraform
terraform init

# Review the plan
terraform plan

# Apply the configuration
terraform apply
```

**Critical Terraform Variables to Update:**
- `db_password`: Strong database password
- `secret_key`: Application secret key (generate with `openssl rand -hex 32`)
- `domain_name`: Your domain name (optional)
- `alert_email`: Email for CloudWatch alerts
- `app_image`: ECR image URL (will be available after first push)

### 5. Configure kubectl for EKS

```bash
# Update kubeconfig for EKS cluster
aws eks update-kubeconfig --name planner-production-cluster --region us-east-1

# Verify connection
kubectl get nodes
kubectl get namespaces
```

### 6. Build and Push Docker Image to ECR

```bash
# Get ECR login command
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build image
docker build -t planner-production-app:latest -f Dockerfile --target production .

# Tag image
docker tag planner-production-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:latest

# Push image
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/planner-production-app:latest
```

### 7. Deploy Kubernetes Resources

```bash
# Navigate to Kubernetes manifests directory
cd ../../infrastructure/kubernetes

# Create namespace
kubectl apply -f namespace.yaml

# Create secrets (update values first)
kubectl create secret generic planner-secrets \
  --from-literal=SECRET_KEY=<your-secret-key> \
  --from-literal=POSTGRES_PASSWORD=<your-db-password> \
  --from-literal=REDIS_PASSWORD=<your-redis-password> \
  -n planner-production

# Deploy application
kubectl apply -f deployment.yaml
kubectl apply -f service.yaml
kubectl apply -f hpa.yaml
kubectl apply -f ingress.yaml

# Verify deployment
kubectl get pods -n planner-production
kubectl get svc -n planner-production
kubectl get ingress -n planner-production
```

### 8. Run Database Migrations

```bash
# Apply migration job
kubectl apply -f job-migration.yaml

# Monitor migration job
kubectl get jobs -n planner-production -w

# Check migration logs
kubectl logs job/planner-migration -n planner-production

# Verify migration completed
kubectl get jobs planner-migration -n planner-production -o jsonpath='{.status.succeeded}'
```

### 9. Verify Installation

```bash
# Check all pods are running
kubectl get pods -n planner-production

# Check application logs
kubectl logs -l app=planner-app -n planner-production

# Get ingress URL
kubectl get ingress -n planner-production

# Test API health endpoint
curl http://<ingress-url>/health

# Or with custom domain
curl https://your-domain.com/health
```

## Post-Installation Configuration

### Configure Backup Strategy

```bash
# Create backup directory
mkdir -p /var/backups/planner

# Set up automated database backups (add to crontab)
0 2 * * * docker-compose -f /path/to/docker-compose.yml -f /path/to/docker-compose.prod.yml exec -T db pg_dump -U planner_admin planner_production > /var/backups/planner/backup-$(date +\%Y\%m\%d-\%H\%M\%S).sql
```

### Configure Log Rotation

```bash
# Create logrotate configuration
sudo nano /etc/logrotate.d/planner
```

Add the following content:

```
/var/lib/docker/containers/*/*.log {
    rotate 7
    daily
    compress
    missingok
    delaycompress
    copytruncate
}
```

### Set Up Monitoring

1. Configure application monitoring (Sentry, Datadog, etc.)
2. Set up server monitoring (CPU, memory, disk usage)
3. Configure alerting for critical issues
4. Set up log aggregation

## Security Hardening

### 1. Disable Debug Mode

Ensure in `.env`:
```bash
DEBUG=false
ENVIRONMENT=production
```

### 2. Restrict Database Access

```bash
# Only allow connections from application container
# Configure PostgreSQL pg_hba.conf if using external database
```

### 3. Enable Rate Limiting

The Nginx configuration includes rate limiting. Adjust as needed in `nginx/nginx.conf`.

### 4. Regular Security Updates

```bash
# Update system packages
sudo apt-get update && sudo apt-get upgrade -y

# Update Docker images
docker-compose -f docker-compose.yml -f docker-compose.prod.yml pull
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

### 5. Configure Secrets Management

For production, consider using:
- AWS Secrets Manager
- HashiCorp Vault
- Docker Secrets

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs

# Check specific service
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app

# Restart services
docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart
```

### Database Connection Issues

```bash
# Check database is running
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps db

# Test database connection
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db psql -U planner_admin -d planner_production

# Check database logs
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs db
```

### Performance Issues

```bash
# Check resource usage
docker stats

# Check application logs for errors
docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app | grep ERROR

# Increase resources if needed (edit docker-compose.prod.yml)
```

## Maintenance

### Regular Tasks

- **Daily**: Check application logs for errors
- **Weekly**: Review system resource usage
- **Monthly**: Update Docker images and system packages
- **Quarterly**: Review and rotate SSL certificates
- **Annually**: Review and update security configurations

### Backup Verification

```bash
# Test backup restoration periodically
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db psql -U planner_admin -d planner_test < /var/backups/planner/backup-latest.sql
```

## Support

For issues or questions:
- Check the troubleshooting guide
- Review application logs
- Contact the development team
- Refer to the deployment runbook for detailed procedures
