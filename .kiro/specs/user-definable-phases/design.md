# Design Document: User-Definable Project Phases

## Overview

This design transforms project phases from a fixed, predefined system (Planning/Execution enum) into a flexible, user-definable timeline management system. The key architectural changes include:

1. **Model Transformation**: Replace `phase_type` enum with user-defined `name`, `start_date`, and `end_date` fields
2. **Implicit Relationships**: Remove explicit `project_phase_id` foreign key from resource assignments, using date-based implicit relationships instead
3. **Timeline Validation**: Implement comprehensive validation to ensure phases form continuous, non-overlapping timelines
4. **Auto-Creation**: Automatically create a "Default Phase" when projects are created
5. **Migration Strategy**: Safe migration path from old to new model with rollback capability

This approach eliminates data synchronization issues between assignments and phases while providing users with complete flexibility in organizing their project timelines.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend Layer                          │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Phase Editor   │  │ Timeline Visual  │  │ Project     │ │
│  │ Component      │  │ Component        │  │ Detail Page │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                       API Layer                              │
│  ┌────────────────┐  ┌──────────────────┐                  │
│  │ Phase CRUD     │  │ Phase Validation │                  │
│  │ Endpoints      │  │ Endpoints        │                  │
│  └────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Service Layer                            │
│  ┌────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │ Phase Service  │  │ Phase Validator  │  │ Project     │ │
│  │                │  │ Service          │  │ Service     │ │
│  └────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Repository Layer                           │
│  ┌────────────────┐  ┌──────────────────┐                  │
│  │ Phase Repo     │  │ Assignment Repo  │                  │
│  └────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     Database Layer                           │
│  ┌────────────────┐  ┌──────────────────┐                  │
│  │ project_phases │  │ resource_        │                  │
│  │ (modified)     │  │ assignments      │                  │
│  │                │  │ (modified)       │                  │
│  └────────────────┘  └──────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **Date-Based Implicit Relationships**: Instead of storing `project_phase_id` in resource_assignments, we determine phase membership by checking if `assignment_date` falls within a phase's date range. This eliminates synchronization issues when phase dates change.

2. **Timeline Continuity as Invariant**: The system enforces that phases must always form a continuous, non-overlapping timeline. This is validated before any create/update/delete operation.

3. **Default Phase Pattern**: Every project starts with a "Default Phase" covering the entire project duration, ensuring immediate timeline coverage.

4. **Validation-First Approach**: All phase operations go through validation before database changes, preventing invalid states.


## Components and Interfaces

### Backend Components

#### 1. Updated ProjectPhase Model

**File**: `backend/app/models/project.py`

```python
class ProjectPhase(BaseModel):
    """Project phase model with user-definable date ranges."""
    
    __tablename__ = "project_phases"
    
    # Foreign keys
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False, index=True)
    
    # Required fields
    name = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False, index=True)
    end_date = Column(Date, nullable=False, index=True)
    
    # Optional fields
    description = Column(String(500), nullable=True)
    
    # Budget fields
    capital_budget = Column(Numeric(15, 2), nullable=False, default=0)
    expense_budget = Column(Numeric(15, 2), nullable=False, default=0)
    total_budget = Column(Numeric(15, 2), nullable=False, default=0)
    
    # Relationships
    project = relationship("Project", back_populates="phases")
    # Note: resource_assignments relationship removed (now implicit via dates)
    
    # Constraints
    __table_args__ = (
        CheckConstraint('start_date <= end_date', name='check_phase_dates'),
        CheckConstraint('capital_budget >= 0', name='check_capital_budget_positive'),
        CheckConstraint('expense_budget >= 0', name='check_expense_budget_positive'),
        CheckConstraint('total_budget >= 0', name='check_total_budget_positive'),
        CheckConstraint('capital_budget + expense_budget = total_budget', name='check_budget_sum'),
    )
```

**Changes from Current Model**:
- Removed: `phase_type` (enum field)
- Added: `name` (string, max 100 chars)
- Added: `start_date` (date, indexed)
- Added: `end_date` (date, indexed)
- Removed: `resource_assignments` relationship (now implicit)

#### 2. Updated ResourceAssignment Model

**File**: `backend/app/models/resource_assignment.py`

```python
class ResourceAssignment(BaseModel):
    """Resource assignment model with implicit phase relationship."""
    
    __tablename__ = "resource_assignments"
    
    # Foreign keys
    resource_id = Column(GUID(), ForeignKey("resources.id"), nullable=False, index=True)
    project_id = Column(GUID(), ForeignKey("projects.id"), nullable=False, index=True)
    # REMOVED: project_phase_id
    
    # Required fields
    assignment_date = Column(Date, nullable=False, index=True)
    allocation_percentage = Column(Numeric(5, 2), nullable=False)
    capital_percentage = Column(Numeric(5, 2), nullable=False)
    expense_percentage = Column(Numeric(5, 2), nullable=False)
    
    # Relationships
    resource = relationship("Resource", back_populates="resource_assignments")
    project = relationship("Project", back_populates="resource_assignments")
    # REMOVED: project_phase relationship
    actuals = relationship("Actual", back_populates="resource_assignment", cascade="all, delete-orphan")
```

**Changes from Current Model**:
- Removed: `project_phase_id` foreign key column
- Removed: `project_phase` relationship
- Phase association now determined by date range queries

#### 3. Phase Validation Service

**File**: `backend/app/services/phase_validator.py`

```python
from datetime import date
from typing import List, Optional, Dict
from uuid import UUID
from pydantic import BaseModel

class PhaseValidationError(BaseModel):
    """Validation error details."""
    field: str
    message: str
    phase_id: Optional[UUID] = None

class PhaseValidationResult(BaseModel):
    """Result of phase validation."""
    is_valid: bool
    errors: List[PhaseValidationError]

class PhaseValidatorService:
    """Service for validating phase timeline continuity."""
    
    def validate_phase_timeline(
        self,
        project_start: date,
        project_end: date,
        phases: List[Dict],  # List of phase dicts with id, name, start_date, end_date
        exclude_phase_id: Optional[UUID] = None
    ) -> PhaseValidationResult:
        """
        Validate that phases form a continuous, non-overlapping timeline.
        
        Args:
            project_start: Project start date
            project_end: Project end date
            phases: List of phase dictionaries
            exclude_phase_id: Phase ID to exclude from validation (for updates)
            
        Returns:
            PhaseValidationResult with validation status and errors
        """
        pass
    
    def validate_single_phase(
        self,
        phase_name: str,
        phase_start: date,
        phase_end: date,
        project_start: date,
        project_end: date
    ) -> PhaseValidationResult:
        """Validate a single phase's basic constraints."""
        pass
    
    def find_timeline_gaps(
        self,
        project_start: date,
        project_end: date,
        phases: List[Dict]
    ) -> List[tuple[date, date]]:
        """Find gaps in phase coverage."""
        pass
    
    def find_timeline_overlaps(
        self,
        phases: List[Dict]
    ) -> List[tuple[UUID, UUID]]:
        """Find overlapping phases."""
        pass
```

