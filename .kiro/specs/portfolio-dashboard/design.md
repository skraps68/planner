# Design Document: Portfolio Dashboard

## Overview

The Portfolio Dashboard is a React-based frontend feature that provides a comprehensive financial overview of programs and projects. It serves as the default landing page, replacing the current generic dashboard. The feature leverages existing backend forecast APIs (`/reports/forecast/program/{program_id}` and `/reports/forecast/project/{project_id}`) to display financial metrics in a structured 3x5 table format with interactive filtering capabilities.

The design follows the existing application patterns using React, TypeScript, Material-UI, React Query for data fetching, and React Router for navigation.

## Architecture

### Component Hierarchy

```
PortfolioDashboardPage (Container)
├── FilterSection (Presentation)
│   ├── ProgramDropdown (Controlled)
│   └── ProjectDropdown (Controlled)
├── FinancialSummaryTable (Presentation)
└── ChartSection (Placeholder)
```

### Data Flow

1. User selects a program from ProgramDropdown
2. PortfolioDashboardPage updates state and triggers API call
3. ProjectDropdown populates with filtered projects
4. User optionally selects a project
5. PortfolioDashboardPage triggers appropriate API call (program or project level)
6. FinancialSummaryTable receives data and renders financial metrics

### Technology Stack

- **Frontend Framework**: React 18+ with TypeScript
- **UI Library**: Material-UI (MUI) v5
- **State Management**: React hooks (useState, useEffect) + React Query for server state
- **Routing**: React Router v6
- **HTTP Client**: Axios (via existing API layer)
- **Data Fetching**: TanStack React Query (existing pattern)

## Components and Interfaces

### 1. PortfolioDashboardPage Component

**Purpose**: Main container component managing state and orchestrating child components.

**State**:
```typescript
interface PortfolioDashboardState {
  selectedProgramId: string | null
  selectedProjectId: string | null
}
```

**Props**: None (top-level route component)

**Responsibilities**:
- Manage program and project selection state
- Fetch programs list on mount
- Fetch projects list when program is selected
- Fetch financial data based on selection
- Pass data and callbacks to child components

**API Calls**:
- `GET /api/v1/programs` - Fetch all programs
- `GET /api/v1/projects?program_id={id}` - Fetch projects for selected program
- `GET /api/v1/reports/forecast/program/{program_id}?as_of_date={today}` - Program-level forecast
- `GET /api/v1/reports/forecast/project/{project_id}?as_of_date={today}` - Project-level forecast

### 2. FilterSection Component

**Purpose**: Render program and project dropdown filters.

**Props**:
```typescript
interface FilterSectionProps {
  programs: Program[]
  projects: Project[]
  selectedProgramId: string | null
  selectedProjectId: string | null
  onProgramChange: (programId: string | null) => void
  onProjectChange: (projectId: string | null) => void
  programsLoading: boolean
  projectsLoading: boolean
}
```

**Layout**: Horizontal flex container with two dropdowns side-by-side.

**Behavior**:
- Program dropdown always enabled (if programs loaded)
- Project dropdown disabled when no program selected
- Project dropdown shows only projects from selected program

### 3. FinancialSummaryTable Component

**Purpose**: Display 3x5 grid of financial metrics.

**Props**:
```typescript
interface FinancialSummaryTableProps {
  data: ForecastData | null
  loading: boolean
  error: Error | null
}

interface ForecastData {
  budget: CategoryBreakdown
  actual: CategoryBreakdown
  forecast: CategoryBreakdown
  current_forecast: CategoryBreakdown  // Computed: actual + forecast
  variance: CategoryBreakdown          // Computed: budget - current_forecast
}

interface CategoryBreakdown {
  total: number
  capital: number
  expense: number
}
```

**Table Structure**:
```
           Budget  |  Actuals  +  Forecast  =  Current Forecast  |  Variance
Total      $X      |  $Y       +  $Z        =  $Y+Z             |  $X-(Y+Z)
Capital    $X      |  $Y       +  $Z        =  $Y+Z             |  $X-(Y+Z)
Expense    $X      |  $Y       +  $Z        =  $Y+Z             |  $X-(Y+Z)
```

