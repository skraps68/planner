# Optimistic Locking API Documentation

## Overview

The Optimistic Locking feature provides concurrency control for all user-editable entities in the system. It prevents silent data loss when multiple users simultaneously edit the same entity by detecting concurrent modifications and requiring explicit conflict resolution.

### Key Concepts

- **Optimistic Locking**: A concurrency control mechanism that assumes conflicts are rare and checks for conflicts only at commit time using version numbers
- **Version Number**: An integer field that automatically increments on each update, used to detect concurrent modifications
- **Version Conflict**: Occurs when an update attempts to modify an entity whose version has changed since it was read
- **Conflict Resolution**: The process by which a user resolves differences between their changes and another user's changes

### Affected Entities

Optimistic locking is enabled for all 13 user-editable entities:

- Portfolios
- Programs
- Projects
- Project Phases
- Resources
- Worker Types
- Workers
- Resource Assignments
- Rates
- Actuals
- Users
- User Roles
- Scope Assignments

## How It Works

### Version Tracking

Every user-editable entity has a `version` field that:
1. Initializes to `1` when the entity is created
2. Automatically increments by `1` on each successful update
3. Must be provided in all update requests

### Update Flow

```
1. Client reads entity (version=5)
2. User modifies entity locally
3. Client sends update with version=5
4. Server checks: current version == provided version?
   ├─ YES → Update succeeds, version becomes 6
   └─ NO  → Update fails with 409 Conflict
5. On conflict, server returns current entity state
6. Client displays conflict dialog to user
7. User decides: refresh and retry, or cancel
```

### Concurrent Update Example

```
Time  User A                    User B                    Database
----  ------------------------  ------------------------  ------------
T1    Read Portfolio (v=1)      -                         version=1
T2    -                         Read Portfolio (v=1)      version=1
T3    Update (v=1) → Success    -                         version=2
T4    -                         Update (v=1) → CONFLICT   version=2
T5    -                         Receives 409 + current    version=2
```

## API Changes

### Version Field in Responses

All API responses for user-editable entities now include a `version` field:

