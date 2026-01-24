#!/bin/bash
# Deploy to production environment

set -e

echo "=========================================="
echo "Production Deployment Script"
echo "=========================================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found!"
    echo "Please create .env from .env.production.example and configure all values."
    exit 1
fi

# Source environment variables
source .env

# Verify critical environment variables
if [ "$ENVIRONMENT" != "production" ]; then
    echo "Error: ENVIRONMENT must be set to 'production' in .env file"
    exit 1
fi

if [ "$DEBUG" = "true" ]; then
    echo "Error: DEBUG must be set to 'false' in production"
    exit 1
fi

if [ "$SECRET_KEY" = "CHANGE-THIS-TO-A-SECURE-RANDOM-STRING" ]; then
    echo "Error: SECRET_KEY must be changed from default value"
    exit 1
fi

echo "✓ Environment validation passed"
echo ""

# Confirm deployment
echo "You are about to deploy to PRODUCTION environment"
echo "Environment: $ENVIRONMENT"
echo "Project: $PROJECT_NAME"
echo "Version: $VERSION"
echo ""
read -p "Continue with deployment? (yes/NO): " -r
if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Deployment cancelled."
    exit 1
fi

echo ""
echo "Starting production deployment..."
echo ""

# Pull latest code (if using git)
if [ -d .git ]; then
    echo "Pulling latest code..."
    git pull origin main || echo "⚠ Git pull failed or not configured"
fi

# Build production images
echo "Building production Docker images..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml build --no-cache

# Stop existing containers
echo "Stopping existing containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml down

# Start new containers
echo "Starting production containers..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be ready..."
sleep 20

# Run database migrations
echo "Running database migrations..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T app alembic upgrade head

# Check service health
echo ""
echo "Checking service health..."
docker-compose -f docker-compose.yml -f docker-compose.prod.yml ps

# Test API health endpoint
echo ""
echo "Testing API health..."
if curl -f http://localhost:8000/health > /dev/null 2>&1; then
    echo "✓ API is healthy"
else
    echo "⚠ API health check failed"
    echo "Check logs with: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app"
fi

echo ""
echo "=========================================="
echo "✓ Production deployment complete!"
echo "=========================================="
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs -f"
echo "  - Stop services: docker-compose -f docker-compose.yml -f docker-compose.prod.yml down"
echo "  - Restart services: docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart"
echo ""
