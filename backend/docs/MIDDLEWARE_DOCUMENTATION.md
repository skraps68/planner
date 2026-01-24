# API Middleware Documentation

## Overview

This document describes the authentication, authorization, rate limiting, and security middleware implemented for the Program and Project Management System API.

## Middleware Components

### 1. SecurityHeadersMiddleware

**Purpose**: Adds security headers to all HTTP responses to protect against common web vulnerabilities.

**Headers Added**:
- `X-Content-Type-Options: nosniff` - Prevents MIME type sniffing
- `X-Frame-Options: DENY` - Prevents clickjacking attacks
- `X-XSS-Protection: 1; mode=block` - Enables XSS filtering
- `Strict-Transport-Security: max-age=31536000; includeSubDomains` - Enforces HTTPS
- `Content-Security-Policy: default-src 'self'` - Restricts resource loading
- `Referrer-Policy: strict-origin-when-cross-origin` - Controls referrer information
- `Permissions-Policy: geolocation=(), microphone=(), camera=()` - Restricts browser features

**Usage**: Automatically applied to all responses.

### 2. RateLimitMiddleware

**Purpose**: Implements rate limiting to prevent API abuse and DDoS attacks.

**Configuration**:
- Default: 100 requests per minute per IP address
- Configurable window size and request limit
- Uses sliding window algorithm

**Features**:
- Tracks requests by client IP address
- Supports X-Forwarded-For header for proxy environments
- Excludes health check endpoints from rate limiting
- Returns 429 Too Many Requests when limit exceeded
- Includes rate limit headers in responses:
  - `X-RateLimit-Limit`: Maximum requests allowed
  - `X-RateLimit-Remaining`: Remaining requests in window
  - `X-RateLimit-Reset`: Timestamp when limit resets
  - `Retry-After`: Seconds to wait before retrying (on 429 responses)

**Usage**:
```python
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, window_seconds=60)
```

**Note**: Current implementation uses in-memory storage. For production, consider using Redis for distributed rate limiting.

### 3. AuditLoggingMiddleware

**Purpose**: Logs all state-changing API operations for audit trail purposes.

**Features**:
- Logs POST, PUT, DELETE, and PATCH requests
- Captures timestamp, method, path, user ID, and client IP
- Skips read-only operations (GET requests)
- Integrates with audit service for persistent storage

**Logged Information**:
- Timestamp (ISO format)
- HTTP method
- Request path
- User ID (if authenticated)
- Client IP address

**Usage**: Automatically applied to all requests.

## Authentication Dependencies

### get_current_user

**Purpose**: Validates JWT token and returns authenticated user.

**Usage**:
```python
@router.get("/endpoint")
async def endpoint(current_user: User = Depends(get_current_user)):
    # User is authenticated
    pass
```

**Returns**: User object if token is valid
**Raises**: 401 Unauthorized if token is invalid or expired

### get_current_active_user

**Purpose**: Validates JWT token and ensures user is active.

**Usage**:
```python
@router.get("/endpoint")
async def endpoint(current_user: User = Depends(get_current_active_user)):
    # User is authenticated and active
    pass
```

**Returns**: Active User object
**Raises**: 
- 401 Unauthorized if token is invalid
- 403 Forbidden if user is inactive

## Authorization Dependencies

### check_admin_permission

**Purpose**: Ensures user has admin role.

**Usage**:
```python
@router.post("/admin-endpoint")
async def admin_endpoint(current_user: User = Depends(check_admin_permission)):
    # User is admin
    pass
```

**Returns**: User object if user is admin
**Raises**: 403 Forbidden if user is not admin

### check_permission

**Purpose**: Factory function to check specific permissions.

**Usage**:
```python
from app.services.authorization import Permission

@router.get("/programs")
async def list_programs(
    current_user: User = Depends(check_permission(Permission.READ_PROGRAM))
):
    # User has READ_PROGRAM permission
    pass
```

**Parameters**: One or more Permission enums (user needs at least one)
**Returns**: User object if user has required permission
**Raises**: 403 Forbidden if user lacks permission

### check_all_permissions

**Purpose**: Factory function to check that user has ALL specified permissions.

**Usage**:
```python
@router.post("/programs")
async def create_program(
    current_user: User = Depends(check_all_permissions(
        Permission.CREATE_PROGRAM,
        Permission.UPDATE_BUDGET
    ))
):
    # User has both permissions
    pass
```

**Parameters**: Multiple Permission enums (user needs all of them)
**Returns**: User object if user has all permissions
**Raises**: 403 Forbidden if user lacks any permission

### check_program_access

**Purpose**: Validates user has scope access to a specific program.

**Usage**:
```python
@router.get("/programs/{program_id}")
async def get_program(
    program_id: str,
    current_user: User = Depends(check_program_access)
):
    # User has access to this program
    pass
```

**Returns**: User object if user has program access
**Raises**: 403 Forbidden if user lacks program access

### check_project_access

**Purpose**: Validates user has scope access to a specific project.

**Usage**:
```python
@router.get("/projects/{project_id}")
async def get_project(
    project_id: str,
    current_user: User = Depends(check_project_access)
):
    # User has access to this project
    pass
```

**Returns**: User object if user has project access
**Raises**: 403 Forbidden if user lacks project access

### get_accessible_programs

**Purpose**: Returns list of program IDs accessible to current user.

**Usage**:
```python
@router.get("/programs")
async def list_programs(
    accessible_ids: List[UUID] = Depends(get_accessible_programs)
):
    # Filter programs by accessible_ids
    pass
```

**Returns**: List of accessible program UUIDs

### get_accessible_projects

**Purpose**: Returns list of project IDs accessible to current user.

**Usage**:
```python
@router.get("/projects")
async def list_projects(
    accessible_ids: List[UUID] = Depends(get_accessible_projects)
):
    # Filter projects by accessible_ids
    pass
```

**Returns**: List of accessible project UUIDs

## Permission Decorators

### @require_permissions

**Purpose**: Decorator to require specific permissions for an endpoint.

**Usage**:
```python
from app.api.middleware import require_permissions
from app.services.authorization import Permission

@router.get("/programs")
@require_permissions(Permission.READ_PROGRAM)
async def list_programs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # User has READ_PROGRAM permission
    pass
```

**Note**: Requires db and current_user to be in function parameters.

### @require_admin

**Purpose**: Decorator to require admin role.

**Usage**:
```python
from app.api.middleware import require_admin

@router.post("/users")
@require_admin()
async def create_user(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # User is admin
    pass
```

### @require_program_access

**Purpose**: Decorator to require program-level scope access.

**Usage**:
```python
from app.api.middleware import require_program_access

@router.get("/programs/{program_id}")
@require_program_access()
async def get_program(
    program_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # User has access to this program
    pass
```

**Parameters**: 
- `program_id_param`: Name of parameter containing program ID (default: "program_id")

### @require_project_access

**Purpose**: Decorator to require project-level scope access.

**Usage**:
```python
from app.api.middleware import require_project_access

@router.get("/projects/{project_id}")
@require_project_access()
async def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # User has access to this project
    pass
```

**Parameters**: 
- `project_id_param`: Name of parameter containing project ID (default: "project_id")

### @require_scope_filtered_list

**Purpose**: Decorator to automatically filter list results by user scope.

**Usage**:
```python
from app.api.middleware import require_scope_filtered_list

@router.get("/programs")
@require_scope_filtered_list("program")
async def list_programs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    accessible_ids: List[UUID] = None  # Injected by decorator
):
    # Filter programs by accessible_ids
    pass
```

**Parameters**: 
- `entity_type`: Type of entity ("program" or "project")

## Best Practices

### 1. Choosing Between Dependencies and Decorators

**Use Dependencies** when:
- You need the dependency result in your function
- You want FastAPI to handle the dependency in OpenAPI docs
- You prefer explicit dependency injection

**Use Decorators** when:
- You want cleaner endpoint signatures
- You're adding authorization to many endpoints
- You don't need the authorization result in your function

### 2. Combining Multiple Authorization Checks

```python
@router.post("/programs/{program_id}/projects")
async def create_project(
    program_id: UUID,
    project_data: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(check_all_permissions(
        Permission.CREATE_PROJECT,
        Permission.READ_PROGRAM
    ))
):
    # Check program access separately
    if not scope_validator_service.can_access_program(db, current_user.id, program_id):
        raise HTTPException(status_code=403, detail="Access denied to program")
    
    # Create project
    pass
```

### 3. Error Handling

All middleware and dependencies raise appropriate HTTP exceptions:
- `401 Unauthorized`: Invalid or expired token
- `403 Forbidden`: Valid token but insufficient permissions
- `429 Too Many Requests`: Rate limit exceeded

### 4. Testing with Middleware

When writing tests, the middleware is automatically applied. Use test fixtures to create authenticated users:

```python
def test_endpoint(client, auth_headers):
    response = client.get("/api/v1/programs/", headers=auth_headers)
    assert response.status_code == 200
```

## Security Considerations

1. **JWT Token Security**:
   - Tokens are signed with SECRET_KEY from configuration
   - Tokens expire after configured time (default: 8 days)
   - Refresh tokens have longer expiration (30 days)

2. **Rate Limiting**:
   - Current implementation uses in-memory storage
   - For production, use Redis for distributed rate limiting
   - Consider different limits for different endpoint types

3. **Audit Logging**:
   - All state-changing operations are logged
   - Logs include user attribution and timestamps
   - Consider implementing log rotation and archival

4. **CORS Configuration**:
   - Configure BACKEND_CORS_ORIGINS in environment
   - Restrict to specific domains in production
   - Never use "*" in production

5. **Security Headers**:
   - All security headers are applied automatically
   - Review CSP policy for your specific needs
   - Consider adding additional headers as needed

## Configuration

### Environment Variables

```bash
# JWT Configuration
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=11520  # 8 days

# CORS Configuration
BACKEND_CORS_ORIGINS=http://localhost:3000,https://yourdomain.com

# Rate Limiting (configured in code)
# See main.py for rate limit configuration
```

### Middleware Registration

In `main.py`:

```python
from app.api.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    AuditLoggingMiddleware
)

# Add middleware in order (last added = first executed)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, requests_per_minute=100, window_seconds=60)
app.add_middleware(AuditLoggingMiddleware)
```

## Troubleshooting

### Common Issues

1. **401 Unauthorized on valid token**:
   - Check token expiration
   - Verify SECRET_KEY matches between token creation and validation
   - Ensure user is still active in database

2. **403 Forbidden despite having role**:
   - Verify role is active (is_active=True)
   - Check scope assignments for program/project access
   - Ensure permission is mapped to role in ROLE_PERMISSIONS

3. **Rate limit too restrictive**:
   - Adjust requests_per_minute in middleware configuration
   - Consider excluding specific endpoints
   - Implement per-user rate limiting instead of per-IP

4. **Security headers causing issues**:
   - Review CSP policy for your frontend needs
   - Adjust headers in SecurityHeadersMiddleware
   - Test with browser developer tools

## Future Enhancements

1. **Redis-based Rate Limiting**: Implement distributed rate limiting using Redis
2. **Per-User Rate Limits**: Different limits based on user role or subscription
3. **Advanced Audit Logging**: Integration with external logging services
4. **IP Whitelisting**: Allow specific IPs to bypass rate limiting
5. **Dynamic Permission Loading**: Load permissions from database instead of code
6. **OAuth2 Integration**: Support for third-party authentication providers
