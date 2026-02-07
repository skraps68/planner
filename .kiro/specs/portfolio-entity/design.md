# Design Document: Portfolio Entity

## Overview

This design document specifies the implementation of a Portfolio entity that sits at the top of the organizational hierarchy (Portfolio → Program → Project). The Portfolio entity enables organizations to group and manage multiple Programs under strategic umbrellas, providing better visibility and control over large-scale initiatives.

The implementation follows the existing architectural patterns established for Program and Project entities, ensuring consistency across the application. This includes:
- SQLAlchemy ORM models with audit fields
- Pydantic schemas for API validation
- FastAPI REST endpoints following RESTful conventions
- React/TypeScript frontend with Material-UI components
- Scope-based access control integration
- Comprehensive testing at all layers

## Architecture

### System Components

The Portfolio feature spans multiple architectural layers:

1. **Data Layer**: SQLAlchemy models, database migrations
2. **Service Layer**: Business logic, validation, repository pattern
3. **API Layer**: FastAPI endpoints, request/response schemas
4. **Frontend Layer**: React components, API client, routing
5. **Security Layer**: Permission checks, audit logging

### Technology Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, Alembic
- **Frontend**: React 18+, TypeScript, Material-UI, React Query
- **Database**: PostgreSQL (with MySQL compatibility)
- **Testing**: pytest (backend), Jest/React Testing Library (frontend)


## Components and Interfaces

### Backend Components

#### 1. Portfolio Model (`backend/app/models/portfolio.py`)

```python
class Portfolio(BaseModel):
    """Portfolio model for organizing related programs."""
    
    __tablename__ = "portfolios"
    
    # Required fields
    name = Column(String(255), nullable=False, index=True)
    description = Column(String(1000), nullable=False)
    owner = Column(String(255), nullable=False)
    reporting_start_date = Column(Date, nullable=False)
    reporting_end_date = Column(Date, nullable=False)
    
    # Relationships
    programs = relationship("Program", back_populates="portfolio", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        CheckConstraint('reporting_start_date < reporting_end_date', name='check_portfolio_dates'),
    )
```

**Key Design Decisions**:
- Inherits from `BaseModel` which provides audit fields (id, created_at, updated_at, created_by, updated_by)
- Uses same field types and constraints as Program model for consistency
- Cascade delete-orphan prevents orphaned programs (enforces referential integrity)
- Check constraint ensures date validity at database level

#### 2. Updated Program Model

```python
class Program(BaseModel):
    # ... existing fields ...
    
    # Add foreign key
    portfolio_id = Column(GUID(), ForeignKey("portfolios.id"), nullable=False, index=True)
    
    # Add relationship
    portfolio = relationship("Portfolio", back_populates="programs")
```

**Migration Strategy**:
- Add portfolio_id column as nullable initially
- Create default portfolio with name "Default Portfolio"
- Update all existing programs to reference default portfolio
- Alter column to NOT NULL
- Add foreign key constraint


#### 3. Portfolio Schemas (`backend/app/schemas/portfolio.py`)

```python
class PortfolioBase(BaseSchema):
    """Base portfolio schema with common fields."""
    name: str = Field(min_length=1, max_length=255)
    description: str = Field(min_length=1, max_length=1000)
    owner: str = Field(min_length=1, max_length=255)
    reporting_start_date: date
    reporting_end_date: date
    
    @field_validator('end_date')
    @classmethod
    def validate_end_date(cls, v, info):
        if 'reporting_start_date' in info.data and v <= info.data['reporting_start_date']:
            raise ValueError('Reporting end date must be after reporting start date')
        return v

class PortfolioCreate(PortfolioBase):
    """Schema for creating a new portfolio."""
    pass

class PortfolioUpdate(BaseSchema):
    """Schema for updating an existing portfolio."""
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, min_length=1, max_length=1000)
    owner: Optional[str] = Field(default=None, min_length=1, max_length=255)
    reporting_start_date: Optional[date] = None
    reporting_end_date: Optional[date] = None

class PortfolioResponse(PortfolioBase, TimestampMixin):
    """Schema for portfolio response."""
    program_count: Optional[int] = Field(default=0)
```

#### 4. Portfolio Service (`backend/app/services/portfolio.py`)

