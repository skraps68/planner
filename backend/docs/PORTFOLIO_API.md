# Portfolio Management API Documentation

## Overview

The Portfolio Management API provides endpoints for managing portfolios, which sit at the top of the organizational hierarchy (Portfolio → Program → Project). Portfolios enable organizations to group and manage multiple Programs under strategic umbrellas, providing better visibility and control over large-scale initiatives.

### Key Concepts

- **Portfolio**: A top-level organizational entity that contains multiple Programs and represents a strategic collection of related initiatives
- **Program**: A mid-level organizational entity that belongs to exactly one Portfolio
- **Portfolio-Program Relationship**: One-to-many relationship where each Portfolio can contain multiple Programs, but each Program belongs to exactly one Portfolio
- **Default Portfolio**: Automatically created during migration to ensure all existing Programs have a Portfolio association

## Base URL

All endpoints are prefixed with `/api/v1/`

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Portfolio Endpoints

### Create Portfolio
**POST** `/portfolios/`

Create a new portfolio with all required fields.

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "owner": "string",
  "reporting_start_date": "YYYY-MM-DD",
  "reporting_end_date": "YYYY-MM-DD"
}
```

**Field Constraints:**
- `name`: Required, 1-255 characters
- `description`: Required, 1-1000 characters
- `owner`: Required, 1-255 characters
- `reporting_start_date`: Required, valid date
- `reporting_end_date`: Required, valid date, must be after `reporting_start_date`

**Response:** `201 Created`
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "owner": "string",
  "reporting_start_date": "YYYY-MM-DD",
  "reporting_end_date": "YYYY-MM-DD",
  "program_count": 0,
  "created_at": "datetime",
  "updated_at": "datetime",
  "created_by": "string",
  "updated_by": "string"
}
```

**Error Responses:**

`400 Bad Request` - Validation failed
```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

`400 Bad Request` - Date validation failed
```json
{
  "detail": "Reporting end date must be after reporting start date"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/portfolios/" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Digital Transformation Portfolio",
    "description": "Strategic initiatives for digital transformation across the organization",
    "owner": "Jane Smith",
    "reporting_start_date": "2024-01-01",
    "reporting_end_date": "2024-12-31"
  }'
```

---

### List Portfolios
**GET** `/portfolios/`

Get a paginated list of all portfolios with optional filtering.

**Query Parameters:**
- `skip` (int, default: 0): Number of records to skip
- `limit` (int, default: 100): Maximum number of records to return
- `search` (optional): Search term for portfolio name or owner

**Response:** `200 OK`
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "string",
      "description": "string",
      "owner": "string",
      "reporting_start_date": "YYYY-MM-DD",
      "reporting_end_date": "YYYY-MM-DD",
      "program_count": 5,
      "created_at": "datetime",
      "updated_at": "datetime"
    }
  ],
  "total": 10,
  "skip": 0,
  "limit": 100
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/portfolios/?skip=0&limit=10" \
  -H "Authorization: Bearer <token>"
```

**Example Request with Search:**
```bash
curl -X GET "http://localhost:8000/api/v1/portfolios/?search=Digital" \
  -H "Authorization: Bearer <token>"
```

---

### Get Portfolio
**GET** `/portfolios/{portfolio_id}`

Retrieve a specific portfolio by ID, including the count of associated programs.

**Path Parameters:**
- `portfolio_id` (UUID, required): Portfolio ID

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "owner": "string",
  "reporting_start_date": "YYYY-MM-DD",
  "reporting_end_date": "YYYY-MM-DD",
  "program_count": 5,
  "created_at": "datetime",
  "updated_at": "datetime",
  "created_by": "string",
  "updated_by": "string"
}
```

**Error Responses:**

`404 Not Found` - Portfolio not found
```json
{
  "detail": "Portfolio not found"
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/portfolios/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Update Portfolio
**PUT** `/portfolios/{portfolio_id}`

Update an existing portfolio. All fields are optional; only provided fields will be updated.

**Path Parameters:**
- `portfolio_id` (UUID, required): Portfolio ID

**Request Body:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "owner": "string (optional)",
  "reporting_start_date": "YYYY-MM-DD (optional)",
  "reporting_end_date": "YYYY-MM-DD (optional)"
}
```

**Field Constraints:**
- `name`: 1-255 characters if provided
- `description`: 1-1000 characters if provided
- `owner`: 1-255 characters if provided
- `reporting_end_date`: Must be after `reporting_start_date` if both are provided

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "owner": "string",
  "reporting_start_date": "YYYY-MM-DD",
  "reporting_end_date": "YYYY-MM-DD",
  "program_count": 5,
  "created_at": "datetime",
  "updated_at": "datetime",
  "created_by": "string",
  "updated_by": "string"
}
```

**Error Responses:**

