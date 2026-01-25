"""
API middleware for authentication, authorization, rate limiting, and security.
"""
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from functools import wraps
from typing import Callable, Dict, List, Optional
from uuid import UUID

from fastapi import HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.authorization import Permission, authorization_service
from app.core.exceptions import (
    AuthenticationError,
    AuthorizationError,
    ScopeAccessDeniedError,
    InvalidUUIDError,
)
from app.core.validators import input_validator


# Rate limiting storage (in-memory, should use Redis in production)
_rate_limit_storage: Dict[str, List[float]] = defaultdict(list)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.
    
    Adds headers for:
    - Content Security Policy
    - X-Frame-Options
    - X-Content-Type-Options
    - Strict-Transport-Security
    - X-XSS-Protection
    """
    
    async def dispatch(self, request: Request, call_next):
        """Add security headers to response."""
        response = await call_next(request)
        
        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        # Allow Swagger UI to work with inline scripts and styles
        response.headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """
    Middleware for rate limiting API requests.
    
    Implements a sliding window rate limiter that tracks requests per IP address.
    Default: 100 requests per minute per IP.
    """
    
    def __init__(
        self,
        app,
        requests_per_minute: int = 100,
        window_seconds: int = 60
    ):
        """
        Initialize rate limit middleware.
        
        Args:
            app: FastAPI application
            requests_per_minute: Maximum requests allowed per window
            window_seconds: Time window in seconds
        """
        super().__init__(app)
        self.max_requests = requests_per_minute
        self.window_seconds = window_seconds
    
    def _get_client_identifier(self, request: Request) -> str:
        """
        Get unique identifier for the client.
        
        Args:
            request: HTTP request
            
        Returns:
            Client identifier (IP address)
        """
        # Try to get real IP from X-Forwarded-For header (for proxies)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Fall back to direct client IP
        return request.client.host if request.client else "unknown"
    
    def _is_rate_limited(self, client_id: str) -> tuple[bool, Optional[int]]:
        """
        Check if client has exceeded rate limit.
        
        Args:
            client_id: Client identifier
            
        Returns:
            Tuple of (is_limited, retry_after_seconds)
        """
        current_time = time.time()
        window_start = current_time - self.window_seconds
        
        # Get request timestamps for this client
        request_times = _rate_limit_storage[client_id]
        
        # Remove old requests outside the window
        request_times[:] = [t for t in request_times if t > window_start]
        
        # Check if limit exceeded
        if len(request_times) >= self.max_requests:
            # Calculate retry after time
            oldest_request = min(request_times)
            retry_after = int(oldest_request + self.window_seconds - current_time) + 1
            return True, retry_after
        
        # Add current request
        request_times.append(current_time)
        return False, None
    
    async def dispatch(self, request: Request, call_next):
        """Check rate limit before processing request."""
        # Skip rate limiting for health check endpoints
        if request.url.path in ["/health", "/", "/docs", "/openapi.json"]:
            return await call_next(request)
        
        client_id = self._get_client_identifier(request)
        is_limited, retry_after = self._is_rate_limited(client_id)
        
        if is_limited:
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "detail": "Rate limit exceeded. Please try again later.",
                    "retry_after": retry_after
                },
                headers={"Retry-After": str(retry_after)}
            )
        
        response = await call_next(request)
        
        # Add rate limit headers
        response.headers["X-RateLimit-Limit"] = str(self.max_requests)
        response.headers["X-RateLimit-Remaining"] = str(
            self.max_requests - len(_rate_limit_storage[client_id])
        )
        response.headers["X-RateLimit-Reset"] = str(
            int(time.time() + self.window_seconds)
        )
        
        return response


class AuditLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for logging API requests for audit purposes.
    
    Logs all state-changing operations (POST, PUT, DELETE) with user information.
    """
    
    async def dispatch(self, request: Request, call_next):
        """Log request details for audit trail."""
        # Only log state-changing operations
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            # Extract user info from request state (set by auth dependency)
            user_id = getattr(request.state, "user_id", None)
            
            # Log request details
            log_data = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "method": request.method,
                "path": request.url.path,
                "user_id": str(user_id) if user_id else None,
                "client_ip": request.client.host if request.client else None,
            }
            
            # In production, send to logging service or database
            # For now, we'll let the audit service handle this
            request.state.audit_log = log_data
        
        response = await call_next(request)
        return response


