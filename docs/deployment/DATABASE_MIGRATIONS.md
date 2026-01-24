# Database Migration Guide

## Overview

This guide covers database migration procedures for the Program and Project Management System using Alembic.

## Table of Contents

1. [Migration Basics](#migration-basics)
2. [Creating Migrations](#creating-migrations)
3. [Running Migrations](#running-migrations)
4. [Rolling Back Migrations](#rolling-back-migrations)
5. [Best Practices](#best-practices)
6. [Troubleshooting](#troubleshooting)

---

## Migration Basics

### What is Alembic?

Alembic is a database migration tool for SQLAlchemy. It allows you to:
- Track database schema changes over time
- Apply changes incrementally
- Roll back changes if needed
- Maintain consistency across environments

### Migration File Structure

```
backend/alembic/
├── versions/          # Migration scripts
│   ├── 001_initial_schema.py
│   ├── 002_add_user_roles.py
│   └── ...
├── env.py            # Alembic environment configuration
└── script.py.mako    # Template for new migrations
```

### Migration States

- **Current**: The migration version currently applied to the database
- **Head**: The latest migration available in the codebase
- **Base**: The initial state (no migrations applied)

---

## Creating Migrations

### Auto-Generate Migrations

Alembic can automatically detect changes to your SQLAlchemy models:

```bash
# Development environment
cd backend
alembic revision --autogenerate -m "Add new column to projects table"

# Docker environment
docker-compose exec app alembic revision --autogenerate -m "Add new column to projects table"
```

### Manual Migration Creation

For complex changes, create a manual migration:

```bash
# Create empty migration file
alembic revision -m "Custom data migration"

# Edit the generated file in backend/alembic/versions/
```

### Migration File Structure

```python
"""Add new column to projects table

Revision ID: abc123def456
Revises: previous_revision_id
Create Date: 2024-01-24 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'abc123def456'
down_revision = 'previous_revision_id'
branch_labels = None
depends_on = None

def upgrade():
    # Add your upgrade logic here
    op.add_column('projects', sa.Column('new_field', sa.String(255), nullable=True))

def downgrade():
    # Add your downgrade logic here
    op.drop_column('projects', 'new_field')
```

### Best Practices for Creating Migrations

1. **One Logical Change Per Migration**
   - Keep migrations focused on a single feature or fix
   - Makes rollbacks easier and safer

2. **Always Include Downgrade Logic**
   - Every `upgrade()` should have a corresponding `downgrade()`
   - Test downgrade logic before deploying

3. **Handle Data Migrations Carefully**
   ```python
   def upgrade():
       # Schema change
       op.add_column('users', sa.Column('full_name', sa.String(255)))
       
       # Data migration
       connection = op.get_bind()
       connection.execute(
           "UPDATE users SET full_name = first_name || ' ' || last_name"
       )
   ```

4. **Use Batch Operations for Large Tables**
   ```python
   def upgrade():
       with op.batch_alter_table('large_table') as batch_op:
           batch_op.add_column(sa.Column('new_field', sa.String(255)))
           batch_op.create_index('idx_new_field', ['new_field'])
   ```

5. **Add Descriptive Comments**
   ```python
   def upgrade():
       # Add status column to track project lifecycle
       # Default to 'active' for existing projects
       op.add_column('projects', 
           sa.Column('status', sa.String(50), 
                    server_default='active', nullable=False))
   ```

---

## Running Migrations

### Check Current Migration Status

```bash
# Show current migration version
alembic current

# Show migration history
alembic history

# Show pending migrations
alembic heads
```

### Apply Migrations

```bash
# Upgrade to latest version
alembic upgrade head

# Upgrade to specific version
alembic upgrade abc123def456

# Upgrade one version at a time
alembic upgrade +1

# Preview SQL without executing
alembic upgrade head --sql
```

### Production Migration Procedure

1. **Pre-Migration Backup**
   ```bash
   # Backup database
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
     pg_dump -U planner_admin planner_production > backup-pre-migration.sql
   ```

2. **Review Migration**
   ```bash
   # Check what will be applied
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic upgrade head --sql > migration-preview.sql
   
   # Review the SQL
   cat migration-preview.sql
   ```

3. **Apply Migration**
   ```bash
   # Run migration
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic upgrade head
   
   # Verify success
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic current
   ```

4. **Verify Database State**
   ```bash
   # Check table structure
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
     psql -U planner_admin -d planner_production -c "\d projects"
   
   # Verify data integrity
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec db \
     psql -U planner_admin -d planner_production -c "SELECT COUNT(*) FROM projects;"
   ```

---

## Rolling Back Migrations

### Downgrade Procedures

```bash
# Downgrade one version
alembic downgrade -1

# Downgrade to specific version
alembic downgrade abc123def456

# Downgrade to base (remove all migrations)
alembic downgrade base

# Preview downgrade SQL
alembic downgrade -1 --sql
```

### Production Rollback Procedure

1. **Identify Target Version**
   ```bash
   # Show migration history
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic history
   
   # Identify the version to roll back to
   ```

2. **Backup Current State**
   ```bash
   # Backup before rollback
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
     pg_dump -U planner_admin planner_production > backup-pre-rollback.sql
   ```

3. **Execute Rollback**
   ```bash
   # Downgrade to target version
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic downgrade <target-revision>
   
   # Verify rollback
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic current
   ```

4. **Verify Application**
   ```bash
   # Restart application
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart app
   
   # Check logs
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml logs app
   
   # Test functionality
   curl https://your-domain.com/health
   ```

---

## Best Practices

### Development Workflow

1. **Make Model Changes**
   ```python
   # backend/app/models/project.py
   class Project(Base):
       __tablename__ = "projects"
       
       id = Column(UUID(as_uuid=True), primary_key=True)
       name = Column(String(255), nullable=False)
       status = Column(String(50), nullable=False)  # New field
   ```

2. **Generate Migration**
   ```bash
   alembic revision --autogenerate -m "Add status field to projects"
   ```

3. **Review Generated Migration**
   - Check the generated file in `backend/alembic/versions/`
   - Verify upgrade and downgrade logic
   - Add any necessary data migrations

4. **Test Migration**
   ```bash
   # Apply migration
   alembic upgrade head
   
   # Test application
   pytest
   
   # Test rollback
   alembic downgrade -1
   alembic upgrade head
   ```

5. **Commit Migration**
   ```bash
   git add backend/alembic/versions/
   git commit -m "Add status field to projects table"
   ```

### Testing Migrations

```bash
# Create test database
createdb planner_test

# Apply migrations to test database
POSTGRES_DB=planner_test alembic upgrade head

# Run tests
pytest

# Clean up
dropdb planner_test
```

### Migration Naming Conventions

Use descriptive names that explain the change:

- ✅ Good: `add_status_column_to_projects`
- ✅ Good: `create_user_roles_table`
- ✅ Good: `add_index_to_resource_assignments`
- ❌ Bad: `update_database`
- ❌ Bad: `fix_bug`
- ❌ Bad: `changes`

### Handling Large Data Migrations

For tables with millions of rows:

```python
def upgrade():
    # Add column as nullable first
    op.add_column('large_table', sa.Column('new_field', sa.String(255), nullable=True))
    
    # Migrate data in batches
    connection = op.get_bind()
    batch_size = 10000
    offset = 0
    
    while True:
        result = connection.execute(
            f"UPDATE large_table SET new_field = old_field "
            f"WHERE new_field IS NULL LIMIT {batch_size}"
        )
        if result.rowcount == 0:
            break
        offset += batch_size
    
    # Make column non-nullable after data migration
    op.alter_column('large_table', 'new_field', nullable=False)
```

---

## Troubleshooting

### Common Issues

#### 1. Migration Conflicts

**Problem**: Multiple developers created migrations with the same parent revision.

**Solution**:
```bash
# Merge migration branches
alembic merge -m "Merge migration branches" <revision1> <revision2>

# Apply merged migration
alembic upgrade head
```

#### 2. Failed Migration

**Problem**: Migration fails partway through.

**Solution**:
```bash
# Check current state
alembic current

# If migration is marked as applied but failed:
# 1. Fix the issue in the database manually
# 2. Or stamp the database to previous version
alembic stamp <previous-revision>

# Then retry
alembic upgrade head
```

#### 3. Out of Sync Database

**Problem**: Database schema doesn't match migration history.

**Solution**:
```bash
# Check what Alembic thinks is applied
alembic current

# Check actual database schema
psql -U planner_admin -d planner_production -c "\d"

# If they don't match, stamp database to correct version
alembic stamp head
```

#### 4. Cannot Downgrade

**Problem**: Downgrade fails due to data loss concerns.

**Solution**:
```bash
# Restore from backup instead
psql -U planner_admin -d planner_production < backup-pre-migration.sql

# Or manually fix the downgrade function
# Edit the migration file and add proper downgrade logic
```

### Emergency Recovery

If migrations are completely broken:

1. **Restore from Backup**
   ```bash
   # Stop application
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml down
   
   # Restore database
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d db
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec -T db \
     psql -U planner_admin -d planner_production < backup.sql
   
   # Stamp to correct version
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d app
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic stamp head
   ```

2. **Verify and Restart**
   ```bash
   # Check migration status
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml exec app \
     alembic current
   
   # Restart all services
   docker-compose -f docker-compose.yml -f docker-compose.prod.yml restart
   ```

---

## Migration Checklist

### Before Creating Migration
- [ ] Model changes are complete and tested
- [ ] Migration name is descriptive
- [ ] Considered impact on existing data

### After Creating Migration
- [ ] Reviewed generated migration file
- [ ] Added downgrade logic
- [ ] Tested upgrade locally
- [ ] Tested downgrade locally
- [ ] Committed migration file to version control

### Before Production Deployment
- [ ] Database backup completed
- [ ] Migration reviewed by team
- [ ] Tested on staging environment
- [ ] Rollback plan prepared
- [ ] Downtime window scheduled (if needed)

### After Production Deployment
- [ ] Migration applied successfully
- [ ] Database schema verified
- [ ] Application functionality tested
- [ ] No errors in logs
- [ ] Monitoring dashboards normal

---

## Additional Resources

- [Alembic Documentation](https://alembic.sqlalchemy.org/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
