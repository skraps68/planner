#!/bin/bash
# Stop development environment

echo "Stopping Program and Project Management System development environment..."

# Stop and remove containers
docker-compose down

echo "Development environment stopped."