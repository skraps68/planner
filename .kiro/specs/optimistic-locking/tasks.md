# Implementation Plan: Optimistic Locking Concurrency Control

## Overview

This implementation plan breaks down the optimistic locking feature into discrete coding tasks. The approach follows a layered implementation: database models → schemas → API error handling → service layer → bulk operations → frontend integration → comprehensive testing.

## Tasks

- [x] 1. Create database migration for version columns
  - Create Alembic migration to add version column to all 13 user-editable entity tables
  - Set version as INTEGER NOT NULL DEFAULT 1
  - Initialize existing rows with version=1
  - Ensure migration works on both PostgreSQL and SQLite
  - Create down migration for rollback
  - _Requirements: 1.1, 5.1, 5.2, 5.3, 5.4_

- [x] 1.1 Write unit tests for migration
  - Test migration adds version column to all tables
  - Test existing data gets version=1
  - Test column constraints (NOT NULL, DEFAULT 1)
  - Test migration rollback
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [x] 2. Create VersionedMixin for SQLAlchemy models
  - [x] 2.1 Implement VersionedMixin with version_id_col
    - Create mixin class with version column
    - Configure SQLAlchemy's version_id_col feature
    - Add to app/models/mixins.py or similar
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.2 Apply VersionedMixin to all 13 user-editable models
    - Update Portfolio, Program, Project, ProjectPhase models
    - Update Resource, WorkerType, Worker, ResourceAssignment models
    - Update Rate, Actual, User, UserRole, ScopeAssignment models
    - _Requirements: 1.1_
  
  - [x] 2.3 Write property test for version initialization
    - **Property 1: New Entity Version Initialization**
    - **Validates: Requirements 1.2**
  
  - [x] 2.4 Write property test for version increment
    - **Property 2: Version Increment on Update**
    - **Validates: Requirements 1.3**
  
  - [x] 2.5 Write property test for cross-database compatibility
    - **Property 10: Cross-Database Compatibility**
    - **Validates: Requirements 1.5**

- [x] 3. Update Pydantic schemas to include version field
  - [x] 3.1 Create VersionedSchema base class
    - Add version field to base schema
    - Make version required in update schemas
    - Include version in response schemas
    - _Requirements: 2.1, 3.1_
  
  - [x] 3.2 Update all entity schemas to inherit from VersionedSchema
    - Update Portfolio, Program, Project, ProjectPhase schemas
    - Update Resource, WorkerType, Worker, ResourceAssignment schemas
    - Update Rate, Actual, User, UserRole, ScopeAssignment schemas
    - Ensure version is in Update and Response schemas
    - _Requirements: 3.1, 3.2, 3.3, 3.4_
  
  - [x] 3.3 Write property test for version in API responses
    - **Property 6: Version Included in All API Responses**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
  
  - [x] 3.4 Write property test for version required in updates
    - **Property 3: Version Required in Update Requests**
    - **Validates: Requirements 2.1**

- [x] 4. Implement API error handling for version conflicts
  - [x] 4.1 Create ConflictError exception class
    - Define ConflictError with 409 status code
    - Include entity type, ID, and current state in error detail
    - Add user-friendly error message
    - Add to app/core/exceptions.py
    - _Requirements: 2.4, 4.1, 4.2, 4.4, 4.5_
  
  - [x] 4.2 Add StaleDataError handling to all update endpoints
    - Catch StaleDataError in Portfolio, Program, Project, ProjectPhase endpoints
    - Catch StaleDataError in Resource, WorkerType, Worker, ResourceAssignment endpoints
    - Catch StaleDataError in Rate, Actual, User, UserRole, ScopeAssignment endpoints
    - Fetch current entity state and raise ConflictError
    - _Requirements: 2.4, 4.1_
  
  - [x] 4.3 Write property test for conflict detection
    - **Property 5: Conflict Detection on Version Mismatch**
    - **Validates: Requirements 2.3, 2.4, 4.1, 7.1, 7.2**
  
  - [x] 4.4 Write property test for conflict response structure
    - **Property 7: Conflict Response Structure**
    - **Validates: Requirements 4.2, 4.4, 4.5**
  
  - [x] 4.5 Write unit tests for error handling
    - Test 409 response format
    - Test current state included in response
    - Test error message clarity
    - _Requirements: 4.1, 4.2, 4.4, 4.5_

- [x] 5. Update service layer to handle versions
  - [x] 5.1 Update service methods to exclude version from manual updates
    - Modify update methods to skip version field (SQLAlchemy manages it)
    - Ensure version is not manually set in service layer
    - Update Portfolio, Program, Project, ProjectPhase services
    - Update Resource, WorkerType, Worker, ResourceAssignment services
    - Update Rate, Actual, User, UserRole, ScopeAssignment services
    - _Requirements: 1.3_
  
  - [x] 5.2 Write property test for successful update with matching version
    - **Property 4: Successful Update with Matching Version**
    - **Validates: Requirements 2.2**
  
  - [x] 5.3 Write unit tests for service layer version handling
    - Test version is not manually modified
    - Test StaleDataError propagates correctly
    - _Requirements: 1.3, 2.3_