#### 4. Phase Service

**File**: `backend/app/services/phase_service.py`

```python
class PhaseService:
    """Service for managing project phases."""
    
    def __init__(
        self,
        phase_repo: ProjectPhaseRepository,
        project_repo: ProjectRepository,
        validator: PhaseValidatorService
    ):
        self.phase_repo = phase_repo
        self.project_repo = project_repo
        self.validator = validator
    
    async def create_phase(
        self,
        db: AsyncSession,
        project_id: UUID,
        phase_data: PhaseCreate
    ) -> ProjectPhase:
        """Create a new phase with validation."""
        pass
    
    async def update_phase(
        self,
        db: AsyncSession,
        phase_id: UUID,
        phase_data: PhaseUpdate
    ) -> ProjectPhase:
        """Update a phase with validation."""
        pass
    
    async def delete_phase(
        self,
        db: AsyncSession,
        phase_id: UUID
    ) -> None:
        """Delete a phase with validation."""
        pass
    
    async def create_default_phase(
        self,
        db: AsyncSession,
        project_id: UUID,
        project_start: date,
        project_end: date
    ) -> ProjectPhase:
        """Create default phase for a new project."""
        pass
    
    async def get_phase_for_date(
        self,
        db: AsyncSession,
        project_id: UUID,
        target_date: date
    ) -> Optional[ProjectPhase]:
        """Get the phase that contains a specific date."""
        pass
    
    async def get_assignments_for_phase(
        self,
        db: AsyncSession,
        phase_id: UUID
    ) -> List[ResourceAssignment]:
        """Get all assignments that fall within a phase's date range."""
        pass
```


#### 5. Phase API Endpoints

**File**: `backend/app/api/v1/endpoints/phases.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from uuid import UUID

router = APIRouter()

@router.post("/projects/{project_id}/phases", response_model=PhaseResponse)
async def create_phase(
    project_id: UUID,
    phase_data: PhaseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new phase for a project."""
    pass

@router.get("/projects/{project_id}/phases", response_model=List[PhaseResponse])
async def list_phases(
    project_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all phases for a project."""
    pass

@router.get("/phases/{phase_id}", response_model=PhaseResponse)
async def get_phase(
    phase_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific phase."""
    pass

@router.put("/phases/{phase_id}", response_model=PhaseResponse)
async def update_phase(
    phase_id: UUID,
    phase_data: PhaseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update a phase."""
    pass

@router.delete("/phases/{phase_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_phase(
    phase_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a phase."""
    pass

@router.post("/projects/{project_id}/phases/validate", response_model=PhaseValidationResult)
async def validate_phases(
    project_id: UUID,
    phases: List[PhaseValidationRequest],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Validate a set of phases without saving."""
    pass

@router.get("/phases/{phase_id}/assignments", response_model=List[AssignmentResponse])
async def get_phase_assignments(
    phase_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all resource assignments for a phase (date-based)."""
    pass
```

### Frontend Components

#### 1. Phase Editor Component

**File**: `frontend/src/components/phases/PhaseEditor.tsx`

```typescript
interface Phase {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  description?: string;
  capital_budget: number;
  expense_budget: number;
  total_budget: number;
}

interface PhaseEditorProps {
  projectId: string;
  projectStartDate: string;
  projectEndDate: string;
  onSave?: () => void;
}

export const PhaseEditor: React.FC<PhaseEditorProps> = ({
  projectId,
  projectStartDate,
  projectEndDate,
  onSave
}) => {
  // State management for phases
  const [phases, setPhases] = useState<Phase[]>([]);
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  
  // CRUD operations
  const handleAddPhase = () => { /* ... */ };
  const handleUpdatePhase = (phaseId: string, updates: Partial<Phase>) => { /* ... */ };
  const handleDeletePhase = (phaseId: string) => { /* ... */ };
  
  // Validation
  const validatePhases = async () => { /* ... */ };
  
  // Save changes
  const handleSave = async () => { /* ... */ };
  
  return (
    <div className="phase-editor">
      <PhaseTimeline 
        phases={phases}
        projectStart={projectStartDate}
        projectEnd={projectEndDate}
        validationErrors={validationErrors}
      />
      <PhaseList
        phases={phases}
        onAdd={handleAddPhase}
        onUpdate={handleUpdatePhase}
        onDelete={handleDeletePhase}
      />
      <ValidationErrorDisplay errors={validationErrors} />
      <div className="actions">
        <button onClick={handleSave} disabled={validationErrors.length > 0}>
          Save Changes
        </button>
      </div>
    </div>
  );
};
```

#### 2. Phase Timeline Visualization Component

**File**: `frontend/src/components/phases/PhaseTimeline.tsx`

```typescript
interface PhaseTimelineProps {
  phases: Phase[];
  projectStart: string;
  projectEnd: string;
  validationErrors: ValidationError[];
  onPhaseResize?: (phaseId: string, newStart: string, newEnd: string) => void;
}

export const PhaseTimeline: React.FC<PhaseTimelineProps> = ({
  phases,
  projectStart,
  projectEnd,
  validationErrors,
  onPhaseResize
}) => {
  // Calculate timeline dimensions
  const totalDays = calculateDaysBetween(projectStart, projectEnd);
  
  // Render phases as colored bars
  const renderPhase = (phase: Phase) => {
    const startOffset = calculateDaysBetween(projectStart, phase.start_date);
    const duration = calculateDaysBetween(phase.start_date, phase.end_date);
    const widthPercent = (duration / totalDays) * 100;
    const leftPercent = (startOffset / totalDays) * 100;
    
    return (
      <div
        key={phase.id}
        className="timeline-phase"
        style={{
          left: `${leftPercent}%`,
          width: `${widthPercent}%`,
          backgroundColor: getPhaseColor(phase.id)
        }}
      >
        <span className="phase-name">{phase.name}</span>
        <span className="phase-dates">
          {formatDate(phase.start_date)} - {formatDate(phase.end_date)}
        </span>
      </div>
    );
  };
  
  // Highlight gaps and overlaps
  const renderValidationIssues = () => { /* ... */ };
  
  return (
    <div className="phase-timeline">
      <div className="timeline-header">
        <span>{formatDate(projectStart)}</span>
        <span>{formatDate(projectEnd)}</span>
      </div>
      <div className="timeline-track">
        {phases.map(renderPhase)}
        {renderValidationIssues()}
      </div>
    </div>
  );
};
```

#### 3. Phase List Component

**File**: `frontend/src/components/phases/PhaseList.tsx`

```typescript
interface PhaseListProps {
  phases: Phase[];
  onAdd: () => void;
  onUpdate: (phaseId: string, updates: Partial<Phase>) => void;
  onDelete: (phaseId: string) => void;
}

export const PhaseList: React.FC<PhaseListProps> = ({
  phases,
  onAdd,
  onUpdate,
  onDelete
}) => {
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  
  return (
    <div className="phase-list">
      <div className="phase-list-header">
        <h3>Project Phases</h3>
        <button onClick={onAdd}>Add Phase</button>
      </div>
      <table className="phase-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Start Date</th>
            <th>End Date</th>
            <th>Capital Budget</th>
            <th>Expense Budget</th>
            <th>Total Budget</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {phases.map(phase => (
            <PhaseRow
              key={phase.id}
              phase={phase}
              isEditing={editingPhaseId === phase.id}
              onEdit={() => setEditingPhaseId(phase.id)}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
```


## Data Models

### Database Schema Changes

#### ProjectPhase Table (Modified)

```sql
CREATE TABLE project_phases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id),
    
    -- NEW FIELDS
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    description VARCHAR(500),
    
    -- EXISTING FIELDS (unchanged)
    capital_budget NUMERIC(15, 2) NOT NULL DEFAULT 0,
    expense_budget NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_budget NUMERIC(15, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- REMOVED FIELD
    -- phase_type VARCHAR (enum) - DELETED
    
    -- Constraints
    CONSTRAINT check_phase_dates CHECK (start_date <= end_date),
    CONSTRAINT check_capital_budget_positive CHECK (capital_budget >= 0),
    CONSTRAINT check_expense_budget_positive CHECK (expense_budget >= 0),
    CONSTRAINT check_total_budget_positive CHECK (total_budget >= 0),
    CONSTRAINT check_budget_sum CHECK (capital_budget + expense_budget = total_budget)
);

CREATE INDEX ix_project_phases_project_id ON project_phases(project_id);
CREATE INDEX ix_project_phases_start_date ON project_phases(start_date);
CREATE INDEX ix_project_phases_end_date ON project_phases(end_date);
```

#### ResourceAssignment Table (Modified)

```sql
CREATE TABLE resource_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_id UUID NOT NULL REFERENCES resources(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    
    -- REMOVED FIELD
    -- project_phase_id UUID REFERENCES project_phases(id) - DELETED
    
    -- EXISTING FIELDS (unchanged)
    assignment_date DATE NOT NULL,
    allocation_percentage NUMERIC(5, 2) NOT NULL,
    capital_percentage NUMERIC(5, 2) NOT NULL,
    expense_percentage NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    
    -- Constraints
    CONSTRAINT check_allocation_percentage CHECK (allocation_percentage >= 0 AND allocation_percentage <= 100),
    CONSTRAINT check_capital_percentage CHECK (capital_percentage >= 0 AND capital_percentage <= 100),
    CONSTRAINT check_expense_percentage CHECK (expense_percentage >= 0 AND expense_percentage <= 100),
    CONSTRAINT check_accounting_split CHECK (capital_percentage + expense_percentage = 100)
);

CREATE INDEX ix_resource_assignments_resource_id ON resource_assignments(resource_id);
CREATE INDEX ix_resource_assignments_project_id ON resource_assignments(project_id);
CREATE INDEX ix_resource_assignments_assignment_date ON resource_assignments(assignment_date);
-- REMOVED INDEX: ix_resource_assignments_project_phase_id
```

### Pydantic Schemas

#### Phase Schemas

**File**: `backend/app/schemas/phase.py`

```python
from datetime import date
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import Field, field_validator

from .base import BaseSchema, TimestampMixin

class PhaseBase(BaseSchema):
    """Base phase schema with common fields."""
    
    name: str = Field(min_length=1, max_length=100, description="Phase name")
    start_date: date = Field(description="Phase start date")
    end_date: date = Field(description="Phase end date")
    description: Optional[str] = Field(default=None, max_length=500, description="Phase description")
    capital_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Capital budget")
    expense_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Expense budget")
    total_budget: Decimal = Field(ge=0, default=Decimal("0"), description="Total budget")
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        """Validate that end_date is after or equal to start_date."""
        if 'start_date' in info.data and v < info.data['start_date']:
            raise ValueError('End date must be on or after start date')
        return v
    
    @field_validator('total_budget')
    @classmethod
    def validate_total_budget(cls, v, info):
        """Validate that total_budget equals capital_budget + expense_budget."""
        if 'capital_budget' in info.data and 'expense_budget' in info.data:
            expected_total = info.data['capital_budget'] + info.data['expense_budget']
            if v != expected_total:
                raise ValueError(f'Total budget must equal capital + expense ({expected_total})')
        return v

class PhaseCreate(PhaseBase):
    """Schema for creating a new phase."""
    project_id: UUID = Field(description="Project ID this phase belongs to")

class PhaseUpdate(BaseSchema):
    """Schema for updating an existing phase."""
    
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    start_date: Optional[date] = Field(default=None)
    end_date: Optional[date] = Field(default=None)
    description: Optional[str] = Field(default=None, max_length=500)
    capital_budget: Optional[Decimal] = Field(default=None, ge=0)
    expense_budget: Optional[Decimal] = Field(default=None, ge=0)
    total_budget: Optional[Decimal] = Field(default=None, ge=0)

class PhaseResponse(PhaseBase, TimestampMixin):
    """Schema for phase response."""
    
    id: UUID
    project_id: UUID
    assignment_count: Optional[int] = Field(default=0, description="Number of assignments in this phase")

class PhaseValidationRequest(BaseSchema):
    """Schema for validating phases."""
    
    id: Optional[UUID] = Field(default=None, description="Phase ID (null for new phases)")
    name: str
    start_date: date
    end_date: date

class PhaseValidationError(BaseSchema):
    """Validation error details."""
    
    field: str
    message: str
    phase_id: Optional[UUID] = None

class PhaseValidationResult(BaseSchema):
    """Result of phase validation."""
    
    is_valid: bool
    errors: list[PhaseValidationError]
```

### Query Patterns for Date-Based Phase Relationships

#### Get Phase for a Specific Date

```python
async def get_phase_for_date(
    db: AsyncSession,
    project_id: UUID,
    target_date: date
) -> Optional[ProjectPhase]:
    """Get the phase that contains a specific date."""
    result = await db.execute(
        select(ProjectPhase)
        .where(
            ProjectPhase.project_id == project_id,
            ProjectPhase.start_date <= target_date,
            ProjectPhase.end_date >= target_date
        )
    )
    return result.scalar_one_or_none()
```

#### Get Assignments for a Phase

```python
async def get_assignments_for_phase(
    db: AsyncSession,
    phase_id: UUID
) -> List[ResourceAssignment]:
    """Get all assignments that fall within a phase's date range."""
    # First get the phase
    phase = await db.get(ProjectPhase, phase_id)
    if not phase:
        return []
    
    # Query assignments by date range
    result = await db.execute(
        select(ResourceAssignment)
        .where(
            ResourceAssignment.project_id == phase.project_id,
            ResourceAssignment.assignment_date >= phase.start_date,
            ResourceAssignment.assignment_date <= phase.end_date
        )
        .order_by(ResourceAssignment.assignment_date)
    )
    return result.scalars().all()
```

#### Get Phase Budget Summary

```python
async def get_phase_budget_summary(
    db: AsyncSession,
    phase_id: UUID
) -> Dict[str, Decimal]:
    """Calculate actual and forecast costs for a phase."""
    phase = await db.get(ProjectPhase, phase_id)
    if not phase:
        raise ValueError("Phase not found")
    
    # Get assignments in phase date range
    assignments = await get_assignments_for_phase(db, phase_id)
    
    # Calculate costs (simplified - actual implementation would join with rates, etc.)
    total_forecast = Decimal("0")
    total_actual = Decimal("0")
    
    for assignment in assignments:
        # Calculate forecast cost for this assignment
        # Calculate actual cost from actuals table
        pass
    
    return {
        "capital_budget": phase.capital_budget,
        "expense_budget": phase.expense_budget,
        "total_budget": phase.total_budget,
        "forecast_cost": total_forecast,
        "actual_cost": total_actual,
        "variance": phase.total_budget - total_actual
    }
```


## Phase Validation Logic

### Validation Rules

The phase validation service enforces the following rules:

1. **Basic Phase Constraints**:
   - Phase name must not be empty and max 100 characters
   - Start date must be a valid date
   - End date must be a valid date
   - Start date must be <= end date

2. **Project Boundary Constraints**:
   - Phase start_date must be >= project start_date
   - Phase end_date must be <= project end_date

3. **Timeline Continuity**:
   - All phases collectively must cover every date from project start to project end
   - No gaps allowed between phases
   - No overlaps allowed between phases

4. **Deletion Constraints**:
   - Cannot delete a phase if it would create a gap in the timeline
   - Cannot delete the last remaining phase

### Validation Algorithm

```python
def validate_phase_timeline(
    project_start: date,
    project_end: date,
    phases: List[Dict],
    exclude_phase_id: Optional[UUID] = None
) -> PhaseValidationResult:
    """
    Validate that phases form a continuous, non-overlapping timeline.
    
    Algorithm:
    1. Filter out excluded phase (for update scenarios)
    2. Sort phases by start_date
    3. Check first phase starts at project start
    4. Check last phase ends at project end
    5. Check each adjacent pair for gaps or overlaps
    6. Validate each phase's basic constraints
    """
    errors = []
    
    # Filter and sort
    active_phases = [p for p in phases if p.get('id') != exclude_phase_id]
    if not active_phases:
        errors.append(PhaseValidationError(
            field="phases",
            message="Project must have at least one phase"
        ))
        return PhaseValidationResult(is_valid=False, errors=errors)
    
    sorted_phases = sorted(active_phases, key=lambda p: p['start_date'])
    
    # Check first phase starts at project start
    if sorted_phases[0]['start_date'] != project_start:
        errors.append(PhaseValidationError(
            field="start_date",
            message=f"First phase must start at project start date ({project_start})",
            phase_id=sorted_phases[0].get('id')
        ))
    
    # Check last phase ends at project end
    if sorted_phases[-1]['end_date'] != project_end:
        errors.append(PhaseValidationError(
            field="end_date",
            message=f"Last phase must end at project end date ({project_end})",
            phase_id=sorted_phases[-1].get('id')
        ))
    
    # Check for gaps and overlaps between adjacent phases
    for i in range(len(sorted_phases) - 1):
        current = sorted_phases[i]
        next_phase = sorted_phases[i + 1]
        
        # Check for gap (next phase should start the day after current ends)
        expected_next_start = current['end_date'] + timedelta(days=1)
        if next_phase['start_date'] > expected_next_start:
            errors.append(PhaseValidationError(
                field="timeline",
                message=f"Gap detected between {current['name']} and {next_phase['name']}",
                phase_id=current.get('id')
            ))
        
        # Check for overlap
        if next_phase['start_date'] <= current['end_date']:
            errors.append(PhaseValidationError(
                field="timeline",
                message=f"Overlap detected between {current['name']} and {next_phase['name']}",
                phase_id=current.get('id')
            ))
    
    # Validate each phase's basic constraints
    for phase in sorted_phases:
        if phase['start_date'] > phase['end_date']:
            errors.append(PhaseValidationError(
                field="dates",
                message=f"Phase {phase['name']}: start date must be <= end date",
                phase_id=phase.get('id')
            ))
        
        if phase['start_date'] < project_start:
            errors.append(PhaseValidationError(
                field="start_date",
                message=f"Phase {phase['name']}: start date must be >= project start",
                phase_id=phase.get('id')
            ))
        
        if phase['end_date'] > project_end:
            errors.append(PhaseValidationError(
                field="end_date",
                message=f"Phase {phase['name']}: end date must be <= project end",
                phase_id=phase.get('id')
            ))
    
    return PhaseValidationResult(
        is_valid=len(errors) == 0,
        errors=errors
    )
```

### Validation Integration Points

1. **Phase Create**: Validate before inserting new phase
2. **Phase Update**: Validate with updated phase data
3. **Phase Delete**: Validate remaining phases after deletion
4. **Project Date Update**: Validate phases when project dates change
5. **Bulk Phase Update**: Validate entire set before committing

### Error Messages

Clear, actionable error messages for each validation failure:

- "Phase name cannot be empty"
- "Phase name exceeds maximum length of 100 characters"
- "Start date must be on or before end date"
- "Phase must start on or after project start date (YYYY-MM-DD)"
- "Phase must end on or before project end date (YYYY-MM-DD)"
- "Gap detected between phases: [Phase A] ends on YYYY-MM-DD but [Phase B] starts on YYYY-MM-DD"
- "Overlap detected: [Phase A] and [Phase B] have overlapping date ranges"
- "First phase must start at project start date (YYYY-MM-DD)"
- "Last phase must end at project end date (YYYY-MM-DD)"
- "Cannot delete phase: would create gap in project timeline"
- "Cannot delete the last remaining phase"


## Database Migration Strategy

### Migration Overview

The migration transforms the existing phase model from enum-based to user-definable while preserving all data and maintaining referential integrity.

### Migration Steps

#### Step 1: Add New Columns to ProjectPhase

```python
# Alembic migration: add_phase_date_fields.py

def upgrade():
    # Add new columns (nullable initially for data migration)
    op.add_column('project_phases', sa.Column('name', sa.String(100), nullable=True))
    op.add_column('project_phases', sa.Column('start_date', sa.Date(), nullable=True))
    op.add_column('project_phases', sa.Column('end_date', sa.Date(), nullable=True))
    op.add_column('project_phases', sa.Column('description', sa.String(500), nullable=True))
    
    # Add indexes
    op.create_index('ix_project_phases_start_date', 'project_phases', ['start_date'])
    op.create_index('ix_project_phases_end_date', 'project_phases', ['end_date'])
```

#### Step 2: Migrate Existing Data

```python
def upgrade():
    # Get database connection
    connection = op.get_bind()
    
    # For each project, get its phases and set dates
    projects = connection.execute(
        sa.text("SELECT id, start_date, end_date FROM projects")
    ).fetchall()
    
    for project in projects:
        project_id = project.id
        project_start = project.start_date
        project_end = project.end_date
        
        # Get planning and execution phases for this project
        planning_phase = connection.execute(
            sa.text("""
                SELECT id FROM project_phases 
                WHERE project_id = :project_id AND phase_type = 'planning'
            """),
            {"project_id": project_id}
        ).fetchone()
        
        execution_phase = connection.execute(
            sa.text("""
                SELECT id FROM project_phases 
                WHERE project_id = :project_id AND phase_type = 'execution'
            """),
            {"project_id": project_id}
        ).fetchone()
        
        if planning_phase and execution_phase:
            # Calculate midpoint for splitting phases
            total_days = (project_end - project_start).days
            midpoint = project_start + timedelta(days=total_days // 2)
            
            # Update planning phase
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Planning', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": planning_phase.id,
                    "start_date": project_start,
                    "end_date": midpoint
                }
            )
            
            # Update execution phase
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Execution', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": execution_phase.id,
                    "start_date": midpoint + timedelta(days=1),
                    "end_date": project_end
                }
            )
        elif planning_phase:
            # Only planning phase exists - use entire project duration
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Planning', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": planning_phase.id,
                    "start_date": project_start,
                    "end_date": project_end
                }
            )
        elif execution_phase:
            # Only execution phase exists - use entire project duration
            connection.execute(
                sa.text("""
                    UPDATE project_phases 
                    SET name = 'Execution', 
                        start_date = :start_date, 
                        end_date = :end_date
                    WHERE id = :phase_id
                """),
                {
                    "phase_id": execution_phase.id,
                    "start_date": project_start,
                    "end_date": project_end
                }
            )
```

#### Step 3: Make New Columns Non-Nullable

```python
def upgrade():
    # Make columns non-nullable after data migration
    op.alter_column('project_phases', 'name', nullable=False)
    op.alter_column('project_phases', 'start_date', nullable=False)
    op.alter_column('project_phases', 'end_date', nullable=False)
    
    # Add check constraint
    op.create_check_constraint(
        'check_phase_dates',
        'project_phases',
        'start_date <= end_date'
    )
```

#### Step 4: Remove phase_type Column

```python
def upgrade():
    # Drop the old phase_type column
    op.drop_column('project_phases', 'phase_type')
```

#### Step 5: Remove project_phase_id from ResourceAssignment

```python
def upgrade():
    # Drop foreign key constraint
    op.drop_constraint(
        'resource_assignments_project_phase_id_fkey',
        'resource_assignments',
        type_='foreignkey'
    )
    
    # Drop index
    op.drop_index('ix_resource_assignments_project_phase_id', 'resource_assignments')
    
    # Drop column
    op.drop_column('resource_assignments', 'project_phase_id')
```

### Rollback Strategy

```python
def downgrade():
    # Step 5 rollback: Re-add project_phase_id
    op.add_column('resource_assignments', 
        sa.Column('project_phase_id', GUID(), nullable=True)
    )
    op.create_index('ix_resource_assignments_project_phase_id', 
        'resource_assignments', ['project_phase_id']
    )
    
    # Populate project_phase_id based on assignment_date
    connection = op.get_bind()
    assignments = connection.execute(
        sa.text("""
            SELECT id, project_id, assignment_date 
            FROM resource_assignments
        """)
    ).fetchall()
    
    for assignment in assignments:
        # Find phase that contains this assignment date
        phase = connection.execute(
            sa.text("""
                SELECT id FROM project_phases
                WHERE project_id = :project_id
                AND start_date <= :assignment_date
                AND end_date >= :assignment_date
            """),
            {
                "project_id": assignment.project_id,
                "assignment_date": assignment.assignment_date
            }
        ).fetchone()
        
        if phase:
            connection.execute(
                sa.text("""
                    UPDATE resource_assignments
                    SET project_phase_id = :phase_id
                    WHERE id = :assignment_id
                """),
                {
                    "phase_id": phase.id,
                    "assignment_id": assignment.id
                }
            )
    
    # Make project_phase_id non-nullable
    op.alter_column('resource_assignments', 'project_phase_id', nullable=False)
    
    # Re-add foreign key
    op.create_foreign_key(
        'resource_assignments_project_phase_id_fkey',
        'resource_assignments', 'project_phases',
        ['project_phase_id'], ['id']
    )
    
    # Step 4 rollback: Re-add phase_type
    op.add_column('project_phases', 
        sa.Column('phase_type', sa.String(), nullable=True)
    )
    
    # Populate phase_type from name
    connection.execute(
        sa.text("""
            UPDATE project_phases
            SET phase_type = CASE
                WHEN LOWER(name) LIKE '%planning%' THEN 'planning'
                ELSE 'execution'
            END
        """)
    )
    
    op.alter_column('project_phases', 'phase_type', nullable=False)
    
    # Step 3 rollback: Drop check constraint
    op.drop_constraint('check_phase_dates', 'project_phases')
    
    # Step 2 & 1 rollback: Drop new columns
    op.drop_index('ix_project_phases_end_date', 'project_phases')
    op.drop_index('ix_project_phases_start_date', 'project_phases')
    op.drop_column('project_phases', 'end_date')
    op.drop_column('project_phases', 'start_date')
    op.drop_column('project_phases', 'name')
    op.drop_column('project_phases', 'description')
```

### Migration Verification

After migration, run verification queries:

```sql
-- Verify all phases have required fields
SELECT COUNT(*) FROM project_phases 
WHERE name IS NULL OR start_date IS NULL OR end_date IS NULL;
-- Expected: 0

-- Verify no gaps in phase coverage
SELECT p.id, p.name, 
       COUNT(DISTINCT date_series.date) as total_days,
       COUNT(DISTINCT CASE 
           WHEN EXISTS (
               SELECT 1 FROM project_phases ph
               WHERE ph.project_id = p.id
               AND date_series.date BETWEEN ph.start_date AND ph.end_date
           ) THEN date_series.date 
       END) as covered_days
FROM projects p
CROSS JOIN LATERAL generate_series(p.start_date, p.end_date, '1 day'::interval) as date_series(date)
GROUP BY p.id, p.name
HAVING COUNT(DISTINCT date_series.date) != COUNT(DISTINCT CASE 
    WHEN EXISTS (
        SELECT 1 FROM project_phases ph
        WHERE ph.project_id = p.id
        AND date_series.date BETWEEN ph.start_date AND ph.end_date
    ) THEN date_series.date 
END);
-- Expected: 0 rows (all projects fully covered)

-- Verify no overlapping phases
SELECT ph1.id, ph1.name, ph2.id, ph2.name
FROM project_phases ph1
JOIN project_phases ph2 ON ph1.project_id = ph2.project_id AND ph1.id < ph2.id
WHERE ph1.start_date <= ph2.end_date AND ph2.start_date <= ph1.end_date;
-- Expected: 0 rows (no overlaps)
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Default Phase Creation

*For any* newly created project, the system should automatically create exactly one phase named "Default Phase" with start_date equal to the project's start_date, end_date equal to the project's end_date, and all budget values (capital_budget, expense_budget, total_budget) set to zero.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**

### Property 2: Default Phase Date Synchronization

*For any* project that has only a default phase, when the project's start_date or end_date is updated, the default phase's dates should automatically update to match the new project dates.

**Validates: Requirements 2.6**

### Property 3: Timeline Continuity

*For any* project with a valid set of phases, the phases collectively should cover every date from the project's start_date to end_date with no gaps, where a gap is defined as any date within the project range that does not fall within any phase's date range.

**Validates: Requirements 3.1, 3.2, 9.7**

### Property 4: No Phase Overlaps

*For any* two distinct phases within the same project, their date ranges should not overlap, meaning for phases A and B, either A.end_date < B.start_date or B.end_date < A.start_date.

**Validates: Requirements 3.3, 9.6**

### Property 5: Phase Date Ordering

*For any* phase, the start_date should be less than or equal to the end_date.

**Validates: Requirements 3.4, 9.4**

### Property 6: Phase Boundary Constraints

*For any* phase within a project, the phase's start_date should be greater than or equal to the project's start_date, and the phase's end_date should be less than or equal to the project's end_date.

**Validates: Requirements 3.5, 3.6, 9.5**

### Property 7: Validation Rejection

*For any* phase configuration that violates timeline continuity, overlap constraints, date ordering, or boundary constraints, the system should reject the save operation and return specific validation errors.

**Validates: Requirements 3.7**

### Property 8: Phase Display Ordering

*For any* project's phase list displayed in the UI, the phases should be sorted in chronological order by start_date.

**Validates: Requirements 4.2**

### Property 9: Phase Display Completeness

*For any* phase displayed in the Phase Editor, the rendered output should contain the phase's name, start_date, end_date, description (if present), capital_budget, expense_budget, and total_budget.

**Validates: Requirements 4.3, 10.3**

### Property 10: Validation Error Display

*For any* phase configuration that fails validation, the Phase Editor should display inline error messages corresponding to each validation failure.

**Validates: Requirements 4.7**

### Property 11: Save Button State

*For any* phase configuration in the Phase Editor, the save button should be disabled if and only if there are validation errors present.

**Validates: Requirements 4.8**

### Property 12: Required Phase Fields

*For any* phase creation request, if the name, start_date, or end_date fields are missing or empty, the system should reject the request with a validation error.

**Validates: Requirements 5.1**

### Property 13: Phase Update Flexibility

*For any* existing phase, updates to the name, description, start_date, end_date, capital_budget, expense_budget, or total_budget fields should succeed if the resulting phase configuration maintains timeline continuity and satisfies all validation constraints.

**Validates: Requirements 5.3**

### Property 14: Gap-Creating Deletion Prevention

*For any* phase deletion request, if removing the phase would create a gap in the project timeline (leaving dates uncovered by any phase), the system should reject the deletion with a validation error.

**Validates: Requirements 5.4**

### Property 15: Valid Deletion Allowance

*For any* phase deletion request, if the remaining phases after deletion still form a continuous, non-overlapping timeline covering the entire project duration, the system should allow the deletion.

**Validates: Requirements 5.5**

### Property 16: Date-Based Phase Association

*For any* resource assignment with an assignment_date, querying for the phase that contains that assignment should return the unique phase where start_date <= assignment_date <= end_date within the assignment's project.

**Validates: Requirements 6.2, 6.3**

### Property 17: Phase Cost Calculation

*For any* phase, the calculated actual cost should equal the sum of all actual costs from resource assignments where the assignment_date falls within the phase's date range.

**Validates: Requirements 8.2**

### Property 18: Phase Forecast Calculation

*For any* phase, the calculated forecast cost should equal the sum of all forecast costs from resource assignments where the assignment_date falls within the phase's date range and is in the future.

**Validates: Requirements 8.3**

### Property 19: Phase Budget Aggregation

*For any* project, the sum of all phase budgets (capital_budget, expense_budget, total_budget) should equal the project-level budget totals.

**Validates: Requirements 8.5**

### Property 20: Phase Name Validation

*For any* phase, the name field should not be empty and should not exceed 100 characters in length, otherwise the system should reject the phase with a validation error.

**Validates: Requirements 9.1**

### Property 21: Phase Resize Continuity

*For any* phase resize operation in the timeline UI, after adjusting the phase boundaries, the system should automatically adjust adjacent phases such that timeline continuity is maintained (no gaps or overlaps).

**Validates: Requirements 10.6**


## Error Handling

### Error Categories

#### 1. Validation Errors

**Timeline Continuity Errors**:
- `TIMELINE_GAP`: Gap detected between phases
- `TIMELINE_INCOMPLETE_START`: First phase does not start at project start
- `TIMELINE_INCOMPLETE_END`: Last phase does not end at project end
- `TIMELINE_OVERLAP`: Phases have overlapping date ranges

**Phase Constraint Errors**:
- `INVALID_DATE_ORDER`: Phase start_date is after end_date
- `PHASE_BEFORE_PROJECT`: Phase starts before project start_date
- `PHASE_AFTER_PROJECT`: Phase ends after project end_date
- `EMPTY_PHASE_NAME`: Phase name is empty or whitespace only
- `PHASE_NAME_TOO_LONG`: Phase name exceeds 100 characters

**Deletion Errors**:
- `DELETION_CREATES_GAP`: Deleting phase would create timeline gap
- `CANNOT_DELETE_LAST_PHASE`: Cannot delete the only remaining phase

#### 2. Not Found Errors

- `PHASE_NOT_FOUND`: Phase ID does not exist
- `PROJECT_NOT_FOUND`: Project ID does not exist
- `NO_PHASE_FOR_DATE`: No phase covers the specified date

#### 3. Database Errors

- `CONSTRAINT_VIOLATION`: Database constraint violated (e.g., budget sum check)
- `FOREIGN_KEY_VIOLATION`: Referenced project does not exist
- `UNIQUE_VIOLATION`: Duplicate phase (if unique constraints added)

### Error Response Format

```json
{
  "error": {
    "code": "TIMELINE_GAP",
    "message": "Gap detected between phases: 'Planning' ends on 2024-06-30 but 'Execution' starts on 2024-07-15",
    "details": {
      "phase_id": "uuid-here",
      "field": "timeline",
      "gap_start": "2024-07-01",
      "gap_end": "2024-07-14"
    }
  }
}
```

### Error Handling Strategy

#### API Layer

```python
@router.post("/projects/{project_id}/phases")
async def create_phase(
    project_id: UUID,
    phase_data: PhaseCreate,
    db: AsyncSession = Depends(get_db)
):
    try:
        phase = await phase_service.create_phase(db, project_id, phase_data)
        return phase
    except ValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": e.code,
                "message": e.message,
                "details": e.details
            }
        )
    except NotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"code": "PROJECT_NOT_FOUND", "message": str(e)}
        )
    except Exception as e:
        logger.error(f"Unexpected error creating phase: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "An unexpected error occurred"}
        )
```

#### Service Layer

```python
async def create_phase(
    self,
    db: AsyncSession,
    project_id: UUID,
    phase_data: PhaseCreate
) -> ProjectPhase:
    # Get project
    project = await self.project_repo.get(db, project_id)
    if not project:
        raise NotFoundError(f"Project {project_id} not found")
    
    # Get existing phases
    existing_phases = await self.phase_repo.get_by_project(db, project_id)
    
    # Prepare validation data
    all_phases = [
        {
            "id": p.id,
            "name": p.name,
            "start_date": p.start_date,
            "end_date": p.end_date
        }
        for p in existing_phases
    ]
    all_phases.append({
        "id": None,
        "name": phase_data.name,
        "start_date": phase_data.start_date,
        "end_date": phase_data.end_date
    })
    
    # Validate
    validation_result = self.validator.validate_phase_timeline(
        project.start_date,
        project.end_date,
        all_phases
    )
    
    if not validation_result.is_valid:
        raise ValidationError(
            code="VALIDATION_FAILED",
            message="Phase validation failed",
            details={"errors": [e.dict() for e in validation_result.errors]}
        )
    
    # Create phase
    phase = ProjectPhase(
        project_id=project_id,
        name=phase_data.name,
        start_date=phase_data.start_date,
        end_date=phase_data.end_date,
        capital_budget=phase_data.capital_budget,
        expense_budget=phase_data.expense_budget,
        total_budget=phase_data.total_budget
    )
    
    db.add(phase)
    await db.commit()
    await db.refresh(phase)
    
    return phase
```

#### Frontend Error Handling

```typescript
const handleSavePhases = async () => {
  try {
    setIsSaving(true);
    setErrors([]);
    
    // Validate locally first
    const localValidation = validatePhasesLocally(phases);
    if (!localValidation.isValid) {
      setErrors(localValidation.errors);
      return;
    }
    
    // Save to backend
    await Promise.all(
      phases.map(phase => 
        phase.id 
          ? updatePhase(phase.id, phase)
          : createPhase(projectId, phase)
      )
    );
    
    toast.success('Phases saved successfully');
    onSave?.();
    
  } catch (error) {
    if (error.response?.status === 422) {
      // Validation error from backend
      const validationErrors = error.response.data.detail.details.errors;
      setErrors(validationErrors);
      toast.error('Phase validation failed. Please fix the errors and try again.');
    } else if (error.response?.status === 404) {
      toast.error('Project not found');
    } else {
      toast.error('An unexpected error occurred. Please try again.');
      console.error('Error saving phases:', error);
    }
  } finally {
    setIsSaving(false);
  }
};
```

### Rollback and Recovery

#### Transaction Management

All phase operations should be wrapped in database transactions:

```python
async def update_multiple_phases(
    self,
    db: AsyncSession,
    project_id: UUID,
    phase_updates: List[PhaseUpdate]
) -> List[ProjectPhase]:
    """Update multiple phases atomically."""
    
    async with db.begin():
        # Validate all updates first
        # ... validation logic ...
        
        # Apply all updates
        updated_phases = []
        for update in phase_updates:
            phase = await self.phase_repo.update(db, update.id, update)
            updated_phases.append(phase)
        
        # If any operation fails, entire transaction rolls back
        return updated_phases
```

#### Migration Rollback

The migration includes a comprehensive rollback strategy that:
1. Restores `project_phase_id` to resource_assignments
2. Populates `project_phase_id` based on date ranges
3. Restores `phase_type` enum field
4. Removes new date and name fields

This ensures safe rollback if issues are discovered post-migration.


## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, migration scenarios, and API integration
- **Property tests**: Verify universal properties across all possible phase configurations

### Property-Based Testing

We will use **pytest with Hypothesis** for property-based testing in Python. Each correctness property will be implemented as a property-based test with minimum 100 iterations.

#### Property Test Configuration

```python
# conftest.py
from hypothesis import settings, HealthCheck

# Configure Hypothesis for property tests
settings.register_profile("ci", max_examples=100, deadline=None)
settings.register_profile("dev", max_examples=50, deadline=None)
settings.load_profile("ci")
```

#### Example Property Test

```python
from hypothesis import given, strategies as st
from datetime import date, timedelta
import pytest

@given(
    project_start=st.dates(min_value=date(2020, 1, 1), max_value=date(2025, 1, 1)),
    project_duration=st.integers(min_value=30, max_value=730)
)
@pytest.mark.property_test
async def test_default_phase_creation_property(
    project_start: date,
    project_duration: int,
    db_session
):
    """
    Feature: user-definable-phases, Property 1: Default Phase Creation
    
    For any newly created project, the system should automatically create 
    exactly one phase named "Default Phase" with dates matching the project.
    """
    project_end = project_start + timedelta(days=project_duration)
    
    # Create project
    project = await create_project(
        db_session,
        name=f"Test Project {uuid4()}",
        start_date=project_start,
        end_date=project_end
    )
    
    # Get phases
    phases = await get_project_phases(db_session, project.id)
    
    # Assertions
    assert len(phases) == 1, "Should have exactly one default phase"
    
    default_phase = phases[0]
    assert default_phase.name == "Default Phase"
    assert default_phase.start_date == project_start
    assert default_phase.end_date == project_end
    assert default_phase.capital_budget == Decimal("0")
    assert default_phase.expense_budget == Decimal("0")
    assert default_phase.total_budget == Decimal("0")
```

#### Hypothesis Strategies for Phase Testing

```python
from hypothesis import strategies as st
from datetime import date, timedelta

@st.composite
def phase_strategy(draw, project_start: date, project_end: date):
    """Generate a valid phase within project bounds."""
    total_days = (project_end - project_start).days
    
    # Generate start offset
    start_offset = draw(st.integers(min_value=0, max_value=total_days))
    phase_start = project_start + timedelta(days=start_offset)
    
    # Generate duration
    max_duration = (project_end - phase_start).days
    duration = draw(st.integers(min_value=1, max_value=max_duration))
    phase_end = phase_start + timedelta(days=duration)
    
    # Generate name
    name = draw(st.text(min_size=1, max_size=100, alphabet=st.characters(blacklist_categories=('Cs',))))
    
    # Generate budgets
    capital = draw(st.decimals(min_value=0, max_value=1000000, places=2))
    expense = draw(st.decimals(min_value=0, max_value=1000000, places=2))
    
    return {
        "name": name,
        "start_date": phase_start,
        "end_date": phase_end,
        "capital_budget": capital,
        "expense_budget": expense,
        "total_budget": capital + expense
    }

@st.composite
def continuous_phases_strategy(draw, project_start: date, project_end: date):
    """Generate a set of continuous, non-overlapping phases."""
    phases = []
    current_date = project_start
    
    # Generate 1-10 phases
    num_phases = draw(st.integers(min_value=1, max_value=10))
    
    for i in range(num_phases):
        if i == num_phases - 1:
            # Last phase must end at project end
            phase_end = project_end
        else:
            # Generate end date
            remaining_days = (project_end - current_date).days
            min_duration = 1
            max_duration = max(1, remaining_days - (num_phases - i - 1))
            duration = draw(st.integers(min_value=min_duration, max_value=max_duration))
            phase_end = current_date + timedelta(days=duration)
        
        name = draw(st.text(min_size=1, max_size=100))
        capital = draw(st.decimals(min_value=0, max_value=100000, places=2))
        expense = draw(st.decimals(min_value=0, max_value=100000, places=2))
        
        phases.append({
            "name": name,
            "start_date": current_date,
            "end_date": phase_end,
            "capital_budget": capital,
            "expense_budget": expense,
            "total_budget": capital + expense
        })
        
        current_date = phase_end + timedelta(days=1)
    
    return phases
```

### Unit Testing

#### Test Categories

1. **Model Tests**:
   - Phase model constraints (budget sum, date ordering)
   - Schema validation (Pydantic)

2. **Validation Service Tests**:
   - Timeline continuity validation
   - Gap detection
   - Overlap detection
   - Boundary constraint validation

3. **Phase Service Tests**:
   - Create phase with validation
   - Update phase with validation
   - Delete phase with validation
   - Default phase creation
   - Default phase date synchronization

4. **API Endpoint Tests**:
   - CRUD operations
   - Error responses
   - Authorization checks

5. **Migration Tests**:
   - Forward migration (enum to user-defined)
   - Data preservation
   - Backward migration (rollback)

6. **Query Tests**:
   - Get phase for date
   - Get assignments for phase
   - Phase budget calculations

#### Example Unit Tests

```python
class TestPhaseValidation:
    """Unit tests for phase validation service."""
    
    async def test_validate_continuous_timeline_success(self):
        """Test validation passes for continuous timeline."""
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {"id": uuid4(), "name": "Q1", "start_date": date(2024, 1, 1), "end_date": date(2024, 3, 31)},
            {"id": uuid4(), "name": "Q2", "start_date": date(2024, 4, 1), "end_date": date(2024, 6, 30)},
            {"id": uuid4(), "name": "Q3", "start_date": date(2024, 7, 1), "end_date": date(2024, 9, 30)},
            {"id": uuid4(), "name": "Q4", "start_date": date(2024, 10, 1), "end_date": date(2024, 12, 31)},
        ]
        
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(project_start, project_end, phases)
        
        assert result.is_valid
        assert len(result.errors) == 0
    
    async def test_validate_timeline_with_gap(self):
        """Test validation fails when gap exists."""
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {"id": uuid4(), "name": "Phase 1", "start_date": date(2024, 1, 1), "end_date": date(2024, 6, 30)},
            # Gap: July 1-14
            {"id": uuid4(), "name": "Phase 2", "start_date": date(2024, 7, 15), "end_date": date(2024, 12, 31)},
        ]
        
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(project_start, project_end, phases)
        
        assert not result.is_valid
        assert any("gap" in error.message.lower() for error in result.errors)
    
    async def test_validate_timeline_with_overlap(self):
        """Test validation fails when overlap exists."""
        project_start = date(2024, 1, 1)
        project_end = date(2024, 12, 31)
        
        phases = [
            {"id": uuid4(), "name": "Phase 1", "start_date": date(2024, 1, 1), "end_date": date(2024, 7, 15)},
            {"id": uuid4(), "name": "Phase 2", "start_date": date(2024, 7, 1), "end_date": date(2024, 12, 31)},
        ]
        
        validator = PhaseValidatorService()
        result = validator.validate_phase_timeline(project_start, project_end, phases)
        
        assert not result.is_valid
        assert any("overlap" in error.message.lower() for error in result.errors)
    
    async def test_cannot_delete_last_phase(self, db_session):
        """Test that deleting the last phase is prevented."""
        # Create project with one phase
        project = await create_test_project(db_session)
        phases = await get_project_phases(db_session, project.id)
        
        assert len(phases) == 1  # Only default phase
        
        # Attempt to delete
        with pytest.raises(ValidationError) as exc_info:
            await phase_service.delete_phase(db_session, phases[0].id)
        
        assert "last remaining phase" in str(exc_info.value).lower()
```

### Frontend Testing

#### Component Tests (Jest + React Testing Library)

```typescript
describe('PhaseEditor', () => {
  it('should display phases in chronological order', () => {
    const phases = [
      { id: '3', name: 'Phase 3', start_date: '2024-07-01', end_date: '2024-12-31' },
      { id: '1', name: 'Phase 1', start_date: '2024-01-01', end_date: '2024-03-31' },
      { id: '2', name: 'Phase 2', start_date: '2024-04-01', end_date: '2024-06-30' },
    ];
    
    render(<PhaseEditor projectId="test" phases={phases} />);
    
    const phaseRows = screen.getAllByRole('row');
    expect(phaseRows[1]).toHaveTextContent('Phase 1');
    expect(phaseRows[2]).toHaveTextContent('Phase 2');
    expect(phaseRows[3]).toHaveTextContent('Phase 3');
  });
  
  it('should disable save button when validation errors exist', () => {
    const phasesWithGap = [
      { id: '1', name: 'Phase 1', start_date: '2024-01-01', end_date: '2024-06-30' },
      { id: '2', name: 'Phase 2', start_date: '2024-08-01', end_date: '2024-12-31' },
    ];
    
    render(
      <PhaseEditor 
        projectId="test" 
        projectStartDate="2024-01-01"
        projectEndDate="2024-12-31"
        phases={phasesWithGap} 
      />
    );
    
    const saveButton = screen.getByRole('button', { name: /save/i });
    expect(saveButton).toBeDisabled();
  });
});
```

### Integration Tests

```python
class TestPhaseAPIIntegration:
    """Integration tests for phase API endpoints."""
    
    async def test_create_update_delete_phase_flow(self, client, db_session):
        """Test complete CRUD flow for phases."""
        # Create project
        project = await create_test_project(db_session)
        
        # Get default phase
        response = await client.get(f"/api/v1/projects/{project.id}/phases")
        assert response.status_code == 200
        phases = response.json()
        assert len(phases) == 1
        assert phases[0]["name"] == "Default Phase"
        
        # Split default phase into two phases
        midpoint = project.start_date + (project.end_date - project.start_date) / 2
        
        # Update default phase to cover first half
        response = await client.put(
            f"/api/v1/phases/{phases[0]['id']}",
            json={
                "name": "Phase 1",
                "end_date": midpoint.isoformat()
            }
        )
        assert response.status_code == 200
        
        # Create second phase for second half
        response = await client.post(
            f"/api/v1/projects/{project.id}/phases",
            json={
                "name": "Phase 2",
                "start_date": (midpoint + timedelta(days=1)).isoformat(),
                "end_date": project.end_date.isoformat(),
                "capital_budget": "50000.00",
                "expense_budget": "30000.00",
                "total_budget": "80000.00"
            }
        )
        assert response.status_code == 201
        
        # Verify two phases exist
        response = await client.get(f"/api/v1/projects/{project.id}/phases")
        assert len(response.json()) == 2
```

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 90% for service and validation logic
- **Integration Test Coverage**: All API endpoints
- **Property Test Coverage**: All 21 correctness properties
- **Frontend Test Coverage**: Minimum 80% for phase-related components