**Rendering Logic**:
- Display empty/placeholder values when `data` is null
- Show loading spinner when `loading` is true
- Display error message when `error` is present
- Format currency values with thousand separators and 2 decimal places
- Highlight negative variance values in red

### 4. ChartSection Component

**Purpose**: Placeholder for future chart implementation.

**Props**: None initially

**Rendering**: Display a placeholder message or empty state component.

## Data Models

### Program Model (Existing)
```typescript
interface Program {
  id: string
  name: string
  description?: string
  start_date: string
  end_date?: string
  status: string
}
```

### Project Model (Existing)
```typescript
interface Project {
  id: string
  name: string
  program_id: string
  description?: string
  start_date: string
  end_date?: string
  status: string
}
```

### API Response Model (from backend)
```typescript
interface ForecastApiResponse {
  entity_id: string
  entity_name: string
  entity_type: "project" | "program"
  budget: {
    total: number
    capital: number
    expense: number
  }
  actual: {
    total: number
    capital: number
    expense: number
  }
  forecast: {
    total: number
    capital: number
    expense: number
  }
  analysis: {
    budget_remaining: number
    forecast_variance: number
    budget_utilization_percentage: number
    forecast_to_budget_percentage: number
  }
}
```

### Transformed Data Model (for UI)
```typescript
interface FinancialTableData {
  budget: CategoryBreakdown
  actuals: CategoryBreakdown
  forecast: CategoryBreakdown
  currentForecast: CategoryBreakdown  // Computed
  variance: CategoryBreakdown          // Computed
}

interface CategoryBreakdown {
  total: number
  capital: number
  expense: number
}
```

**Transformation Logic**:
```typescript
function transformForecastData(apiResponse: ForecastApiResponse): FinancialTableData {
  const { budget, actual, forecast } = apiResponse
  
  const currentForecast = {
    total: actual.total + forecast.total,
    capital: actual.capital + forecast.capital,
    expense: actual.expense + forecast.expense
  }
  
  const variance = {
    total: budget.total - currentForecast.total,
    capital: budget.capital - currentForecast.capital,
    expense: budget.expense - currentForecast.expense
  }
  
  return {
    budget,
    actuals: actual,
    forecast,
    currentForecast,
    variance
  }
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Program Dropdown Population
*For any* set of programs returned by the API, the Program dropdown should contain all programs from that set.
**Validates: Requirements 2.4**

### Property 2: Project Filtering by Program
*For any* selected program and any set of projects, the Project dropdown should display only projects where `project.program_id` equals the selected program's ID.
**Validates: Requirements 2.5**

### Property 3: Program-Level API Call
*For any* program selection without a project selection, the system should call `/reports/forecast/program/{program_id}` with the selected program's ID.
**Validates: Requirements 2.6, 6.1**

### Property 4: Project-Level API Call
*For any* program and project selection, the system should call `/reports/forecast/project/{project_id}` with the selected project's ID.
**Validates: Requirements 2.7, 6.2**

### Property 5: Current Forecast Calculation
*For any* actuals value A and forecast value F, the current forecast should equal A + F for each category (total, capital, expense).
**Validates: Requirements 4.4**

### Property 6: Variance Calculation
*For any* budget value B and current forecast value CF, the variance should equal B - CF for each category (total, capital, expense).
**Validates: Requirements 4.5**

### Property 7: API Date Parameter
*For any* forecast API call (program or project level), the `as_of_date` parameter should be set to today's date in ISO format (YYYY-MM-DD).
**Validates: Requirements 6.3**

### Property 8: Data Transformation Correctness
*For any* valid ForecastApiResponse, the transformation function should produce a FinancialTableData object where:
- budget values match the API response budget values
- actuals values match the API response actual values
- forecast values match the API response forecast values
- currentForecast values equal actuals + forecast for each category
- variance values equal budget - currentForecast for each category
**Validates: Requirements 6.4**

### Property 9: Financial Data Display
*For any* FinancialTableData object, the table should render:
- Total row displaying the total values for each column
- Capital row displaying the capital values for each column
- Expense row displaying the expense values for each column
**Validates: Requirements 3.7, 5.1, 5.2, 5.3**

### Property 10: Currency Formatting Consistency
*For any* numeric value in the financial table, the formatted output should:
- Include thousand separators (e.g., 1,000,000)
- Display exactly two decimal places (e.g., 1,234.56)
- Prefix negative values with a minus sign or apply distinct styling
- Apply the same formatting function to all cells
**Validates: Requirements 7.1, 7.2, 7.3, 7.4**

### Property 11: Error Handling
*For any* API error response, the system should display an error message to the user and not crash.
**Validates: Requirements 6.5**

## Error Handling

### API Error Scenarios

1. **Network Errors**: Display user-friendly message "Unable to connect to server. Please check your connection."
2. **404 Not Found**: Display "The requested program/project was not found."
3. **403 Forbidden**: Display "You don't have permission to view this data."
4. **500 Server Error**: Display "An error occurred while loading data. Please try again."
5. **Timeout**: Display "Request timed out. Please try again."

### Error Handling Strategy

- Use React Query's error handling capabilities
- Display errors using Material-UI Alert component
- Provide retry mechanism for transient errors
- Log errors to console for debugging
- Maintain UI stability (no crashes) when errors occur

### Validation

- Validate program and project IDs before API calls
- Handle empty response data gracefully
- Validate numeric values before calculations
- Handle null/undefined values in data transformation

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests** focus on:
- Specific examples of component rendering
- Edge cases (empty data, null values)
- User interaction flows (clicking dropdowns, selecting items)
- Error states and error message display
- Initial component state

**Property-Based Tests** focus on:
- Universal properties that hold for all inputs
- Data transformation correctness across random inputs
- Calculation accuracy (current forecast, variance) for any values
- Currency formatting consistency for any numeric values
- API call correctness for any program/project selection

### Property-Based Testing Configuration

- **Library**: fast-check (JavaScript/TypeScript property-based testing library)
- **Minimum Iterations**: 100 runs per property test
- **Tag Format**: Each test must include a comment: `// Feature: portfolio-dashboard, Property {number}: {property_text}`

