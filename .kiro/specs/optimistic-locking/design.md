# Design Document: Optimistic Locking Concurrency Control

## Overview

This design implements optimistic locking concurrency control across all user-editable entities using SQLAlchemy's built-in `version_id_col` feature. The solution adds version tracking to 13 entity types, validates versions on updates, and returns structured conflict errors when concurrent modifications are detected.

The implementation leverages SQLAlchemy's automatic version management, which increments version numbers on each UPDATE and validates them within the database transaction. This provides atomic conflict detection without additional application logic or database round trips.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  - Stores version from API responses                         │
│  - Sends version with update requests                        │
│  - Handles 409 Conflict responses                            │
│  - Displays conflict resolution UI                           │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP (JSON with version field)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer (FastAPI)                     │
│  - Validates version in request payload                      │
│  - Catches StaleDataError from ORM                           │
│  - Returns 409 Conflict with current state                   │
│  - Includes version in all responses                         │
└────────────────────┬────────────────────────────────────────┘
                     │ SQLAlchemy ORM
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                   ORM Layer (SQLAlchemy)                     │
│  - Manages version_id_col automatically                      │
│  - Increments version on UPDATE                              │
│  - Adds WHERE version=? to UPDATE statements                 │
│  - Raises StaleDataError on version mismatch                 │
└────────────────────┬────────────────────────────────────────┘
                     │ SQL
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Database Layer (PostgreSQL)                 │
│  - Stores version column (integer, NOT NULL, default 1)      │
│  - Executes atomic UPDATE with version check                 │
│  - Returns rows affected (0 if version mismatch)             │
└─────────────────────────────────────────────────────────────┘
```

### Version Checking Flow

```
User submits update with version=5
         │
         ▼
API receives: {id: "abc", name: "New Name", version: 5}
         │
         ▼
ORM generates: UPDATE entities SET name='New Name', version=6 
               WHERE id='abc' AND version=5
         │
         ├─── Rows affected = 1 ──→ Success (version matched)
         │
         └─── Rows affected = 0 ──→ StaleDataError (version mismatch)
                    │
                    ▼
              API catches error
                    │
                    ▼
              Fetch current state
                    │
                    ▼
         Return 409 Conflict with current entity
```

## Components and Interfaces

### 1. Database Models (SQLAlchemy)

All user-editable models will be updated to include version tracking:

```python
from sqlalchemy import Column, Integer
from sqlalchemy.orm import declarative_mixin

@declarative_mixin
class VersionedMixin:
    """Mixin to add optimistic locking to models."""
    version = Column(Integer, nullable=False, default=1)
    
    __mapper_args__ = {
        "version_id_col": version
    }

# Apply to all user-editable entities
class Portfolio(Base, VersionedMixin):
    # ... existing fields ...
    pass

class Program(Base, VersionedMixin):
    # ... existing fields ...
    pass

class Project(Base, VersionedMixin):
    # ... existing fields ...
    pass

class ProjectPhase(Base, VersionedMixin):
    # ... existing fields ...
    pass

class Resource(Base, VersionedMixin):
    # ... existing fields ...
    pass

class WorkerType(Base, VersionedMixin):
    # ... existing fields ...
    pass

class Worker(Base, VersionedMixin):
    # ... existing fields ...
    pass

class ResourceAssignment(Base, VersionedMixin):
    # ... existing fields ...
    pass

class Rate(Base, VersionedMixin):
    # ... existing fields ...
    pass

class Actual(Base, VersionedMixin):
    # ... existing fields ...
    pass

class User(Base, VersionedMixin):
    # ... existing fields ...
    pass

class UserRole(Base, VersionedMixin):
    # ... existing fields ...
    pass

class ScopeAssignment(Base, VersionedMixin):
    # ... existing fields ...
    pass
```

**Key Design Decisions:**
- Use a mixin for DRY principle and consistency
- SQLAlchemy's `version_id_col` handles all version logic automatically
- Version column is NOT NULL with default=1 for new records
- Integer type is sufficient (supports 2+ billion updates per entity)

### 2. Pydantic Schemas

Update request and response schemas to include version field:

```python
from pydantic import BaseModel, Field

