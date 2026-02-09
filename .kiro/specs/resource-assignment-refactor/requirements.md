# Requirements Document: Resource Assignment Data Model Refactoring

## Introduction

This specification defines the requirements for refactoring the ResourceAssignment data model to eliminate the `allocation_percentage` field and change the conceptual model for capital and expense percentages. Currently, `capital_percentage` and `expense_percentage` represent portions of an allocation (must sum to 100%). The new model treats these as independent time allocations where the sum across all projects for a resource on a given day must not exceed 100%.

## Glossary

- **Resource**: A person or entity that can be assigned to work on projects
- **ResourceAssignment**: A record representing a resource's allocation to a project on a specific date
- **Capital_Percentage**: Percentage of a resource's time on a given day allocated to capital work (0-100%)
- **Expense_Percentage**: Percentage of a resource's time on a given day allocated to expense work (0-100%)
- **Allocation_Percentage**: (DEPRECATED) Total allocation percentage - to be removed
- **Cross_Project_Validation**: Validation logic that ensures a resource's total time allocation across all projects on a given day does not exceed 100%
- **Assignment_Date**: The specific date for which a resource assignment applies
- **Database_Migration**: A versioned script that modifies the database schema

## Requirements

### Requirement 1: Remove Allocation Percentage Field

**User Story:** As a system architect, I want to remove the allocation_percentage field from the data model, so that the system reflects the new conceptual model where capital and expense percentages represent direct time allocations.

#### Acceptance Criteria

1. THE Database_Migration SHALL remove the allocation_percentage column from the resource_assignments table
2. THE ResourceAssignment_Model SHALL not include an allocation_percentage field
3. THE ResourceAssignmentBase_Schema SHALL not include an allocation_percentage field
4. THE ResourceAssignmentCreate_Schema SHALL not include an allocation_percentage field
5. THE ResourceAssignmentUpdate_Schema SHALL not include an allocation_percentage field
6. THE ResourceAssignmentResponse_Schema SHALL not include an allocation_percentage field
7. THE AssignmentImportRow_Schema SHALL not include an allocation_percentage field

### Requirement 2: Update Field Constraints

**User Story:** As a developer, I want the capital_percentage and expense_percentage fields to have independent 0-100% constraints with a combined limit, so that they can represent direct time allocations that don't exceed 100% within a single assignment.

#### Acceptance Criteria

1. THE ResourceAssignment_Model SHALL enforce capital_percentage >= 0 AND capital_percentage <= 100
2. THE ResourceAssignment_Model SHALL enforce expense_percentage >= 0 AND expense_percentage <= 100
3. THE ResourceAssignment_Model SHALL enforce capital_percentage + expense_percentage <= 100
4. THE ResourceAssignmentBase_Schema SHALL validate capital_percentage is between 0 and 100
5. THE ResourceAssignmentBase_Schema SHALL validate expense_percentage is between 0 and 100
6. THE ResourceAssignmentBase_Schema SHALL validate that capital_percentage + expense_percentage <= 100

### Requirement 3: Implement Cross-Project Validation

**User Story:** As a project manager, I want the system to prevent over-allocation of resources across projects, so that a resource cannot be assigned more than 100% of their time on any given day.

#### Acceptance Criteria

1. WHEN creating a new ResourceAssignment THEN THE System SHALL validate that the sum of (capital_percentage + expense_percentage) across all projects for that resource on that date does not exceed 100
2. WHEN updating an existing ResourceAssignment THEN THE System SHALL validate that the sum of (capital_percentage + expense_percentage) across all projects for that resource on that date does not exceed 100
3. IF the cross-project validation fails THEN THE System SHALL return a descriptive error message indicating the current total allocation and the attempted allocation
4. THE Validation_Logic SHALL exclude the current assignment being updated when calculating the total allocation
5. THE Validation_Logic SHALL include all projects when calculating the total allocation for a resource on a date

### Requirement 4: Update API Request/Response Schemas

**User Story:** As an API consumer, I want the API to not require or return allocation_percentage, so that I can work with the new data model.

#### Acceptance Criteria