```python
class PortfolioService:
    """Service for portfolio business logic."""
    
    def create_portfolio(self, db: Session, **kwargs) -> Portfolio:
        """Create a new portfolio with validation."""
        # Validate dates
        # Create portfolio
        # Commit and return
    
    def get_portfolio(self, db: Session, portfolio_id: UUID) -> Optional[Portfolio]:
        """Get portfolio by ID."""
    
    def list_portfolios(self, db: Session, skip: int = 0, limit: int = 100) -> List[Portfolio]:
        """List portfolios with pagination."""
    
    def update_portfolio(self, db: Session, portfolio_id: UUID, **kwargs) -> Portfolio:
        """Update portfolio with validation."""
    
    def delete_portfolio(self, db: Session, portfolio_id: UUID) -> None:
        """Delete portfolio (only if no programs)."""
        # Check for associated programs
        # Raise error if programs exist
        # Delete if safe
```


#### 5. Portfolio API Endpoints (`backend/app/api/v1/endpoints/portfolios.py`)

```python
@router.post("/", response_model=PortfolioResponse, status_code=201)
async def create_portfolio(portfolio_in: PortfolioCreate, db: Session, current_user: User):
    """Create a new portfolio."""

@router.get("/", response_model=PortfolioListResponse)
async def list_portfolios(pagination: PaginationParams, db: Session, current_user: User):
    """List portfolios with pagination."""

@router.get("/{portfolio_id}", response_model=PortfolioResponse)
async def get_portfolio(portfolio_id: UUID, db: Session, current_user: User):
    """Get portfolio by ID."""

@router.put("/{portfolio_id}", response_model=PortfolioResponse)
async def update_portfolio(portfolio_id: UUID, portfolio_in: PortfolioUpdate, db: Session, current_user: User):
    """Update portfolio."""

@router.delete("/{portfolio_id}", response_model=SuccessResponse)
async def delete_portfolio(portfolio_id: UUID, db: Session, current_user: User):
    """Delete portfolio (only if no programs)."""

@router.get("/{portfolio_id}/programs", response_model=List[ProgramSummary])
async def get_portfolio_programs(portfolio_id: UUID, db: Session, current_user: User):
    """Get all programs in a portfolio."""
```

**Error Handling**:
- 400 Bad Request: Invalid input data, validation errors
- 404 Not Found: Portfolio not found
- 409 Conflict: Cannot delete portfolio with programs
- 403 Forbidden: Insufficient permissions
- 500 Internal Server Error: Unexpected errors


### Frontend Components

#### 1. Portfolio Types (`frontend/src/types/portfolio.ts`)

```typescript
export interface Portfolio {
  id: string
  name: string
  description: string
  owner: string
  reporting_start_date: string
  reporting_end_date: string
  program_count: number
  created_at: string
  updated_at: string
}

export interface PortfolioCreate {
  name: string
  description: string
  owner: string
  reporting_start_date: string
  reporting_end_date: string
}

export interface PortfolioUpdate {
  name?: string
  description?: string
  owner?: string
  reporting_start_date?: string
  reporting_end_date?: string
}
```

#### 2. Portfolio API Client (`frontend/src/api/portfolios.ts`)

