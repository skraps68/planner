# ECS to EKS Migration Guide

## Overview

This document outlines the migration from AWS ECS Fargate to AWS EKS Fargate for the Planner application.

## What Changed

### Infrastructure (Terraform)

**Removed:**
- `infrastructure/aws/ecs.tf` - ECS cluster, task definitions, and services

**Added:**
- `infrastructure/aws/eks.tf` - EKS cluster, Fargate profiles, IAM roles, and addons
- `infrastructure/aws/policies/aws-load-balancer-controller-policy.json` - IAM policy for AWS Load Balancer Controller

**Modified:**
- `infrastructure/aws/variables.tf` - Replaced ECS variables with EKS variables
- `infrastructure/aws/outputs.tf` - Replaced ECS outputs with EKS outputs
- `infrastructure/aws/vpc.tf` - Updated security groups from `ecs_tasks` to `eks_pods`
- `infrastructure/aws/alb.tf` - Simplified (ALB now managed by AWS Load Balancer Controller)

### Kubernetes Manifests

**Added** (`infrastructure/kubernetes/`):
- `namespace.yaml` - Application namespace
- `serviceaccount.yaml` - Service account with IRSA
- `deployment.yaml` - Application deployment
- `service.yaml` - Kubernetes service
- `ingress.yaml` - Ingress for AWS Load Balancer Controller
- `hpa.yaml` - Horizontal Pod Autoscaler
- `job-migration.yaml` - Database migration job template
- `README.md` - Kubernetes deployment guide

### Scripts

**To Be Updated:**
- `scripts/deploy-ecs.sh` → `scripts/deploy-eks.sh` (needs complete rewrite for kubectl)

### GitHub Actions Workflows

**To Be Updated:**
- `.github/workflows/cd-staging.yml` - Replace ECS deployment with EKS/kubectl
- `.github/workflows/cd-production.yml` - Replace ECS deployment with EKS/kubectl
- `.github/workflows/deploy-manual.yml` - Replace ECS deployment with EKS/kubectl

### Documentation

**To Be Updated:**
- `docs/deployment/CICD_GUIDE.md` - Update for EKS deployment
- `docs/deployment/DEPLOYMENT_RUNBOOK.md` - Update for EKS procedures
- `docs/deployment/TROUBLESHOOTING.md` - Add EKS troubleshooting
- `infrastructure/aws/README.md` - Update for EKS infrastructure
- `.github/SECRETS.md` - Update required secrets for EKS

## Key Differences: ECS vs EKS

| Aspect | ECS Fargate | EKS Fargate |
|--------|-------------|-------------|
| **Orchestration** | AWS ECS | Kubernetes |
| **Task Definition** | ECS Task Definition (JSON) | Kubernetes Deployment (YAML) |
| **Service Discovery** | ECS Service | Kubernetes Service |
| **Load Balancing** | Direct ALB integration | AWS Load Balancer Controller + Ingress |
| **Auto Scaling** | ECS Auto Scaling | Horizontal Pod Autoscaler (HPA) |
| **Secrets** | AWS Secrets Manager (direct) | Kubernetes Secrets + AWS Secrets Manager |
| **Logging** | CloudWatch (automatic) | CloudWatch via Fluent Bit or Container Insights |
| **Deployment** | AWS CLI / ECS API | kubectl / Kubernetes API |
| **Rollback** | ECS task definition revision | kubectl rollout undo |
| **Health Checks** | ECS health checks | Kubernetes liveness/readiness probes |

## Migration Steps

### Phase 1: Infrastructure Setup (Terraform)

1. **Review and update Terraform variables**:
   ```bash
   cd infrastructure/aws
   cp terraform.tfvars.example terraform.tfvars
   # Edit terraform.tfvars with EKS-specific values
   ```

2. **Plan and apply Terraform changes**:
   ```bash
   terraform init
   terraform plan
   terraform apply
   ```

3. **Configure kubectl**:
   ```bash
   aws eks update-kubeconfig --region us-east-1 --name planner-production-cluster
   ```

4. **Verify EKS cluster**:
   ```bash
   kubectl get nodes
   kubectl get pods -A
   ```

### Phase 2: Install AWS Load Balancer Controller

1. **Create IAM OIDC provider** (already done by Terraform)

