# Requirements Document

## Introduction

A comprehensive program and project management system that enables organizations to manage hierarchical programs and projects with detailed resource allocation, budget tracking, and cost forecasting capabilities. The system supports both labor and non-labor resources with flexible accounting treatments and provides robust audit trails for all data modifications.

## Glossary

- **System**: The program and project management system
- **Program**: A parent organizational unit that contains one or more projects
- **Project**: A work initiative that must be associated with exactly one parent program
- **Resource**: Either a labor resource (worker) or non-labor resource (contracts, hardware, etc.)
- **Worker**: A labor resource with specific attributes and rates
- **Resource_Assignment**: The allocation of a resource to a project for specific time periods
- **Worker_Type**: A categorization of workers with associated rate structures
- **Rate_Table**: Historical rate information for worker types with temporal validity
- **Budget**: Financial allocation for a program or project, split between capital and expense components
- **Actual**: Historical cost data for completed work
- **Forecast**: Projected future costs based on resource assignments
- **Execution_Phase**: The mandatory implementation phase of a project
- **Planning_Phase**: The optional preparatory phase that precedes execution
- **RBAC**: Role-Based Access Control system for authorization
- **Program_Scope**: Permission scope that grants role-based access to a specific program and all its projects
- **Project_Scope**: Permission scope that grants role-based access to a specific project only
- **Scope_Assignment**: The association of a user role with a specific program or project scope
- **Audit_Trail**: Historical record of all data modifications with user attribution

## Requirements

### Requirement 1

**User Story:** As a program manager, I want to create and manage programs with essential attributes, so that I can organize related projects under a common umbrella.

#### Acceptance Criteria

1. WHEN a user creates a program, THE System SHALL generate a unique program ID automatically
2. WHEN a user creates a program, THE System SHALL require name, business sponsor, program manager, technical lead, start date, and end date
3. WHEN a user updates program attributes, THE System SHALL validate all required fields are present
4. WHEN a user sets program dates, THE System SHALL ensure start date precedes end date
5. THE System SHALL allow multiple projects to be associated with the same parent program

### Requirement 2

**User Story:** As a project manager, I want to create and manage projects with comprehensive attributes, so that I can track project details and associate them with parent programs.

#### Acceptance Criteria

1. WHEN a user creates a project, THE System SHALL generate a unique project ID automatically
2. WHEN a user creates a project, THE System SHALL require association with exactly one parent program
3. WHEN a user creates a project, THE System SHALL require name, business sponsor, project manager, technical lead, start date, end date, budget, and cost center code
4. WHEN a user specifies project budget, THE System SHALL require capital and expense components that sum to total budget
5. WHEN a user updates budget components, THE System SHALL automatically recalculate total budget
6. THE System SHALL allow budget modification at any time during project lifecycle

### Requirement 3

**User Story:** As a resource manager, I want to assign resources to projects with specific time periods and allocation percentages, so that I can plan resource utilization effectively.

#### Acceptance Criteria

1. WHEN a user assigns a resource to a project, THE System SHALL require whole day periods with percentage allocation
2. WHEN a user assigns a resource, THE System SHALL prevent total allocation exceeding 100% on any given day
3. WHEN calculating resource conflicts, THE System SHALL consider assignments across all projects for the same resource
4. WHEN a user imports resource assignments via file, THE System SHALL apply the same validation rules as manual entry
5. THE System SHALL support both labor and non-labor resource types in assignments

### Requirement 4

**User Story:** As an accounting manager, I want to specify capital/expense treatment for resource assignments, so that I can properly categorize costs for financial reporting.

#### Acceptance Criteria

1. WHEN a user assigns a resource to a project, THE System SHALL allow specification of capital/expense percentage split
2. WHEN storing accounting treatment, THE System SHALL associate the split with the resource assignment, not the resource itself
3. WHEN a resource is assigned to multiple projects, THE System SHALL allow different accounting treatments per assignment
4. THE System SHALL ensure capital and expense percentages sum to 100% for each resource assignment
5. THE System SHALL support both labor and non-labor resources having accounting treatment specifications

### Requirement 5

**User Story:** As an HR administrator, I want to manage worker information and types, so that I can maintain accurate labor resource data.

#### Acceptance Criteria

