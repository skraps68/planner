# Database Scripts

This directory contains scripts for managing database migrations and seed data.

## Scripts Overview

### 1. migrate_database.sh

Production-ready database migration script with safety checks and rollback capability.

**Features:**
- Database connectivity checks
- Automatic backups (for production)
- Migration execution with error handling
- Rollback capability
- Migration history viewing

**Usage:**

```bash
# Run all pending migrations
./scripts/migrate_database.sh upgrade

# Rollback last migration
./scripts/migrate_database.sh downgrade 1

# Rollback last 3 migrations
./scripts/migrate_database.sh downgrade 3

# View migration history
./scripts/migrate_database.sh history

# Check current migration status
./scripts/migrate_database.sh current

# Check database connectivity
./scripts/migrate_database.sh check
```

**Environment Variables:**

- `DATABASE_URL` - Database connection string (required)
- `ENVIRONMENT` - Set to 'production' to enable automatic backups
- `BACKUP_DIR` - Directory for backups (default: ./backups)

**Production Example:**

```bash
export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
export ENVIRONMENT="production"
export BACKUP_DIR="/var/backups/planner"

./scripts/migrate_database.sh upgrade
```

### 2. seed_data.py

Comprehensive seed data script for development and testing.

**Creates:**
- 3 Programs (Digital Transformation, Infrastructure Modernization, Customer Experience)
- 5 Projects across the programs with planning and execution phases
- 6 Worker Types with historical rate data
- 7 Workers assigned to different worker types
- 3 Non-labor resources
- 420 Resource assignments across projects
- 80 Actual work records
- 7 Users with various role and scope combinations

**Test Users:**

| Username | Password | Role | Scope |
|----------|----------|------|-------|
| admin | admin123 | Admin | Global (full access) |
| program_mgr | pm123 | Program Manager | Digital Transformation program |
| project_mgr | proj123 | Project Manager | Mobile App project only |
| finance_mgr | finance123 | Finance Manager | 2 programs |
| resource_mgr | resource123 | Resource Manager | Mixed (program + project) |
| viewer | viewer123 | Viewer | Web Portal project only |
| multi_role | multi123 | Multiple roles | Multiple scopes |

**Usage:**

```bash
# Run seed data script
python -m scripts.seed_data
```

**Note:** This script will clear all existing data before creating seed data.

### 3. reset_and_seed.sh

Convenience script that combines database reset, migration, and seed data loading.

**Usage:**

```bash
# Interactive mode (asks for confirmation)
./scripts/reset_and_seed.sh
```

**What it does:**
1. Drops the existing database
2. Runs all migrations to create schema
3. Loads seed data

**Warning:** This will delete ALL data in the database!

## Development Workflow

### Initial Setup

```bash
# 1. Create database and run migrations
python -m alembic upgrade head

# 2. Load seed data
python -m scripts.seed_data
```

### Reset Database During Development

```bash
# Quick reset with seed data
./scripts/reset_and_seed.sh
```

### Create New Migration

```bash
# After modifying models, create a new migration
python -m alembic revision --autogenerate -m "description_of_changes"

# Review the generated migration file
# Edit if necessary

# Apply the migration
python -m alembic upgrade head
```

### Rollback Migration

```bash
# Rollback last migration
python -m alembic downgrade -1

# Rollback to specific version
python -m alembic downgrade <revision_id>

# Rollback all migrations
python -m alembic downgrade base
```

## Production Deployment

### Pre-Deployment Checklist

1. ✅ Review all pending migrations
2. ✅ Test migrations on staging environment
3. ✅ Ensure database backups are configured
4. ✅ Plan rollback strategy
5. ✅ Schedule maintenance window if needed

### Deployment Steps

```bash
# 1. Set environment variables
export DATABASE_URL="postgresql://user:pass@prod-host:5432/planner"
export ENVIRONMENT="production"
export BACKUP_DIR="/var/backups/planner"

# 2. Check current status
./scripts/migrate_database.sh current

# 3. Run migrations with automatic backup
./scripts/migrate_database.sh upgrade

# 4. Verify migration success
./scripts/migrate_database.sh current
```

### Rollback in Production

```bash
# If migration fails or causes issues
./scripts/migrate_database.sh downgrade 1

# Restore from backup if needed
psql -h host -U user -d dbname < /var/backups/planner/db_backup_TIMESTAMP.sql
```

## Migration Files

### Current Migrations

1. **540d8be25367_initial_schema_with_all_models.py**
   - Creates all core tables (programs, projects, users, etc.)
   - Adds foreign key relationships
   - Creates indexes for performance
   - Adds check constraints for data validation

2. **976e6adbac6f_add_scope_performance_indexes.py**
   - Adds composite indexes for scope-based queries
   - Optimizes user role and scope assignment lookups
   - Improves resource assignment query performance
   - Adds indexes for actuals and audit log queries

### Index Strategy

**Scope-Based Query Optimization:**
- `ix_user_roles_user_active` - User role lookups with active status
- `ix_scope_assignments_role_active` - Scope assignment lookups
- `ix_scope_assignments_program_active` - Program scope filtering
- `ix_scope_assignments_project_active` - Project scope filtering

**Resource Management Optimization:**
- `ix_resource_assignments_resource_date` - Resource allocation queries
- `ix_resource_assignments_project_date` - Project resource views
- `ix_actuals_worker_date` - Worker allocation validation
- `ix_actuals_project_date` - Project actuals queries

**Audit and Rate Optimization:**
- `ix_rates_worker_type_dates` - Temporal rate lookups
- `ix_audit_logs_entity` - Entity audit trail queries

## Troubleshooting

### Migration Fails

```bash
# Check current status
python -m alembic current

# View migration history
python -m alembic history

# Try manual rollback
python -m alembic downgrade -1

# If database is in inconsistent state, may need to:
# 1. Restore from backup
# 2. Manually fix database
# 3. Stamp to correct version: python -m alembic stamp <revision>
```

### Seed Data Fails

```bash
# Check database connectivity
python -c "from app.db.session import SessionLocal; db = SessionLocal(); print('Connected')"

# Check for existing data conflicts
# The seed script clears data first, but if it fails midway:
python -m alembic downgrade base
python -m alembic upgrade head
python -m scripts.seed_data
```

### Database Connection Issues

```bash
# Verify DATABASE_URL
echo $DATABASE_URL

# Test connection
psql $DATABASE_URL -c "SELECT 1"

# Check if database exists
psql -h host -U user -l
```

## Best Practices

1. **Always review generated migrations** before applying them
2. **Test migrations on staging** before production
3. **Keep migrations small and focused** on single changes
4. **Never edit applied migrations** - create new ones instead
5. **Use descriptive migration messages** for easy identification
6. **Backup before migrations** in production
7. **Have rollback plan ready** before deploying
8. **Monitor migration performance** on large databases
9. **Document breaking changes** in migration comments
10. **Test rollback functionality** during development

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