### Test Coverage Requirements

**Component Tests** (Unit):
1. PortfolioDashboardPage renders without crashing
2. FilterSection displays two dropdowns on load
3. Project dropdown is disabled when no program selected
4. FinancialSummaryTable displays 3x5 grid structure
5. Table displays correct column headers in order
6. Table displays correct row labels in order
7. Table displays '+' and '=' symbols in correct positions
8. ChartSection displays placeholder message
9. Error messages display when API calls fail
10. Loading states display correctly

**Property Tests**:
1. Property 1: Program dropdown population (Requirements 2.4)
2. Property 2: Project filtering (Requirements 2.5)
3. Property 3: Program-level API calls (Requirements 2.6, 6.1)
4. Property 4: Project-level API calls (Requirements 2.7, 6.2)
5. Property 5: Current forecast calculation (Requirements 4.4)
6. Property 6: Variance calculation (Requirements 4.5)
7. Property 7: API date parameter (Requirements 6.3)
8. Property 8: Data transformation (Requirements 6.4)
9. Property 9: Financial data display (Requirements 3.7, 5.1, 5.2, 5.3)
10. Property 10: Currency formatting (Requirements 7.1, 7.2, 7.3, 7.4)
11. Property 11: Error handling (Requirements 6.5)

### Integration Tests

- Test complete user flow: select program → view data → select project → view data
- Test navigation from other pages to Portfolio Dashboard
- Test that Portfolio Dashboard is default landing page
- Test API integration with real backend (in integration test environment)

### Testing Tools

- **Unit Testing**: Jest + React Testing Library
- **Property Testing**: fast-check
- **API Mocking**: MSW (Mock Service Worker)
- **Component Testing**: React Testing Library
- **E2E Testing**: Playwright (optional, for critical user flows)
