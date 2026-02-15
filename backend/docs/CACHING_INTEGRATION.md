# Redis Caching Integration

## Overview

The application now uses Redis caching for performance-critical permission and scope resolution operations. This significantly reduces database queries for frequently accessed authorization data.

## What's Cached

The following data is cached with a 1-hour TTL (Time To Live):

1. **User Permissions** (`permissions:{user_id}`)
   - Set of Permission enums for each user
   - Computed from user roles and role permissions

2. **Accessible Programs** (`accessible_programs:{user_id}`)
   - List of program IDs the user can access
   - Based on user's scope assignments (global, program, or project level)

3. **Accessible Projects** (`accessible_projects:{user_id}`)
   - List of project IDs the user can access
   - Includes projects from program-level scopes

4. **Scope Summary** (`scope_summary:{user_id}`)
   - Comprehensive summary of user's access scope
   - Includes global scope status, accessible counts, and direct scopes

## Architecture

### Cache Service
`app/services/permission_cache.py` - Handles all Redis operations with graceful fallback when Redis is unavailable.

### Scope Validator Integration
`app/services/scope_validator.py` - Now uses cache-or-compute pattern:
- `get_user_accessible_programs()` - Checks cache first, computes if miss
- `get_user_accessible_projects()` - Checks cache first, computes if miss
- Internal `_compute_*()` methods - Direct database queries (used by cache service)

### Role Management Integration
`app/services/role_management.py` - Automatically invalidates cache when:
- Roles are assigned, removed, activated, or deactivated
- Scopes are assigned, removed, activated, or deactivated
- Bulk scope assignments are performed

## Cache Invalidation Strategy

### Automatic Invalidation
Cache is automatically invalidated when user permissions or scopes change:

```python
# Example: Assigning a new role invalidates the user's cache
role_management_service.assign_role(db, user_id, RoleType.PROGRAM_MANAGER)
# Cache for user_id is automatically invalidated
```

### Manual Invalidation
You can manually invalidate cache when needed:

```python
from app.services.permission_cache import permission_cache_service

# Invalidate specific user
permission_cache_service.invalidate_user_cache(user_id)

# Invalidate all caches (for bulk organizational changes)
permission_cache_service.invalidate_all_caches()

# Refresh user cache (invalidate + recompute)
permission_cache_service.refresh_user_cache(db, user_id)
```

## Graceful Degradation

The caching layer is designed to fail gracefully:

- If Redis is unavailable, operations fall back to direct database queries
- No errors are raised to the application layer
- Performance degrades but functionality remains intact
- Warnings are logged when Redis connection fails

## Performance Benefits

With Redis caching enabled:

- **Permission checks**: ~10-100x faster (cache hit vs database query)
- **Scope resolution**: ~5-50x faster depending on complexity
- **Reduced database load**: Significant reduction in authorization queries
- **Better scalability**: Can handle more concurrent users

## Configuration

Redis configuration is in `app/core/config.py`:

```python
REDIS_HOST: str = "localhost"
REDIS_PORT: int = 6379
REDIS_DB: int = 0
REDIS_PASSWORD: Optional[str] = None
```

Set via environment variables:
```bash
REDIS_HOST=redis.example.com
REDIS_PORT=6379
REDIS_DB=0
REDIS_PASSWORD=your_password
```

## Monitoring

### Cache Hit Rate
Monitor cache effectiveness by tracking:
- Cache hits vs misses
- Average response times
- Redis memory usage

### Redis Health
Monitor Redis availability:
- Connection status
- Memory usage
- Eviction rate
- Key expiration

## Testing

Performance tests are available in `tests/performance/test_cache_performance.py`:

```bash
# Run cache performance tests
pytest tests/performance/test_cache_performance.py -v

# Test with Redis unavailable
# (tests verify graceful degradation)
```

## Production Considerations

### Redis Deployment
- Use Redis Cluster or Sentinel for high availability
- Configure appropriate memory limits and eviction policies
- Enable persistence (RDB/AOF) based on requirements
- Monitor Redis metrics (memory, connections, operations/sec)

### Cache TTL Tuning
Default TTL is 1 hour (3600 seconds). Adjust based on:
- How frequently permissions change
- Memory constraints
- Acceptable staleness

To change TTL, modify `permission_cache.py`:
```python
self.cache_ttl = 3600  # seconds
```

### Distributed Rate Limiting
The middleware currently uses in-memory rate limiting. For production with multiple instances, consider migrating to Redis-based rate limiting for consistency across instances.

## Troubleshooting

### Cache Not Working
1. Check Redis connection: `redis-cli ping`
2. Verify environment variables are set correctly
3. Check application logs for Redis connection warnings
4. Ensure Redis is accessible from application network

### Stale Data
If users see outdated permissions:
1. Check cache invalidation is working after role/scope changes
2. Verify TTL is appropriate for your use case
3. Manually invalidate cache if needed
4. Consider reducing TTL for more frequent updates

### High Memory Usage
If Redis memory usage is high:
1. Check number of cached keys: `redis-cli DBSIZE`
2. Review TTL settings (shorter TTL = less memory)
3. Configure Redis maxmemory and eviction policy
4. Monitor key patterns and sizes

## Migration Notes

This caching integration is **backwards compatible**:
- No database schema changes required
- No API changes required
- Existing code continues to work
- Performance improves automatically when Redis is available

## Future Enhancements

Potential improvements:
1. Cache warming on application startup
2. Predictive cache refresh based on usage patterns
3. Redis-based distributed rate limiting
4. Cache analytics and monitoring dashboard
5. Configurable TTL per cache type
