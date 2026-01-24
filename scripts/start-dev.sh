#!/bin/bash
# Start development environment

set -e

echo "Starting Program and Project Management System development environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    cp .env.example .env
    echo "✓ Created .env file"
fi

# Build and start services
echo "Building and starting services with Docker Compose..."
docker-compose up -d --build

# Wait for services to be healthy
echo "Waiting for services to be ready..."
echo -n "Checking database health"
for i in {1..30}; do
    if docker-compose exec -T db pg_isready -U postgres > /dev/null 2>&1; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 1
done

echo -n "Checking Redis health"
for i in {1..30}; do
    if docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 1
done

echo -n "Checking application health"
for i in {1..60}; do
    if curl -f http://localhost:8000/health > /dev/null 2>&1; then
        echo " ✓"
        break
    fi
    echo -n "."
    sleep 1
done

# Run database migrations
echo "Running database migrations..."
docker-compose exec -T app alembic upgrade head || echo "⚠ Migration failed or already up to date"

# Check service health
echo ""
echo "Service Status:"
docker-compose ps

echo ""
echo "✓ Development environment started successfully!"
echo ""
echo "Services:"
echo "  - API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - View app logs: docker-compose logs -f app"
echo "  - Stop services: docker-compose down"
echo "  - Reset environment: ./scripts/reset-dev.sh"
echo ""