"""
Performance tests for caching and database query optimization.
"""
import pytest
import time
from uuid import uuid4

from app.services.permission_cache import permission_cache_service
from app.services.authentication import authentication_service
from app.services.role_management import role_management_service
from app.models.user import RoleType, ScopeType


@pytest.fixture
def db_session():
    """Get database session for tests."""
    from tests.conftest import TestingSessionLocal
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture
def test_user(db_session):
    """Create a test user with roles and scopes."""
    # Create user
    user = authentication_service.create_user(
        db_session,
        username=f"perf_user_{uuid4().hex[:8]}",
        email=f"perf_{uuid4().hex[:8]}@example.com",
        password="TestPass123!",
        is_active=True
    )
    
    # Assign role
    role = role_management_service.assign_role(
        db_session,
        user.id,
        RoleType.PROGRAM_MANAGER,
        is_active=True
    )
    
    return user


class TestCachePerformance:
    """Test caching performance improvements."""
    
    def test_permission_cache_hit(self, db_session, test_user):
        """Test that cached permissions are faster than database queries."""
        user_id = test_user.id
        
        # First call - cache miss (database query)
        start_time = time.time()
        permissions1 = permission_cache_service.get_or_compute_permissions(db_session, user_id)
        first_call_time = time.time() - start_time
        
        # Second call - cache hit (Redis)
        start_time = time.time()
        permissions2 = permission_cache_service.get_or_compute_permissions(db_session, user_id)
        second_call_time = time.time() - start_time
        
        # Verify same results
        assert permissions1 == permissions2
        
        # Cache hit should be faster (if Redis is available)
        if permission_cache_service._is_redis_available():
            assert second_call_time < first_call_time
            print(f"\nFirst call (DB): {first_call_time:.4f}s")
            print(f"Second call (Cache): {second_call_time:.4f}s")
            print(f"Speedup: {first_call_time / second_call_time:.2f}x")
    
    def test_scope_resolution_cache(self, db_session, test_user):
        """Test that scope resolution benefits from caching."""
        user_id = test_user.id
        
        # First call - cache miss
        start_time = time.time()
        programs1 = permission_cache_service.get_or_compute_accessible_programs(db_session, user_id)
        first_call_time = time.time() - start_time
        
        # Second call - cache hit
        start_time = time.time()
        programs2 = permission_cache_service.get_or_compute_accessible_programs(db_session, user_id)
        second_call_time = time.time() - start_time
        
        # Verify same results
        assert programs1 == programs2
        
        # Cache hit should be faster (if Redis is available)
        if permission_cache_service._is_redis_available():
            assert second_call_time < first_call_time
            print(f"\nFirst call (DB): {first_call_time:.4f}s")
            print(f"Second call (Cache): {second_call_time:.4f}s")
            print(f"Speedup: {first_call_time / second_call_time:.2f}x")
    
    def test_cache_invalidation(self, db_session, test_user):
        """Test that cache invalidation works correctly."""
        user_id = test_user.id
        
        # Get initial permissions (cache them)
        permissions1 = permission_cache_service.get_or_compute_permissions(db_session, user_id)
        
        # Invalidate cache
        result = permission_cache_service.invalidate_user_cache(user_id)
        
        # If Redis available, invalidation should succeed
        if permission_cache_service._is_redis_available():
            assert result is True
        
        # Get permissions again (should query database)
        permissions2 = permission_cache_service.get_or_compute_permissions(db_session, user_id)
        
        # Results should still be the same
        assert permissions1 == permissions2
    
    def test_cache_refresh(self, db_session, test_user):
        """Test that cache refresh updates all cached data."""
        user_id = test_user.id
        
        # Refresh cache
        result = permission_cache_service.refresh_user_cache(db_session, user_id)
        
        # If Redis available, refresh should succeed
        if permission_cache_service._is_redis_available():
            assert result is True
            
            # Verify all data is cached
            cached_permissions = permission_cache_service.get_cached_permissions(user_id)
            cached_programs = permission_cache_service.get_cached_accessible_programs(user_id)
            cached_projects = permission_cache_service.get_cached_accessible_projects(user_id)
            cached_summary = permission_cache_service.get_cached_scope_summary(user_id)
            
            assert cached_permissions is not None
            assert cached_programs is not None
            assert cached_projects is not None
            assert cached_summary is not None


class TestDatabaseIndexPerformance:
    """Test that database indexes improve query performance."""
    
    def test_scope_query_performance(self, db_session, test_user):
        """Test scope-based query performance with indexes."""
        from app.repositories.project import project_repository
        from app.services.scope_validator import scope_validator_service
        
        user_id = test_user.id
        
        # Get accessible projects (uses indexed queries)
        start_time = time.time()
        accessible_projects = scope_validator_service.get_user_accessible_projects(db_session, user_id)
        query_time = time.time() - start_time
        
        # Query should complete quickly (< 100ms for small dataset)
        assert query_time < 0.1
        print(f"\nScope query time: {query_time:.4f}s")
    
    def test_role_lookup_performance(self, db_session, test_user):
        """Test role lookup performance with indexes."""
        from app.repositories.user import user_role_repository
        
        user_id = test_user.id
        
        # Get user roles (uses indexed query)
        start_time = time.time()
        roles = user_role_repository.get_by_user(db_session, user_id)
        query_time = time.time() - start_time
        
        # Query should complete quickly
        assert query_time < 0.1
        print(f"\nRole lookup time: {query_time:.4f}s")


class TestGracefulDegradation:
    """Test that system works without Redis."""
    
    def test_cache_unavailable_fallback(self, db_session, test_user):
        """Test that system works when Redis is unavailable."""
        user_id = test_user.id
        
        # Even if Redis is unavailable, should still get permissions
        permissions = permission_cache_service.get_or_compute_permissions(db_session, user_id)
        
        # Should return valid permissions
        assert permissions is not None
        assert isinstance(permissions, set)
    
    def test_cache_operations_safe_without_redis(self, test_user):
        """Test that cache operations don't crash without Redis."""
        user_id = test_user.id
        
        # These should not raise exceptions even if Redis unavailable
        permission_cache_service.invalidate_user_cache(user_id)
        permission_cache_service.invalidate_all_caches()
        
        # Test passed if no exceptions raised
        assert True