1. WHEN a user creates a worker, THE System SHALL generate a unique worker ID automatically
2. WHEN a user creates a worker, THE System SHALL require external ID, name, and worker type
3. WHEN a user creates a worker type, THE System SHALL generate a unique worker type ID automatically
4. WHEN a user creates a worker type, THE System SHALL require type name and description
5. THE System SHALL allow flexible configuration of worker types without predefined limitations

### Requirement 6

**User Story:** As a finance manager, I want to maintain historical rate information for worker types, so that I can accurately calculate costs across different time periods.

#### Acceptance Criteria

1. WHEN a user creates a new rate, THE System SHALL require worker type, rate amount, and start date
2. WHEN a user creates an initial rate, THE System SHALL set end date to infinity representation
3. WHEN a user updates a rate, THE System SHALL close the previous rate record with an end date
4. WHEN a user updates a rate, THE System SHALL create a new rate record starting on the same date
5. THE System SHALL maintain complete historical rate information without data loss

### Requirement 7

**User Story:** As a compliance officer, I want comprehensive audit trails for all data modifications, so that I can track changes and ensure accountability.

#### Acceptance Criteria

1. WHEN any user modifies data, THE System SHALL record the specific column changed
2. WHEN any user modifies data, THE System SHALL capture before and after values
3. WHEN any user modifies data, THE System SHALL timestamp the modification
4. WHEN any user modifies data, THE System SHALL record the user ID of the person making the change
5. THE System SHALL require user authentication before allowing any data modifications

### Requirement 8

**User Story:** As a financial analyst, I want dynamic cost forecasting capabilities, so that I can analyze budget vs actual vs forecast across programs and projects.

#### Acceptance Criteria

1. WHEN calculating project costs, THE System SHALL compute total forecast based on all resource assignments
2. WHEN generating cost breakdowns, THE System SHALL separate capital and expense components
3. WHEN incorporating actuals data, THE System SHALL accept manual entry and file import methods
4. WHEN forecasting costs, THE System SHALL combine historical actuals with future resource assignments
5. THE System SHALL provide real-time budget vs actual vs forecast reporting

### Requirement 9

**User Story:** As a project manager, I want to manage both planning and execution phases with separate budgets, so that I can track costs across the complete project lifecycle.

#### Acceptance Criteria

1. WHEN a user creates a project, THE System SHALL require a mandatory execution phase with its own budget
2. WHEN a user adds a planning phase, THE System SHALL allow optional planning phase with separate budget
3. WHEN managing project phases, THE System SHALL ensure planning phase temporally precedes execution phase
4. WHEN displaying project information, THE System SHALL share common attributes across both phases
5. THE System SHALL maintain separate budget tracking for planning and execution phases

### Requirement 10

**User Story:** As a system administrator, I want role-based access control with appropriate scopes, so that I can ensure users only access authorized data and functions.

#### Acceptance Criteria

1. WHEN implementing API endpoints, THE System SHALL annotate all endpoints with required roles and permissions
2. WHEN controlling database access, THE System SHALL enforce role-based restrictions on all operations
3. WHEN applying access scopes, THE System SHALL support program-level and project-level scope restrictions
4. WHEN a user attempts unauthorized access, THE System SHALL deny the request and log the attempt
5. THE System SHALL provide flexible role and permission configuration capabilities

### Requirement 11

**User Story:** As a system administrator, I want to assign role-based permissions with program-level or project-level scopes, so that I can grant users appropriate access to specific organizational units without exposing unrelated data.

#### Acceptance Criteria

1. WHEN assigning a user role with program scope, THE System SHALL grant the user role-based permissions to the specified program and all projects within that program
2. WHEN assigning a user role with project scope, THE System SHALL grant the user role-based permissions to the specified project only
3. WHEN a user has program-level scope, THE System SHALL automatically include access to any new projects created within that program
4. WHEN a user has multiple scope assignments, THE System SHALL combine all permissions and provide access to the union of all scoped entities
5. WHEN displaying data to a scoped user, THE System SHALL filter all lists, reports, and searches to show only entities within the user's assigned scope
6. WHEN a scoped user attempts to access entities outside their scope, THE System SHALL deny access and return appropriate authorization errors
7. THE System SHALL allow administrators to assign multiple scope combinations to a single user (e.g., program scope for Program A plus project scope for specific projects in Program B)
