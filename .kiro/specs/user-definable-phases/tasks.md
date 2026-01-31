# Implementation Plan: User-Definable Project Phases

## Overview

This implementation transforms project phases from a fixed enum-based system to a flexible, user-definable timeline management system. The implementation follows a careful migration strategy to preserve existing data while introducing new capabilities.

## Tasks

- [x] 1. Create database migration for phase model transformation
  - Create Alembic migration script to add new fields (name, start_date, end_date, description)
  - Add migration logic to convert existing Planning/Execution phases to user-defined phases
  - Add migration logic to remove project_phase_id from resource_assignments
  - Include rollback logic for safe migration reversal
  - Add verification queries to ensure data integrity post-migration
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 6.1, 7.1, 7.2, 7.3, 7.4, 7.5, 7.7_

- [x] 1.1 Write unit tests for migration data transformation
  - Test Planning phase conversion
  - Test Execution phase conversion
  - Test budget preservation
  - Test rollback functionality
  - _Requirements: 7.2, 7.3, 7.4_

- [x] 2. Update ProjectPhase model and schemas
  - [x] 2.1 Update ProjectPhase SQLAlchemy model
    - Remove phase_type enum field
    - Add name, start_date, end_date, description fields
    - Update constraints and indexes
    - Remove resource_assignments relationship
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  
  - [x] 2.2 Create new phase Pydantic schemas
    - Create PhaseBase, PhaseCreate, PhaseUpdate, PhaseResponse schemas
    - Add field validators for dates and budgets
    - Create PhaseValidationRequest, PhaseValidationError, PhaseValidationResult schemas
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [x] 2.3 Update ResourceAssignment model
    - Remove project_phase_id foreign key field
    - Remove project_phase relationship
    - Update model documentation
    - _Requirements: 6.1, 6.4_

- [x] 3. Implement phase validation service
  - [x] 3.1 Create PhaseValidatorService class
    - Implement validate_phase_timeline method
    - Implement validate_single_phase method
    - Implement find_timeline_gaps method
    - Implement find_timeline_overlaps method
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.8, 9.4, 9.5, 9.6, 9.7_
  
  - [x] 3.2 Write property test for timeline continuity validation
    - **Property 3: Timeline Continuity**
    - **Validates: Requirements 3.1, 3.2, 9.7**
  
  - [x] 3.3 Write property test for no overlaps validation
    - **Property 4: No Phase Overlaps**
    - **Validates: Requirements 3.3, 9.6**
  
  - [x] 3.4 Write property test for phase date ordering
    - **Property 5: Phase Date Ordering**
    - **Validates: Requirements 3.4, 9.4**
  
  - [x] 3.5 Write property test for phase boundary constraints
    - **Property 6: Phase Boundary Constraints**
    - **Validates: Requirements 3.5, 3.6, 9.5**
  
  - [x] 3.6 Write unit tests for validation edge cases
    - Test gap detection with multiple gaps
    - Test overlap detection with multiple overlaps
    - Test boundary violations
    - Test empty phase list
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 4. Checkpoint - Ensure validation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement phase service layer
  - [x] 5.1 Create PhaseService class
    - Implement create_phase with validation
    - Implement update_phase with validation
    - Implement delete_phase with validation
    - Implement create_default_phase
    - Implement get_phase_for_date
    - Implement get_assignments_for_phase
    - _Requirements: 2.1, 2.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 6.2, 6.3_
  
  - [x] 5.2 Write property test for default phase creation
    - **Property 1: Default Phase Creation**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  
  - [x] 5.3 Write property test for default phase date synchronization
    - **Property 2: Default Phase Date Synchronization**
    - **Validates: Requirements 2.6**
  
  - [x] 5.4 Write property test for validation rejection
    - **Property 7: Validation Rejection**
    - **Validates: Requirements 3.7**
  
  - [x] 5.5 Write property test for required phase fields
    - **Property 12: Required Phase Fields**
    - **Validates: Requirements 5.1**
  
  - [x] 5.6 Write property test for phase update flexibility
    - **Property 13: Phase Update Flexibility**
    - **Validates: Requirements 5.3**
  
  - [x] 5.7 Write property test for gap-creating deletion prevention
    - **Property 14: Gap-Creating Deletion Prevention**
    - **Validates: Requirements 5.4**
  
  - [x] 5.8 Write property test for valid deletion allowance
    - **Property 15: Valid Deletion Allowance**
    - **Validates: Requirements 5.5**
  
  - [x] 5.9 Write property test for date-based phase association
    - **Property 16: Date-Based Phase Association**
    - **Validates: Requirements 6.2, 6.3**
  
  - [x] 5.10 Write unit tests for phase service operations
    - Test create phase success and failure cases
    - Test update phase success and failure cases
    - Test delete phase success and failure cases
    - Test last phase deletion prevention
    - Test default phase creation on project creation
    - _Requirements: 2.1, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6_


