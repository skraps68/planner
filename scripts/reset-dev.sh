#!/bin/bash
# Reset development environment (removes all data)

echo "Resetting Program and Project Management System development environment..."
echo "WARNING: This will remove all data!"

read -p "Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Reset cancelled."
    exit 1
fi

# Stop containers and remove volumes
docker-compose down -v

# Remove any orphaned containers
docker-compose down --remove-orphans

# Rebuild and start
docker-compose up -d --build

echo "Development environment reset complete!"