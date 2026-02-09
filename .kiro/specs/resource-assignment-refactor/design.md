# Design Document: Resource Assignment Data Model Refactoring

## Overview

This design document outlines the technical approach for refactoring the ResourceAssignment data model to eliminate the `allocation_percentage` field and implement a new conceptual model where `capital_percentage` and `expense_percentage` represent direct time allocations rather than portions of a total allocation.

### Current Model
- `allocation_percentage`: Total allocation (0-100%)
- `capital_percentage`: Portion of allocation for capital (0-100%)
- `expense_percentage`: Portion of allocation for expense (0-100%)
- Constraint: `capital_percentage + expense_percentage = 100`

### New Model
- `capital_percentage`: Direct time allocation for capital work (0-100%)
- `expense_percentage`: Direct time allocation for expense work (0-100%)
- Constraint (per assignment): `capital_percentage + expense_percentage <= 100`
- Constraint (cross-project): Sum of all (capital + expense) for a resource on a date <= 100%

### Key Changes
1. Remove `allocation_percentage` field from database, models, schemas, and APIs
2. Change constraint from `capital + expense = 100` to `capital + expense <= 100`
3. Implement cross-project validation to ensure total allocation <= 100% per resource per day
4. Update all service layer logic to use new validation
5. Update frontend to work with new model
6. Migrate existing data safely

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend Layer                        │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ResourceAssignmentCalendar Component                  │ │
│  │  - Remove allocation_percentage calculations           │ │
│  │  - Send only capital/expense percentages               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Validation Utilities (cellValidation.ts)              │ │
│  │  - Implement cross-project validation                  │ │
│  │  - Query all assignments for resource+date             │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                         API Layer                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Pydantic Schemas (assignment.py)                      │ │
│  │  - Remove allocation_percentage field                  │ │
│  │  - Update validators for new constraints               │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  API Endpoints (assignments.py)                        │ │
│  │  - Remove allocation_percentage from requests          │ │
│  │  - Remove allocation_percentage from responses         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  AssignmentService (assignment.py)                     │ │
│  │  - Remove allocation_percentage logic                  │ │
│  │  - Implement cross-project validation                  │ │
│  │  - Remove validate_accounting_split calls              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Repository Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ResourceAssignmentRepository                          │ │
│  │  - Add get_cross_project_allocation method             │ │
│  │  - Update validation methods                           │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Database Layer                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ResourceAssignment Model                              │ │
│  │  - Remove allocation_percentage column                 │ │
│  │  - Update check constraints                            │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Alembic Migration                                     │ │
│  │  - Drop allocation_percentage column                   │ │
│  │  - Drop check_accounting_split constraint              │ │
│  │  - Add new check constraint (capital + expense <= 100) │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Create Assignment Flow
```
User Input (capital%, expense%)
    │
    ▼
Frontend Validation (capital + expense <= 100)
    │
    ▼
API Request (POST /assignments)
    │
    ▼
Schema Validation (capital + expense <= 100)
    │
    ▼
Service Layer
    │
    ├─> Validate resource exists
    ├─> Validate project exists
    ├─> Validate date within project range
    ├─> Cross-project validation:
    │   └─> Query all assignments for resource+date
    │   └─> Sum (capital + expense) across all projects
    │   └─> Check: total + new <= 100
    │
    ▼
Repository Layer (Create)
    │
    ▼
Database (Insert with constraints)
```

#### Update Assignment Flow
```
User Edit (new capital% or expense%)
    │
    ▼
Frontend Validation (capital + expense <= 100)
    │
    ▼
API Request (PATCH /assignments/{id})
    │
    ▼
Schema Validation (capital + expense <= 100)
    │
    ▼
Service Layer
    │
    ├─> Get existing assignment
    ├─> Cross-project validation:
    │   └─> Query all assignments for resource+date (excluding current)
    │   └─> Sum (capital + expense) across other projects
    │   └─> Check: total + updated <= 100
    │
    ▼
Repository Layer (Update)
    │
    ▼
Database (Update with constraints)
```