class VersionedSchema(BaseModel):
    """Base schema for versioned entities."""
    version: int = Field(..., description="Version number for optimistic locking")

class PortfolioUpdate(VersionedSchema):
    name: Optional[str] = None
    description: Optional[str] = None
    # ... other fields ...

class PortfolioResponse(VersionedSchema):
    id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    version: int  # Always included in responses
    # ... other fields ...

# Apply pattern to all 13 entity types
```

**Key Design Decisions:**
- Version is required in update schemas (prevents accidental omission)
- Version is always included in response schemas
- Version field is documented in OpenAPI schema

### 3. API Error Handling

Create a standardized conflict error response:

```python
from fastapi import HTTPException, status
from sqlalchemy.orm.exc import StaleDataError

class ConflictError(HTTPException):
    """Raised when optimistic locking detects a conflict."""
    def __init__(self, entity_type: str, entity_id: str, current_state: dict):
        detail = {
            "error": "conflict",
            "message": f"The {entity_type} was modified by another user. Please refresh and try again.",
            "entity_type": entity_type,
            "entity_id": entity_id,
            "current_state": current_state
        }
        super().__init__(status_code=status.HTTP_409_CONFLICT, detail=detail)

# In endpoint handlers
@router.put("/{portfolio_id}")
async def update_portfolio(
    portfolio_id: UUID,
    portfolio_update: PortfolioUpdate,
    db: Session = Depends(get_db)
):
    try:
        updated = portfolio_service.update(db, portfolio_id, portfolio_update)
        return updated
    except StaleDataError:
        # Fetch current state
        current = portfolio_service.get(db, portfolio_id)
        raise ConflictError("portfolio", str(portfolio_id), current.dict())
```

**Key Design Decisions:**
- Catch `StaleDataError` at the API layer (not service layer)
- Always fetch and return current entity state in conflict response
- Use consistent error structure across all endpoints
- HTTP 409 Conflict is the standard status code for this scenario

### 4. Service Layer Updates

Service layer methods remain largely unchanged, as SQLAlchemy handles version checking:

```python
class PortfolioService:
    def update(self, db: Session, portfolio_id: UUID, update_data: PortfolioUpdate) -> Portfolio:
        """Update portfolio. Raises StaleDataError if version mismatch."""
        portfolio = db.query(Portfolio).filter(Portfolio.id == portfolio_id).first()
        if not portfolio:
            raise NotFoundException(f"Portfolio {portfolio_id} not found")
        
        # Update fields
        for field, value in update_data.dict(exclude_unset=True).items():
            if field != "version":  # Don't manually set version
                setattr(portfolio, field, value)
        
        # SQLAlchemy automatically checks version and increments it
        db.commit()
        db.refresh(portfolio)
        return portfolio
```

**Key Design Decisions:**
- Service layer doesn't need explicit version checking logic
- SQLAlchemy's `version_id_col` handles everything automatically
- Service methods can raise `StaleDataError` naturally
- Version field is excluded from manual updates (SQLAlchemy manages it)

### 5. Bulk Update Handling

For bulk operations (especially Resource Assignments), handle conflicts individually:

```python
class AssignmentService:
    def bulk_update(
        self, 
        db: Session, 
        updates: List[ResourceAssignmentUpdate]
    ) -> BulkUpdateResult:
        """Update multiple assignments, tracking conflicts individually."""
        results = {
            "succeeded": [],
            "failed": []
        }
        
        for update in updates:
            try:
                assignment = self.update(db, update.id, update)
                results["succeeded"].append({
                    "id": update.id,
                    "version": assignment.version
                })
            except StaleDataError:
                current = self.get(db, update.id)
                results["failed"].append({
                    "id": update.id,
                    "error": "conflict",
                    "current_state": current.dict()
                })
        
        return results
```

**Key Design Decisions:**
- Process bulk updates individually to isolate conflicts
- Return partial success results (some succeed, some fail)
- Don't roll back successful updates when one fails
- Client can retry only the failed updates

### 6. Frontend Integration

Frontend components will be updated to handle versions:

```typescript
// Store version from API response
interface Portfolio {
  id: string;
  name: string;
  version: number;  // Always present
  // ... other fields
}

