# Requirements Document: User-Definable Project Phases

## Introduction

This feature transforms project phases from a fixed, predefined concept (Planning/Execution) into a flexible, user-definable timeline management system. Phases become customizable date ranges that must form a continuous, non-overlapping timeline spanning the entire project duration. By removing the explicit phase reference from resource assignments and relying on date-based implicit relationships, we eliminate data synchronization issues and provide users with greater flexibility in organizing their projects.

## Glossary

- **Phase**: A user-defined date range within a project timeline with a unique name, start date, and end date
- **Default Phase**: The initial phase automatically created when a new project is created, spanning the project's entire duration
- **Continuous Timeline**: A requirement that all phases must collectively cover every date from project start to project end without gaps
- **Non-Overlapping**: A constraint that no two phases can have overlapping date ranges
- **Implicit Phase Relationship**: The automatic association of resource assignments to phases based on assignment date falling within phase date range
- **Phase Editor**: A dedicated UI component for managing phases with validation of timeline continuity
- **Phase Validation**: The process of ensuring phases form a valid continuous timeline before saving changes

## Requirements

### Requirement 1: Remove Predefined Phase Types

**User Story:** As a system administrator, I want to remove the hardcoded phase types (Planning/Execution) so that users can define their own phase structure.

#### Acceptance Criteria

1. THE System SHALL remove the `phase_type` enum field from the ProjectPhase model
2. THE System SHALL add a `name` field (string, required) to the ProjectPhase model
3. THE System SHALL add `start_date` field (date, required) to the ProjectPhase model
4. THE System SHALL add `end_date` field (date, required) to the ProjectPhase model
5. THE System SHALL maintain the existing `project_id`, `capital_budget`, `expense_budget`, and `total_budget` fields
6. THE System SHALL ensure each phase has a unique ID for internal reference
7. THE System SHALL ensure a phase can only be associated with a single project

### Requirement 2: Automatic Default Phase Creation

**User Story:** As a user, I want a default phase automatically created when I create a new project, so that the project has complete phase coverage from the start.

#### Acceptance Criteria

1. WHEN a new project is created, THE System SHALL automatically create a default phase
2. THE default phase SHALL be named "Default Phase"
3. THE default phase start_date SHALL equal the project start_date
4. THE default phase end_date SHALL equal the project end_date
5. THE default phase SHALL have budget values of zero (0) for capital_budget, expense_budget, and total_budget
6. IF the project dates are updated and only the default phase exists, THE System SHALL automatically update the default phase dates to match

### Requirement 3: Phase Timeline Continuity Validation

**User Story:** As a user, I want the system to ensure my phases form a continuous timeline, so that every date in my project is covered by exactly one phase.

#### Acceptance Criteria

1. THE System SHALL validate that all phases collectively span from project start_date to project end_date
2. THE System SHALL validate that no gaps exist between phases
3. THE System SHALL validate that no two phases overlap
4. THE System SHALL validate that phase start_date is less than or equal to phase end_date
5. THE System SHALL validate that phase start_date is greater than or equal to project start_date
6. THE System SHALL validate that phase end_date is less than or equal to project end_date
7. IF validation fails, THE System SHALL prevent the save operation and display specific error messages
8. THE System SHALL perform validation before any phase create, update, or delete operation

### Requirement 4: Phase Management UI

**User Story:** As a user, I want a dedicated interface for managing project phases, so that I can easily add, edit, and delete phases while maintaining timeline continuity.

#### Acceptance Criteria

1. THE System SHALL provide a Phase Editor interface accessible from the project detail page
2. THE Phase Editor SHALL display all phases for the selected project in chronological order
3. THE Phase Editor SHALL display each phase's name, start date, end date, and budget information
4. THE Phase Editor SHALL provide an "Add Phase" button to create new phases
5. THE Phase Editor SHALL provide "Edit" and "Delete" buttons for each phase
6. THE Phase Editor SHALL visually indicate the project timeline and phase coverage
7. THE Phase Editor SHALL display validation errors inline when timeline continuity is violated
8. THE Phase Editor SHALL prevent saving changes until all validation rules are satisfied

### Requirement 5: Phase CRUD Operations

**User Story:** As a user, I want to create, read, update, and delete phases, so that I can organize my project timeline according to my needs.

#### Acceptance Criteria