```typescript
export const portfoliosApi = {
  list: async (params?: PaginationParams): Promise<PaginatedResponse<Portfolio>> => {
    const response = await apiClient.get('/portfolios', { params })
    return response.data
  },
  
  get: async (id: string): Promise<Portfolio> => {
    const response = await apiClient.get(`/portfolios/${id}`)
    return response.data
  },
  
  create: async (data: PortfolioCreate): Promise<Portfolio> => {
    const response = await apiClient.post('/portfolios', data)
    return response.data
  },
  
  update: async (id: string, data: PortfolioUpdate): Promise<Portfolio> => {
    const response = await apiClient.put(`/portfolios/${id}`, data)
    return response.data
  },
  
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/portfolios/${id}`)
  },
  
  getPrograms: async (id: string): Promise<Program[]> => {
    const response = await apiClient.get(`/portfolios/${id}/programs`)
    return response.data
  }
}
```


#### 3. Portfolios List Page (`frontend/src/pages/portfolios/PortfoliosListPage.tsx`)

**Component Structure**:
- Page title "Portfolios" with "Create Portfolio" button
- Search/filter bar at top
- DataGrid with columns: Portfolio Name, Owner, Reporting Start, Reporting End
- Row hover: gray background with blue border
- Row click: navigate to detail page
- Pagination controls

**Key Features**:
- React Query for data fetching and caching
- Material-UI DataGrid for table display
- Scope-based filtering (only show portfolios user can access)
- Permission-based "Create Portfolio" button visibility
- Date formatting using date-fns

#### 4. Portfolio Detail Page (`frontend/src/pages/portfolios/PortfolioDetailPage.tsx`)

**Component Structure**:
- Breadcrumbs navigation
- Details tab showing all portfolio fields (read-only initially)
- Edit button at bottom right
- When editing: all fields become editable, Save/Cancel buttons appear
- Programs tab showing associated programs

**Key Features**:
- In-place editing with form validation
- Optimistic updates with React Query
- Error handling and success messages
- Permission checks for edit capability

#### 5. Portfolio Form Page (`frontend/src/pages/portfolios/PortfolioFormPage.tsx`)

**Component Structure**:
- Form with all required fields
- Date pickers for reporting dates
- Validation error display
- Submit and Cancel buttons

**Validation Rules**:
- All fields required
- Name: 1-255 characters
- Description: 1-1000 characters
- Owner: 1-255 characters
- Reporting end date must be after start date


#### 6. Updated Program Form

**Changes Required**:
- Add Portfolio selection dropdown
- Populate dropdown with all portfolios from API
- Make portfolio selection required
- Display validation error if not selected
- Update Program API calls to include portfolio_id

#### 7. Updated Sidebar Navigation

**Changes Required**:
- Add "Portfolios" navigation item above "Programs"
- Use appropriate icon (e.g., BusinessCenter or AccountBalance)
- Apply permission checks (view_portfolios permission)
- Highlight when on portfolio pages

## Data Models

### Portfolio Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | Primary Key | Unique identifier |
| name | String(255) | NOT NULL, Indexed | Portfolio name |
| description | String(1000) | NOT NULL | Portfolio description |
| owner | String(255) | NOT NULL | Portfolio owner |
| reporting_start_date | Date | NOT NULL | Reporting period start |
| reporting_end_date | Date | NOT NULL, > start_date | Reporting period end |
| created_at | Timestamp | NOT NULL | Creation timestamp |
| updated_at | Timestamp | NOT NULL | Last update timestamp |
| created_by | String(255) | NULL | Creator user ID |
| updated_by | String(255) | NULL | Last updater user ID |

### Updated Program Entity

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| portfolio_id | UUID | NOT NULL, FK(portfolios.id), Indexed | Parent portfolio |
| ... | ... | ... | (existing fields unchanged) |

### Relationships

- **Portfolio → Programs**: One-to-Many (cascade delete-orphan)
- **Program → Portfolio**: Many-to-One (required)
- **Program → Projects**: One-to-Many (existing, unchanged)


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, I identified the following testable properties. I performed a reflection to eliminate redundancy:

**Redundancy Analysis**:
- Properties 1.7, 1.8, 1.9 (empty field validation) can be combined into a single comprehensive property about required field validation
- Properties 1.10, 1.11 (date field presence) are covered by the combined required field property
- Properties 3.6 and 3.8 (invalid data returns 400) can be combined into a single property about API validation
- Properties 2.6 and 2.7 (relationship queries) are complementary and should remain separate

### Backend Properties

**Property 1: Required Field Validation**
*For any* Portfolio creation request with any required field (name, description, owner, reporting_start_date, reporting_end_date) that is empty, null, or whitespace-only, the system should reject the request with a validation error.
**Validates: Requirements 1.7, 1.8, 1.9, 1.10, 1.11**

**Property 2: Program Portfolio Association Required**
*For any* Program creation request without a portfolio_id or with a null portfolio_id, the system should reject the request with a validation error.
**Validates: Requirements 2.3**

**Property 3: Portfolio Reference Integrity**
*For any* Program creation request with a portfolio_id that does not reference an existing Portfolio, the system should reject the request with a referential integrity error.
**Validates: Requirements 2.4**

**Property 4: Portfolio Deletion Protection**
*For any* Portfolio that has one or more associated Programs, attempting to delete the Portfolio should fail with a conflict error and the Portfolio should remain in the database.
**Validates: Requirements 2.5**

**Property 5: Portfolio-Program Relationship Query**
*For any* Portfolio with associated Programs, querying the Portfolio should return all Programs that have that Portfolio's ID as their portfolio_id.
**Validates: Requirements 2.6**

**Property 6: Program-Portfolio Relationship Query**
*For any* Program with a portfolio_id, querying the Program should return the Portfolio that matches that portfolio_id.
**Validates: Requirements 2.7**

**Property 7: API Validation Error Responses**
*For any* POST or PUT request to Portfolio endpoints with invalid data (missing required fields, invalid date ranges, invalid data types), the system should return a 400 Bad Request status with validation error details.
**Validates: Requirements 3.6, 3.8**


## Error Handling

### Backend Error Handling

**Validation Errors (400 Bad Request)**:
- Missing required fields
- Empty or whitespace-only strings
- Invalid date ranges (end date before start date)
- Invalid data types
- String length violations

**Not Found Errors (404 Not Found)**:
- Portfolio ID does not exist
- Program ID does not exist

**Conflict Errors (409 Conflict)**:
- Attempting to delete Portfolio with associated Programs
- Foreign key constraint violations

**Permission Errors (403 Forbidden)**:
- User lacks required permission for operation
- User's scope does not include the Portfolio

**Server Errors (500 Internal Server Error)**:
- Database connection failures
- Unexpected exceptions
- Transaction rollback failures

### Frontend Error Handling

**Network Errors**:
- Display user-friendly error messages
- Retry mechanism for transient failures
- Offline detection and messaging

**Validation Errors**:
- Display field-level validation errors
- Prevent form submission until valid
- Clear error messages on field correction

**Permission Errors**:
- Hide unavailable actions (buttons, menu items)
- Display permission denied messages when appropriate
- Redirect to appropriate page if access denied

**Not Found Errors**:
- Display "Portfolio not found" message
- Provide navigation back to list page
- Handle deleted entities gracefully


## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

**Unit Tests**: Verify specific examples, edge cases, and error conditions
- Specific portfolio creation scenarios
- Integration points between components
- Edge cases (empty portfolios, single program, many programs)
- Error conditions (invalid IDs, permission failures)

**Property Tests**: Verify universal properties across all inputs
- Universal properties that hold for all inputs
- Comprehensive input coverage through randomization
- Minimum 100 iterations per property test

Together, unit tests catch concrete bugs while property tests verify general correctness.

### Backend Testing

#### Unit Tests

**Model Tests** (`backend/tests/unit/test_portfolio_model.py`):
- Portfolio creation with valid data
- Portfolio validation (date constraints)
- Audit field population
- Relationship loading (programs)

**Service Tests** (`backend/tests/unit/test_portfolio_service.py`):
- Create portfolio with valid data
- Create portfolio with invalid data (should raise ValueError)
- Update portfolio with partial data
- Delete portfolio without programs (should succeed)
- Delete portfolio with programs (should raise ValueError)
- List portfolios with pagination
- Get portfolio by ID (exists and not exists)

**Schema Tests** (`backend/tests/unit/test_portfolio_schemas.py`):
- PortfolioCreate validation
- PortfolioUpdate validation
- Date range validation
- Field length validation


#### Property-Based Tests

**Property Test Configuration**:
- Library: pytest with Hypothesis
- Minimum 100 iterations per test
- Each test tagged with: **Feature: portfolio-entity, Property {number}: {property_text}**

**Property Tests** (`backend/tests/unit/test_portfolio_properties.py`):

```python
# Feature: portfolio-entity, Property 1: Required Field Validation
@given(portfolio_data=portfolios_with_missing_fields())
def test_required_field_validation(portfolio_data):
    """For any Portfolio with missing required fields, creation should fail."""
    with pytest.raises(ValidationError):
        PortfolioCreate(**portfolio_data)

