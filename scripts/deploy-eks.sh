#!/bin/bash

# EKS Deployment Helper Script
# This script helps with common EKS deployment tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-planner-app}"
K8S_NAMESPACE="planner-app"
DEPLOYMENT_NAME="planner-app"

# Functions
print_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  deploy <env>              Deploy to environment (staging|production)"
    echo "  rollback <env>            Rollback to previous deployment"
    echo "  status <env>              Check deployment status"
    echo "  logs <env> [pod-name]     View logs from pods"
    echo "  migrate <env>             Run database migrations"
    echo "  scale <env> <count>       Scale deployment to desired count"
    echo "  restart <env>             Restart deployment"
    echo "  describe <env>            Describe deployment details"
    echo ""
    echo "Options:"
    echo "  --image-tag <tag>         Specify image tag (default: latest)"
    echo "  --skip-migrations         Skip database migrations"
    echo "  --force                   Force new deployment"
    echo ""
    echo "Examples:"
    echo "  $0 deploy staging"
    echo "  $0 deploy production --image-tag v1.2.3"
    echo "  $0 rollback production"
    echo "  $0 status staging"
    echo "  $0 logs production"
    echo "  $0 migrate staging"
    echo "  $0 scale staging 3"
}

get_cluster_name() {
    local env=$1
    echo "planner-${env}-cluster"
}

check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}Error: AWS credentials not configured${NC}"
        exit 1
    fi
}

check_kubectl() {
    if ! command -v kubectl &> /dev/null; then
        echo -e "${RED}Error: kubectl is not installed${NC}"
        exit 1
    fi
}

configure_kubectl() {
    local env=$1
    local cluster=$(get_cluster_name $env)
    
    echo -e "${YELLOW}Configuring kubectl for ${cluster}...${NC}"
    aws eks update-kubeconfig --region $AWS_REGION --name $cluster
    
    # Verify connection
    kubectl cluster-info &> /dev/null || {
        echo -e "${RED}Error: Failed to connect to cluster${NC}"
        exit 1
    }
}

deploy() {
    local env=$1
    local image_tag=${2:-"${env}-latest"}
    local skip_migrations=${3:-false}
    local force=${4:-false}
    
    echo -e "${GREEN}Deploying to ${env} environment...${NC}"
    
    configure_kubectl $env
    
    # Get ECR registry
    local ecr_registry=$(aws ecr describe-repositories \
        --repository-names $ECR_REPOSITORY \
        --region $AWS_REGION \
        --query 'repositories[0].repositoryUri' \
        --output text | cut -d'/' -f1)
    
    local image="${ecr_registry}/${ECR_REPOSITORY}:${image_tag}"
    
    echo "Image: $image"
    
    # Set environment variables
    export ECR_REGISTRY=$ecr_registry
    export IMAGE_TAG=$image_tag
    export ENVIRONMENT=$env
    
    # Load environment-specific variables
    if [ "$env" == "production" ]; then
        export DB_HOST="${PRODUCTION_DB_HOST}"
        export DB_PORT="${PRODUCTION_DB_PORT}"
        export DB_NAME="${PRODUCTION_DB_NAME}"
        export DB_USER="${PRODUCTION_DB_USER}"
        export REDIS_HOST="${PRODUCTION_REDIS_HOST}"
        export REDIS_PORT="${PRODUCTION_REDIS_PORT}"
        export APP_POD_ROLE_ARN="${PRODUCTION_APP_POD_ROLE_ARN}"
    else
        export DB_HOST="${STAGING_DB_HOST}"
        export DB_PORT="${STAGING_DB_PORT}"
        export DB_NAME="${STAGING_DB_NAME}"
        export DB_USER="${STAGING_DB_USER}"
        export REDIS_HOST="${STAGING_REDIS_HOST}"
        export REDIS_PORT="${STAGING_REDIS_PORT}"
        export APP_POD_ROLE_ARN="${STAGING_APP_POD_ROLE_ARN}"
    fi
    
    # Run migrations if not skipped
    if [ "$skip_migrations" != "true" ]; then
        echo -e "${YELLOW}Running database migrations...${NC}"
        migrate $env
    fi
    
    # Apply Kubernetes manifests
    echo -e "${YELLOW}Applying Kubernetes manifests...${NC}"
    kubectl apply -f infrastructure/kubernetes/namespace.yaml
    envsubst < infrastructure/kubernetes/serviceaccount.yaml | kubectl apply -f -
    envsubst < infrastructure/kubernetes/deployment.yaml | kubectl apply -f -
    kubectl apply -f infrastructure/kubernetes/service.yaml
    kubectl apply -f infrastructure/kubernetes/hpa.yaml
    
    # Force restart if requested
    if [ "$force" == "true" ]; then
        kubectl rollout restart deployment/$DEPLOYMENT_NAME -n $K8S_NAMESPACE
    fi
    
    # Wait for rollout to complete
    echo -e "${YELLOW}Waiting for rollout to complete...${NC}"
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $K8S_NAMESPACE --timeout=600s
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
}

rollback() {
    local env=$1
    
    echo -e "${YELLOW}Rolling back ${env} environment...${NC}"
    
    configure_kubectl $env
    
    # Rollback deployment
    kubectl rollout undo deployment/$DEPLOYMENT_NAME -n $K8S_NAMESPACE
    
    # Wait for rollback to complete
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $K8S_NAMESPACE --timeout=300s
    
    echo -e "${GREEN}Rollback completed successfully!${NC}"
    
    # Show current status
    kubectl get pods -n $K8S_NAMESPACE
}

status() {
    local env=$1
    
    configure_kubectl $env
    
    echo -e "${GREEN}Deployment Status for ${env}:${NC}"
    echo ""
    
    # Deployment status
    kubectl get deployment $DEPLOYMENT_NAME -n $K8S_NAMESPACE
    echo ""
    
    # Pod status
    kubectl get pods -n $K8S_NAMESPACE -l app=planner
    echo ""
    
    # HPA status
    kubectl get hpa -n $K8S_NAMESPACE
    echo ""
    
    # Service status
    kubectl get svc -n $K8S_NAMESPACE
    echo ""
    
    # Ingress status
    kubectl get ingress -n $K8S_NAMESPACE
}

logs() {
    local env=$1
    local pod_name=$2
    
    configure_kubectl $env
    
    if [ -z "$pod_name" ]; then
        # Get latest pod
        pod_name=$(kubectl get pods -n $K8S_NAMESPACE -l app=planner \
            --sort-by=.metadata.creationTimestamp \
            -o jsonpath='{.items[-1].metadata.name}')
    fi
    
    if [ -z "$pod_name" ]; then
        echo -e "${RED}No pods found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Fetching logs for pod: ${pod_name}${NC}"
    kubectl logs -n $K8S_NAMESPACE $pod_name --tail=100 -f
}

migrate() {
    local env=$1
    
    echo -e "${YELLOW}Running database migrations for ${env}...${NC}"
    
    configure_kubectl $env
    
    # Set environment variables
    export ECR_REGISTRY=$(aws ecr describe-repositories \
        --repository-names $ECR_REPOSITORY \
        --region $AWS_REGION \
        --query 'repositories[0].repositoryUri' \
        --output text | cut -d'/' -f1)
    export ECR_REPOSITORY=$ECR_REPOSITORY
    export IMAGE_TAG="${env}-latest"
    export TIMESTAMP=$(date +%Y%m%d%H%M%S)
    export ENVIRONMENT=$env
    
    # Load environment-specific variables
    if [ "$env" == "production" ]; then
        export DB_HOST="${PRODUCTION_DB_HOST}"
        export DB_PORT="${PRODUCTION_DB_PORT}"
        export DB_NAME="${PRODUCTION_DB_NAME}"
        export DB_USER="${PRODUCTION_DB_USER}"
    else
        export DB_HOST="${STAGING_DB_HOST}"
        export DB_PORT="${STAGING_DB_PORT}"
        export DB_NAME="${STAGING_DB_NAME}"
        export DB_USER="${STAGING_DB_USER}"
    fi
    
    # Apply migration job
    envsubst < infrastructure/kubernetes/job-migration.yaml | kubectl apply -f -
    
    # Wait for job to complete
    JOB_NAME="planner-migration-${TIMESTAMP}"
    echo "Migration job: $JOB_NAME"
    
    kubectl wait --for=condition=complete --timeout=600s job/${JOB_NAME} -n $K8S_NAMESPACE || {
        echo -e "${RED}Migration failed${NC}"
        kubectl logs -n $K8S_NAMESPACE job/${JOB_NAME}
        exit 1
    }
    
    echo -e "${GREEN}Migration completed successfully!${NC}"
}

scale() {
    local env=$1
    local count=$2
    
    if [ -z "$count" ]; then
        echo -e "${RED}Error: Desired count not specified${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Scaling ${env} deployment to ${count} replicas...${NC}"
    
    configure_kubectl $env
    
    kubectl scale deployment/$DEPLOYMENT_NAME --replicas=$count -n $K8S_NAMESPACE
    
    echo -e "${GREEN}Deployment scaled to ${count} replicas${NC}"
}

restart() {
    local env=$1
    
    echo -e "${YELLOW}Restarting ${env} deployment...${NC}"
    
    configure_kubectl $env
    
    kubectl rollout restart deployment/$DEPLOYMENT_NAME -n $K8S_NAMESPACE
    
    kubectl rollout status deployment/$DEPLOYMENT_NAME -n $K8S_NAMESPACE --timeout=300s
    
    echo -e "${GREEN}Deployment restarted successfully!${NC}"
}

describe() {
    local env=$1
    
    configure_kubectl $env
    
    echo -e "${GREEN}Deployment Details for ${env}:${NC}"
    echo ""
    
    kubectl describe deployment $DEPLOYMENT_NAME -n $K8S_NAMESPACE
}

# Main script
check_aws_credentials
check_kubectl

case "${1:-}" in
    deploy)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        
        env=$2
        image_tag="${IMAGE_TAG:-${env}-latest}"
        skip_migrations=false
        force=false
        
        shift 2
        while [[ $# -gt 0 ]]; do
            case $1 in
                --image-tag)
                    image_tag="$2"
                    shift 2
                    ;;
                --skip-migrations)
                    skip_migrations=true
                    shift
                    ;;
                --force)
                    force=true
                    shift
                    ;;
                *)
                    echo -e "${RED}Unknown option: $1${NC}"
                    exit 1
                    ;;
            esac
        done
        
        deploy $env $image_tag $skip_migrations $force
        ;;
    rollback)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        rollback $2
        ;;
    status)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        status $2
        ;;
    logs)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        logs $2 ${3:-}
        ;;
    migrate)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        migrate $2
        ;;
    scale)
        if [ -z "${2:-}" ] || [ -z "${3:-}" ]; then
            echo -e "${RED}Error: Environment and count not specified${NC}"
            print_usage
            exit 1
        fi
        scale $2 $3
        ;;
    restart)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        restart $2
        ;;
    describe)
        if [ -z "${2:-}" ]; then
            echo -e "${RED}Error: Environment not specified${NC}"
            print_usage
            exit 1
        fi
        describe $2
        ;;
    *)
        print_usage
        exit 1
        ;;
esac
