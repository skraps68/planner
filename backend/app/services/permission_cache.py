"""
Permission caching service using Redis for performance optimization.
"""
import json
from typing import List, Set, Optional, Dict, Any
from uuid import UUID

import redis
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.authorization import authorization_service, Permission
from app.services.scope_validator import scope_validator_service


class PermissionCacheService:
    """Service for caching user permissions and scope resolutions."""
    
    def __init__(self):
        self.redis_client = self._get_redis_client()
        self.authorization_service = authorization_service
        self.scope_validator = scope_validator_service
        
        # Cache TTL in seconds (default: 1 hour)
        self.cache_ttl = 3600
        
        # Cache key prefixes
        self.PERMISSIONS_PREFIX = "permissions:"
        self.PROGRAMS_PREFIX = "accessible_programs:"
        self.PROJECTS_PREFIX = "accessible_projects:"
        self.SCOPE_SUMMARY_PREFIX = "scope_summary:"
    
    def _get_redis_client(self) -> redis.Redis:
        """Get Redis client instance."""
        try:
            client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD,
                decode_responses=True
            )
            # Test connection
            client.ping()
            return client
        except (redis.ConnectionError, redis.TimeoutError) as e:
            # If Redis is not available, return a mock client that does nothing
            print(f"Warning: Redis connection failed: {e}")
            return None
    
    def _is_redis_available(self) -> bool:
        """Check if Redis is available."""
        return self.redis_client is not None
    
    def _make_key(self, prefix: str, user_id: UUID) -> str:
        """Create a cache key."""
        return f"{prefix}{str(user_id)}"
    
    def get_cached_permissions(
        self,
        user_id: UUID
    ) -> Optional[Set[Permission]]:
        """
        Get cached permissions for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Set of permissions if cached, None otherwise
        """
        if not self._is_redis_available():
            return None
        
        try:
            key = self._make_key(self.PERMISSIONS_PREFIX, user_id)
            cached_data = self.redis_client.get(key)
            
            if cached_data:
                permission_values = json.loads(cached_data)
                return {Permission(p) for p in permission_values}
            
            return None
        except Exception as e:
            print(f"Error getting cached permissions: {e}")
            return None
    
    def cache_permissions(
        self,
        user_id: UUID,
        permissions: Set[Permission]
    ) -> bool:
        """
        Cache permissions for a user.
        
        Args:
            user_id: User ID
            permissions: Set of permissions to cache
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self._is_redis_available():
            return False
        
        try:
            key = self._make_key(self.PERMISSIONS_PREFIX, user_id)
            permission_values = [p.value for p in permissions]
            self.redis_client.setex(
                key,
                self.cache_ttl,
                json.dumps(permission_values)
            )
            return True
        except Exception as e:
            print(f"Error caching permissions: {e}")
            return False
    
    def get_cached_accessible_programs(
        self,
        user_id: UUID
    ) -> Optional[List[UUID]]:
        """
        Get cached accessible programs for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            List of program IDs if cached, None otherwise
        """
        if not self._is_redis_available():
            return None
        
        try:
            key = self._make_key(self.PROGRAMS_PREFIX, user_id)
            cached_data = self.redis_client.get(key)
            
            if cached_data:
                program_ids = json.loads(cached_data)
                return [UUID(pid) for pid in program_ids]
            
            return None
        except Exception as e:
            print(f"Error getting cached programs: {e}")
            return None
    
    def cache_accessible_programs(
        self,
        user_id: UUID,
        program_ids: List[UUID]
    ) -> bool:
        """
        Cache accessible programs for a user.
        
        Args:
            user_id: User ID
            program_ids: List of program IDs to cache
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self._is_redis_available():
            return False
        
        try:
            key = self._make_key(self.PROGRAMS_PREFIX, user_id)
            program_id_strs = [str(pid) for pid in program_ids]
            self.redis_client.setex(
                key,
                self.cache_ttl,
                json.dumps(program_id_strs)
            )
            return True
        except Exception as e:
            print(f"Error caching programs: {e}")
            return False
    
    def get_cached_accessible_projects(
        self,
        user_id: UUID
    ) -> Optional[List[UUID]]:
        """
        Get cached accessible projects for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            List of project IDs if cached, None otherwise
        """
        if not self._is_redis_available():
            return None
        
        try:
            key = self._make_key(self.PROJECTS_PREFIX, user_id)
            cached_data = self.redis_client.get(key)
            
            if cached_data:
                project_ids = json.loads(cached_data)
                return [UUID(pid) for pid in project_ids]
            
            return None
        except Exception as e:
            print(f"Error getting cached projects: {e}")
            return None
    
    def cache_accessible_projects(
        self,
        user_id: UUID,
        project_ids: List[UUID]
    ) -> bool:
        """
        Cache accessible projects for a user.
        
        Args:
            user_id: User ID
            project_ids: List of project IDs to cache
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self._is_redis_available():
            return False
        
        try:
            key = self._make_key(self.PROJECTS_PREFIX, user_id)
            project_id_strs = [str(pid) for pid in project_ids]
            self.redis_client.setex(
                key,
                self.cache_ttl,
                json.dumps(project_id_strs)
            )
            return True
        except Exception as e:
            print(f"Error caching projects: {e}")
            return False
    
    def get_cached_scope_summary(
        self,
        user_id: UUID
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached scope summary for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            Scope summary dict if cached, None otherwise
        """
        if not self._is_redis_available():
            return None
        
        try:
            key = self._make_key(self.SCOPE_SUMMARY_PREFIX, user_id)
            cached_data = self.redis_client.get(key)
            
            if cached_data:
                return json.loads(cached_data)
            
            return None
        except Exception as e:
            print(f"Error getting cached scope summary: {e}")
            return None
    
    def cache_scope_summary(
        self,
        user_id: UUID,
        scope_summary: Dict[str, Any]
    ) -> bool:
        """
        Cache scope summary for a user.
        
        Args:
            user_id: User ID
            scope_summary: Scope summary to cache
            
        Returns:
            True if cached successfully, False otherwise
        """
        if not self._is_redis_available():
            return False
        
        try:
            key = self._make_key(self.SCOPE_SUMMARY_PREFIX, user_id)
            # Convert UUIDs to strings for JSON serialization
            serializable_summary = self._make_json_serializable(scope_summary)
            self.redis_client.setex(
                key,
                self.cache_ttl,
                json.dumps(serializable_summary)
            )
            return True
        except Exception as e:
            print(f"Error caching scope summary: {e}")
            return False
    
    def _make_json_serializable(self, obj: Any) -> Any:
        """Convert UUIDs to strings for JSON serialization."""
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: self._make_json_serializable(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [self._make_json_serializable(item) for item in obj]
        return obj
    
    def invalidate_user_cache(
        self,
        user_id: UUID
    ) -> bool:
        """
        Invalidate all cached data for a user.
        
        Args:
            user_id: User ID
            
        Returns:
            True if invalidated successfully, False otherwise
        """
        if not self._is_redis_available():
            return False
        
        try:
            keys_to_delete = [
                self._make_key(self.PERMISSIONS_PREFIX, user_id),
                self._make_key(self.PROGRAMS_PREFIX, user_id),
                self._make_key(self.PROJECTS_PREFIX, user_id),
                self._make_key(self.SCOPE_SUMMARY_PREFIX, user_id),
            ]
            
            self.redis_client.delete(*keys_to_delete)
            return True
        except Exception as e:
            print(f"Error invalidating user cache: {e}")
            return False
    
    def invalidate_all_caches(self) -> bool:
        """
        Invalidate all permission caches (for bulk organizational changes).
        
        Returns:
            True if invalidated successfully, False otherwise
        """
        if not self._is_redis_available():
            return False
        
        try:
            # Get all keys matching our prefixes
            patterns = [
                f"{self.PERMISSIONS_PREFIX}*",
                f"{self.PROGRAMS_PREFIX}*",
                f"{self.PROJECTS_PREFIX}*",
                f"{self.SCOPE_SUMMARY_PREFIX}*",
            ]
            
            for pattern in patterns:
                keys = self.redis_client.keys(pattern)
                if keys:
                    self.redis_client.delete(*keys)
            
            return True
        except Exception as e:
            print(f"Error invalidating all caches: {e}")
            return False
    
    def get_or_compute_permissions(
        self,
        db: Session,
        user_id: UUID
    ) -> Set[Permission]:
        """
        Get permissions from cache or compute and cache them.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            Set of permissions
        """
        # Try to get from cache
        cached_permissions = self.get_cached_permissions(user_id)
        if cached_permissions is not None:
            return cached_permissions
        
        # Compute permissions
        permissions = self.authorization_service.get_user_permissions(db, user_id)
        
        # Cache the result
        self.cache_permissions(user_id, permissions)
        
        return permissions
    
    def get_or_compute_accessible_programs(
        self,
        db: Session,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get accessible programs from cache or compute and cache them.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of program IDs
        """
        # Try to get from cache
        cached_programs = self.get_cached_accessible_programs(user_id)
        if cached_programs is not None:
            return cached_programs
        
        # Compute accessible programs
        programs = self.scope_validator.get_user_accessible_programs(db, user_id)
        
        # Cache the result
        self.cache_accessible_programs(user_id, programs)
        
        return programs
    
    def get_or_compute_accessible_projects(
        self,
        db: Session,
        user_id: UUID
    ) -> List[UUID]:
        """
        Get accessible projects from cache or compute and cache them.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            List of project IDs
        """
        # Try to get from cache
        cached_projects = self.get_cached_accessible_projects(user_id)
        if cached_projects is not None:
            return cached_projects
        
        # Compute accessible projects
        projects = self.scope_validator.get_user_accessible_projects(db, user_id)
        
        # Cache the result
        self.cache_accessible_projects(user_id, projects)
        
        return projects
    
    def refresh_user_cache(
        self,
        db: Session,
        user_id: UUID
    ) -> bool:
        """
        Refresh all cached data for a user.
        
        Args:
            db: Database session
            user_id: User ID
            
        Returns:
            True if refreshed successfully, False otherwise
        """
        try:
            # Invalidate existing cache
            self.invalidate_user_cache(user_id)
            
            # Recompute and cache
            self.get_or_compute_permissions(db, user_id)
            self.get_or_compute_accessible_programs(db, user_id)
            self.get_or_compute_accessible_projects(db, user_id)
            
            # Cache scope summary
            scope_summary = self.scope_validator.get_scope_summary(db, user_id)
            self.cache_scope_summary(user_id, scope_summary)
            
            return True
        except Exception as e:
            print(f"Error refreshing user cache: {e}")
            return False


# Create service instance
permission_cache_service = PermissionCacheService()