- [x] 6. Update project service to create default phase
  - Modify project creation logic to automatically create default phase
  - Modify project update logic to sync default phase dates when only default exists
  - Update project repository methods as needed
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 6.1 Write integration tests for project-phase creation
  - Test that new projects have default phase
  - Test default phase properties
  - Test project date updates sync to default phase
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6_

- [x] 7. Create phase API endpoints
  - [x] 7.1 Create phases router and endpoints
    - Implement POST /projects/{project_id}/phases (create phase)
    - Implement GET /projects/{project_id}/phases (list phases)
    - Implement GET /phases/{phase_id} (get phase)
    - Implement PUT /phases/{phase_id} (update phase)
    - Implement DELETE /phases/{phase_id} (delete phase)
    - Implement POST /projects/{project_id}/phases/validate (validate phases)
    - Implement GET /phases/{phase_id}/assignments (get phase assignments)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3, 8.1_
  
  - [x] 7.2 Add error handling to phase endpoints
    - Handle ValidationError with 422 status
    - Handle NotFoundError with 404 status
    - Handle database errors with 500 status
    - Return structured error responses
    - _Requirements: 3.7, 5.7, 9.8_
  
  - [x] 7.3 Register phase router in main API
    - Add phases router to API v1
    - Update API documentation
    - _Requirements: 8.1_
  
  - [x] 7.4 Write integration tests for phase API endpoints
    - Test create phase endpoint (success and validation failures)
    - Test list phases endpoint
    - Test get phase endpoint
    - Test update phase endpoint (success and validation failures)
    - Test delete phase endpoint (success and validation failures)
    - Test validate phases endpoint
    - Test get phase assignments endpoint
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.2, 6.3_

- [x] 8. Checkpoint - Ensure backend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 9. Update reporting and query services for date-based phase filtering
  - [x] 9.1 Update forecast service to use date-based phase queries
    - Modify queries to filter assignments by date range instead of phase_id
    - Update phase cost calculation logic
    - Update phase forecast calculation logic
    - _Requirements: 6.2, 6.3, 6.5, 8.2, 8.3_
  
  - [x] 9.2 Update reports service to use date-based phase filtering
    - Update budget vs actual reports to use date-based filtering
    - Update phase-level aggregations
    - Update project-level aggregations from phases
    - _Requirements: 6.5, 8.4, 8.5_
  
  - [x] 9.3 Write property test for phase cost calculation
    - **Property 17: Phase Cost Calculation**
    - **Validates: Requirements 8.2**
  
  - [x] 9.4 Write property test for phase forecast calculation
    - **Property 18: Phase Forecast Calculation**
    - **Validates: Requirements 8.3**
  
  - [x] 9.5 Write property test for phase budget aggregation
    - **Property 19: Phase Budget Aggregation**
    - **Validates: Requirements 8.5**
  
  - [x] 9.6 Write unit tests for updated query logic
    - Test get_phase_for_date with various dates
    - Test get_assignments_for_phase with various date ranges
    - Test phase cost calculations
    - Test phase forecast calculations
    - _Requirements: 6.2, 6.3, 8.2, 8.3, 8.5_

