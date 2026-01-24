#!/bin/bash
# Reset development environment (removes all data)

set -e

echo "Resetting Program and Project Management System development environment..."
echo "⚠ WARNING: This will remove all data including database and cache!"
echo ""

read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Reset cancelled."
    exit 1
fi

echo "Stopping containers..."
docker-compose down

echo "Removing volumes..."
docker-compose down -v

echo "Removing orphaned containers..."
docker-compose down --remove-orphans

echo "Rebuilding and starting services..."
docker-compose up -d --build

echo "Waiting for services to be ready..."
sleep 15

echo "Running database migrations..."
docker-compose exec -T app alembic upgrade head

echo "Seeding database with test data..."
docker-compose exec -T app python scripts/seed_data.py || echo "⚠ Seeding failed or not available"

echo ""
echo "✓ Development environment reset complete!"
echo ""
echo "Services:"
echo "  - API: http://localhost:8000"
echo "  - API Docs: http://localhost:8000/docs"
echo ""