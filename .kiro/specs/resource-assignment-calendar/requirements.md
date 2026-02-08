# Requirements Document: Resource Assignment Calendar View

## Introduction

This feature transforms the assignments table in the Project Detail Page into a calendar-style view that displays resource allocations over time. The calendar view provides a visual representation of how resources are allocated across project dates, with separate rows for Capital and Expense cost treatments.

## Glossary

- **Resource**: A worker or team member that can be assigned to project work
- **Assignment**: An allocation of a resource to a project on a specific date with a percentage allocation
- **Capital_Percentage**: The percentage of an assignment's allocation that is capitalized
- **Expense_Percentage**: The percentage of an assignment's allocation that is expensed
- **Cost_Treatment**: The categorization of costs as either Capital or Expense
- **Calendar_Grid**: A 2D grid structure displaying resources in rows and dates in columns
- **Sticky_Column**: A fixed column that remains visible during horizontal scrolling
- **Assignment_Date**: A specific date on which a resource has an allocation
- **Date_Range**: The span from project start_date to end_date

## Requirements

### Requirement 1: Calendar Grid Layout

**User Story:** As a project manager, I want to view resource assignments in a calendar format, so that I can visualize allocations over time.

#### Acceptance Criteria

1. THE Calendar_Grid SHALL display resources in rows and dates in columns
2. WHEN the calendar is rendered, THE System SHALL create a sticky first column containing resource names
3. WHEN the calendar is rendered, THE System SHALL create date columns spanning from project start_date to end_date
4. THE System SHALL display two rows per resource: one for Capital allocations and one for Expense allocations
5. WHEN a user scrolls horizontally, THE System SHALL keep the resource name column fixed while date columns scroll

### Requirement 2: Resource Row Structure

**User Story:** As a project manager, I want to see Capital and Expense allocations separately for each resource, so that I can understand cost treatment distribution.

#### Acceptance Criteria

1. FOR each resource in the assignment data, THE System SHALL create exactly two rows
2. THE System SHALL label the first row with the resource name and "Capital" indicator
3. THE System SHALL label the second row with the resource name and "Expense" indicator
4. THE System SHALL visually distinguish Capital rows from Expense rows
5. THE System SHALL group Capital and Expense rows for the same resource together

### Requirement 3: Date Column Generation

**User Story:** As a project manager, I want to see all dates in my project timeline, so that I can identify gaps and patterns in resource allocation.

#### Acceptance Criteria

1. WHEN generating date columns, THE System SHALL use the project start_date as the first column
2. WHEN generating date columns, THE System SHALL use the project end_date as the last column
3. THE System SHALL generate one column for each date in the date range
4. THE System SHALL format date column headers consistently
5. WHEN the project has no start_date or end_date, THE System SHALL display an appropriate empty state

### Requirement 4: Assignment Data Display

**User Story:** As a project manager, I want to see allocation percentages in calendar cells, so that I can understand resource utilization on specific dates.

#### Acceptance Criteria

1. WHEN an assignment exists for a resource on a date, THE System SHALL display the capital_percentage in the Capital row cell
2. WHEN an assignment exists for a resource on a date, THE System SHALL display the expense_percentage in the Expense row cell
3. WHEN no assignment exists for a resource on a date, THE System SHALL display an empty cell
4. THE System SHALL format percentage values consistently
5. THE System SHALL handle zero percentage values by displaying "0%" or leaving the cell empty

### Requirement 5: Data Transformation

**User Story:** As a developer, I want to transform flat assignment data into a grid structure, so that the calendar view can render efficiently.

#### Acceptance Criteria

1. WHEN assignment data is received, THE System SHALL transform the flat list into a 2D grid structure
2. THE System SHALL map each assignment to the correct resource row based on resource_id
3. THE System SHALL map each assignment to the correct date column based on assignment_date
4. THE System SHALL separate capital_percentage and expense_percentage into different rows
5. THE System SHALL handle assignments with missing or null percentage values

### Requirement 6: Data Source Integration

**User Story:** As a developer, I want to use the existing assignments API, so that the calendar view integrates seamlessly with current data flows.

#### Acceptance Criteria

1. THE System SHALL fetch assignment data using assignmentsApi.getByProject(projectId)
2. THE System SHALL extract resource_id, resource_name, assignment_date, capital_percentage, and expense_percentage from each assignment
3. WHEN the API call fails, THE System SHALL display an error message
4. WHEN the API returns no assignments, THE System SHALL display an empty state
5. THE System SHALL handle loading states while fetching assignment data

### Requirement 7: Visual Styling and Consistency

**User Story:** As a user, I want the calendar view to match the existing application design, so that the interface feels cohesive.

#### Acceptance Criteria

1. THE System SHALL apply consistent table header styling with #A5C1D8 background color
2. THE System SHALL apply bold text to column headers
3. THE System SHALL apply consistent cell borders and spacing
4. THE System SHALL ensure text is readable against all background colors
5. THE System SHALL maintain visual consistency with other table components in the application

### Requirement 8: Performance and Scalability

**User Story:** As a project manager with long-running projects, I want the calendar view to load quickly, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN rendering large date ranges, THE System SHALL maintain responsive performance
2. THE System SHALL implement efficient data structures for grid lookups
3. THE System SHALL avoid unnecessary re-renders when scrolling
4. WHEN the date range exceeds 365 days, THE System SHALL still render within 2 seconds
5. THE System SHALL handle up to 100 resources without performance degradation