`404 Not Found` - Portfolio not found
```json
{
  "detail": "Portfolio not found"
}
```

`400 Bad Request` - Validation failed
```json
{
  "detail": "Reporting end date must be after reporting start date"
}
```

**Example Request:**
```bash
curl -X PUT "http://localhost:8000/api/v1/portfolios/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "owner": "John Doe",
    "reporting_end_date": "2025-06-30"
  }'
```

---

### Delete Portfolio
**DELETE** `/portfolios/{portfolio_id}`

Delete a portfolio. This operation will fail if the portfolio has any associated programs.

**Path Parameters:**
- `portfolio_id` (UUID, required): Portfolio ID

**Response:** `200 OK`
```json
{
  "message": "Portfolio deleted successfully"
}
```

**Error Responses:**

`404 Not Found` - Portfolio not found
```json
{
  "detail": "Portfolio not found"
}
```

`409 Conflict` - Portfolio has associated programs
```json
{
  "detail": "Cannot delete portfolio with associated programs. Please reassign or delete programs first."
}
```

**Example Request:**
```bash
curl -X DELETE "http://localhost:8000/api/v1/portfolios/123e4567-e89b-12d3-a456-426614174000" \
  -H "Authorization: Bearer <token>"
```

---

### Get Portfolio Programs
**GET** `/portfolios/{portfolio_id}/programs`

Get all programs associated with a specific portfolio.

**Path Parameters:**
- `portfolio_id` (UUID, required): Portfolio ID

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "name": "string",
    "description": "string",
    "portfolio_id": "uuid",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "status": "string",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

**Error Responses:**

`404 Not Found` - Portfolio not found
```json
{
  "detail": "Portfolio not found"
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/portfolios/123e4567-e89b-12d3-a456-426614174000/programs" \
  -H "Authorization: Bearer <token>"
```

---

## Program Endpoints (Portfolio Integration)

### Create Program with Portfolio
**POST** `/programs/`

