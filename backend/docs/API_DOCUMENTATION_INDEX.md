# API Documentation Index

## Overview

This document provides an index of all API documentation for the Program and Project Management System.

## Interactive Documentation

The API provides interactive documentation through FastAPI's built-in tools:

- **Swagger UI**: `http://localhost:8000/docs`
  - Interactive API explorer
  - Test endpoints directly in the browser
  - View request/response schemas
  - See validation rules and examples

- **ReDoc**: `http://localhost:8000/redoc`
  - Alternative documentation format
  - Better for reading and reference
  - Clean, organized layout

- **OpenAPI JSON**: `http://localhost:8000/api/v1/openapi.json`
  - Raw OpenAPI 3.0 specification
  - Can be imported into API tools (Postman, Insomnia, etc.)

## API Endpoint Documentation

### Core Resources

- **[Portfolio Management API](./PORTFOLIO_API.md)** ⭐ NEW
  - Portfolio CRUD operations
  - Portfolio-Program relationship management
  - Scope-based access control
  - Default portfolio migration
  - Audit logging integration

- **[Phase Management API](./PHASE_API.md)**
  - User-definable project phases
  - Timeline continuity validation
  - Batch operations
  - Date-based implicit relationships
  - Migration guide reference

- **[Resource & Worker API](./RESOURCE_WORKER_API.md)**
  - Resource management (labor/non-labor)
  - Worker and worker type management
  - Rate management with temporal validity

### Additional Endpoints

Other endpoints are documented through the interactive Swagger UI at `/docs`. Navigate to the appropriate tag:

- **authentication** - User authentication and JWT tokens
- **users** - User management and role assignment
- **audit** - Audit log queries
- **portfolios** - Portfolio management (see [Portfolio API](./PORTFOLIO_API.md))
- **programs** - Program management
- **projects** - Project management
- **resources** - Resource management
- **workers** - Worker management
- **rates** - Rate management
- **assignments** - Resource assignment management
- **actuals** - Actual cost tracking and import
- **reports** - Financial reports and analytics

## Technical Documentation

### Migration Guides

- **[Resource Assignment Migration Guide](./RESOURCE_ASSIGNMENT_MIGRATION_GUIDE.md)** ⭐ NEW
  - Remove allocation_percentage field
  - Update validation constraints
  - Step-by-step migration instructions
  - Rollback procedures
  - [Quick Reference](./RESOURCE_ASSIGNMENT_MIGRATION_QUICK_REFERENCE.md)

- **[Phase Migration Runbook](./PHASE_MIGRATION_RUNBOOK.md)**
  - Step-by-step migration instructions
  - Pre-migration checks
  - Rollback procedures
  - Data verification queries

- **[Database Migrations](../docs/deployment/DATABASE_MIGRATIONS.md)**
  - General migration procedures
  - Alembic usage
  - Best practices

### System Architecture

- **[Error Handling Guide](./ERROR_HANDLING_GUIDE.md)**
  - Error response formats
  - Exception handling patterns
  - Custom exception classes

- **[Middleware Documentation](./MIDDLEWARE_DOCUMENTATION.md)**
  - Security headers
  - Rate limiting
  - Audit logging
  - CORS configuration

- **[Performance Optimization](./PERFORMANCE_OPTIMIZATION.md)**
  - Database query optimization
  - Caching strategies
  - Index usage

- **[Security Audit](./SECURITY_AUDIT.md)**
  - Security best practices
  - Authentication/authorization
  - Data protection

### Database

- **[Database Compatibility](./DATABASE_COMPATIBILITY.md)**
  - PostgreSQL compatibility
  - SQLite support (testing)
  - Database-specific considerations

## API Usage Examples

### Authentication

All API endpoints require JWT authentication:

```bash
# Login to get token
curl -X POST "http://localhost:8000/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"username": "user@example.com", "password": "password"}'

# Use token in subsequent requests
curl -X GET "http://localhost:8000/api/v1/projects" \
  -H "Authorization: Bearer <your-token>"
```

### Phase Management Example

```bash
# List phases for a project
curl -X GET "http://localhost:8000/api/v1/projects/{project_id}/phases" \
  -H "Authorization: Bearer <token>"

# Batch update phases
curl -X POST "http://localhost:8000/api/v1/projects/{project_id}/phases/batch" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phases": [
      {
        "id": null,
        "name": "Planning",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "capital_budget": 50000.00,
        "expense_budget": 25000.00,
        "total_budget": 75000.00
      }
    ]
  }'

# Validate phases before saving
curl -X POST "http://localhost:8000/api/v1/projects/{project_id}/phases/validate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": null,
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31"
    }
  ]'
```

## Development Resources

### Local Development

See [LOCAL_DEVELOPMENT_GUIDE.md](../../LOCAL_DEVELOPMENT_GUIDE.md) for:
- Setting up the development environment
- Running the API locally
- Database setup
- Testing

### Deployment

See [docs/deployment/](../../docs/deployment/) for:
- Production setup
- CI/CD configuration
- Monitoring and logging
- Troubleshooting

## API Versioning

The current API version is **v1**, accessible at `/api/v1/`.

All endpoints are prefixed with `/api/v1/` to support future versioning.

## Support

For questions or issues:
1. Check the interactive documentation at `/docs`
2. Review the relevant documentation file from this index
3. Check the [Error Handling Guide](./ERROR_HANDLING_GUIDE.md) for common errors
4. Contact the development team or file an issue

## Recent Updates

### Resource Assignment Data Model Refactoring (Latest)

The Resource Assignment data model has been refactored to support a new conceptual model:

- **Breaking Change**: Removed `allocation_percentage` field from resource assignments
- **Constraint Update**: Changed from `capital + expense = 100` to `capital + expense <= 100`
- **New Validation**: Cross-project allocation validation ensures total <= 100% per resource per day
- **Migration Required**: See [Resource Assignment Migration Guide](./RESOURCE_ASSIGNMENT_MIGRATION_GUIDE.md)
- **Key Changes**:
  - Capital and expense percentages now represent direct time allocations
  - Validation logic moved to service layer
  - Frontend validation updated for cross-project checks

For complete details, see [Resource Assignment Migration Guide](./RESOURCE_ASSIGNMENT_MIGRATION_GUIDE.md) or [Quick Reference](./RESOURCE_ASSIGNMENT_MIGRATION_QUICK_REFERENCE.md).

### Portfolio Management API

The Portfolio Management API introduces a new top-level organizational entity:

- **New Feature**: Portfolio entity sits above Programs in the hierarchy (Portfolio → Program → Project)
- **New Endpoints**: Full CRUD operations for portfolios
- **Migration Required**: Automatic creation of default portfolio and program reassignment
- **Key Features**:
  - Portfolio-Program one-to-many relationship
  - Deletion protection for portfolios with programs
  - Scope-based access control integration
  - Comprehensive audit logging

For complete details, see [PORTFOLIO_API.md](./PORTFOLIO_API.md).

### Phase Management API

The Phase Management API has been completely redesigned to support user-definable phases:

- **Breaking Change**: Replaced fixed enum-based phases (Planning/Execution) with flexible, user-defined phases
- **New Endpoints**: Batch update, validation, and assignment query endpoints
- **Migration Required**: See [Phase Migration Runbook](./PHASE_MIGRATION_RUNBOOK.md)
- **Key Features**:
  - Timeline continuity validation
  - Date-based implicit relationships
  - Atomic batch operations
  - Real-time validation

For complete details, see [PHASE_API.md](./PHASE_API.md).