# Feature: portfolio-entity, Property 2: Program Portfolio Association Required
@given(program_data=programs_without_portfolio())
def test_program_requires_portfolio(program_data):
    """For any Program without portfolio_id, creation should fail."""
    with pytest.raises(ValidationError):
        ProgramCreate(**program_data)

# Feature: portfolio-entity, Property 3: Portfolio Reference Integrity
@given(program_data=programs_with_invalid_portfolio_id())
def test_portfolio_reference_integrity(db, program_data):
    """For any Program with non-existent portfolio_id, creation should fail."""
    with pytest.raises(IntegrityError):
        program_service.create_program(db, **program_data)

# Feature: portfolio-entity, Property 4: Portfolio Deletion Protection
@given(portfolio_with_programs=portfolios_with_programs())
def test_portfolio_deletion_protection(db, portfolio_with_programs):
    """For any Portfolio with Programs, deletion should fail."""
    portfolio = create_portfolio_with_programs(db, portfolio_with_programs)
    with pytest.raises(ValueError):
        portfolio_service.delete_portfolio(db, portfolio.id)

# Feature: portfolio-entity, Property 5: Portfolio-Program Relationship Query
@given(portfolio_with_programs=portfolios_with_programs())
def test_portfolio_program_relationship(db, portfolio_with_programs):
    """For any Portfolio, querying should return all associated Programs."""
    portfolio = create_portfolio_with_programs(db, portfolio_with_programs)
    retrieved = portfolio_service.get_portfolio(db, portfolio.id)
    assert len(retrieved.programs) == len(portfolio_with_programs['programs'])

