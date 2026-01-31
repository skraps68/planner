"""
Main FastAPI application entry point.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.api.middleware import (
    SecurityHeadersMiddleware,
    RateLimitMiddleware,
    AuditLoggingMiddleware
)
from app.core.config import settings
from app.core.error_handlers import register_error_handlers

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="""
# Program and Project Management System API

A comprehensive API for managing programs, projects, resources, and financial tracking.

## Key Features

- **User-Definable Project Phases**: Flexible timeline management with continuous, non-overlapping phases
- **Resource Management**: Track labor and non-labor resources with assignments
- **Financial Tracking**: Budget planning, actuals import, and variance analysis
- **Scope-Based Access Control**: Role-based permissions with program/project scope filtering
- **Audit Logging**: Complete audit trail of all system changes

## Phase Management

The Phase Management API provides flexible, user-definable project phases that replace the previous
fixed enum-based system. Key features:

- **Timeline Continuity**: Phases must form a continuous timeline from project start to end
- **Date-Based Relationships**: Resource assignments are implicitly associated with phases by date
- **Batch Operations**: Atomic updates for all phases in a project
- **Real-Time Validation**: Validate phase changes before saving

For detailed phase API documentation, see `/docs` and navigate to the "phases" tag.

## Authentication

All endpoints require JWT authentication. Include your token in the Authorization header:

```
Authorization: Bearer <your-token>
```

## Interactive Documentation

- **Swagger UI**: Available at `/docs` (this page)
- **ReDoc**: Available at `/redoc` for alternative documentation format

## Additional Resources

- [Phase Migration Guide](https://github.com/your-org/your-repo/blob/main/backend/docs/PHASE_MIGRATION_RUNBOOK.md)
- [Error Handling Guide](https://github.com/your-org/your-repo/blob/main/backend/docs/ERROR_HANDLING_GUIDE.md)
- [API Documentation](https://github.com/your-org/your-repo/blob/main/backend/docs/)
""",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    openapi_tags=[
        {
            "name": "authentication",
            "description": "User authentication and authorization"
        },
        {
            "name": "users",
            "description": "User management and role assignment"
        },
        {
            "name": "audit",
            "description": "Audit log queries"
        },
        {
            "name": "programs",
            "description": "Program management"
        },
        {
            "name": "projects",
            "description": "Project management"
        },
        {
            "name": "phases",
            "description": """
**Phase Management** - User-definable project phases with timeline continuity validation.

Phases represent date ranges within a project and must form a continuous, non-overlapping timeline.
Key endpoints:
- `POST /projects/{id}/phases/batch` - Batch update all phases (primary endpoint)
- `GET /projects/{id}/phases` - List all phases
- `POST /projects/{id}/phases/validate` - Validate phases without saving
- `GET /phases/{id}/assignments` - Get assignments for a phase

See [Phase API Documentation](https://github.com/your-org/your-repo/blob/main/backend/docs/PHASE_API.md) for details.
"""
        },
        {
            "name": "resources",
            "description": "Resource management (labor and non-labor)"
        },
        {
            "name": "workers",
            "description": "Worker and worker type management"
        },
        {
            "name": "rates",
            "description": "Rate management with temporal validity"
        },
        {
            "name": "assignments",
            "description": "Resource assignment management"
        },
        {
            "name": "actuals",
            "description": "Actual cost tracking and import"
        },
        {
            "name": "reports",
            "description": "Financial reports and analytics"
        }
    ]
)

# Register global error handlers
register_error_handlers(app)

# Add security headers middleware
app.add_middleware(SecurityHeadersMiddleware)

# Add rate limiting middleware (disabled in test/development environments)
# In production: 100 requests per minute per IP
# In development/test: 10000 requests per minute (effectively unlimited)
rate_limit = 10000 if settings.ENVIRONMENT in ["development", "test"] else 100
app.add_middleware(RateLimitMiddleware, requests_per_minute=rate_limit, window_seconds=60)

# Add audit logging middleware
app.add_middleware(AuditLoggingMiddleware)

# Set up CORS middleware
if settings.cors_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/")
async def root():
    """Root endpoint for health check."""
    return {
        "message": "Program and Project Management System API",
        "version": settings.VERSION,
        "docs_url": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}