- [x] 10. Create Phase Editor frontend component
  - [x] 10.1 Create PhaseEditor component
    - Implement phase list display with sorting
    - Implement add phase functionality
    - Implement edit phase functionality
    - Implement delete phase functionality
    - Implement validation error display
    - Implement save/cancel actions
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_
  
  - [x] 10.2 Create PhaseTimeline visualization component
    - Implement timeline rendering with phase bars
    - Implement color coding for phases
    - Display phase names and date ranges
    - Highlight validation issues (gaps/overlaps)
    - Display project boundaries
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.7_
  
  - [x] 10.3 Create PhaseList table component
    - Display phases in table format
    - Show all phase fields (name, description, dates, budgets)
    - Implement inline editing
    - Implement row actions (edit, delete)
    - _Requirements: 4.2, 4.3, 4.4, 4.5_
  
  - [x] 10.4 Implement phase validation in frontend
    - Create client-side validation logic
    - Validate timeline continuity
    - Validate date constraints
    - Validate required fields
    - Display validation errors inline
    - Disable save button when errors exist
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 4.7, 4.8, 9.1, 9.4, 9.5, 9.6, 9.7_
  
  - [x] 10.5 Write property test for phase display ordering
    - **Property 8: Phase Display Ordering**
    - **Validates: Requirements 4.2**
  
  - [x] 10.6 Write property test for phase display completeness
    - **Property 9: Phase Display Completeness**
    - **Validates: Requirements 4.3, 10.3**
  
  - [x] 10.7 Write property test for validation error display
    - **Property 10: Validation Error Display**
    - **Validates: Requirements 4.7**
  
  - [x] 10.8 Write property test for save button state
    - **Property 11: Save Button State**
    - **Validates: Requirements 4.8**
  
  - [x] 10.9 Write property test for phase name validation
    - **Property 20: Phase Name Validation**
    - **Validates: Requirements 9.1**
  
  - [x] 10.10 Write unit tests for PhaseEditor component
    - Test phase list rendering
    - Test add phase action
    - Test edit phase action
    - Test delete phase action
    - Test validation error display
    - Test save button disabled state
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_
  
  - [x] 10.11 Write unit tests for PhaseTimeline component
    - Test timeline rendering
    - Test phase bar positioning
    - Test gap highlighting
    - Test overlap highlighting
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [x] 11. Implement interactive timeline features (optional enhancement)
  - [x] 11.1 Add drag-to-resize functionality to timeline
    - Implement mouse/touch handlers for phase boundaries
    - Update phase dates on drag
    - Auto-adjust adjacent phases to maintain continuity
    - _Requirements: 10.5, 10.6_
  
  - [x] 11.2 Write property test for phase resize continuity
    - **Property 21: Phase Resize Continuity**
    - **Validates: Requirements 10.6**
  
  - [x] 11.3 Write unit tests for drag-to-resize functionality
    - Test boundary dragging
    - Test adjacent phase adjustment
    - Test continuity maintenance
    - _Requirements: 10.5, 10.6_

- [x] 12. Integrate Phase Editor into project detail page
  - Add Phase Editor tab/section to project detail page
  - Wire up API calls for CRUD operations
  - Add loading states and error handling
  - Add success/error toast notifications
  - _Requirements: 4.1_

- [x] 12.1 Write integration tests for Phase Editor in project context
  - Test Phase Editor loads with project data
  - Test creating phases through UI
  - Test updating phases through UI
  - Test deleting phases through UI
  - Test validation prevents invalid saves
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

- [x] 13. Checkpoint - Ensure frontend tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 14. Run database migration
  - [x] 14.1 Test migration on development database
    - Run migration forward
    - Verify data transformation
    - Run verification queries
    - Test rollback
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_
  
  - [x] 14.2 Create migration runbook
    - Document pre-migration checks
    - Document migration steps
    - Document verification steps
    - Document rollback procedure
    - _Requirements: 7.1, 7.6, 7.7_
  
  - [x] 14.3 Run migration on staging environment
    - Execute migration
    - Verify data integrity
    - Test application functionality
    - Monitor for errors
    - _Requirements: 7.1, 7.6_

- [x] 15. Update seed data and test fixtures
  - Update seed_data.py to create user-defined phases instead of enum phases
  - Update test fixtures to use new phase model
  - Update integration test data
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 16. Update API documentation
  - Update OpenAPI/Swagger docs for new phase endpoints
  - Document phase validation rules
  - Document migration process
  - Add examples for phase CRUD operations
  - _Requirements: 8.1, 9.8_

- [x] 17. Final integration testing
  - [x] 17.1 Write end-to-end test for complete phase lifecycle
    - Create project (verify default phase)
    - Split default phase into multiple phases
    - Update phase dates and budgets
    - Delete a phase (verify continuity maintained)
    - Verify assignments are correctly associated with phases
    - _Requirements: 2.1, 5.1, 5.3, 5.4, 6.2_
  
  - [x] 17.2 Write end-to-end test for phase-based reporting
    - Create project with multiple phases
    - Create assignments across phases
    - Verify phase cost calculations
    - Verify phase forecast calculations
    - Verify budget aggregations
    - _Requirements: 8.2, 8.3, 8.4, 8.5_

- [x] 18. Final checkpoint - Ensure all tests pass
  - Run full test suite (unit, property, integration, e2e)
  - Verify test coverage meets goals (90% backend, 80% frontend)
  - Fix any failing tests
  - Ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Migration is a critical step and requires careful testing before production deployment
- The interactive timeline features (task 11) are optional enhancements that can be implemented later if time permits