// Send version with updates
async function updatePortfolio(id: string, data: Partial<Portfolio>, version: number) {
  try {
    const response = await api.put(`/portfolios/${id}`, {
      ...data,
      version  // Include version in request
    });
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      // Handle conflict
      const conflict = error.response.data;
      showConflictDialog({
        message: conflict.message,
        currentState: conflict.current_state,
        attemptedChanges: data
      });
    }
    throw error;
  }
}

// Conflict resolution UI
function ConflictDialog({ message, currentState, attemptedChanges }) {
  return (
    <Dialog>
      <DialogTitle>Update Conflict</DialogTitle>
      <DialogContent>
        <p>{message}</p>
        <ComparisonView 
          current={currentState} 
          attempted={attemptedChanges} 
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={refreshAndRetry}>Refresh & Retry</Button>
        <Button onClick={cancel}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
```

**Key Design Decisions:**
- Always store version from API responses
- Always send version with update requests
- Display user-friendly conflict messages
- Show comparison between current state and attempted changes
- Provide clear actions (refresh/retry or cancel)

## Data Models

### Version Column Schema

```sql
-- Added to all 13 user-editable entity tables
ALTER TABLE portfolios ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE programs ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE projects ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE project_phases ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resources ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE worker_types ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workers ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE resource_assignments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rates ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE actuals ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE user_roles ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE scope_assignments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
```

### Generated UPDATE Statement

When SQLAlchemy performs an update with `version_id_col`:

```sql
-- Without optimistic locking (old behavior)
UPDATE portfolios 
SET name = 'New Name', updated_at = NOW() 
WHERE id = 'abc-123';

-- With optimistic locking (new behavior)
UPDATE portfolios 
SET name = 'New Name', updated_at = NOW(), version = version + 1
WHERE id = 'abc-123' AND version = 5;

-- If version doesn't match (another user updated it):
-- Rows affected = 0 → StaleDataError raised
```

### Conflict Response Schema

```json
{
  "detail": {
    "error": "conflict",
    "message": "The portfolio was modified by another user. Please refresh and try again.",
    "entity_type": "portfolio",
    "entity_id": "abc-123",
    "current_state": {
      "id": "abc-123",
      "name": "Name Set By Other User",
      "description": "Updated description",
      "version": 6,
      "updated_at": "2024-01-15T10:30:00Z"
    }
  }
}
```


## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property Reflection

After analyzing all acceptance criteria, I identified the following redundancies:
- Requirements 3.1-3.4 all test that version is included in API responses - these can be combined into one comprehensive property
- Requirements 2.4 and 4.1 both test that conflicts return HTTP 409 - these are duplicates
- Requirements 7.1 and 7.2 are covered by the general conflict detection property (2.3)
- Requirements 4.2, 4.4, and 4.5 can be combined into one property about conflict response structure

The following properties provide comprehensive coverage without redundancy:

### Property 1: New Entity Version Initialization

*For any* user-editable entity type (Portfolio, Program, Project, ProjectPhase, Resource, WorkerType, Worker, ResourceAssignment, Rate, Actual, User, UserRole, ScopeAssignment), when a new entity is created, the version field should be initialized to 1.

**Validates: Requirements 1.2**

### Property 2: Version Increment on Update

*For any* user-editable entity, when the entity is successfully updated, the version number should be incremented by exactly 1.

**Validates: Requirements 1.3**

### Property 3: Version Required in Update Requests

*For any* update request to a user-editable entity, if the version field is missing from the request payload, the API should reject the request with a validation error.

**Validates: Requirements 2.1**

### Property 4: Successful Update with Matching Version

*For any* user-editable entity, when an update request is sent with a version number that matches the current database version, the update should succeed and return the updated entity with an incremented version.

**Validates: Requirements 2.2**

### Property 5: Conflict Detection on Version Mismatch

*For any* user-editable entity, when an update request is sent with a version number that does not match the current database version, the system should raise a StaleDataError and return HTTP 409 Conflict.

**Validates: Requirements 2.3, 2.4, 4.1, 7.1, 7.2**

### Property 6: Version Included in All API Responses

*For any* API endpoint that returns user-editable entities (create, read, update, list), the response should include the version field for each entity.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 7: Conflict Response Structure

*For any* version conflict (HTTP 409), the error response should contain a consistent JSON structure with: error type, user-friendly message, entity type, entity ID, and the current state of the entity.

**Validates: Requirements 4.2, 4.4, 4.5**

### Property 8: Bulk Update Individual Validation

*For any* bulk update operation on Resource Assignments, each assignment's version should be validated individually, and the response should identify which assignments succeeded and which failed due to version conflicts.

**Validates: Requirements 7.3, 7.5**

### Property 9: Conflict Logging

*For any* version conflict, the system should log the conflict with entity type, entity ID, expected version, actual version, and user ID, without logging sensitive data.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4**

### Property 10: Cross-Database Compatibility

*For any* property test, when run against both PostgreSQL and SQLite databases, the behavior should be identical (version initialization, increment, conflict detection).

**Validates: Requirements 1.5**

## Error Handling

### Error Types and Responses

1. **Version Conflict (StaleDataError)**
   - HTTP Status: 409 Conflict
   - Cause: Update attempted with outdated version number
   - Response includes current entity state
   - User must refresh and retry

2. **Missing Version in Request**
   - HTTP Status: 422 Unprocessable Entity
   - Cause: Update request missing required version field
   - Response indicates validation error
   - User must include version in request

3. **Entity Not Found**
   - HTTP Status: 404 Not Found
   - Cause: Attempting to update non-existent entity
   - Standard not found error response
   - No version checking occurs

### Error Handling Flow

```python
@router.put("/{entity_id}")
async def update_entity(entity_id: UUID, update: EntityUpdate, db: Session):
    try:
        # Service layer performs update with version check
        updated = service.update(db, entity_id, update)
        return updated
    
    except StaleDataError:
        # Version conflict detected
        current = service.get(db, entity_id)
        logger.warning(
            f"Version conflict on {entity_type} {entity_id}",
            extra={
                "entity_type": entity_type,
                "entity_id": str(entity_id),
                "expected_version": update.version,
                "actual_version": current.version,
                "user_id": current_user.id
            }
        )
        raise ConflictError(entity_type, str(entity_id), current.dict())
    
    except NotFoundException:
        # Entity doesn't exist
        raise HTTPException(status_code=404, detail=f"{entity_type} not found")
```

### Bulk Operation Error Handling

For bulk updates (especially Resource Assignments), partial success is allowed:

```python
{
  "succeeded": [
    {"id": "abc-123", "version": 3},
    {"id": "def-456", "version": 2}
  ],
  "failed": [
    {
      "id": "ghi-789",
      "error": "conflict",
      "message": "Version mismatch",
      "current_state": { ... }
    }
  ]
}
```

### Frontend Error Handling

Frontend should handle conflicts gracefully:

```typescript
try {
  await updateEntity(id, data, version);
} catch (error) {
  if (error.response?.status === 409) {
    // Show conflict dialog
    const conflict = error.response.data.detail;
    showConflictDialog({
      message: conflict.message,
      currentState: conflict.current_state,
      onRefresh: () => {
        // Reload entity and let user retry
        loadEntity(id);
      }
    });
  } else {
    // Handle other errors
    showErrorToast(error.message);
  }
}
```

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

Together, these provide comprehensive coverage where unit tests catch concrete bugs and property tests verify general correctness.

### Property-Based Testing

We will use **Hypothesis** (Python) for backend property-based testing. Each property test will:
- Run a minimum of 100 iterations
- Generate random test data (entity types, version numbers, update payloads)
- Reference the design document property it validates
- Use the tag format: `# Feature: optimistic-locking, Property N: [property text]`

Example property test structure:

```python
from hypothesis import given, strategies as st
import pytest

# Feature: optimistic-locking, Property 2: Version Increment on Update
@given(
    entity_type=st.sampled_from([
        Portfolio, Program, Project, ProjectPhase, Resource,
        WorkerType, Worker, ResourceAssignment, Rate, Actual,
        User, UserRole, ScopeAssignment
    ]),
    update_data=st.dictionaries(
        keys=st.text(min_size=1),
        values=st.text()
    )
)
@pytest.mark.parametrize("db_type", ["postgresql", "sqlite"])
def test_version_increments_on_update(entity_type, update_data, db_type, db_session):
    """For any entity, updating should increment version by 1."""
    # Create entity
    entity = create_random_entity(entity_type, db_session)
    initial_version = entity.version
    
    # Update entity
    updated = update_entity(entity.id, update_data, entity.version, db_session)
    
    # Verify version incremented
    assert updated.version == initial_version + 1
```

### Unit Testing

Unit tests will cover:
- Specific examples of version conflicts
- Edge cases (version=0, version=MAX_INT)
- Error response structure validation
- Migration verification
- Frontend component behavior

Example unit test:

```python
def test_conflict_returns_409_with_current_state(db_session):
    """Verify conflict response structure."""
    # Create portfolio
    portfolio = create_portfolio(db_session, name="Original")
    original_version = portfolio.version
    
    # Update portfolio (increments version)
    update_portfolio(portfolio.id, {"name": "Updated"}, original_version, db_session)
    
    # Try to update with stale version
    response = client.put(
        f"/api/v1/portfolios/{portfolio.id}",
        json={"name": "Conflict", "version": original_version}
    )
    
    # Verify 409 response
    assert response.status_code == 409
    assert response.json()["detail"]["error"] == "conflict"
    assert response.json()["detail"]["current_state"]["name"] == "Updated"
    assert response.json()["detail"]["current_state"]["version"] == original_version + 1
```

### Integration Testing

Integration tests will simulate realistic concurrent update scenarios:

```python
def test_concurrent_resource_assignment_updates(db_session):
    """Simulate two users updating the same assignment simultaneously."""
    # User 1 reads assignment
    assignment = get_assignment(assignment_id)
    version_1 = assignment.version
    
    # User 2 reads assignment (same version)
    assignment_2 = get_assignment(assignment_id)
    version_2 = assignment_2.version
    assert version_1 == version_2
    
    # User 1 updates successfully
    update_assignment(assignment_id, {"hours": 40}, version_1)
    
    # User 2 tries to update with stale version
    with pytest.raises(ConflictError):
        update_assignment(assignment_id, {"hours": 35}, version_2)
```

### Frontend Testing

Frontend tests will use React Testing Library and MSW (Mock Service Worker):

```typescript
test('displays conflict dialog when 409 received', async () => {
  // Mock 409 response
  server.use(
    rest.put('/api/v1/portfolios/:id', (req, res, ctx) => {
      return res(
        ctx.status(409),
        ctx.json({
          detail: {
            error: 'conflict',
            message: 'Portfolio was modified by another user',
            current_state: { id: '123', name: 'Updated Name', version: 2 }
          }
        })
      );
    })
  );
  
  // Attempt update
  render(<PortfolioForm portfolio={{ id: '123', name: 'Old Name', version: 1 }} />);
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Name' } });
  fireEvent.click(screen.getByText('Save'));
  
  // Verify conflict dialog appears
  await waitFor(() => {
    expect(screen.getByText(/modified by another user/i)).toBeInTheDocument();
    expect(screen.getByText('Updated Name')).toBeInTheDocument();
  });
});
```

### Test Coverage Requirements

- All 13 entity types must have version conflict tests
- All API endpoints (create, read, update, list) must verify version inclusion
- Bulk update operations must have partial success tests
- Migration tests must verify backwards compatibility
- Cross-database tests must run on both PostgreSQL and SQLite
- Frontend tests must cover conflict dialog and retry logic

### Performance Testing

While not part of property-based testing, we should measure:
- Response time impact of version checking (should be < 5% increase)
- Bulk update performance with version validation
- Database query count (should not increase)

These will be monitored but not enforced in automated tests.