### Requirement 9: Empty State Handling

**User Story:** As a user, I want clear feedback when there is no data to display, so that I understand the system state.

#### Acceptance Criteria

1. WHEN there are no assignments for the project, THE System SHALL display a message indicating no assignments exist
2. WHEN there are no resources in the assignment data, THE System SHALL display a message indicating no resources are assigned
3. WHEN the project has no start_date or end_date, THE System SHALL display a message indicating dates are required
4. THE System SHALL provide actionable guidance in empty state messages
5. THE System SHALL style empty state messages consistently with the application

### Requirement 10: Horizontal Scrolling Behavior

**User Story:** As a user viewing a long project timeline, I want smooth horizontal scrolling, so that I can navigate through dates easily.

#### Acceptance Criteria

1. WHEN the date columns exceed viewport width, THE System SHALL enable horizontal scrolling
2. WHEN scrolling horizontally, THE System SHALL keep the resource name column visible
3. THE System SHALL provide smooth scrolling without jank or lag
4. THE System SHALL maintain scroll position when data updates
5. THE System SHALL indicate when more content is available off-screen

### Requirement 11: Edit Mode Toggle

**User Story:** As a project manager with edit permissions, I want to switch between read-only and edit modes, so that I can modify resource assignments when needed.

#### Acceptance Criteria

1. THE System SHALL display the calendar in read-only mode by default
2. THE System SHALL display an "Edit" button in the top right of the calendar view
3. WHEN a user clicks the "Edit" button, THE System SHALL check if the user has edit permissions
4. WHEN a user has edit permissions and clicks "Edit", THE System SHALL enable edit mode for all calendar cells
5. WHEN a user does not have edit permissions, THE System SHALL disable the "Edit" button or display an appropriate message

### Requirement 12: Cell Editing

**User Story:** As a project manager, I want to edit allocation percentages directly in calendar cells, so that I can quickly adjust resource assignments.

#### Acceptance Criteria

1. WHEN edit mode is enabled, THE System SHALL make calendar cells editable
2. WHEN a user clicks on a cell, THE System SHALL allow the user to input a percentage value
3. THE System SHALL accept numeric input for percentage values
4. THE System SHALL validate that percentage values are between 0 and 100
5. WHEN a user enters an invalid value, THE System SHALL display an error message and prevent the change

### Requirement 13: Cell-Level Validation

**User Story:** As a project manager, I want immediate feedback when I enter invalid allocations, so that I can correct errors quickly.

#### Acceptance Criteria

1. WHEN a user completes editing a cell by pressing Enter, THE System SHALL validate the entered value
2. WHEN a user completes editing a cell by pressing Tab, THE System SHALL validate the entered value
3. WHEN a user completes editing a cell by clicking outside the cell, THE System SHALL validate the entered value
4. THE System SHALL check that the resource is not allocated more than 100% on the given date across all projects and cost treatments
5. WHEN validation fails, THE System SHALL display an error message indicating the total allocation percentage and which projects contribute to the over-allocation

### Requirement 14: Save and Cancel Operations

**User Story:** As a project manager, I want to save or discard my changes, so that I have control over when edits are persisted.

#### Acceptance Criteria

1. WHEN edit mode is enabled, THE System SHALL display a "Save" button
2. WHEN edit mode is enabled, THE System SHALL display a "Cancel" button
3. WHEN a user clicks "Save", THE System SHALL validate all modified cells
4. WHEN all validations pass, THE System SHALL persist changes to the database via the assignments API
5. WHEN a user clicks "Cancel", THE System SHALL discard all unsaved changes and return to read-only mode

### Requirement 15: Cross-Project Allocation Validation

**User Story:** As a system administrator, I want to ensure resources are not over-allocated across projects, so that resource planning remains realistic.

#### Acceptance Criteria

1. WHEN validating an assignment change, THE System SHALL query all assignments for the resource on the given date across all projects
2. THE System SHALL sum capital_percentage and expense_percentage for the resource on the date
3. WHEN the total allocation exceeds 100%, THE System SHALL reject the change
4. THE System SHALL provide detailed feedback showing the breakdown of allocations by project
5. THE System SHALL perform this validation both at cell-level (on blur/tab/enter) and at save-time

### Requirement 16: Permission-Based Access Control

**User Story:** As a system administrator, I want to control who can edit assignments, so that data integrity is maintained.

#### Acceptance Criteria

1. THE System SHALL check user permissions before enabling edit mode
2. THE System SHALL verify edit permissions on the server side when saving changes
3. WHEN a user without edit permissions attempts to save, THE System SHALL reject the request with an appropriate error message
4. THE System SHALL display the "Edit" button only to users with appropriate permissions
5. THE System SHALL handle permission checks gracefully without exposing sensitive information

### Requirement 17: Optimistic UI Updates

**User Story:** As a user editing assignments, I want the interface to feel responsive, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN a user edits a cell value, THE System SHALL update the UI immediately
2. WHEN validation fails, THE System SHALL revert the cell to its previous value
3. WHEN saving changes, THE System SHALL show a loading indicator
4. WHEN save succeeds, THE System SHALL display a success message
5. WHEN save fails, THE System SHALL display an error message and allow the user to retry