## Components and Interfaces

### Database Schema Changes

#### ResourceAssignment Model (SQLAlchemy)

**Before:**
```python
class ResourceAssignment(BaseModel):
    allocation_percentage = Column(Numeric(5, 2), nullable=False)
    capital_percentage = Column(Numeric(5, 2), nullable=False)
    expense_percentage = Column(Numeric(5, 2), nullable=False)
    
    __table_args__ = (
        CheckConstraint('capital_percentage + expense_percentage = 100', 
                       name='check_accounting_split'),
    )
```

**After:**
```python
class ResourceAssignment(BaseModel):
    # allocation_percentage removed
    capital_percentage = Column(Numeric(5, 2), nullable=False)
    expense_percentage = Column(Numeric(5, 2), nullable=False)
    
    __table_args__ = (
        CheckConstraint('capital_percentage + expense_percentage <= 100', 
                       name='check_allocation_sum'),
    )
```

#### Migration Script

```python
"""Remove allocation_percentage and update constraints

Revision ID: <generated>
Revises: <previous>
Create Date: <timestamp>
"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Drop old constraint
    op.drop_constraint('check_accounting_split', 'resource_assignments', 
                      type_='check')
    
    # Drop allocation_percentage column
    op.drop_column('resource_assignments', 'allocation_percentage')
    
    # Add new constraint
    op.create_check_constraint(
        'check_allocation_sum',
        'resource_assignments',
        'capital_percentage + expense_percentage <= 100'
    )

def downgrade():
    # Add allocation_percentage column back
    op.add_column('resource_assignments',
                 sa.Column('allocation_percentage', sa.Numeric(5, 2), 
                          nullable=True))
    
    # Populate allocation_percentage from capital + expense
    op.execute("""
        UPDATE resource_assignments 
        SET allocation_percentage = capital_percentage + expense_percentage
    """)
    
    # Make column non-nullable
    op.alter_column('resource_assignments', 'allocation_percentage',
                   nullable=False)
    
    # Drop new constraint
    op.drop_constraint('check_allocation_sum', 'resource_assignments',
                      type_='check')
    
    # Add old constraint back
    op.create_check_constraint(
        'check_accounting_split',
        'resource_assignments',
        'capital_percentage + expense_percentage = 100'
    )
```

### API Schema Changes

#### ResourceAssignmentBase (Pydantic)

**Before:**
```python
class ResourceAssignmentBase(BaseSchema):
    resource_id: UUID
    project_id: UUID
    assignment_date: date
    allocation_percentage: Decimal = Field(ge=0, le=100)
    capital_percentage: Decimal = Field(ge=0, le=100)
    expense_percentage: Decimal = Field(ge=0, le=100)
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_accounting_split(cls, v, info):
        if 'capital_percentage' in info.data:
            total = info.data['capital_percentage'] + v
            if total != 100:
                raise ValueError('Capital + expense must equal 100')
        return v
```

**After:**
```python
class ResourceAssignmentBase(BaseSchema):
    resource_id: UUID
    project_id: UUID
    assignment_date: date
    # allocation_percentage removed
    capital_percentage: Decimal = Field(ge=0, le=100)
    expense_percentage: Decimal = Field(ge=0, le=100)
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_allocation_sum(cls, v, info):
        if 'capital_percentage' in info.data:
            total = info.data['capital_percentage'] + v
            if total > 100:
                raise ValueError(
                    f'Capital + expense cannot exceed 100% '
                    f'(got {total}%)'
                )
        return v
```

### Service Layer Changes

#### AssignmentService

**New Method:**
```python
def _validate_cross_project_allocation(
    self,
    db: Session,
    resource_id: UUID,
    assignment_date: date,
    capital_percentage: Decimal,
    expense_percentage: Decimal,
    exclude_assignment_id: Optional[UUID] = None
) -> tuple[bool, Optional[str]]:
    """
    Validate that adding/updating an assignment doesn't exceed 100% 
    allocation across all projects for a resource on a date.
    
    Returns:
        (is_valid, error_message)
    """
    # Get all assignments for this resource on this date
    assignments = self.repository.get_by_date(db, resource_id, assignment_date)
    
    # Calculate current total (excluding the assignment being updated)
    current_total = Decimal('0')
    for assignment in assignments:
        if exclude_assignment_id and assignment.id == exclude_assignment_id:
            continue
        current_total += (assignment.capital_percentage + 
                         assignment.expense_percentage)
    
    # Calculate new total
    new_allocation = capital_percentage + expense_percentage
    new_total = current_total + new_allocation
    
    if new_total > Decimal('100'):
        return (False, 
                f'Assignment would exceed 100% allocation for resource on '
                f'{assignment_date}. Current total: {current_total}%, '
                f'Attempting to add: {new_allocation}%, '
                f'Would result in: {new_total}%')
    
    return (True, None)
```

**Updated create_assignment:**
```python
def create_assignment(
    self,
    db: Session,
    resource_id: UUID,
    project_id: UUID,
    assignment_date: date,
    capital_percentage: Decimal,
    expense_percentage: Decimal,
    user_id: Optional[UUID] = None
) -> ResourceAssignment:
    # ... existing validation ...
    
    # Validate single assignment constraint
    if capital_percentage + expense_percentage > Decimal('100'):
        raise ValueError(
            f'Capital + expense cannot exceed 100% '
            f'(got {capital_percentage + expense_percentage}%)'
        )
    
    # Validate cross-project allocation
    is_valid, error_msg = self._validate_cross_project_allocation(
        db, resource_id, assignment_date, 
        capital_percentage, expense_percentage
    )
    if not is_valid:
        raise ValueError(error_msg)
    
    # Create assignment (no allocation_percentage)
    assignment_data = {
        "resource_id": resource_id,
        "project_id": project_id,
        "assignment_date": assignment_date,
        "capital_percentage": capital_percentage,
        "expense_percentage": expense_percentage
    }
    
    return self.repository.create(db, obj_in=assignment_data)
```

### Repository Layer Changes

#### ResourceAssignmentRepository

**Remove Method:**
```python
# DELETE THIS METHOD
def validate_accounting_split(
    self,
    capital_percentage: Decimal,
    expense_percentage: Decimal
) -> bool:
    return capital_percentage + expense_percentage == Decimal('100.00')
```

**Remove Method:**
```python
# DELETE THIS METHOD
def validate_allocation_limit(
    self,
    db: Session,
    resource_id: UUID,
    assignment_date: date,
    new_allocation: Decimal,
    exclude_id: Optional[UUID] = None
) -> bool:
    # This method is no longer needed as validation moves to service layer
```

**Remove Method:**
```python
# DELETE THIS METHOD
def get_total_allocation_for_date(
    self,
    db: Session,
    resource_id: UUID,
    assignment_date: date
) -> Decimal:
    # This method is no longer needed
```

### Frontend Changes

#### ResourceAssignmentCalendar Component

**Remove allocation_percentage calculation:**

**Before:**
```typescript
const allocationPercentage = capitalPercentage + expensePercentage

if (existingAssignment) {
  updatePromises.push(
    assignmentsApi.update(existingAssignment.id, {
      allocation_percentage: allocationPercentage,
      capital_percentage: capitalPercentage,
      expense_percentage: expensePercentage,
    })
  )
} else {
  createPromises.push(
    assignmentsApi.create({
      resource_id: resourceId,
      project_id: projectId,
      assignment_date: dateStr,
      allocation_percentage: allocationPercentage,
      capital_percentage: capitalPercentage,
      expense_percentage: expensePercentage,
    })
  )
}
```

**After:**
```typescript
// No allocation_percentage calculation needed

if (existingAssignment) {
  updatePromises.push(
    assignmentsApi.update(existingAssignment.id, {
      capital_percentage: capitalPercentage,
      expense_percentage: expensePercentage,
    })
  )
} else {
  createPromises.push(
    assignmentsApi.create({
      resource_id: resourceId,
      project_id: projectId,
      assignment_date: dateStr,
      capital_percentage: capitalPercentage,
      expense_percentage: expensePercentage,
    })
  )
}
```

#### Validation Utilities (cellValidation.ts)

**Update validateCellEdit:**

**Before:**
```typescript
export async function validateCellEdit(
  resourceId: string,
  date: Date,
  costTreatment: 'capital' | 'expense',
  newValue: number,
  projectId: string
): Promise<ValidationResult> {
  // Current implementation only validates within project
  // ...
}
```

**After:**
```typescript
export async function validateCellEdit(
  resourceId: string,
  date: Date,
  costTreatment: 'capital' | 'expense',
  newValue: number,
  projectId: string
): Promise<ValidationResult> {
  // Validate range
  if (newValue < 0 || newValue > 100) {
    return {
      isValid: false,
      errorMessage: 'Percentage must be between 0 and 100'
    }
  }
  
  try {
    // Get all assignments for this resource on this date (all projects)
    const dateStr = date.toISOString().split('T')[0]
    const allAssignments = await assignmentsApi.getByResourceAndDate(
      resourceId,
      dateStr
    )
    
    // Calculate current total across all projects
    let currentTotal = 0
    for (const assignment of allAssignments) {
      // Skip current project (we're replacing its value)
      if (assignment.project_id === projectId) {
        continue
      }
      currentTotal += assignment.capital_percentage + 
                     assignment.expense_percentage
    }
    
    // Get current project's other value (capital or expense)
    const currentProjectAssignment = allAssignments.find(
      a => a.project_id === projectId
    )
    const otherValue = costTreatment === 'capital'
      ? (currentProjectAssignment?.expense_percentage || 0)
      : (currentProjectAssignment?.capital_percentage || 0)
    
    // Calculate new total
    const newProjectTotal = newValue + otherValue
    const newGrandTotal = currentTotal + newProjectTotal
    
    // Validate single assignment constraint
    if (newProjectTotal > 100) {
      return {
        isValid: false,
        errorMessage: `Capital + expense cannot exceed 100% for this project ` +
                     `(would be ${newProjectTotal}%)`
      }
    }
    
    // Validate cross-project constraint
    if (newGrandTotal > 100) {
      return {
        isValid: false,
        errorMessage: `Total allocation across all projects would exceed 100% ` +
                     `(current: ${currentTotal}%, this project: ${newProjectTotal}%, ` +
                     `total: ${newGrandTotal}%)`
      }
    }
    
    return { isValid: true }
  } catch (error) {
    console.error('Error validating cell edit:', error)
    return {
      isValid: false,
      errorMessage: 'Failed to validate allocation'
    }
  }
}
```

## Data Models

### ResourceAssignment (Database Model)

```python
class ResourceAssignment(BaseModel):
    """
    Resource assignment model for allocating resources to projects.
    
    Capital and expense percentages represent direct time allocations
    on a specific date. The sum of capital + expense must be <= 100%
    for a single assignment, and the sum across all projects for a
    resource on a date must be <= 100%.
    """
    
    __tablename__ = "resource_assignments"
    
    # Foreign keys
    resource_id = Column(GUID(), ForeignKey("resources.id"), 
                        nullable=False, index=True)
    project_id = Column(GUID(), ForeignKey("projects.id"), 
                       nullable=False, index=True)
    
    # Required fields
    assignment_date = Column(Date, nullable=False, index=True)
    capital_percentage = Column(Numeric(5, 2), nullable=False)
    expense_percentage = Column(Numeric(5, 2), nullable=False)
    
    # Relationships
    resource = relationship("Resource", back_populates="resource_assignments")
    project = relationship("Project", back_populates="resource_assignments")
    actuals = relationship("Actual", back_populates="resource_assignment", 
                          cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('allocation_percentage >= 0 AND allocation_percentage <= 100', 
                       name='check_allocation_percentage'),
        CheckConstraint('capital_percentage >= 0 AND capital_percentage <= 100', 
                       name='check_capital_percentage'),
        CheckConstraint('expense_percentage >= 0 AND expense_percentage <= 100', 
                       name='check_expense_percentage'),
        CheckConstraint('capital_percentage + expense_percentage <= 100', 
                       name='check_allocation_sum'),
    )
```

### ResourceAssignment (API Schema)

```python
class ResourceAssignmentBase(BaseSchema):
    """Base resource assignment schema with common fields."""
    
    resource_id: UUID = Field(description="Resource ID")
    project_id: UUID = Field(description="Project ID")
    assignment_date: date = Field(description="Assignment date")
    capital_percentage: Decimal = Field(
        ge=0, le=100, 
        description="Capital percentage (0-100)"
    )
    expense_percentage: Decimal = Field(
        ge=0, le=100, 
        description="Expense percentage (0-100)"
    )
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_allocation_sum(cls, v, info):
        """Validate that capital_percentage + expense_percentage <= 100."""
        if 'capital_percentage' in info.data:
            total = info.data['capital_percentage'] + v
            if total > 100:
                raise ValueError(
                    f'Capital percentage + expense percentage cannot exceed 100 '
                    f'(got {total})'
                )
        return v


class ResourceAssignmentCreate(ResourceAssignmentBase):
    """Schema for creating a new resource assignment."""
    pass


class ResourceAssignmentUpdate(BaseSchema):
    """Schema for updating an existing resource assignment."""
    
    resource_id: Optional[UUID] = Field(default=None, description="Resource ID")
    project_id: Optional[UUID] = Field(default=None, description="Project ID")
    assignment_date: Optional[date] = Field(default=None, 
                                            description="Assignment date")
    capital_percentage: Optional[Decimal] = Field(
        default=None, ge=0, le=100, 
        description="Capital percentage (0-100)"
    )
    expense_percentage: Optional[Decimal] = Field(
        default=None, ge=0, le=100, 
        description="Expense percentage (0-100)"
    )
    
    @field_validator('expense_percentage')
    @classmethod
    def validate_allocation_sum(cls, v, info):
        """Validate that capital_percentage + expense_percentage <= 100."""
        if (v is not None and 'capital_percentage' in info.data and 
            info.data['capital_percentage'] is not None):
            total = info.data['capital_percentage'] + v
            if total > 100:
                raise ValueError(
                    f'Capital percentage + expense percentage cannot exceed 100 '
                    f'(got {total})'
                )
        return v


class ResourceAssignmentResponse(ResourceAssignmentBase, TimestampMixin):
    """Schema for resource assignment response."""
    
    resource_name: Optional[str] = Field(default=None, 
                                        description="Resource name")
    project_name: Optional[str] = Field(default=None, 
                                       description="Project name")
    program_name: Optional[str] = Field(default=None, 
                                       description="Program name")
    phase_name: Optional[str] = Field(default=None, 
                                     description="Project phase name")
```

### TypeScript Interfaces

```typescript
export interface ResourceAssignment {
  id: string
  resource_id: string
  project_id: string
  assignment_date: string  // ISO date string
  capital_percentage: number
  expense_percentage: number
  resource_name?: string
  project_name?: string
  program_name?: string
  phase_name?: string
  created_at: string
  updated_at: string
}

export interface ResourceAssignmentCreate {
  resource_id: string
  project_id: string
  assignment_date: string
  capital_percentage: number
  expense_percentage: number
}

export interface ResourceAssignmentUpdate {
  capital_percentage?: number
  expense_percentage?: number
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Percentage Range Constraints

*For any* ResourceAssignment, both capital_percentage and expense_percentage must be between 0 and 100 (inclusive).

**Validates: Requirements 2.1, 2.2**

### Property 2: Single Assignment Sum Constraint

*For any* ResourceAssignment, the sum of capital_percentage + expense_percentage must be less than or equal to 100.

**Validates: Requirements 2.3**

### Property 3: Cross-Project Allocation Constraint

*For any* resource and date, when creating or updating a ResourceAssignment, the sum of (capital_percentage + expense_percentage) across all projects for that resource on that date must not exceed 100.

**Validates: Requirements 3.1, 3.2**

### Property 4: Update Exclusion

*For any* ResourceAssignment being updated, the cross-project validation must exclude the current assignment's values when calculating the total allocation.

**Validates: Requirements 3.4**

## Error Handling

### Validation Errors

#### Single Assignment Constraint Violation
```python
# Error when capital + expense > 100 for a single assignment
raise ValueError(
    f'Capital percentage + expense percentage cannot exceed 100% '
    f'(got {capital_percentage + expense_percentage}%)'
)
```

#### Cross-Project Constraint Violation
```python
# Error when total allocation across projects > 100
raise ValueError(
    f'Assignment would exceed 100% allocation for resource on {assignment_date}. '
    f'Current total across other projects: {current_total}%, '
    f'This assignment: {new_allocation}%, '
    f'Would result in: {new_total}%'
)
```

#### Invalid Percentage Range
```python
# Error when percentage is outside 0-100 range
raise ValueError(
    f'Percentage must be between 0 and 100 (got {value}%)'
)
```

### Frontend Error Display

The frontend will display validation errors in two places:

1. **Inline Cell Errors**: When editing a cell, validation errors appear as tooltips on the input field
2. **Save Errors**: When saving fails, an alert banner appears at the top of the calendar with the error message

### Error Recovery

- **Frontend**: Users can correct invalid values and retry saving
- **Backend**: Failed operations are rolled back, leaving the database in a consistent state
- **Migration**: The migration includes a downgrade path to revert changes if needed

## Testing Strategy

### Dual Testing Approach

This refactoring requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs

### Unit Testing

Unit tests should focus on:

1. **Migration Testing**
   - Test migration executes successfully on empty database
   - Test migration executes successfully with existing data
   - Test migration preserves capital and expense values
   - Test downgrade restores allocation_percentage correctly

2. **Schema Validation**
   - Test that allocation_percentage is rejected in API requests
   - Test that capital + expense > 100 is rejected
   - Test that negative percentages are rejected
   - Test that percentages > 100 are rejected

3. **Service Layer**
   - Test cross-project validation with specific scenarios
   - Test that validation excludes current assignment during updates
   - Test error messages contain expected information

4. **Frontend**
   - Test that API calls don't include allocation_percentage
   - Test that validation errors are displayed correctly
   - Test that save operations send correct data structure

### Property-Based Testing

Property tests should be configured to run a minimum of 100 iterations per test. Each test must reference its design document property using the tag format:

**Feature: resource-assignment-refactor, Property {number}: {property_text}**

#### Property Test 1: Percentage Range Constraints

**Feature: resource-assignment-refactor, Property 1: Percentage Range Constraints**

```python
from hypothesis import given, strategies as st
from decimal import Decimal

@given(
    capital=st.decimals(min_value=0, max_value=100, places=2),
    expense=st.decimals(min_value=0, max_value=100, places=2)
)
def test_percentage_range_constraints(capital, expense):
    """
    Property: For any ResourceAssignment, both capital_percentage and 
    expense_percentage must be between 0 and 100.
    """
    # Attempt to create assignment
    assignment_data = {
        "resource_id": generate_uuid(),
        "project_id": generate_uuid(),
        "assignment_date": date.today(),
        "capital_percentage": capital,
        "expense_percentage": expense
    }
    
    # Should not raise error for range validation
    # (may fail sum constraint, but that's tested separately)
    schema = ResourceAssignmentCreate(**assignment_data)
    assert 0 <= schema.capital_percentage <= 100
    assert 0 <= schema.expense_percentage <= 100
```

#### Property Test 2: Single Assignment Sum Constraint

**Feature: resource-assignment-refactor, Property 2: Single Assignment Sum Constraint**

```python
@given(
    capital=st.decimals(min_value=0, max_value=100, places=2),
    expense=st.decimals(min_value=0, max_value=100, places=2)
)
def test_single_assignment_sum_constraint(capital, expense):
    """
    Property: For any ResourceAssignment, capital + expense must be <= 100.
    """
    assignment_data = {
        "resource_id": generate_uuid(),
        "project_id": generate_uuid(),
        "assignment_date": date.today(),
        "capital_percentage": capital,
        "expense_percentage": expense
    }
    
    if capital + expense <= 100:
        # Should succeed
        schema = ResourceAssignmentCreate(**assignment_data)
        assert schema.capital_percentage + schema.expense_percentage <= 100
    else:
        # Should fail validation
        with pytest.raises(ValueError, match="cannot exceed 100"):
            ResourceAssignmentCreate(**assignment_data)
```

#### Property Test 3: Cross-Project Allocation Constraint

**Feature: resource-assignment-refactor, Property 3: Cross-Project Allocation Constraint**

```python
@given(
    num_existing=st.integers(min_value=0, max_value=5),
    new_capital=st.decimals(min_value=0, max_value=100, places=2),
    new_expense=st.decimals(min_value=0, max_value=100, places=2)
)
def test_cross_project_allocation_constraint(
    db_session, num_existing, new_capital, new_expense
):
    """
    Property: For any resource and date, the sum of (capital + expense) 
    across all projects must not exceed 100.
    """
    resource_id = generate_uuid()
    assignment_date = date.today()
    
    # Create existing assignments with random allocations
    existing_total = Decimal('0')
    for i in range(num_existing):
        capital = Decimal(random.randint(0, 30))
        expense = Decimal(random.randint(0, 30))
        if capital + expense <= 100:
            create_assignment(
                db_session,
                resource_id=resource_id,
                project_id=generate_uuid(),
                assignment_date=assignment_date,
                capital_percentage=capital,
                expense_percentage=expense
            )
            existing_total += (capital + expense)
    
    # Try to create new assignment
    new_total = new_capital + new_expense
    
    if new_total <= 100 and existing_total + new_total <= 100:
        # Should succeed
        assignment = assignment_service.create_assignment(
            db_session,
            resource_id=resource_id,
            project_id=generate_uuid(),
            assignment_date=assignment_date,
            capital_percentage=new_capital,
            expense_percentage=new_expense
        )
        assert assignment is not None
    elif new_total > 100:
        # Should fail single assignment constraint
        with pytest.raises(ValueError, match="cannot exceed 100"):
            assignment_service.create_assignment(
                db_session,
                resource_id=resource_id,
                project_id=generate_uuid(),
                assignment_date=assignment_date,
                capital_percentage=new_capital,
                expense_percentage=new_expense
            )
    else:
        # Should fail cross-project constraint
        with pytest.raises(ValueError, match="would exceed 100% allocation"):
            assignment_service.create_assignment(
                db_session,
                resource_id=resource_id,
                project_id=generate_uuid(),
                assignment_date=assignment_date,
                capital_percentage=new_capital,
                expense_percentage=new_expense
            )
