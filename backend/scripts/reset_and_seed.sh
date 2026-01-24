#!/bin/bash
# Reset database and load seed data
# This script is useful for development and testing

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database Reset and Seed Script${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""

# Check if we're in the backend directory
if [ ! -f "alembic.ini" ]; then
    echo "Error: Must be run from the backend directory"
    exit 1
fi

# Confirm action
echo -e "${YELLOW}WARNING: This will delete all data and recreate the database!${NC}"
echo -n "Are you sure you want to continue? (yes/no): "
read -r confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Operation cancelled."
    exit 0
fi

echo ""
echo "Step 1: Dropping database..."
rm -f test.db

echo "Step 2: Running migrations..."
python -m alembic upgrade head

echo ""
echo "Step 3: Loading seed data..."
python -m scripts.seed_data

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}Database reset and seed completed!${NC}"
echo -e "${GREEN}========================================${NC}"