1. WHEN creating a phase, THE System SHALL require name, start_date, and end_date
2. WHEN creating a phase, THE System SHALL allow optional capital_budget, expense_budget, and total_budget
3. WHEN updating a phase, THE System SHALL allow modification of name, dates, and budgets
4. WHEN deleting a phase, THE System SHALL prevent deletion if it would create a gap in the timeline
5. WHEN deleting a phase, THE System SHALL allow deletion if remaining phases still form a continuous timeline
6. THE System SHALL prevent deletion of the last remaining phase
7. THE System SHALL provide appropriate error messages for invalid operations

### Requirement 6: Remove Phase Reference from Resource Assignments

**User Story:** As a developer, I want to remove the explicit phase_id reference from resource assignments, so that phase relationships are determined implicitly by date.

#### Acceptance Criteria

1. THE System SHALL remove the `project_phase_id` field from the ResourceAssignment model
2. THE System SHALL determine phase association by comparing assignment_date with phase date ranges
3. WHEN querying assignments by phase, THE System SHALL filter where assignment_date is between phase start_date and end_date
4. THE System SHALL maintain all other ResourceAssignment fields (resource_id, project_id, assignment_date, allocation_percentage, capital_percentage, expense_percentage)
5. THE System SHALL update all existing queries and reports to use date-based phase filtering

### Requirement 7: Database Migration

**User Story:** As a system administrator, I want a safe migration path from the old phase model to the new model, so that existing data is preserved.

#### Acceptance Criteria

1. THE System SHALL provide a database migration script to transform existing data
2. THE migration SHALL convert existing Planning phases to user-defined phases with name "Planning"
3. THE migration SHALL convert existing Execution phases to user-defined phases with name "Execution"
4. THE migration SHALL preserve all budget data during migration
5. THE migration SHALL remove the project_phase_id foreign key from resource_assignments table
6. THE migration SHALL verify data integrity after migration
7. THE migration SHALL be reversible (provide a rollback script)

### Requirement 8: Phase-Based Budget Reporting

**User Story:** As a user, I want to see budget information aggregated by phase, so that I can understand financial allocation across my project timeline.

#### Acceptance Criteria

1. THE System SHALL provide an API endpoint to retrieve phases with budget information
2. THE System SHALL calculate actual costs per phase based on assignment dates
3. THE System SHALL calculate forecast costs per phase based on future assignment dates
4. THE System SHALL display phase-level budget vs actual vs forecast in reports
5. THE System SHALL aggregate phase budgets to show project-level totals

### Requirement 9: Phase Validation Rules

**User Story:** As a user, I want clear validation rules for phases, so that I understand what constitutes a valid phase configuration.

#### Acceptance Criteria

1. THE System SHALL enforce that phase name is not empty and has maximum length of 100 characters
2. THE System SHALL enforce that start_date is a valid date
3. THE System SHALL enforce that end_date is a valid date
4. THE System SHALL enforce that start_date <= end_date
5. THE System SHALL enforce that phase dates fall within project dates
6. THE System SHALL enforce that phases do not overlap
7. THE System SHALL enforce that phases form a continuous timeline
8. THE System SHALL provide specific error messages for each validation failure

### Requirement 10: Phase Timeline Visualization

**User Story:** As a user, I want to visualize the phase timeline, so that I can easily understand how my project is divided.

#### Acceptance Criteria

1. THE Phase Editor SHALL display a visual timeline showing all phases
2. THE timeline SHALL use different colors for different phases
3. THE timeline SHALL show phase names and date ranges
4. THE timeline SHALL highlight gaps or overlaps if validation fails
5. THE timeline SHALL be interactive, allowing drag-to-resize phase boundaries
6. WHEN resizing a phase, THE System SHALL automatically adjust adjacent phases to maintain continuity
7. THE timeline SHALL display the project start and end dates as boundaries

## Non-Functional Requirements

### Performance
- Phase validation SHALL complete within 100ms for projects with up to 50 phases
- Phase queries SHALL return results within 200ms

### Usability
- Phase Editor SHALL provide intuitive drag-and-drop interface for phase management
- Validation errors SHALL be displayed inline with specific guidance

### Data Integrity
- Phase operations SHALL be atomic (all-or-nothing)
- System SHALL prevent orphaned resource assignments

### Backward Compatibility
- Migration SHALL preserve all existing budget and assignment data
- API endpoints SHALL maintain backward compatibility where possible
