#!/bin/bash
# Stop development environment

set -e

echo "Stopping Program and Project Management System development environment..."

# Stop and remove containers
docker-compose down

echo "✓ Development environment stopped."
echo ""
echo "Note: Data volumes are preserved. To remove all data, use ./scripts/reset-dev.sh"