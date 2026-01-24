#!/bin/bash
# Database Migration Script for Production Deployment
# This script handles database migrations with safety checks and rollback capability

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Function to print colored messages
print_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if database is accessible
check_database() {
    print_info "Checking database connectivity..."
    if python -m alembic current > /dev/null 2>&1; then
        print_info "Database is accessible"
        return 0
    else
        print_error "Cannot connect to database"
        return 1
    fi
}

# Function to get current migration version
get_current_version() {
    python -m alembic current 2>/dev/null | grep -oP '(?<=^)[a-f0-9]+(?= \(head\)|\s|$)' | head -1
}

# Function to backup database (PostgreSQL)
backup_database() {
    if [ -z "$DATABASE_URL" ]; then
        print_warning "DATABASE_URL not set, skipping backup"
        return 0
    fi
    
    print_info "Creating database backup..."
    mkdir -p "$BACKUP_DIR"
    
    # Extract database connection details from DATABASE_URL
    # Format: postgresql://user:password@host:port/dbname
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    
    BACKUP_FILE="$BACKUP_DIR/db_backup_${TIMESTAMP}.sql"
    
    PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -F p -f "$BACKUP_FILE"
    
    if [ $? -eq 0 ]; then
        print_info "Backup created: $BACKUP_FILE"
        # Compress backup
        gzip "$BACKUP_FILE"
        print_info "Backup compressed: ${BACKUP_FILE}.gz"
        return 0
    else
        print_error "Backup failed"
        return 1
    fi
}

# Function to run migrations
run_migrations() {
    print_info "Running database migrations..."
    
    CURRENT_VERSION=$(get_current_version)
    print_info "Current migration version: ${CURRENT_VERSION:-none}"
    
    python -m alembic upgrade head
    
    if [ $? -eq 0 ]; then
        NEW_VERSION=$(get_current_version)
        print_info "Migration successful. New version: $NEW_VERSION"
        return 0
    else
        print_error "Migration failed"
        return 1
    fi
}

# Function to rollback migrations
rollback_migrations() {
    local steps=${1:-1}
    print_warning "Rolling back $steps migration(s)..."
    
    python -m alembic downgrade -$steps
    
    if [ $? -eq 0 ]; then
        print_info "Rollback successful"
        return 0
    else
        print_error "Rollback failed"
        return 1
    fi
}

# Function to show migration history
show_history() {
    print_info "Migration history:"
    python -m alembic history --verbose
}

# Function to show current status
show_status() {
    print_info "Current migration status:"
    python -m alembic current --verbose
}

# Main script logic
main() {
    local command=${1:-upgrade}
    
    case $command in
        upgrade)
            print_info "Starting database migration process..."
            
            # Check database connectivity
            if ! check_database; then
                print_error "Database check failed. Aborting."
                exit 1
            fi
            
            # Backup database (only for production)
            if [ "$ENVIRONMENT" = "production" ]; then
                if ! backup_database; then
                    print_error "Backup failed. Aborting migration."
                    exit 1
                fi
            fi
            
            # Run migrations
            if ! run_migrations; then
                print_error "Migration failed. Please check logs and consider rollback."
                exit 1
            fi
            
            print_info "Migration process completed successfully!"
            ;;
            
        downgrade)
            local steps=${2:-1}
            print_warning "This will rollback $steps migration(s). Are you sure? (yes/no)"
            read -r confirmation
            if [ "$confirmation" = "yes" ]; then
                rollback_migrations $steps
            else
                print_info "Rollback cancelled"
            fi
            ;;
            
        history)
            show_history
            ;;
            
        current)
            show_status
            ;;
            
        check)
            check_database
            show_status
            ;;
            
        *)
            echo "Usage: $0 {upgrade|downgrade [steps]|history|current|check}"
            echo ""
            echo "Commands:"
            echo "  upgrade          - Run all pending migrations (default)"
            echo "  downgrade [n]    - Rollback n migrations (default: 1)"
            echo "  history          - Show migration history"
            echo "  current          - Show current migration status"
            echo "  check            - Check database connectivity and status"
            echo ""
            echo "Environment Variables:"
            echo "  DATABASE_URL     - Database connection string"
            echo "  ENVIRONMENT      - Set to 'production' to enable backups"
            echo "  BACKUP_DIR       - Directory for backups (default: ./backups)"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