def require_permissions(*permissions: Permission):
    """
    Decorator to require specific permissions for an endpoint.
    
    Usage:
        @router.get("/programs")
        @require_permissions(Permission.READ_PROGRAM)
        async def list_programs(...):
            ...
    
    Args:
        *permissions: Required permissions
        
    Returns:
        Decorated function that checks permissions
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            
            if not db or not current_user:
                raise AuthenticationError("Authentication required")
            
            # Check if user has any of the required permissions
            user_permissions = authorization_service.get_user_permissions(
                db, current_user.id
            )
            
            has_permission = any(perm in user_permissions for perm in permissions)
            
            if not has_permission:
                raise AuthorizationError(
                    f"Required permissions: {', '.join(p.value for p in permissions)}",
                    required_permissions=[p.value for p in permissions]
                )
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_admin():
    """
    Decorator to require admin role for an endpoint.
    
    Usage:
        @router.post("/users")
        @require_admin()
        async def create_user(...):
            ...
    
    Returns:
        Decorated function that checks admin role
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            
            if not db or not current_user:
                raise AuthenticationError("Authentication required")
            
            # Check if user is admin
            if not authorization_service.is_admin(db, current_user.id):
                raise AuthorizationError("Admin permission required")
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_program_access(program_id_param: str = "program_id"):
    """
    Decorator to require program-level scope access.
    
    Usage:
        @router.get("/programs/{program_id}")
        @require_program_access()
        async def get_program(program_id: UUID, ...):
            ...
    
    Args:
        program_id_param: Name of the parameter containing program ID
        
    Returns:
        Decorated function that checks program access
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            program_id = kwargs.get(program_id_param)
            
            if not db or not current_user:
                raise AuthenticationError("Authentication required")
            
            if not program_id:
                raise InvalidUUIDError(program_id_param, "missing")
            
            # Validate UUID format
            program_uuid = input_validator.validate_uuid(program_id, program_id_param)
            
            # Check scope access
            from app.services.scope_validator import scope_validator_service
            
            if not scope_validator_service.can_access_program(
                db, current_user.id, program_uuid
            ):
                raise ScopeAccessDeniedError("Program", program_uuid)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_project_access(project_id_param: str = "project_id"):
    """
    Decorator to require project-level scope access.
    
    Usage:
        @router.get("/projects/{project_id}")
        @require_project_access()
        async def get_project(project_id: UUID, ...):
            ...
    
    Args:
        project_id_param: Name of the parameter containing project ID
        
    Returns:
        Decorated function that checks project access
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            project_id = kwargs.get(project_id_param)
            
            if not db or not current_user:
                raise AuthenticationError("Authentication required")
            
            if not project_id:
                raise InvalidUUIDError(project_id_param, "missing")
            
            # Validate UUID format
            project_uuid = input_validator.validate_uuid(project_id, project_id_param)
            
            # Check scope access
            from app.services.scope_validator import scope_validator_service
            
            if not scope_validator_service.can_access_project(
                db, current_user.id, project_uuid
            ):
                raise ScopeAccessDeniedError("Project", project_uuid)
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def require_scope_filtered_list(entity_type: str):
    """
    Decorator to automatically filter list results by user scope.
    
    Usage:
        @router.get("/programs")
        @require_scope_filtered_list("program")
        async def list_programs(...):
            ...
    
    Args:
        entity_type: Type of entity being listed ("program" or "project")
        
    Returns:
        Decorated function that filters results by scope
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract dependencies from kwargs
            db = kwargs.get("db")
            current_user = kwargs.get("current_user")
            
            if not db or not current_user:
                raise AuthenticationError("Authentication required")
            
            # Get accessible entity IDs based on type
            from app.services.scope_validator import scope_validator_service
            
            if entity_type == "program":
                accessible_ids = scope_validator_service.get_user_accessible_programs(
                    db, current_user.id
                )
            elif entity_type == "project":
                accessible_ids = scope_validator_service.get_user_accessible_projects(
                    db, current_user.id
                )
            else:
                raise ValueError(f"Unsupported entity type: {entity_type}")
            
            # Add accessible IDs to kwargs for use in endpoint
            kwargs["accessible_ids"] = accessible_ids
            
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator
