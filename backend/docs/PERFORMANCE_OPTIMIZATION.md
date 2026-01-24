# Performance Optimization and Caching

This document describes the performance optimization strategies implemented in the planner application, including caching, database indexing, and query optimization.

## Redis Caching Implementation

### Permission Caching

The application uses Redis to cache frequently accessed permission and scope data to reduce database queries.

**Cached Data:**
- User permissions (Set of Permission enums)
- Accessible programs (List of program IDs)
- Accessible projects (List of project IDs)
- Scope summaries (Complete scope context for users)

**Cache Configuration:**
- **TTL**: 1 hour (3600 seconds)
- **Invalidation**: Automatic on role/scope changes
- **Fallback**: Graceful degradation if Redis unavailable

**Service:** `app/services/permission_cache.py`

### Cache Usage Patterns

```python
from app.services.permission_cache import permission_cache_service

# Get or compute permissions (with caching)
permissions = permission_cache_service.get_or_compute_permissions(db, user_id)

# Get or compute accessible programs (with caching)
programs = permission_cache_service.get_or_compute_accessible_programs(db, user_id)

# Get or compute accessible projects (with caching)
projects = permission_cache_service.get_or_compute_accessible_projects(db, user_id)

# Invalidate cache on role/scope changes
permission_cache_service.invalidate_user_cache(user_id)

# Refresh cache after changes
permission_cache_service.refresh_user_cache(db, user_id)

# Bulk invalidation for organizational changes
permission_cache_service.invalidate_all_caches()
```

### Cache Invalidation Strategy

**Automatic Invalidation Triggers:**
1. User role assignment/removal
2. Scope assignment changes
3. Role activation/deactivation
4. User account status changes

**Manual Invalidation:**
- Bulk organizational restructuring
- System maintenance
- Cache corruption recovery

## Database Indexing

### Scope-Based Query Indexes

**Migration:** `976e6adbac6f_add_scope_performance_indexes.py`

#### User Role Indexes

```sql
-- User role lookups with active status
CREATE INDEX ix_user_roles_user_active ON user_roles (user_id, is_active);
```

**Optimizes:**
- Getting active roles for a user
- Role validation queries
- Permission resolution

#### Scope Assignment Indexes

```sql
-- Scope assignment lookups by role
CREATE INDEX ix_scope_assignments_role_active ON scope_assignments (user_role_id, is_active);

-- Scope assignments by program
CREATE INDEX ix_scope_assignments_program_active ON scope_assignments (program_id, is_active);

-- Scope assignments by project
CREATE INDEX ix_scope_assignments_project_active ON scope_assignments (project_id, is_active);
```

**Optimizes:**
- Scope resolution for users
- Program/project access checks
- Scope filtering queries

#### Resource Assignment Indexes

```sql
-- Resource assignments by resource and date
CREATE INDEX ix_resource_assignments_resource_date ON resource_assignments (resource_id, assignment_date);

-- Resource assignments by project and date
CREATE INDEX ix_resource_assignments_project_date ON resource_assignments (project_id, assignment_date);
```

**Optimizes:**
- Resource allocation queries
- Project resource views
- Forecasting calculations

#### Actuals Indexes

```sql
-- Actuals by worker and date (allocation validation)
CREATE INDEX ix_actuals_worker_date ON actuals (external_worker_id, actual_date);

-- Actuals by project and date
CREATE INDEX ix_actuals_project_date ON actuals (project_id, actual_date);
```

**Optimizes:**
- Allocation conflict detection
- Variance analysis
- Project cost calculations

#### Rate Temporal Indexes

```sql
-- Rates temporal queries
CREATE INDEX ix_rates_worker_type_dates ON rates (worker_type_id, start_date, end_date);
```

**Optimizes:**
- Historical rate lookups
- Cost calculations
- Rate change tracking

#### Audit Log Indexes

```sql
-- Audit logs by entity
CREATE INDEX ix_audit_logs_entity ON audit_logs (entity_type, entity_id, created_at);
```

**Optimizes:**
- Entity change history
- Audit trail queries
- Compliance reporting

## Query Optimization

### Scope-Based Filtering

**Pattern:** Apply scope filters at the database query level to minimize data transfer.

```python
# Example: Filter projects by user scope
def get_user_projects(db: Session, user_id: UUID):
    accessible_project_ids = scope_validator_service.get_user_accessible_projects(db, user_id)
    
    return db.query(Project).filter(
        Project.id.in_(accessible_project_ids)
    ).all()
```

**Benefits:**
- Reduces data transfer from database
- Prevents unauthorized data exposure
- Improves query performance

### Eager Loading

**Pattern:** Use SQLAlchemy eager loading to reduce N+1 query problems.

```python
from sqlalchemy.orm import joinedload

# Load project with related data in single query
project = db.query(Project).options(
    joinedload(Project.program),
    joinedload(Project.phases),
    joinedload(Project.assignments)
).filter(Project.id == project_id).first()
```

**Benefits:**
- Reduces number of database queries
- Improves response time
- Reduces database load

### Pagination

**Pattern:** Implement pagination for large result sets.

```python
def get_paginated_projects(
    db: Session,
    skip: int = 0,
    limit: int = 100
):
    return db.query(Project).offset(skip).limit(limit).all()
```

**Benefits:**
- Reduces memory usage
- Improves response time
- Better user experience

## Reporting Endpoint Optimization

### Budget vs Actual Calculations

**Optimization Strategies:**
1. **Aggregate at database level** using SQL SUM/GROUP BY
2. **Cache report results** for frequently accessed reports
3. **Use materialized views** for complex aggregations (future enhancement)
4. **Implement incremental updates** for real-time reports

### Forecasting Calculations

**Optimization Strategies:**
1. **Pre-calculate forecasts** during off-peak hours
2. **Cache forecast results** with appropriate TTL
3. **Use batch processing** for large-scale forecasts
4. **Implement progressive loading** for UI

### Variance Analysis

**Optimization Strategies:**
1. **Index on date ranges** for temporal queries
2. **Batch process variance calculations**
3. **Cache variance thresholds** and configurations
4. **Use database window functions** for efficient calculations

## Performance Monitoring

### Key Metrics to Monitor

1. **Cache Hit Rate**
   - Target: >80% for permission queries
   - Monitor: Redis INFO stats

2. **Query Execution Time**
   - Target: <100ms for simple queries
   - Target: <500ms for complex reports
   - Monitor: Database slow query log

3. **API Response Time**
   - Target: <200ms for CRUD operations
   - Target: <1s for reporting endpoints
   - Monitor: Application logs

4. **Database Connection Pool**
   - Monitor: Active connections
   - Monitor: Connection wait time
   - Alert: Pool exhaustion

### Performance Testing

```bash
# Run performance tests
python -m pytest tests/performance/ -v

# Profile slow queries
python -m pytest tests/integration/ --profile

# Load testing with locust
locust -f tests/load/locustfile.py
```

## Optimization Checklist

### Database Level
- ✅ Composite indexes for scope queries
- ✅ Indexes for temporal queries (rates, actuals)
- ✅ Indexes for foreign key relationships
- ✅ Proper data types for UUID fields
- ⬜ Materialized views for complex reports (future)
- ⬜ Partitioning for large tables (future)

### Application Level
- ✅ Redis caching for permissions
- ✅ Redis caching for scope resolution
- ✅ Graceful degradation without Redis
- ✅ Eager loading for related entities
- ✅ Pagination for large result sets
- ⬜ Query result caching (future)
- ⬜ Background job processing (future)

### API Level
- ✅ Scope filtering at query level
- ✅ Efficient serialization with Pydantic
- ✅ Proper HTTP caching headers
- ⬜ Response compression (future)
- ⬜ API rate limiting per user (future)

## Configuration

### Redis Configuration

**Environment Variables:**
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=
```

**Docker Compose:**
```yaml
redis:
  image: redis:7-alpine
  ports:
    - "6379:6379"
  volumes:
    - redis_data:/data
```

### Database Configuration

**Connection Pool Settings:**
```python
# app/db/session.py
engine = create_engine(
    DATABASE_URL,
    pool_size=20,          # Number of connections to maintain
    max_overflow=10,       # Additional connections when pool exhausted
    pool_pre_ping=True,    # Verify connections before use
    pool_recycle=3600      # Recycle connections after 1 hour
)
```

## Troubleshooting

### Cache Issues

**Problem:** Cache not updating after role changes
**Solution:** Verify cache invalidation is called in role management service

**Problem:** Redis connection errors
**Solution:** Check Redis service status and connection settings

### Query Performance

**Problem:** Slow scope resolution queries
**Solution:** Verify indexes exist and are being used (EXPLAIN ANALYZE)

**Problem:** N+1 query problems
**Solution:** Use eager loading with joinedload/selectinload

### Memory Issues

**Problem:** High memory usage
**Solution:** Implement pagination, reduce cache TTL, optimize query result sets

## Future Enhancements

1. **Query Result Caching**
   - Cache frequently accessed reports
   - Implement cache warming strategies
   - Use cache tags for invalidation

2. **Background Processing**
   - Move heavy calculations to background jobs
   - Implement job queues with Celery
   - Schedule periodic cache refreshes

3. **Database Optimizations**
   - Implement materialized views for reports
   - Add table partitioning for large tables
   - Optimize database configuration

4. **API Optimizations**
   - Implement GraphQL for flexible queries
   - Add response compression
   - Implement HTTP/2 server push

5. **Monitoring and Alerting**
   - Set up APM (Application Performance Monitoring)
   - Configure alerts for performance degradation
   - Implement distributed tracing