2. **Install AWS Load Balancer Controller**:
   ```bash
   helm repo add eks https://aws.github.io/eks-charts
   helm repo update
   
   helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
     -n kube-system \
     --set clusterName=planner-production-cluster \
     --set serviceAccount.create=true \
     --set serviceAccount.name=aws-load-balancer-controller \
     --set serviceAccount.annotations."eks\.amazonaws\.com/role-arn"="arn:aws:iam::ACCOUNT_ID:role/planner-production-aws-load-balancer-controller"
   ```

3. **Verify controller**:
   ```bash
   kubectl get deployment -n kube-system aws-load-balancer-controller
   ```

### Phase 3: Deploy Application

1. **Create namespace**:
   ```bash
   kubectl apply -f infrastructure/kubernetes/namespace.yaml
   ```

2. **Create secrets**:
   ```bash
   kubectl create secret generic planner-secrets \
     --from-literal=db-password="${DB_PASSWORD}" \
     --from-literal=secret-key="${SECRET_KEY}" \
     -n planner-app
   ```

3. **Deploy application** (see `infrastructure/kubernetes/README.md`)

### Phase 4: Update CI/CD Pipelines

1. Update GitHub Actions workflows to use kubectl instead of ECS CLI
2. Update deployment scripts
3. Test CI/CD pipeline in staging environment

### Phase 5: DNS Cutover

1. Update DNS to point to new ALB created by Ingress
2. Monitor application health
3. Verify all functionality works

### Phase 6: Cleanup Old ECS Resources

1. Delete ECS services and task definitions
2. Remove old ALB and target groups
3. Clean up unused IAM roles

## Required GitHub Secrets (Updated)

### New Secrets Needed:
- `EKS_CLUSTER_NAME` - Name of the EKS cluster
- `KUBE_CONFIG_DATA` - Base64-encoded kubeconfig (optional, can use AWS CLI)

### Existing Secrets (Still Needed):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `PRODUCTION_SUBNET_IDS` (for migration jobs)
- `PRODUCTION_SECURITY_GROUP` (for migration jobs)

## Rollback Plan

If issues occur during migration:

1. **Keep ECS infrastructure running** during initial EKS deployment
2. **DNS rollback**: Point DNS back to ECS ALB
3. **Database**: Ensure database is compatible with both deployments
4. **Monitoring**: Set up parallel monitoring for both ECS and EKS

## Testing Checklist

Before cutover:

- [ ] EKS cluster is healthy
- [ ] All pods are running
- [ ] Ingress/ALB is created and healthy
- [ ] Database connectivity works
- [ ] Redis connectivity works
- [ ] Health checks pass
- [ ] Application functionality verified
- [ ] Auto-scaling works
- [ ] Logging is configured
- [ ] Monitoring/alerts are set up
- [ ] CI/CD pipeline tested
- [ ] Rollback procedure tested

## Benefits of EKS over ECS

1. **Kubernetes Standard**: Industry-standard orchestration
2. **Portability**: Can run on any Kubernetes cluster (not AWS-specific)
3. **Ecosystem**: Access to vast Kubernetes ecosystem (Helm, operators, etc.)
4. **Advanced Features**: More sophisticated deployment strategies
5. **Multi-cloud**: Easier to migrate to other clouds if needed
6. **Community**: Larger community and more resources

## Considerations

1. **Learning Curve**: Kubernetes is more complex than ECS
2. **Management**: More components to manage (though Fargate helps)
3. **Cost**: Potentially higher costs due to control plane charges
4. **Debugging**: More layers to troubleshoot

## Next Steps

1. ✅ Update Terraform infrastructure files
2. ✅ Create Kubernetes manifests
3. ⏳ Update GitHub Actions workflows
4. ⏳ Update deployment scripts
5. ⏳ Update documentation
6. ⏳ Test in staging environment
7. ⏳ Deploy to production

## Status

**Current Status**: Infrastructure and Kubernetes manifests created

**Remaining Work**:
- Update GitHub Actions workflows (`.github/workflows/*.yml`)
- Create new deployment script (`scripts/deploy-eks.sh`)
- Update documentation files
- Test deployment

---

**Created**: January 24, 2026
**Last Updated**: January 24, 2026
