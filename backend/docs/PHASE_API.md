# Phase Management API Documentation

## Overview

The Phase Management API provides endpoints for managing user-definable project phases. Phases represent date ranges within a project timeline and must form a continuous, non-overlapping timeline spanning the entire project duration.

This API replaces the previous fixed enum-based phase system (Planning/Execution) with a flexible, user-definable approach where phases are determined by date ranges rather than predefined types.

### Key Concepts

- **Phase**: A user-defined date range within a project with a unique name, start date, end date, and budget allocation
- **Default Phase**: Automatically created when a new project is created, spanning the project's entire duration
- **Timeline Continuity**: All phases must collectively cover every date from project start to project end without gaps or overlaps
- **Implicit Phase Relationships**: Resource assignments are associated with phases based on assignment date falling within phase date range (no explicit foreign key)

### Migration Information

For information about migrating from the old phase system to the new user-definable system, see [PHASE_MIGRATION_RUNBOOK.md](./PHASE_MIGRATION_RUNBOOK.md).

## Base URL

All endpoints are prefixed with `/api/v1/`

## Authentication

All endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <token>
```

## Phase Endpoints

### Batch Update Phases
**POST** `/projects/{project_id}/phases/batch`

Atomically update all phases for a project. This is the primary endpoint for saving phase changes from the Phase Editor UI.

**Path Parameters:**
- `project_id` (UUID, required): Project ID

**Request Body:**
```json
{
  "phases": [
    {
      "id": "uuid | null",
      "name": "string",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "string (optional)",
      "capital_budget": "decimal",
      "expense_budget": "decimal",
      "total_budget": "decimal"
    }
  ]
}
```

**Notes:**
- `id` should be `null` for new phases
- `id` should be the existing phase UUID for updates
- Phases not included in the request will be deleted
- All phases are validated for timeline continuity before any changes are made
- The operation is atomic: either all changes succeed or all fail

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "name": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "description": "string",
    "capital_budget": "decimal",
    "expense_budget": "decimal",
    "total_budget": "decimal",
    "assignment_count": 0,
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

**Error Responses:**

`404 Not Found` - Project not found
```json
{
  "detail": "Project {project_id} not found"
}
```

`422 Unprocessable Entity` - Validation failed
```json
{
  "detail": "Validation error message",
  "headers": {
    "X-Error-Code": "VALIDATION_ERROR"
  }
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000/phases/batch" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "phases": [
      {
        "id": null,
        "name": "Planning",
        "start_date": "2024-01-01",
        "end_date": "2024-03-31",
        "description": "Initial planning phase",
        "capital_budget": 50000.00,
        "expense_budget": 25000.00,
        "total_budget": 75000.00
      },
      {
        "id": null,
        "name": "Execution",
        "start_date": "2024-04-01",
        "end_date": "2024-12-31",
        "description": "Main execution phase",
        "capital_budget": 150000.00,
        "expense_budget": 75000.00,
        "total_budget": 225000.00
      }
    ]
  }'
```

---

### List Phases
**GET** `/projects/{project_id}/phases`

Get all phases for a project in chronological order.

**Path Parameters:**
- `project_id` (UUID, required): Project ID

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "project_id": "uuid",
    "name": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "description": "string",
    "capital_budget": "decimal",
    "expense_budget": "decimal",
    "total_budget": "decimal",
    "assignment_count": 0,
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000/phases" \
  -H "Authorization: Bearer <token>"
```

---

### Get Phase
**GET** `/phases/{phase_id}`

Retrieve a specific phase by ID.

**Path Parameters:**
- `phase_id` (UUID, required): Phase ID