When creating a program, a `portfolio_id` is now required.

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "portfolio_id": "uuid",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  ...
}
```

**Error Responses:**

`400 Bad Request` - Missing portfolio_id
```json
{
  "detail": [
    {
      "loc": ["body", "portfolio_id"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

`400 Bad Request` - Invalid portfolio_id
```json
{
  "detail": "Portfolio not found"
}
```

### Get Program with Portfolio
**GET** `/programs/{program_id}`

Program responses now include portfolio information.

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "portfolio_id": "uuid",
  "portfolio": {
    "id": "uuid",
    "name": "string",
    "owner": "string"
  },
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  ...
}
```

---

## Validation Rules

### Portfolio Field Validation

1. **Name Validation**
   - Must not be empty or whitespace-only
   - Maximum length: 255 characters
   - Error: `"String should have at least 1 character"` or `"String should have at most 255 characters"`

2. **Description Validation**
   - Must not be empty or whitespace-only
   - Maximum length: 1000 characters
   - Error: `"String should have at least 1 character"` or `"String should have at most 1000 characters"`

3. **Owner Validation**
   - Must not be empty or whitespace-only
   - Maximum length: 255 characters
   - Error: `"String should have at least 1 character"` or `"String should have at most 255 characters"`

4. **Date Validation**
   - Both `reporting_start_date` and `reporting_end_date` must be valid dates
   - `reporting_end_date` must be after `reporting_start_date`
   - Error: `"Reporting end date must be after reporting start date"`

### Portfolio-Program Relationship Validation

5. **Program Portfolio Association**
   - Every Program must have a `portfolio_id`
   - The `portfolio_id` must reference an existing Portfolio
   - Error: `"Portfolio not found"` or `"field required"`

6. **Portfolio Deletion Protection**
   - Cannot delete a Portfolio that has associated Programs
   - Error: `"Cannot delete portfolio with associated programs. Please reassign or delete programs first."`

### Validation Examples

**Valid Portfolio Creation:**
```json
{
  "name": "Digital Transformation",
  "description": "Strategic digital initiatives",
  "owner": "Jane Smith",
  "reporting_start_date": "2024-01-01",
  "reporting_end_date": "2024-12-31"
}
```

**Invalid - Missing Required Field:**
```json
{
  "name": "Digital Transformation",
  "description": "Strategic digital initiatives",
  "owner": "Jane Smith",
  "reporting_start_date": "2024-01-01"
  // Missing reporting_end_date
}
```

**Invalid - Date Order:**
```json
{
  "name": "Digital Transformation",
  "description": "Strategic digital initiatives",
  "owner": "Jane Smith",
  "reporting_start_date": "2024-12-31",
  "reporting_end_date": "2024-01-01"  // Before start date
}
```

**Invalid - Empty String:**
```json
{
  "name": "",  // Empty string not allowed
  "description": "Strategic digital initiatives",
  "owner": "Jane Smith",
  "reporting_start_date": "2024-01-01",
  "reporting_end_date": "2024-12-31"
}
```

---

## Default Portfolio

### Migration Behavior

During the database migration to add Portfolio support, a default portfolio is automatically created:

**Default Portfolio Properties:**
- **Name**: "Default Portfolio"
- **Description**: "Default portfolio created during migration"
- **Owner**: "System"
- **Reporting Start Date**: Earliest program start date or current date
- **Reporting End Date**: Latest program end date or one year from current date

All existing Programs are automatically assigned to this default portfolio during migration.

### Post-Migration

After migration, administrators should:
1. Review the default portfolio and update its properties as needed
2. Create additional portfolios for organizational structure
3. Reassign programs to appropriate portfolios
4. Optionally delete the default portfolio once all programs are reassigned

---

## Permissions and Security

### Permission Checks

All Portfolio endpoints enforce permission checks:

- **view_portfolios**: Required to list and view portfolios
- **create_portfolios**: Required to create new portfolios
- **update_portfolios**: Required to update existing portfolios
- **delete_portfolios**: Required to delete portfolios

### Scope-Based Access Control

Portfolio access is integrated with the existing scope-based access control system:

- **Global Scope (Admin)**: Full access to all portfolios
- **Portfolio Scope**: Access to specific portfolios and their programs
- **Program Scope**: Access to programs and their parent portfolio (read-only)
- **Project Scope**: Access to projects and their parent program's portfolio (read-only)

### Audit Logging

All Portfolio operations are logged to the audit log:

**Logged Operations:**
- Portfolio creation
- Portfolio updates
- Portfolio deletion
- Portfolio access (read operations)

**Audit Log Entry Format:**
```json
{
  "user_id": "uuid",
  "action": "create_portfolio | update_portfolio | delete_portfolio | view_portfolio",
  "resource_type": "portfolio",
  "resource_id": "uuid",
  "timestamp": "datetime",
  "details": {
    "changes": {...}
  }
}
```

---

## Common Use Cases

### Creating a New Portfolio

**Scenario**: Create a portfolio for a new strategic initiative.

```bash
# 1. Create the portfolio
POST /api/v1/portfolios/
{
  "name": "Cloud Migration Portfolio",
  "description": "Portfolio for all cloud migration initiatives",
  "owner": "CTO Office",
  "reporting_start_date": "2024-01-01",
  "reporting_end_date": "2025-12-31"
}

# 2. Create programs within the portfolio
POST /api/v1/programs/
{
  "name": "Infrastructure Migration",
  "description": "Migrate on-premise infrastructure to cloud",
  "portfolio_id": "{portfolio_id}",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### Reorganizing Programs

**Scenario**: Move programs from one portfolio to another.

```bash
# 1. Get programs in the source portfolio
GET /api/v1/portfolios/{source_portfolio_id}/programs

# 2. Update each program's portfolio_id
PUT /api/v1/programs/{program_id}
{
  "portfolio_id": "{target_portfolio_id}"
}
```

### Viewing Portfolio Hierarchy

**Scenario**: View the complete organizational hierarchy.

```bash
# 1. List all portfolios
GET /api/v1/portfolios/

# 2. For each portfolio, get its programs
GET /api/v1/portfolios/{portfolio_id}/programs

# 3. For each program, get its projects
GET /api/v1/programs/{program_id}/projects
```

### Deleting a Portfolio

**Scenario**: Remove an obsolete portfolio.

```bash
# 1. Check if portfolio has programs
GET /api/v1/portfolios/{portfolio_id}/programs

# 2. If programs exist, reassign them
PUT /api/v1/programs/{program_id}
{
  "portfolio_id": "{new_portfolio_id}"
}

# 3. Delete the portfolio once empty
DELETE /api/v1/portfolios/{portfolio_id}
```

### Updating Portfolio Reporting Period

**Scenario**: Extend the reporting period for a portfolio.

```bash
PUT /api/v1/portfolios/{portfolio_id}
{
  "reporting_end_date": "2026-12-31"
}
```

---

## Error Handling

### Error Response Format

All error responses follow a consistent format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

For validation errors with multiple fields:

```json
{
  "detail": [
    {
      "loc": ["body", "field_name"],
      "msg": "error message",
      "type": "error_type"
    }
  ]
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request format, validation errors, or business rule violations |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User lacks permission for this operation |
| 404 | Not Found | Requested portfolio or program not found |
| 409 | Conflict | Cannot delete portfolio with associated programs |
| 422 | Unprocessable Entity | Request validation failed |
| 500 | Internal Server Error | Unexpected server error |

### Error Examples

**Missing Required Field:**
```json
{
  "detail": [
    {
      "loc": ["body", "name"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Invalid Date Range:**
```json
{
  "detail": "Reporting end date must be after reporting start date"
}
```

**Portfolio Not Found:**
```json
{
  "detail": "Portfolio not found"
}
```

**Cannot Delete Portfolio:**
```json
{
  "detail": "Cannot delete portfolio with associated programs. Please reassign or delete programs first."
}
```

**Insufficient Permissions:**
```json
{
  "detail": "User does not have permission to perform this action"
}
```

---

## Best Practices

### Frontend Integration

1. **Validate Before Submission**: Validate portfolio data on the client side before submitting to reduce round trips
2. **Handle Errors Gracefully**: Display user-friendly error messages with specific guidance
3. **Confirm Deletions**: Always confirm before deleting a portfolio, especially if it has programs
4. **Cache Portfolio Lists**: Cache portfolio lists for dropdown selections to improve performance
5. **Show Program Counts**: Display program counts to help users understand portfolio size

### Backend Integration

1. **Use Transactions**: Wrap portfolio operations in database transactions for atomicity
2. **Validate References**: Always validate that referenced portfolios exist before creating/updating programs
3. **Check Permissions**: Enforce permission checks at both API and service layers
4. **Log Changes**: Log all portfolio modifications for audit purposes
5. **Handle Cascades**: Be aware of cascade delete behavior when deleting portfolios

### Performance Considerations

1. **Index Usage**: Ensure indexes on `portfolio_id` in programs table are utilized
2. **Pagination**: Use pagination for large portfolio lists
3. **Eager Loading**: Use eager loading to fetch portfolio with programs in single query
4. **Caching**: Cache portfolio data for read-heavy workloads
5. **Batch Operations**: Consider batch endpoints for bulk program reassignments

---

## Testing

### Interactive API Documentation

FastAPI provides interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

Use these interfaces to test endpoints interactively with your authentication token.

### Example Test Scenarios

1. **Create and Retrieve Portfolio**
   - Create a new portfolio
   - Retrieve it by ID
   - Verify all fields match

2. **Update Portfolio**
   - Create a portfolio
   - Update specific fields
   - Verify changes persisted

3. **Portfolio-Program Relationship**
   - Create a portfolio
   - Create programs with portfolio_id
   - Retrieve portfolio programs
   - Verify all programs returned

4. **Deletion Protection**
   - Create portfolio with programs
   - Attempt to delete portfolio
   - Verify deletion fails with 409 error
   - Delete programs first
   - Verify portfolio deletion succeeds

5. **Validation Errors**
   - Submit portfolio with missing fields
   - Submit portfolio with invalid date range
   - Verify appropriate error responses

---

## Migration Guide

### Database Migration

The Portfolio feature requires a database migration to add the portfolios table and update the programs table.

**Migration File**: `backend/alembic/versions/847b37d80156_add_portfolio_entity.py`

**Migration Steps:**

1. **Backup Database**
   ```bash
   pg_dump -U postgres -d planner_db > backup_before_portfolio.sql
   ```

2. **Run Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Verify Migration**
   ```bash
   # Check portfolios table exists
   psql -U postgres -d planner_db -c "\d portfolios"
   
   # Check programs have portfolio_id
   psql -U postgres -d planner_db -c "\d programs"
   
   # Verify default portfolio created
   psql -U postgres -d planner_db -c "SELECT * FROM portfolios WHERE name = 'Default Portfolio';"
   
   # Verify all programs assigned
   psql -U postgres -d planner_db -c "SELECT COUNT(*) FROM programs WHERE portfolio_id IS NULL;"
   ```

4. **Rollback (if needed)**
   ```bash
   alembic downgrade -1
   ```

### Application Updates

After migration, update your application code:

1. **Update Program Creation**
   - Add portfolio selection to program creation forms
   - Validate portfolio_id before submission

2. **Update Program Display**
   - Show portfolio information in program details
   - Add portfolio filter to program lists

3. **Add Portfolio Management**
   - Add portfolio CRUD pages
   - Add portfolio navigation menu item
   - Implement portfolio-program hierarchy views

---

## Support and Resources

### Documentation
- [API Documentation Index](./API_DOCUMENTATION_INDEX.md)
- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)
- [Database Migrations](../../docs/deployment/DATABASE_MIGRATIONS.md)

### Related Endpoints
- [Program API](http://localhost:8000/docs#/programs) - Program management endpoints
- [Project API](http://localhost:8000/docs#/projects) - Project management endpoints
- [Audit API](http://localhost:8000/docs#/audit) - Audit log endpoints

### Contact
For questions or issues, contact the development team or file an issue in the project repository.

---

## Changelog

### Version 1.0.0 (Initial Release)
- Portfolio CRUD endpoints
- Portfolio-Program relationship
- Default portfolio migration
- Permission and audit integration
- Scope-based access control
