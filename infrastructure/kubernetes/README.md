# Kubernetes Manifests for EKS Deployment

This directory contains Kubernetes manifests for deploying the Planner application to Amazon EKS with Fargate.

## Files

- `namespace.yaml` - Creates the planner-app namespace
- `serviceaccount.yaml` - Service account with IAM role for pods (IRSA)
- `deployment.yaml` - Application deployment configuration
- `service.yaml` - Kubernetes service for the application
- `ingress.yaml` - Ingress resource for AWS Load Balancer Controller
- `hpa.yaml` - Horizontal Pod Autoscaler configuration
- `job-migration.yaml` - Database migration job template

## Prerequisites

Before deploying, ensure:

1. **EKS Cluster** is created via Terraform
2. **AWS Load Balancer Controller** is installed in the cluster
3. **Secrets** are created in the cluster:
   ```bash
   kubectl create secret generic planner-secrets \
     --from-literal=db-password='your-db-password' \
     --from-literal=secret-key='your-secret-key' \
     -n planner-app
   ```

## Deployment Order

1. **Namespace**:
   ```bash
   kubectl apply -f namespace.yaml
   ```

2. **Secrets** (create manually or via CI/CD):
   ```bash
   kubectl create secret generic planner-secrets \
     --from-literal=db-password="${DB_PASSWORD}" \
     --from-literal=secret-key="${SECRET_KEY}" \
     -n planner-app
   ```

3. **Service Account**:
   ```bash
   # Replace ${APP_POD_ROLE_ARN} with actual IAM role ARN
   envsubst < serviceaccount.yaml | kubectl apply -f -
   ```

4. **Deployment**:
   ```bash
   # Set environment variables first
   export ECR_REGISTRY="123456789012.dkr.ecr.us-east-1.amazonaws.com"
   export ECR_REPOSITORY="planner-app"
   export IMAGE_TAG="v1.0.0"
   export ENVIRONMENT="production"
   export DB_HOST="planner-production-db.xxxxx.us-east-1.rds.amazonaws.com"
   export DB_PORT="5432"
   export DB_NAME="planner"
   export DB_USER="planner_admin"
   export REDIS_HOST="planner-production-redis.xxxxx.cache.amazonaws.com"
   export REDIS_PORT="6379"
   
   envsubst < deployment.yaml | kubectl apply -f -
   ```

5. **Service**:
   ```bash
   kubectl apply -f service.yaml
   ```

6. **Ingress**:
   ```bash
   # Set additional environment variables
   export CERTIFICATE_ARN="arn:aws:acm:us-east-1:123456789012:certificate/xxxxx"
   export DOMAIN_NAME="planner.example.com"
   
   envsubst < ingress.yaml | kubectl apply -f -
   ```

7. **Horizontal Pod Autoscaler**:
   ```bash
   kubectl apply -f hpa.yaml
   ```

## Running Database Migrations

To run database migrations:

```bash
export TIMESTAMP=$(date +%Y%m%d%H%M%S)
envsubst < job-migration.yaml | kubectl apply -f -

# Watch the job
kubectl get jobs -n planner-app -w

# View logs
kubectl logs -n planner-app job/planner-migration-${TIMESTAMP}
```

## Verifying Deployment

```bash
# Check pods
kubectl get pods -n planner-app

# Check service
kubectl get svc -n planner-app

# Check ingress and ALB
kubectl get ingress -n planner-app
kubectl describe ingress planner-app-ingress -n planner-app

# Check HPA
kubectl get hpa -n planner-app

# View logs
kubectl logs -n planner-app -l app=planner --tail=100 -f
```

## Updating the Application

To update to a new version:

```bash
# Update the image tag
export IMAGE_TAG="v1.1.0"

# Run migrations first
export TIMESTAMP=$(date +%Y%m%d%H%M%S)
envsubst < job-migration.yaml | kubectl apply -f -

# Wait for migration to complete
kubectl wait --for=condition=complete --timeout=300s job/planner-migration-${TIMESTAMP} -n planner-app

# Update deployment
envsubst < deployment.yaml | kubectl apply -f -

# Watch rollout
kubectl rollout status deployment/planner-app -n planner-app
```

## Rollback

To rollback to a previous version:

```bash
# View rollout history
kubectl rollout history deployment/planner-app -n planner-app

# Rollback to previous version
kubectl rollout undo deployment/planner-app -n planner-app

# Rollback to specific revision
kubectl rollout undo deployment/planner-app --to-revision=2 -n planner-app
```

## Scaling

Manual scaling:

```bash
# Scale to specific number of replicas
kubectl scale deployment/planner-app --replicas=5 -n planner-app
```

The HPA will automatically scale based on CPU and memory utilization.

## Troubleshooting

### Pods not starting

```bash
# Describe pod
kubectl describe pod <pod-name> -n planner-app

# Check events
kubectl get events -n planner-app --sort-by='.lastTimestamp'

# Check logs
kubectl logs <pod-name> -n planner-app
```

### Ingress/ALB issues

```bash
# Check ingress
kubectl describe ingress planner-app-ingress -n planner-app

# Check AWS Load Balancer Controller logs
kubectl logs -n kube-system deployment/aws-load-balancer-controller
```

### Database connection issues

```bash
# Test database connectivity from a pod
kubectl run -it --rm debug --image=postgres:15 --restart=Never -n planner-app -- \
  psql -h ${DB_HOST} -U ${DB_USER} -d ${DB_NAME}
```

## Cleanup

To remove all resources:

```bash
kubectl delete -f hpa.yaml
kubectl delete -f ingress.yaml
kubectl delete -f service.yaml
kubectl delete -f deployment.yaml
kubectl delete -f serviceaccount.yaml
kubectl delete secret planner-secrets -n planner-app
kubectl delete -f namespace.yaml
```

## CI/CD Integration

These manifests are designed to work with the GitHub Actions workflows in `.github/workflows/`. The workflows will:

1. Build and push Docker images to ECR
2. Update kubeconfig to access the EKS cluster
3. Run database migrations via Kubernetes Job
4. Update the deployment with the new image
5. Wait for rollout to complete
6. Verify deployment health

See `.github/workflows/cd-production.yml` for the complete CI/CD pipeline.