- [x] 6. Implement bulk update handling for Resource Assignments
  - [x] 6.1 Create bulk update endpoint for Resource Assignments
    - Accept list of ResourceAssignmentUpdate objects
    - Process each update individually
    - Track succeeded and failed updates separately
    - Return BulkUpdateResult with succeeded/failed lists
    - _Requirements: 7.3, 7.5_
  
  - [x] 6.2 Implement partial success response structure
    - Define BulkUpdateResult schema
    - Include succeeded list with IDs and new versions
    - Include failed list with IDs, error type, and current state
    - _Requirements: 7.5_
  
  - [x] 6.3 Write property test for bulk update individual validation
    - **Property 8: Bulk Update Individual Validation**
    - **Validates: Requirements 7.3, 7.5**
  
  - [x] 6.4 Write integration tests for bulk operations
    - Test mixed valid/invalid versions in bulk update
    - Test partial success scenarios
    - Test all failures scenario
    - _Requirements: 7.3, 7.5_

- [x] 7. Add conflict logging
  - [x] 7.1 Implement conflict logging in error handlers
    - Log entity type, entity ID, expected version, actual version
    - Log user ID who attempted the update
    - Ensure no sensitive data is logged
    - Use structured logging with extra fields
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [x] 7.2 Write property test for conflict logging
    - **Property 9: Conflict Logging**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
  
  - [x] 7.3 Write unit tests for logging
    - Test log contains required fields
    - Test sensitive data is excluded
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 8. Checkpoint - Run all backend tests
  - Run migration and verify schema changes
  - Run all property tests (minimum 100 iterations each)
  - Run all unit tests
  - Run all integration tests
  - Verify tests pass on both PostgreSQL and SQLite
  - Ensure all tests pass, ask the user if questions arise

- [x] 9. Update frontend API client to handle versions
  - [x] 9.1 Update TypeScript interfaces to include version field
    - Add version: number to all entity interfaces
    - Update Portfolio, Program, Project, ProjectPhase interfaces
    - Update Resource, WorkerType, Worker, ResourceAssignment interfaces
    - Update Rate, Actual, User, UserRole, ScopeAssignment interfaces
    - _Requirements: 3.1_
  
  - [x] 9.2 Update API client methods to send version with updates
    - Modify update functions to include version in request payload
    - Update all entity API client methods
    - _Requirements: 2.1_
  
  - [x] 9.3 Write unit tests for API client version handling
    - Test version is included in update requests
    - Test version is stored from responses
    - _Requirements: 2.1, 3.1_

- [x] 10. Implement frontend conflict handling UI
  - [x] 10.1 Create ConflictDialog component
    - Display user-friendly error message
    - Show comparison between attempted changes and current state
    - Provide "Refresh & Retry" and "Cancel" buttons
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 10.2 Add conflict error handling to all entity forms
    - Catch 409 responses in Portfolio, Program, Project, ProjectPhase forms
    - Catch 409 responses in Resource, WorkerType, Worker, ResourceAssignment forms
    - Catch 409 responses in Rate, Actual, User, UserRole, ScopeAssignment forms
    - Show ConflictDialog on conflict
    - _Requirements: 6.1_
  
  - [x] 10.3 Implement refresh and retry logic
    - Reload entity on "Refresh & Retry"
    - Pre-fill form with user's attempted changes
    - Update version to current version
    - _Requirements: 6.4_
  
  - [x] 10.4 Ensure no silent retries
    - Verify failed updates are not automatically retried
    - Require user acknowledgment before retry
    - _Requirements: 6.5_
  
  - [x] 10.5 Write component tests for conflict handling
    - Test ConflictDialog displays on 409 response
    - Test current state is shown
    - Test refresh and retry flow
    - Test no automatic retry
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 11. Update Resource Assignment Calendar for bulk conflicts
  - [x] 11.1 Handle bulk update conflict responses
    - Parse BulkUpdateResult response
    - Display which assignments succeeded and which failed
    - Show conflict details for failed assignments
    - _Requirements: 7.5_
  
  - [x] 11.2 Implement partial success UI feedback
    - Show success message for succeeded assignments
    - Show conflict dialog for failed assignments
    - Allow user to retry only failed assignments
    - _Requirements: 7.5_
  
  - [x] 11.3 Write integration tests for calendar bulk conflicts
    - Test bulk update with mixed success/failure
    - Test UI displays partial success correctly
    - Test retry of failed assignments
    - _Requirements: 7.3, 7.5_

- [x] 12. Final checkpoint - End-to-end testing
  - [x] 12.1 Run full test suite
    - Run all backend tests (unit, property, integration)
    - Run all frontend tests (unit, component, integration)
    - Verify tests pass on both PostgreSQL and SQLite
  
  - [x] 12.2 Manual testing of concurrent scenarios
    - Test two users editing same portfolio simultaneously
    - Test bulk Resource Assignment updates with conflicts
    - Test conflict resolution UI flow
    - Verify no silent data loss occurs
  
  - [x] 12.3 Verify backwards compatibility
    - Test with existing data (version=1)
    - Verify migration completed successfully
    - Test rollback scenario
  
  - Ensure all tests pass, ask the user if questions arise

- [x] 13. Documentation and deployment preparation
  - [x] 13.1 Update API documentation
    - Document version field in all entity schemas
    - Document 409 Conflict response format
    - Add examples of conflict handling
    - _Requirements: 3.5_
  
  - [x] 13.2 Create deployment guide
    - Document migration steps
    - Document rollback procedure
    - Document monitoring for conflict frequency
    - Note: No downtime required for deployment
  
  - [x] 13.3 Update user documentation
    - Explain what happens when conflicts occur
    - Provide guidance on resolving conflicts
    - Add screenshots of conflict dialog

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties with minimum 100 iterations
- Unit tests validate specific examples and edge cases
- All tests must pass on both PostgreSQL and SQLite
- Migration is backwards compatible (existing data gets version=1)
- No application downtime required for deployment