**Example - Portfolio Response:**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Digital Transformation Portfolio",
  "description": "Strategic initiatives",
  "owner": "Jane Smith",
  "reporting_start_date": "2024-01-01",
  "reporting_end_date": "2024-12-31",
  "version": 5,
  "created_at": "2024-01-15T10:00:00Z",
  "updated_at": "2024-02-10T14:30:00Z"
}
```

### Version Field in Update Requests

All update requests must include the `version` field:

**Example - Update Portfolio:**
```bash
PUT /api/v1/portfolios/123e4567-e89b-12d3-a456-426614174000
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "Updated Portfolio Name",
  "version": 5
}
```

**Missing Version Error:**
```json
{
  "detail": [
    {
      "loc": ["body", "version"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Conflict Response Format

### HTTP 409 Conflict

When a version conflict is detected, the server returns HTTP status code `409 Conflict` with a structured error response:

```json
{
  "detail": {
    "error": "conflict",
    "message": "The portfolio was modified by another user. Please refresh and try again.",
    "entity_type": "portfolio",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000",
    "current_state": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "Name Set By Other User",
      "description": "Updated description",
      "owner": "Jane Smith",
      "reporting_start_date": "2024-01-01",
      "reporting_end_date": "2024-12-31",
      "version": 6,
      "created_at": "2024-01-15T10:00:00Z",
      "updated_at": "2024-02-10T15:45:00Z"
    }
  }
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `error` | string | Always "conflict" for version conflicts |
| `message` | string | User-friendly error message |
| `entity_type` | string | Type of entity (portfolio, program, project, etc.) |
| `entity_id` | string | UUID of the conflicting entity |
| `current_state` | object | Complete current state of the entity including the new version |

### Using Current State

The `current_state` object contains the entity as it currently exists in the database, including:
- All field values as modified by the other user
- The new `version` number (incremented from what you had)
- Updated `updated_at` timestamp

Clients should use this data to:
1. Show users what changed
2. Allow users to compare their changes with the current state
3. Pre-fill forms with the user's attempted changes
4. Update the version number for retry attempts

## Endpoint Examples

### Portfolio Endpoints

#### Create Portfolio
**POST** `/api/v1/portfolios/`

**Response includes version:**
```json
{
  "id": "uuid",
  "name": "New Portfolio",
  "version": 1,
  ...
}
```

#### Get Portfolio
**GET** `/api/v1/portfolios/{portfolio_id}`

**Response includes version:**
```json
{
  "id": "uuid",
  "name": "Portfolio Name",
  "version": 5,
  ...
}
```

#### Update Portfolio
**PUT** `/api/v1/portfolios/{portfolio_id}`

**Request requires version:**
```json
{
  "name": "Updated Name",
  "version": 5
}
```

**Success Response (200 OK):**
```json
{
  "id": "uuid",
  "name": "Updated Name",
  "version": 6,
  ...
}
```

**Conflict Response (409 Conflict):**
```json
{
  "detail": {
    "error": "conflict",
    "message": "The portfolio was modified by another user. Please refresh and try again.",
    "entity_type": "portfolio",
    "entity_id": "uuid",
    "current_state": { ... }
  }
}
```

#### List Portfolios
**GET** `/api/v1/portfolios/`

**Response includes version for each item:**
```json
{
  "items": [
    {
      "id": "uuid",
      "name": "Portfolio 1",
      "version": 3,
      ...
    },
    {
      "id": "uuid",
      "name": "Portfolio 2",
      "version": 7,
      ...
    }
  ],
  "total": 2
}
```

### Program Endpoints

All program endpoints follow the same pattern:

- **POST** `/api/v1/programs/` - Returns `version: 1`
- **GET** `/api/v1/programs/{program_id}` - Includes `version`
- **PUT** `/api/v1/programs/{program_id}` - Requires `version`, returns incremented version or 409
- **GET** `/api/v1/programs/` - Each item includes `version`

### Project Endpoints

All project endpoints follow the same pattern:

- **POST** `/api/v1/projects/` - Returns `version: 1`
- **GET** `/api/v1/projects/{project_id}` - Includes `version`
- **PUT** `/api/v1/projects/{project_id}` - Requires `version`, returns incremented version or 409
- **GET** `/api/v1/projects/` - Each item includes `version`

### Phase Endpoints

#### Batch Update Phases
**POST** `/api/v1/projects/{project_id}/phases/batch`

**Request requires version for each phase:**
```json
{
  "phases": [
    {
      "id": "uuid",
      "name": "Planning",
      "start_date": "2024-01-01",
      "end_date": "2024-03-31",
      "version": 2
    },
    {
      "id": "uuid",
      "name": "Execution",
      "start_date": "2024-04-01",
      "end_date": "2024-12-31",
      "version": 3
    }
  ]
}
```

**Success Response:**
```json
[
  {
    "id": "uuid",
    "name": "Planning",
    "version": 3,
    ...
  },
  {
    "id": "uuid",
    "name": "Execution",
    "version": 4,
    ...
  }
]
```

**Conflict Response (409 Conflict):**
```json
{
  "detail": {
    "error": "conflict",
    "message": "The phase Planning was modified by another user. Please refresh and try again.",
    "entity_type": "phase",
    "entity_id": "uuid",
    "current_state": {
      "id": "uuid",
      "name": "Planning",
      "version": 5,
      ...
    }
  }
}
```

### Resource Assignment Endpoints

#### Bulk Update Assignments
**POST** `/api/v1/assignments/bulk-update`

For bulk operations, the response indicates which assignments succeeded and which failed:

**Request:**
```json
{
  "assignments": [
    {
      "id": "uuid-1",
      "capital_percentage": 50,
      "expense_percentage": 50,
      "version": 2
    },
    {
      "id": "uuid-2",
      "capital_percentage": 60,
      "expense_percentage": 40,
      "version": 3
    },
    {
      "id": "uuid-3",
      "capital_percentage": 70,
      "expense_percentage": 30,
      "version": 4
    }
  ]
}
```

**Partial Success Response (200 OK):**
```json
{
  "succeeded": [
    {
      "id": "uuid-1",
      "version": 3
    },
    {
      "id": "uuid-3",
      "version": 5
    }
  ],
  "failed": [
    {
      "id": "uuid-2",
      "error": "conflict",
      "message": "Assignment was modified by another user",
      "current_state": {
        "id": "uuid-2",
        "capital_percentage": 55,
        "expense_percentage": 45,
        "version": 5,
        ...
      }
    }
  ]
}
```

**Notes:**
- Bulk operations process each assignment individually
- Some assignments may succeed while others fail
- Failed assignments include the current state for conflict resolution
- Succeeded assignments include the new version number

## Client Implementation Guide

### Storing Versions

Always store the version number when receiving entity data:

```typescript
interface Portfolio {
  id: string;
  name: string;
  description: string;
  version: number;  // Always store this
  // ... other fields
}

// When fetching data
const portfolio = await api.get<Portfolio>(`/portfolios/${id}`);
// portfolio.version is now available for updates
```

### Sending Updates

Always include the version in update requests:

```typescript
async function updatePortfolio(
  id: string, 
  data: Partial<Portfolio>, 
  version: number
) {
  return await api.put(`/portfolios/${id}`, {
    ...data,
    version  // Include version from stored entity
  });
}
```

### Handling Conflicts

Catch 409 responses and display conflict information:

```typescript
try {
  await updatePortfolio(id, changes, currentVersion);
  showSuccess("Portfolio updated successfully");
} catch (error) {
  if (error.response?.status === 409) {
    const conflict = error.response.data.detail;
    showConflictDialog({
      message: conflict.message,
      currentState: conflict.current_state,
      attemptedChanges: changes,
      onRefresh: () => {
        // Reload entity with new version
        loadPortfolio(id);
      },
      onRetry: () => {
        // Retry with new version
        updatePortfolio(id, changes, conflict.current_state.version);
      }
    });
  } else {
    showError("Update failed");
  }
}
```

### Conflict Dialog UI

Display a user-friendly conflict dialog:

```typescript
function ConflictDialog({ 
  message, 
  currentState, 
  attemptedChanges,
  onRefresh,
  onCancel 
}) {
  return (
    <Dialog>
      <DialogTitle>Update Conflict</DialogTitle>
      <DialogContent>
        <Alert severity="warning">{message}</Alert>
        
        <Typography variant="h6">Your Changes:</Typography>
        <ComparisonView data={attemptedChanges} />
        
        <Typography variant="h6">Current State:</Typography>
        <ComparisonView data={currentState} />
      </DialogContent>
      <DialogActions>
        <Button onClick={onRefresh}>
          Refresh & Retry
        </Button>
        <Button onClick={onCancel}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

### Bulk Update Handling

For bulk operations, handle partial success:

```typescript
async function bulkUpdateAssignments(assignments) {
  const response = await api.post('/assignments/bulk-update', {
    assignments
  });
  
  const { succeeded, failed } = response.data;
  
  if (succeeded.length > 0) {
    showSuccess(`${succeeded.length} assignments updated successfully`);
  }
  
  if (failed.length > 0) {
    showBulkConflictDialog({
      failed,
      onRetryFailed: () => {
        // Retry only the failed assignments with new versions
        const retryAssignments = failed.map(f => ({
          ...f.current_state,
          // Apply user's changes to current state
        }));
        bulkUpdateAssignments(retryAssignments);
      }
    });
  }
}
```

## Error Handling

### Error Types

| Status Code | Error Type | Description | Action |
|-------------|------------|-------------|--------|
| 409 | Conflict | Version mismatch detected | Show conflict dialog, allow refresh/retry |
| 422 | Validation Error | Missing version field | Include version in request |
| 404 | Not Found | Entity doesn't exist | Handle as normal not found error |
| 400 | Bad Request | Invalid request format | Fix request format |

### Error Response Examples

**Missing Version (422):**
```json
{
  "detail": [
    {
      "loc": ["body", "version"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Version Conflict (409):**
```json
{
  "detail": {
    "error": "conflict",
    "message": "The portfolio was modified by another user. Please refresh and try again.",
    "entity_type": "portfolio",
    "entity_id": "123e4567-e89b-12d3-a456-426614174000",
    "current_state": { ... }
  }
}
```

**Entity Not Found (404):**
```json
{
  "detail": "Portfolio not found"
}
```

## Best Practices

### For Frontend Developers

1. **Always Store Versions**: Store the version number whenever you receive entity data
2. **Always Send Versions**: Include the version in all update requests
3. **Handle Conflicts Gracefully**: Display clear, user-friendly conflict messages
4. **Show Comparisons**: Show users what they tried to change vs. what's currently in the database
5. **Never Auto-Retry**: Always require user acknowledgment before retrying a failed update
6. **Update Local State**: After successful update, update your local version number

### For Backend Developers

1. **Don't Manually Set Version**: Let SQLAlchemy manage the version field automatically
2. **Catch StaleDataError**: Catch this exception at the API layer and return 409
3. **Include Current State**: Always fetch and return the current entity state in conflict responses
4. **Use Transactions**: Ensure version checking happens within database transactions
5. **Log Conflicts**: Log version conflicts for monitoring and debugging

### For System Administrators

1. **Monitor Conflict Frequency**: Track how often conflicts occur to identify hotspots
2. **Analyze Patterns**: Look for entities or users with high conflict rates
3. **No Performance Impact**: Version checking adds minimal overhead (< 5%)
4. **No Downtime Required**: Migration can be applied without application downtime

## Migration Information

### Database Changes

The optimistic locking feature adds a `version` column to all user-editable entity tables:

```sql
ALTER TABLE portfolios ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE programs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
-- ... and 10 more tables
```

### Migration File

**File**: `backend/alembic/versions/ceaed8172152_add_version_columns_for_optimistic_.py`

### Migration Steps

1. **Backup Database**
   ```bash
   pg_dump -U postgres -d planner_db > backup_before_versioning.sql
   ```

2. **Run Migration**
   ```bash
   cd backend
   alembic upgrade head
   ```

3. **Verify Migration**
   ```bash
   # Check version columns exist
   psql -U postgres -d planner_db -c "\d portfolios"
   
   # Verify existing data has version=1
   psql -U postgres -d planner_db -c "SELECT id, name, version FROM portfolios LIMIT 5;"
   ```

4. **Rollback (if needed)**
   ```bash
   alembic downgrade -1
   ```

### Backwards Compatibility

- All existing entities are initialized with `version=1`
- No application downtime required
- Frontend can be updated independently (will work with or without version field)
- Migration is fully reversible

## Testing

### Manual Testing

Use the interactive API documentation to test version conflicts:

1. Open two browser tabs to `http://localhost:8000/docs`
2. In both tabs, GET the same portfolio (note the version)
3. In tab 1, update the portfolio (version increments)
4. In tab 2, try to update with the old version (should get 409)
5. Verify the 409 response includes current state

### Automated Testing

The feature includes comprehensive test coverage:

- **Unit Tests**: Test version initialization, increment, and conflict detection
- **Property Tests**: Test universal properties across all entity types (100+ iterations)
- **Integration Tests**: Test concurrent update scenarios
- **Frontend Tests**: Test conflict dialog and retry logic

Run tests:
```bash
# Backend tests
cd backend
pytest tests/unit/test_optimistic_locking*.py
pytest tests/unit/test_versioned_model*.py

# Frontend tests
cd frontend
npm test -- --testPathPattern=conflict
```

## Monitoring and Logging

### Conflict Logging

All version conflicts are logged with structured data:

```json
{
  "level": "WARNING",
  "message": "Version conflict on portfolio 123e4567-e89b-12d3-a456-426614174000",
  "entity_type": "portfolio",
  "entity_id": "123e4567-e89b-12d3-a456-426614174000",
  "expected_version": 5,
  "actual_version": 6,
  "user_id": "user-uuid",
  "timestamp": "2024-02-13T10:30:00Z"
}
```

### Metrics to Monitor

1. **Conflict Rate**: Number of 409 responses / total update requests
2. **Conflict by Entity Type**: Which entities have the most conflicts
3. **Conflict by User**: Which users experience the most conflicts
4. **Retry Success Rate**: How often users successfully retry after conflicts

### Alerting

Consider setting up alerts for:
- Conflict rate > 5% (indicates high concurrency or UI issues)
- Specific entities with > 10% conflict rate (hotspots)
- Users with repeated conflicts (training opportunity)

## Support and Resources

### Documentation
- [API Documentation Index](./API_DOCUMENTATION_INDEX.md)
- [Error Handling Guide](./ERROR_HANDLING_GUIDE.md)
- [Database Migrations](../../docs/deployment/DATABASE_MIGRATIONS.md)

### Related Documentation
- [Portfolio API](./PORTFOLIO_API.md)
- [Phase API](./PHASE_API.md)
- [Resource Assignment API](./RESOURCE_WORKER_API.md)

### Interactive Documentation
- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`

### Contact
For questions or issues, contact the development team or file an issue in the project repository.

## Changelog

### Version 1.0.0 (Initial Release)
- Version tracking for all 13 user-editable entities
- Automatic version increment on updates
- 409 Conflict responses with current state
- Bulk update partial success handling
- Comprehensive test coverage
- Migration with backwards compatibility