**Response:** `200 OK`
```json
{
  "id": "uuid",
  "project_id": "uuid",
  "name": "string",
  "start_date": "YYYY-MM-DD",
  "end_date": "YYYY-MM-DD",
  "description": "string",
  "capital_budget": "decimal",
  "expense_budget": "decimal",
  "total_budget": "decimal",
  "assignment_count": 0,
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

**Error Responses:**

`404 Not Found` - Phase not found
```json
{
  "detail": "Phase {phase_id} not found"
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/phases/123e4567-e89b-12d3-a456-426614174001" \
  -H "Authorization: Bearer <token>"
```

---

### Validate Phases
**POST** `/projects/{project_id}/phases/validate`

Validate a set of phases for timeline continuity without persisting changes. This endpoint is useful for providing real-time validation feedback in the UI.

**Path Parameters:**
- `project_id` (UUID, required): Project ID

**Request Body:**
```json
[
  {
    "id": "uuid | null",
    "name": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD"
  }
]
```

**Response:** `200 OK`
```json
{
  "is_valid": true,
  "errors": []
}
```

Or if validation fails:
```json
{
  "is_valid": false,
  "errors": [
    {
      "field": "timeline",
      "message": "Gap detected between Planning and Execution",
      "phase_id": "uuid | null"
    }
  ]
}
```

**Error Responses:**

`404 Not Found` - Project not found
```json
{
  "detail": "Project {project_id} not found"
}
```

**Example Request:**
```bash
curl -X POST "http://localhost:8000/api/v1/projects/123e4567-e89b-12d3-a456-426614174000/phases/validate" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "id": null,
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31"
    },
    {
      "id": null,
      "name": "Execution",
      "start_date": "2024-04-01",
      "end_date": "2024-12-31"
    }
  ]'