```

#### Property Test 4: Update Exclusion

**Feature: resource-assignment-refactor, Property 4: Update Exclusion**

```python
@given(
    initial_capital=st.decimals(min_value=0, max_value=50, places=2),
    initial_expense=st.decimals(min_value=0, max_value=50, places=2),
    new_capital=st.decimals(min_value=0, max_value=100, places=2),
    new_expense=st.decimals(min_value=0, max_value=100, places=2)
)
def test_update_exclusion_property(
    db_session, initial_capital, initial_expense, new_capital, new_expense
):
    """
    Property: When updating an assignment, the validation must exclude 
    the current assignment's values from the total.
    """
    resource_id = generate_uuid()
    assignment_date = date.today()
    
    # Create initial assignment
    assignment = create_assignment(
        db_session,
        resource_id=resource_id,
        project_id=generate_uuid(),
        assignment_date=assignment_date,
        capital_percentage=initial_capital,
        expense_percentage=initial_expense
    )
    
    # Try to update
    new_total = new_capital + new_expense
    
    if new_total <= 100:
        # Should succeed (no other assignments, so only checking single constraint)
        updated = assignment_service.update_assignment(
            db_session,
            assignment_id=assignment.id,
            capital_percentage=new_capital,
            expense_percentage=new_expense
        )
        assert updated.capital_percentage == new_capital
        assert updated.expense_percentage == new_expense
    else:
        # Should fail single assignment constraint
        with pytest.raises(ValueError, match="cannot exceed 100"):
            assignment_service.update_assignment(
                db_session,
                assignment_id=assignment.id,
                capital_percentage=new_capital,
                expense_percentage=new_expense
            )
```

### Frontend Property Tests

```typescript
// Property Test: Calendar sends correct data structure
describe('Property: Calendar API calls', () => {
  it('should not include allocation_percentage in create requests', 
     async () => {
    // Generate random capital and expense values
    const capital = Math.floor(Math.random() * 50)
    const expense = Math.floor(Math.random() * (100 - capital))
    
    // Mock API
    const createSpy = jest.spyOn(assignmentsApi, 'create')
    
    // Trigger save
    await saveAssignment(resourceId, projectId, date, capital, expense)
    
    // Verify API call structure
    expect(createSpy).toHaveBeenCalledWith({
      resource_id: expect.any(String),
      project_id: expect.any(String),
      assignment_date: expect.any(String),
      capital_percentage: capital,
      expense_percentage: expense
      // allocation_percentage should NOT be present
    })
    
    const callArgs = createSpy.mock.calls[0][0]
    expect(callArgs).not.toHaveProperty('allocation_percentage')
  })
})
```

### Test Coverage Requirements

- **Backend**: Minimum 90% code coverage for modified files
- **Frontend**: Minimum 85% code coverage for modified components
- **Property Tests**: Minimum 100 iterations per property test
- **Integration Tests**: End-to-end tests for create, update, and validation flows

### Testing Tools

- **Backend Property Testing**: Hypothesis (Python)
- **Backend Unit Testing**: pytest
- **Frontend Testing**: Jest, React Testing Library
- **Integration Testing**: pytest with test database
- **Migration Testing**: Alembic with test database

## Implementation Notes

### Migration Strategy

1. **Pre-Migration Validation**
   - Verify all existing assignments have capital + expense = 100
   - Identify any data inconsistencies
   - Back up database before migration

2. **Migration Execution**
   - Run migration in transaction
   - Verify constraint changes applied correctly
   - Test rollback capability

3. **Post-Migration Validation**
   - Verify allocation_percentage column removed
   - Verify new constraint in place
   - Verify existing data intact

### Deployment Strategy

1. **Backend Deployment**
   - Deploy new backend code with migration
   - Run migration on staging environment
   - Verify API endpoints work correctly
   - Deploy to production

2. **Frontend Deployment**
   - Deploy new frontend code
   - Verify calendar component works with new API
   - Monitor for errors

3. **Rollback Plan**
   - If issues occur, run migration downgrade
   - Revert backend deployment
   - Revert frontend deployment

### Performance Considerations

- **Cross-Project Validation**: Queries all assignments for a resource on a date. For resources with many projects, this could be slow. Consider adding database index on (resource_id, assignment_date).
- **Frontend Validation**: Makes API call for each cell edit. Consider debouncing or batching validation requests.

### Backward Compatibility

This is a breaking change:
- API clients must update to not send allocation_percentage
- Database schema changes are not backward compatible
- Frontend must be updated simultaneously with backend

### Security Considerations

- Validation logic prevents over-allocation attacks
- Scope-based access control remains unchanged
- No new security vulnerabilities introduced
