# Implementation Plan: Resource Assignment Data Model Refactoring

## Overview

This implementation plan breaks down the refactoring of the ResourceAssignment data model into discrete, incremental steps. The approach follows a bottom-up strategy: database → backend → frontend, ensuring each layer is complete and tested before moving to the next.

## Tasks

- [x] 1. Create database migration
  - Create Alembic migration script to remove allocation_percentage column and update constraints
  - Include both upgrade and downgrade logic
  - Test migration on empty database
  - Test migration on database with existing data
  - _Requirements: 1.1, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 1.1 Write unit tests for migration
  - Test migration executes successfully on empty database
  - Test migration executes successfully with existing data
  - Test migration preserves capital and expense values
  - Test downgrade restores allocation_percentage correctly
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [x] 2. Update database model
  - [x] 2.1 Remove allocation_percentage field from ResourceAssignment model
    - Remove column definition
    - Update __table_args__ to remove check_accounting_split constraint
    - Add new check_allocation_sum constraint (capital + expense <= 100)
    - Update __repr__ method if it references allocation_percentage
    - _Requirements: 1.2, 2.1, 2.2, 2.3_

  - [x] 2.2 Write property test for percentage range constraints
    - **Property 1: Percentage Range Constraints**
    - **Validates: Requirements 2.1, 2.2**

  - [x] 2.3 Write property test for single assignment sum constraint
    - **Property 2: Single Assignment Sum Constraint**
    - **Validates: Requirements 2.3**

- [x] 3. Update Pydantic schemas
  - [x] 3.1 Remove allocation_percentage from ResourceAssignmentBase
    - Remove field definition
    - Update validate_accounting_split to validate_allocation_sum
    - Change validation from "= 100" to "<= 100"
    - _Requirements: 1.3, 2.4, 2.5, 2.6_

  - [x] 3.2 Remove allocation_percentage from ResourceAssignmentCreate
    - Verify inheritance from ResourceAssignmentBase is correct
    - _Requirements: 1.4_

  - [x] 3.3 Remove allocation_percentage from ResourceAssignmentUpdate
    - Remove field definition
    - Update validator to check <= 100 instead of = 100
    - _Requirements: 1.5_

  - [x] 3.4 Remove allocation_percentage from ResourceAssignmentResponse
    - Verify inheritance from ResourceAssignmentBase is correct
    - _Requirements: 1.6_

  - [x] 3.5 Remove allocation_percentage from AssignmentImportRow
    - Remove field definition
    - Update validator
    - _Requirements: 1.7_

  - [x] 3.6 Write unit tests for schema validation
    - Test that allocation_percentage is not accepted in requests
    - Test that capital + expense > 100 is rejected
    - Test that negative percentages are rejected
    - Test that percentages > 100 are rejected
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 4. Update repository layer
  - [x] 4.1 Remove validate_accounting_split method from ResourceAssignmentRepository
    - Delete method entirely
    - _Requirements: 5.6_

  - [x] 4.2 Remove validate_allocation_limit method from ResourceAssignmentRepository
    - Delete method entirely (logic moves to service layer)
    - _Requirements: 5.6_

  - [x] 4.3 Remove get_total_allocation_for_date method from ResourceAssignmentRepository
    - Delete method entirely (logic moves to service layer)
    - _Requirements: 5.6_

- [x] 5. Update service layer
  - [x] 5.1 Add _validate_cross_project_allocation method to AssignmentService
    - Implement cross-project validation logic
    - Query all assignments for resource+date
    - Calculate total allocation across projects
    - Return (is_valid, error_message) tuple
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 5.2, 5.4_

  - [x] 5.2 Update create_assignment method in AssignmentService
    - Remove allocation_percentage parameter
    - Remove allocation_percentage from assignment_data dict
    - Remove validate_accounting_split call
    - Remove validate_allocation_limit call
    - Add single assignment constraint validation (capital + expense <= 100)
    - Add call to _validate_cross_project_allocation
    - _Requirements: 5.1, 5.2, 5.5_

  - [x] 5.3 Update update_assignment method in AssignmentService
    - Remove allocation_percentage parameter
    - Remove allocation_percentage from update_data dict
    - Remove validate_accounting_split call
    - Remove validate_allocation_limit call
    - Add single assignment constraint validation
    - Add call to _validate_cross_project_allocation with exclude_assignment_id
    - _Requirements: 5.3, 5.4, 5.5_

  - [x] 5.4 Update import_assignments method in AssignmentService
    - Remove allocation_percentage from CSV parsing
    - Update create_assignment calls to not include allocation_percentage
    - _Requirements: 5.1_

  - [x] 5.5 Write property test for cross-project allocation constraint
    - **Property 3: Cross-Project Allocation Constraint**
    - **Validates: Requirements 3.1, 3.2**

  - [x] 5.6 Write property test for update exclusion
    - **Property 4: Update Exclusion**
    - **Validates: Requirements 3.4**

  - [x] 5.7 Write unit tests for service layer
    - Test cross-project validation with specific scenarios
    - Test that validation excludes current assignment during updates
    - Test error messages contain expected information
    - _Requirements: 3.3, 3.4, 5.2, 5.4_

- [x] 6. Checkpoint - Ensure backend tests pass
  - Run all backend unit tests
  - Run all backend property tests
  - Run all backend integration tests
  - Ensure all tests pass, ask the user if questions arise