1. THE ResourceAssignmentCreate_Endpoint SHALL NOT accept allocation_percentage in request body
2. THE ResourceAssignmentUpdate_Endpoint SHALL NOT accept allocation_percentage in request body
3. THE ResourceAssignmentResponse_Endpoint SHALL NOT return allocation_percentage in response body
4. THE AssignmentImport_Endpoint SHALL NOT accept allocation_percentage in import rows
5. WHEN an API request includes allocation_percentage THEN THE System SHALL ignore the field without error

### Requirement 5: Update Service Layer Logic

**User Story:** As a developer, I want the service layer to use the new validation logic, so that business rules are consistently enforced.

#### Acceptance Criteria

1. THE AssignmentService.create_assignment SHALL NOT calculate or set allocation_percentage
2. THE AssignmentService.create_assignment SHALL call the new cross-project validation logic
3. THE AssignmentService.update_assignment SHALL NOT calculate or set allocation_percentage
4. THE AssignmentService.update_assignment SHALL call the new cross-project validation logic
5. THE AssignmentService SHALL remove the validate_accounting_split method calls
6. THE ResourceAssignmentRepository SHALL implement a new method to calculate total allocation across projects for a resource on a date

### Requirement 6: Update Frontend Calendar Component

**User Story:** As a user, I want the resource assignment calendar to work with the new data model, so that I can assign resources without dealing with allocation_percentage.

#### Acceptance Criteria

1. THE ResourceAssignmentCalendar SHALL NOT calculate allocation_percentage when saving assignments
2. THE ResourceAssignmentCalendar SHALL send only capital_percentage and expense_percentage to the API
3. THE ResourceAssignmentCalendar SHALL display validation errors from cross-project validation
4. THE ResourceAssignmentCalendar SHALL NOT display or edit allocation_percentage values
5. WHEN saving cell edits THEN THE Calendar SHALL group edits by resource and date and send capital_percentage and expense_percentage without allocation_percentage

### Requirement 7: Update Validation Utilities

**User Story:** As a developer, I want the frontend validation utilities to implement cross-project validation, so that users receive immediate feedback about over-allocation.

#### Acceptance Criteria

1. THE validateCellEdit_Function SHALL query all assignments for a resource on a date across all projects
2. THE validateCellEdit_Function SHALL calculate the sum of (capital_percentage + expense_percentage) across all projects
3. THE validateCellEdit_Function SHALL return an error if the total exceeds 100%
4. THE validateCellEdit_Function SHALL exclude the current project when calculating totals for updates
5. THE validateCellEdit_Function SHALL provide a descriptive error message showing current allocation and attempted allocation

### Requirement 8: Maintain Data Integrity During Migration

**User Story:** As a database administrator, I want the migration to preserve existing data, so that no assignment information is lost during the refactoring.

#### Acceptance Criteria

1. THE Database_Migration SHALL execute successfully on databases with existing resource_assignments data
2. THE Database_Migration SHALL NOT delete or modify capital_percentage values
3. THE Database_Migration SHALL NOT delete or modify expense_percentage values
4. THE Database_Migration SHALL drop the allocation_percentage column
5. THE Database_Migration SHALL drop the check_accounting_split constraint
6. THE Database_Migration SHALL be reversible (include downgrade logic)

### Requirement 9: Update All Tests

**User Story:** As a developer, I want all tests to reflect the new data model, so that the test suite validates the correct behavior.

#### Acceptance Criteria

1. THE Unit_Tests SHALL NOT reference allocation_percentage
2. THE Integration_Tests SHALL NOT send allocation_percentage in API requests
3. THE Property_Tests SHALL validate cross-project allocation constraints
4. THE Frontend_Tests SHALL NOT test allocation_percentage calculations
5. THE Test_Fixtures SHALL NOT include allocation_percentage values
6. WHEN tests create ResourceAssignments THEN they SHALL only provide capital_percentage and expense_percentage

### Requirement 10: Update Documentation

**User Story:** As a developer, I want documentation to reflect the new data model, so that I understand how to use the system correctly.

#### Acceptance Criteria

1. THE API_Documentation SHALL describe the new validation rules
2. THE API_Documentation SHALL NOT reference allocation_percentage
3. THE Schema_Documentation SHALL explain that capital_percentage and expense_percentage are independent time allocations
4. THE Migration_Guide SHALL explain the changes and their impact
5. THE Migration_Guide SHALL provide examples of the new validation behavior
