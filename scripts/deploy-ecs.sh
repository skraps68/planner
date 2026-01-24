#!/bin/bash

# ECS Deployment Helper Script
# This script helps with common ECS deployment tasks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPOSITORY="${ECR_REPOSITORY:-planner-app}"

# Functions
print_usage() {
    echo "Usage: $0 <command> [options]"
    echo ""
    echo "Commands:"
    echo "  deploy <env>              Deploy to environment (staging|production)"
    echo "  rollback <env>            Rollback to previous task definition"
    echo "  status <env>              Check deployment status"
    echo "  logs <env> [task-id]      View logs from ECS tasks"
    echo "  migrate <env>             Run database migrations"
    echo "  scale <env> <count>       Scale service to desired count"
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
    echo "planner-${env}"
}

get_service_name() {
    echo "planner-app-service"
}

get_task_definition() {
    echo "planner-app-task"
}

check_aws_credentials() {
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}Error: AWS credentials not configured${NC}"
        exit 1
    fi
}

deploy() {
    local env=$1
    local image_tag=${2:-"${env}-latest"}
    local skip_migrations=${3:-false}
    local force=${4:-false}
    
    echo -e "${GREEN}Deploying to ${env} environment...${NC}"
    
    local cluster=$(get_cluster_name $env)
    local service=$(get_service_name)
    local task_def=$(get_task_definition)
    
    # Get ECR registry
    local ecr_registry=$(aws ecr describe-repositories \
        --repository-names $ECR_REPOSITORY \
        --region $AWS_REGION \
        --query 'repositories[0].repositoryUri' \
        --output text | cut -d'/' -f1)
    
    local image="${ecr_registry}/${ECR_REPOSITORY}:${image_tag}"
    
    echo "Image: $image"
    
    # Download current task definition
    aws ecs describe-task-definition \
        --task-definition $task_def \
        --query taskDefinition > /tmp/task-definition.json
    
    # Update image in task definition
    jq --arg IMAGE "$image" \
        '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' \
        /tmp/task-definition.json > /tmp/new-task-definition.json
    
    # Register new task definition
    local new_task_def_arn=$(aws ecs register-task-definition \
        --cli-input-json file:///tmp/new-task-definition.json \
        --query 'taskDefinition.taskDefinitionArn' \
        --output text)
    
    echo "New task definition: $new_task_def_arn"
    
    # Run migrations if not skipped
    if [ "$skip_migrations" != "true" ]; then
        echo -e "${YELLOW}Running database migrations...${NC}"
        migrate $env
    fi
    
    # Update service
    local force_flag=""
    if [ "$force" == "true" ]; then
        force_flag="--force-new-deployment"
    fi
    
    aws ecs update-service \
        --cluster $cluster \
        --service $service \
        --task-definition $new_task_def_arn \
        $force_flag \
        --query 'service.serviceName' \
        --output text
    
    echo -e "${GREEN}Deployment initiated. Waiting for service stability...${NC}"
    
    aws ecs wait services-stable \
        --cluster $cluster \
        --services $service
    
    echo -e "${GREEN}Deployment completed successfully!${NC}"
}

rollback() {
    local env=$1
    
    echo -e "${YELLOW}Rolling back ${env} environment...${NC}"
    
    local cluster=$(get_cluster_name $env)
    local service=$(get_service_name)
    
    # Get previous task definition
    local previous_task_def=$(aws ecs describe-services \
        --cluster $cluster \
        --services $service \
        --query 'services[0].deployments[1].taskDefinition' \
        --output text)
    
    if [ -z "$previous_task_def" ] || [ "$previous_task_def" == "None" ]; then
        echo -e "${RED}No previous task definition found${NC}"
        exit 1
    fi
    
    echo "Rolling back to: $previous_task_def"
    
    aws ecs update-service \
        --cluster $cluster \
        --service $service \
        --task-definition $previous_task_def \
        --force-new-deployment \
        --query 'service.serviceName' \
        --output text
    
    echo -e "${GREEN}Rollback initiated. Waiting for service stability...${NC}"
    
    aws ecs wait services-stable \
        --cluster $cluster \
        --services $service
    
    echo -e "${GREEN}Rollback completed successfully!${NC}"
}

status() {
    local env=$1
    
    local cluster=$(get_cluster_name $env)
    local service=$(get_service_name)
    
    echo -e "${GREEN}Service Status for ${env}:${NC}"
    echo ""
    
    aws ecs describe-services \
        --cluster $cluster \
        --services $service \
        --query 'services[0].{Status:status,DesiredCount:desiredCount,RunningCount:runningCount,PendingCount:pendingCount,TaskDefinition:taskDefinition,Deployments:deployments[*].{Status:status,TaskDef:taskDefinition,DesiredCount:desiredCount,RunningCount:runningCount}}' \
        --output table
}

logs() {
    local env=$1
    local task_id=$2
    
    local cluster=$(get_cluster_name $env)
    
    if [ -z "$task_id" ]; then
        # Get latest task
        task_id=$(aws ecs list-tasks \
            --cluster $cluster \
            --service-name $(get_service_name) \
            --desired-status RUNNING \
            --query 'taskArns[0]' \
            --output text | cut -d'/' -f3)
    fi
    
    if [ -z "$task_id" ] || [ "$task_id" == "None" ]; then
        echo -e "${RED}No running tasks found${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Fetching logs for task: ${task_id}${NC}"
    
    # Get log stream name
    local log_group="/ecs/planner-app"
    local log_stream="ecs/planner-app/${task_id}"
    
    aws logs tail $log_group \
        --log-stream-names $log_stream \
        --follow \
        --format short
}

migrate() {
    local env=$1
    
    echo -e "${YELLOW}Running database migrations for ${env}...${NC}"
    
    local cluster=$(get_cluster_name $env)
    local task_def=$(get_task_definition)
    
    # Get subnet and security group based on environment
    local subnet_ids security_group
    if [ "$env" == "production" ]; then
        subnet_ids="${PRODUCTION_SUBNET_IDS}"
        security_group="${PRODUCTION_SECURITY_GROUP}"
    else
        subnet_ids="${STAGING_SUBNET_IDS}"
        security_group="${STAGING_SECURITY_GROUP}"
    fi
    
    # Run migration task
    local task_arn=$(aws ecs run-task \
        --cluster $cluster \
        --task-definition $task_def \
        --launch-type FARGATE \
        --network-configuration "awsvpcConfiguration={subnets=[${subnet_ids}],securityGroups=[${security_group}],assignPublicIp=ENABLED}" \
        --overrides '{
          "containerOverrides": [{
            "name": "planner-app",
            "command": ["alembic", "upgrade", "head"]
          }]
        }' \
        --query 'tasks[0].taskArn' \
        --output text)
    
    echo "Migration task: $task_arn"
    
    # Wait for task to complete
    aws ecs wait tasks-stopped \
        --cluster $cluster \
        --tasks $task_arn
    
    # Check exit code
    local exit_code=$(aws ecs describe-tasks \
        --cluster $cluster \
        --tasks $task_arn \
        --query 'tasks[0].containers[0].exitCode' \
        --output text)
    
    if [ "$exit_code" != "0" ]; then
        echo -e "${RED}Migration failed with exit code: $exit_code${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Migration completed successfully!${NC}"
}

scale() {
    local env=$1
    local count=$2
    
    if [ -z "$count" ]; then
        echo -e "${RED}Error: Desired count not specified${NC}"
        exit 1
    fi
    
    echo -e "${YELLOW}Scaling ${env} service to ${count} tasks...${NC}"
    
    local cluster=$(get_cluster_name $env)
    local service=$(get_service_name)
    
    aws ecs update-service \
        --cluster $cluster \
        --service $service \
        --desired-count $count \
        --query 'service.serviceName' \
        --output text
    
    echo -e "${GREEN}Service scaled to ${count} tasks${NC}"
}

# Main script
check_aws_credentials

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
    *)
        print_usage
        exit 1
        ;;
esac