- [x] 7. Update API endpoints
  - [x] 7.1 Update assignments API endpoint request handling
    - Verify create endpoint doesn't require allocation_percentage
    - Verify update endpoint doesn't require allocation_percentage
    - Verify endpoints ignore allocation_percentage if provided
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 7.2 Update assignments API endpoint response handling
    - Verify responses don't include allocation_percentage
    - _Requirements: 4.3_

  - [x] 7.3 Write integration tests for API endpoints
    - Test create without allocation_percentage succeeds
    - Test update without allocation_percentage succeeds
    - Test cross-project validation errors are returned correctly
    - Test error messages are descriptive
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [x] 8. Update frontend TypeScript types
  - [x] 8.1 Remove allocation_percentage from ResourceAssignment interface
    - Update interface definition in types file
    - _Requirements: 6.4_

  - [x] 8.2 Remove allocation_percentage from ResourceAssignmentCreate interface
    - Update interface definition
    - _Requirements: 6.2_

  - [x] 8.3 Remove allocation_percentage from ResourceAssignmentUpdate interface
    - Update interface definition
    - _Requirements: 6.2_

- [x] 9. Update frontend validation utilities
  - [x] 9.1 Update validateCellEdit function in cellValidation.ts
    - Add API call to get all assignments for resource+date across all projects
    - Calculate total allocation across all projects
    - Validate single assignment constraint (capital + expense <= 100)
    - Validate cross-project constraint (total <= 100)
    - Return descriptive error messages
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [x] 9.2 Write property test for validateCellEdit
    - Test that validation correctly calculates totals across projects
    - Test that validation returns errors when constraints violated
    - _Requirements: 7.2, 7.3_

  - [x] 9.3 Write unit tests for validation utilities
    - Test validateCellEdit queries all projects
    - Test validateCellEdit excludes current project correctly
    - Test error messages are descriptive
    - _Requirements: 7.1, 7.4, 7.5_

- [x] 10. Update ResourceAssignmentCalendar component
  - [x] 10.1 Remove allocation_percentage calculation from save logic
    - Remove line: `const allocationPercentage = capitalPercentage + expensePercentage`
    - Update API calls to not include allocation_percentage
    - _Requirements: 6.1, 6.2, 6.5_

  - [x] 10.2 Update create assignment API calls
    - Remove allocation_percentage from request payload
    - _Requirements: 6.2, 6.5_

  - [x] 10.3 Update update assignment API calls
    - Remove allocation_percentage from request payload
    - _Requirements: 6.2, 6.5_

  - [x] 10.4 Write unit tests for calendar component
    - Test that API calls don't include allocation_percentage
    - Test that validation errors are displayed correctly
    - Test that save operations send correct data structure
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Update API client (assignments.ts)
  - [x] 11.1 Add getByResourceAndDate method to assignmentsApi
    - Implement method to query assignments by resource and date
    - Used by frontend validation
    - _Requirements: 7.1_

  - [x] 11.2 Verify create and update methods don't send allocation_percentage
    - Review method implementations
    - Remove allocation_percentage from request payloads if present
    - _Requirements: 6.2_

- [x] 12. Checkpoint - Ensure frontend tests pass
  - Run all frontend unit tests
  - Run all frontend component tests
  - Run all frontend integration tests
  - Ensure all tests pass, ask the user if questions arise

- [x] 13. Update test fixtures and factories
  - [x] 13.1 Remove allocation_percentage from backend test fixtures
    - Update all test data factories
    - Update all test fixtures
    - _Requirements: 9.5, 9.6_

  - [x] 13.2 Remove allocation_percentage from frontend test fixtures
    - Update all mock data
    - Update all test fixtures
    - _Requirements: 9.4, 9.5_

- [x] 14. Run database migration
  - [x] 14.1 Run migration on local development database
    - Execute migration
    - Verify schema changes
    - Test application functionality
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 14.2 Prepare migration documentation
    - Document migration steps
    - Document rollback procedure
    - Document validation steps
    - _Requirements: 10.4, 10.5_

- [x] 15. Final integration testing
  - [x] 15.1 Test end-to-end create assignment flow
    - Create assignment through UI
    - Verify data saved correctly
    - Verify validation works
    - _Requirements: 3.1, 6.1, 6.2, 6.5_

  - [x] 15.2 Test end-to-end update assignment flow
    - Update assignment through UI
    - Verify data updated correctly
    - Verify validation works
    - _Requirements: 3.2, 6.1, 6.2, 6.5_

  - [x] 15.3 Test cross-project validation scenarios
    - Create assignments across multiple projects
    - Verify validation prevents over-allocation
    - Verify error messages are clear
    - _Requirements: 3.1, 3.2, 3.3, 6.3, 7.3_

  - [x] 15.4 Test migration rollback
    - Run migration downgrade
    - Verify allocation_percentage restored
    - Verify old constraints restored
    - _Requirements: 8.6_

- [x] 16. Final checkpoint - Ensure all tests pass
  - Run complete test suite (backend + frontend)
  - Verify all property tests pass (100+ iterations each)
  - Verify all unit tests pass
  - Verify all integration tests pass
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- This is a breaking change - backend and frontend must be deployed together
- Migration includes rollback capability for safety
- Cross-project validation may impact performance for resources with many projects - consider adding database index