# Feature: portfolio-entity, Property 6: Program-Portfolio Relationship Query
@given(program_data=valid_programs())
def test_program_portfolio_relationship(db, program_data):
    """For any Program, querying should return its Portfolio."""
    portfolio = create_portfolio(db)
    program = create_program(db, portfolio_id=portfolio.id, **program_data)
    retrieved = program_service.get_program(db, program.id)
    assert retrieved.portfolio.id == portfolio.id

# Feature: portfolio-entity, Property 7: API Validation Error Responses
@given(invalid_data=invalid_portfolio_data())
def test_api_validation_errors(client, invalid_data):
    """For any invalid Portfolio data, API should return 400."""
    response = client.post('/api/v1/portfolios', json=invalid_data)
    assert response.status_code == 400
```


#### Integration Tests

**API Integration Tests** (`backend/tests/integration/test_portfolio_api.py`):
- POST /api/v1/portfolios - create portfolio
- GET /api/v1/portfolios - list portfolios
- GET /api/v1/portfolios/{id} - get portfolio
- PUT /api/v1/portfolios/{id} - update portfolio
- DELETE /api/v1/portfolios/{id} - delete portfolio
- GET /api/v1/portfolios/{id}/programs - get portfolio programs
- Error cases: 404, 400, 409, 403

**Program-Portfolio Integration Tests** (`backend/tests/integration/test_program_portfolio.py`):
- Create program with valid portfolio_id
- Create program without portfolio_id (should fail)
- Create program with invalid portfolio_id (should fail)
- Update program's portfolio_id
- Query program and verify portfolio relationship

#### Migration Tests

**Migration Tests** (`backend/tests/unit/test_portfolio_migration.py`):
- Test migration creates portfolios table
- Test migration adds portfolio_id to programs table
- Test migration creates default portfolio
- Test migration assigns all programs to default portfolio
- Test migration is reversible (rollback)

### Frontend Testing

#### Component Tests

**Portfolio List Page Tests** (`frontend/src/pages/portfolios/PortfoliosListPage.test.tsx`):
- Renders portfolio list
- Displays search bar
- Displays "Create Portfolio" button (with permission)
- Hides "Create Portfolio" button (without permission)
- Filters portfolios by search term
- Navigates to detail page on row click
- Displays formatted dates

**Portfolio Detail Page Tests** (`frontend/src/pages/portfolios/PortfolioDetailPage.test.tsx`):
- Renders portfolio details in read-only mode
- Shows Edit button (with permission)
- Hides Edit button (without permission)
- Switches to edit mode on Edit click
- Shows Save/Cancel buttons in edit mode
- Validates form on save
- Reverts changes on cancel

**Portfolio Form Page Tests** (`frontend/src/pages/portfolios/PortfolioFormPage.test.tsx`):
- Renders form with all fields
- Validates required fields
- Validates date range
- Submits valid form
- Displays validation errors
- Displays API errors
- Navigates on cancel

**Program Form Tests** (`frontend/src/pages/programs/ProgramFormPage.test.tsx`):
- Renders portfolio dropdown
- Populates dropdown with portfolios
- Validates portfolio selection required
- Submits with portfolio_id

#### End-to-End Tests

**Portfolio CRUD E2E Tests** (`frontend/src/e2e/portfolio.test.tsx`):
- Complete flow: create → view → edit → delete
- Create portfolio and verify in list
- Edit portfolio and verify changes
- Delete portfolio without programs
- Attempt delete portfolio with programs (should fail)
- Create program with portfolio selection

### Test Coverage Goals

- Backend unit tests: >90% code coverage
- Backend integration tests: All API endpoints
- Frontend component tests: All user interactions
- Property-based tests: All identified properties
- E2E tests: Critical user workflows