```

---

### Get Phase Assignments
**GET** `/phases/{phase_id}/assignments`

Get all resource assignments that fall within a phase's date range.

**Path Parameters:**
- `phase_id` (UUID, required): Phase ID

**Response:** `200 OK`
```json
[
  {
    "id": "uuid",
    "resource_id": "uuid",
    "project_id": "uuid",
    "assignment_date": "YYYY-MM-DD",
    "allocation_percentage": "decimal",
    "capital_percentage": "decimal",
    "expense_percentage": "decimal",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

**Notes:**
- Returns assignments where `assignment_date` is between phase `start_date` and `end_date` (inclusive)
- This demonstrates the implicit phase relationship based on dates

**Error Responses:**

`404 Not Found` - Phase not found
```json
{
  "detail": "Phase {phase_id} not found"
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:8000/api/v1/phases/123e4567-e89b-12d3-a456-426614174001/assignments" \
  -H "Authorization: Bearer <token>"
```

---

## Phase Validation Rules

The Phase Management API enforces strict validation rules to ensure timeline continuity and data integrity.

### Basic Phase Constraints

1. **Name Validation**
   - Must not be empty
   - Maximum length: 100 characters
   - Error: `"Phase name is required"` or `"Phase name exceeds maximum length"`

2. **Date Validation**
   - `start_date` must be a valid date
   - `end_date` must be a valid date
   - `start_date` must be ≤ `end_date`
   - Error: `"End date must be on or after start date"`

3. **Budget Validation**
   - All budget values must be ≥ 0
   - `total_budget` must equal `capital_budget + expense_budget`
   - Error: `"Total budget must equal capital + expense"`

### Project Boundary Constraints

4. **Phase Within Project Dates**
   - Phase `start_date` must be ≥ project `start_date`
   - Phase `end_date` must be ≤ project `end_date`
   - Error: `"Phase dates must fall within project dates"`

### Timeline Continuity Constraints

5. **Complete Coverage**
   - First phase must start at project `start_date`
   - Last phase must end at project `end_date`
   - Error: `"First phase must start at project start date"` or `"Last phase must end at project end date"`

6. **No Gaps**
   - Each phase must start the day after the previous phase ends
   - Error: `"Gap detected between {phase1} and {phase2}"`

7. **No Overlaps**
   - No two phases can have overlapping date ranges
   - Error: `"Overlap detected between {phase1} and {phase2}"`

### Deletion Constraints

8. **Prevent Gap-Creating Deletions**
   - Cannot delete a phase if it would create a gap in the timeline
   - Error: `"Cannot delete phase: would create timeline gap"`

9. **Last Phase Protection**
   - Cannot delete the last remaining phase
   - Error: `"Cannot delete the last phase"`

### Validation Examples

**Valid Timeline:**
```
Project: 2024-01-01 to 2024-12-31

Phase 1: 2024-01-01 to 2024-03-31 ✓
Phase 2: 2024-04-01 to 2024-08-31 ✓
Phase 3: 2024-09-01 to 2024-12-31 ✓

Result: Valid - continuous coverage, no gaps, no overlaps
```

**Invalid Timeline - Gap:**
```
Project: 2024-01-01 to 2024-12-31

Phase 1: 2024-01-01 to 2024-03-31 ✓
Phase 2: 2024-05-01 to 2024-12-31 ✗

Error: "Gap detected between Phase 1 and Phase 2"
Missing dates: 2024-04-01 to 2024-04-30
```

**Invalid Timeline - Overlap:**
```
Project: 2024-01-01 to 2024-12-31

Phase 1: 2024-01-01 to 2024-06-30 ✓
Phase 2: 2024-06-01 to 2024-12-31 ✗

Error: "Overlap detected between Phase 1 and Phase 2"
Overlapping dates: 2024-06-01 to 2024-06-30
```

**Invalid Timeline - Boundary Violation:**
```
Project: 2024-01-01 to 2024-12-31

Phase 1: 2023-12-01 to 2024-06-30 ✗
Phase 2: 2024-07-01 to 2024-12-31 ✓

Error: "Phase dates must fall within project dates"
Phase 1 starts before project start date
```

---

## Default Phase Behavior

### Automatic Creation

When a new project is created, the system automatically creates a "Default Phase" with the following properties:

- **Name**: "Default Phase"
- **Start Date**: Project start date
- **End Date**: Project end date
- **Capital Budget**: 0
- **Expense Budget**: 0
- **Total Budget**: 0

This ensures that every project has complete phase coverage from the moment of creation.

### Date Synchronization

If a project has only the default phase and the project dates are updated, the default phase dates are automatically synchronized to match:

```
Initial State:
Project: 2024-01-01 to 2024-12-31
Default Phase: 2024-01-01 to 2024-12-31

After Project Update:
Project: 2024-01-01 to 2025-06-30
Default Phase: 2024-01-01 to 2025-06-30 (auto-updated)
```

Once additional phases are created, this automatic synchronization stops, and users must manually manage phase dates.

---

## Implicit Phase Relationships

### Date-Based Association

Unlike the previous system where resource assignments had an explicit `project_phase_id` foreign key, the new system uses **implicit relationships** based on dates:

```sql
-- Old System (Explicit)
SELECT * FROM resource_assignments 
WHERE project_phase_id = '123e4567-e89b-12d3-a456-426614174001';

-- New System (Implicit)
SELECT * FROM resource_assignments 
WHERE project_id = '123e4567-e89b-12d3-a456-426614174000'
  AND assignment_date >= '2024-01-01'
  AND assignment_date <= '2024-03-31';
```

### Benefits

1. **No Synchronization Issues**: When phase dates change, assignments automatically move with them
2. **Flexibility**: Phases can be reorganized without updating assignment records
3. **Simplicity**: Fewer foreign key constraints to manage
4. **Historical Accuracy**: Assignment dates remain unchanged regardless of phase restructuring

### Query Patterns

**Get phase for a specific date:**
```python
phase = db.query(ProjectPhase).filter(
    ProjectPhase.project_id == project_id,
    ProjectPhase.start_date <= target_date,
    ProjectPhase.end_date >= target_date
).first()
```

**Get assignments for a phase:**
```python
assignments = db.query(ResourceAssignment).filter(
    ResourceAssignment.project_id == phase.project_id,
    ResourceAssignment.assignment_date >= phase.start_date,
    ResourceAssignment.assignment_date <= phase.end_date
).all()
```

---

## Migration Process

### Overview

The migration from the old enum-based phase system to the new user-definable system is handled by Alembic migration `92023c163a26_transform_phases_to_user_definable`.

### What Changes

**Database Schema:**
- `project_phases` table:
  - Removed: `phase_type` (enum column)
  - Added: `name` (varchar), `start_date` (date), `end_date` (date), `description` (varchar)
- `resource_assignments` table:
  - Removed: `project_phase_id` (foreign key column)

**Data Transformation:**
- Existing "Planning" phases → User-defined phases named "Planning"
- Existing "Execution" phases → User-defined phases named "Execution"
- Phase dates calculated from project dates and assignment dates
- All budget data preserved

### Migration Steps

1. **Pre-Migration**
   - Backup database
   - Verify current migration state
   - Run data integrity checks

2. **Migration Execution**
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Post-Migration**
   - Verify data transformation
   - Run verification queries
   - Test application functionality

4. **Rollback (if needed)**
   ```bash
   alembic downgrade -1
   ```

### Detailed Instructions

For complete migration instructions, see [PHASE_MIGRATION_RUNBOOK.md](./PHASE_MIGRATION_RUNBOOK.md).

---

## Common Use Cases

### Creating a Multi-Phase Project

**Scenario**: Create a project with Planning, Development, and Testing phases.

```bash
# 1. Create the project (default phase created automatically)
POST /api/v1/projects
{
  "name": "New Application",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31",
  ...
}

# 2. Replace default phase with custom phases
POST /api/v1/projects/{project_id}/phases/batch
{
  "phases": [
    {
      "id": null,
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31",
      "capital_budget": 50000,
      "expense_budget": 25000,
      "total_budget": 75000
    },
    {
      "id": null,
      "name": "Development",
      "start_date": "2024-04-01",
      "end_date": "2024-09-30",
      "capital_budget": 200000,
      "expense_budget": 100000,
      "total_budget": 300000
    },
    {
      "id": null,
      "name": "Testing",
      "start_date": "2024-10-01",
      "end_date": "2024-12-31",
      "capital_budget": 50000,
      "expense_budget": 25000,
      "total_budget": 75000
    }
  ]
}
```

### Extending a Phase

**Scenario**: Extend the Development phase by 2 months, shortening Testing.

```bash
POST /api/v1/projects/{project_id}/phases/batch
{
  "phases": [
    {
      "id": "{planning_phase_id}",
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31",
      "capital_budget": 50000,
      "expense_budget": 25000,
      "total_budget": 75000
    },
    {
      "id": "{development_phase_id}",
      "name": "Development",
      "start_date": "2024-04-01",
      "end_date": "2024-11-30",  // Extended by 2 months
      "capital_budget": 200000,
      "expense_budget": 100000,
      "total_budget": 300000
    },
    {
      "id": "{testing_phase_id}",
      "name": "Testing",
      "start_date": "2024-12-01",  // Adjusted to maintain continuity
      "end_date": "2024-12-31",
      "capital_budget": 50000,
      "expense_budget": 25000,
      "total_budget": 75000
    }
  ]
}
```

### Splitting a Phase

**Scenario**: Split Development into Development and Integration phases.

```bash
POST /api/v1/projects/{project_id}/phases/batch
{
  "phases": [
    {
      "id": "{planning_phase_id}",
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31",
      ...
    },
    {
      "id": "{development_phase_id}",
      "name": "Development",
      "start_date": "2024-04-01",
      "end_date": "2024-07-31",  // Shortened
      ...
    },
    {
      "id": null,  // New phase
      "name": "Integration",
      "start_date": "2024-08-01",
      "end_date": "2024-09-30",
      ...
    },
    {
      "id": "{testing_phase_id}",
      "name": "Testing",
      "start_date": "2024-10-01",
      "end_date": "2024-12-31",
      ...
    }
  ]
}
```

### Real-Time Validation

**Scenario**: Validate phase changes before saving.

```bash
# User is editing phases in the UI
# Before enabling the Save button, validate:

POST /api/v1/projects/{project_id}/phases/validate
[
  {
    "id": "{phase1_id}",
    "name": "Planning",
    "start_date": "2024-01-01",
    "end_date": "2024-03-31"
  },
  {
    "id": "{phase2_id}",
    "name": "Execution",
    "start_date": "2024-04-01",
    "end_date": "2024-12-31"
  }
]

# Response indicates if changes are valid
{
  "is_valid": true,
  "errors": []
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

For validation errors, an additional header is included:

```json
{
  "detail": "Validation error message",
  "headers": {
    "X-Error-Code": "VALIDATION_ERROR"
  }
}
```

### Common Error Codes

| Status Code | Error Type | Description |
|-------------|------------|-------------|
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | User lacks permission for this operation |
| 404 | Not Found | Requested resource (project/phase) not found |
| 422 | Unprocessable Entity | Validation failed (timeline continuity, constraints) |
| 500 | Internal Server Error | Unexpected server error |

### Validation Error Examples

**Timeline Gap:**
```json
{
  "detail": "Gap detected between Planning and Execution phases",
  "headers": {
    "X-Error-Code": "VALIDATION_ERROR"
  }
}
```

**Timeline Overlap:**
```json
{
  "detail": "Overlap detected between Development and Testing phases",
  "headers": {
    "X-Error-Code": "VALIDATION_ERROR"
  }
}
```

**Boundary Violation:**
```json
{
  "detail": "Phase dates must fall within project dates (2024-01-01 to 2024-12-31)",
  "headers": {
    "X-Error-Code": "VALIDATION_ERROR"
  }
}
```

**Invalid Date Order:**
```json
{
  "detail": "End date must be on or after start date",
  "headers": {
    "X-Error-Code": "VALIDATION_ERROR"
  }
}
```

---

## Best Practices

### Frontend Integration

1. **Always Use Batch Update**: Use the batch update endpoint for all phase modifications to ensure atomicity
2. **Validate Before Saving**: Call the validation endpoint to provide real-time feedback
3. **Handle Errors Gracefully**: Display validation errors inline with specific guidance
4. **Maintain Continuity**: When adjusting phase dates, automatically adjust adjacent phases to maintain continuity
5. **Confirm Deletions**: Warn users before deleting phases, especially if it affects assignments

### Backend Integration

1. **Use Date-Based Queries**: Query assignments by date range rather than phase ID
2. **Cache Phase Lookups**: Cache phase data for frequently accessed projects
3. **Validate Early**: Validate phase data before starting database transactions
4. **Handle Transactions**: Wrap phase operations in database transactions for atomicity
5. **Log Changes**: Log all phase modifications for audit purposes

### Performance Considerations

1. **Index Usage**: Ensure indexes on `start_date` and `end_date` columns are utilized
2. **Batch Operations**: Use batch update endpoint to minimize round trips
3. **Pagination**: For projects with many assignments, paginate the assignments endpoint
4. **Caching**: Cache phase data at the application level for read-heavy workloads

---

## Testing

### Interactive API Documentation

FastAPI provides interactive API documentation at:
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

Use these interfaces to test endpoints interactively with your authentication token.

### Example Test Scenarios

1. **Create Project with Default Phase**
   - Create a new project
   - Verify default phase exists
   - Verify default phase spans project dates

2. **Replace Default Phase**
   - Create custom phases using batch update
   - Verify default phase is replaced
   - Verify timeline continuity

3. **Validate Timeline Errors**
   - Submit phases with gaps
   - Verify validation errors returned
   - Submit phases with overlaps
   - Verify validation errors returned

4. **Query Assignments by Phase**
   - Create assignments across multiple phases
   - Query assignments for each phase
   - Verify correct assignments returned

---

## Support and Resources

### Documentation
- [Phase Migration Runbook](./PHASE_MIGRATION_RUNBOOK.md)
- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)
- [API Documentation](http://localhost:8000/docs)

### Related Endpoints
- [Project API](./projects.md) - Project management endpoints
- [Assignment API](./assignments.md) - Resource assignment endpoints
- [Reports API](./reports.md) - Phase-based reporting endpoints

### Contact
For questions or issues, contact the development team or file an issue in the project repository.
