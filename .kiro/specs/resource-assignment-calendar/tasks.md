# Implementation Plan: Resource Assignment Calendar View

## Overview

## Tasks

- [x] 1. Create core data transformation utilities
  - [x] 1.1 Implement date range generation function
    - Create `generateDateRange(startDate: Date, endDate: Date): Date[]` utility
    - Handle edge cases: same day, leap years, invalid ranges
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 1.2 Write property test for date range generation
    - **Property 1: Date Range Generation Completeness**
    - **Validates: Requirements 3.1, 3.2, 3.3**
  
  - [x] 1.3 Implement grid transformation function
    - Create `transformToGrid(assignments, startDate, endDate): GridData` function
    - Extract unique resources from assignments
    - Generate date columns
    - Create cell map with composite keys
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [x] 1.4 Implement cell key generation and lookup utilities
    - Create `getCellKey(resourceId, date, costTreatment): string` function
    - Create `getCellValue(gridData, resourceId, date, costTreatment): number` function
    - Ensure O(1) lookup performance using Map
    - _Requirements: 8.2_
  
  - [x] 1.5 Write property test for grid transformation
    - **Property 2: Grid Structure Correctness**
    - **Property 3: Cell Data Mapping Correctness**
    - **Property 4: Grid Transformation Preserves Data**
    - **Validates: Requirements 1.4, 2.1, 2.2, 2.3, 2.5, 4.1, 4.2, 5.1, 5.2, 5.3, 5.4, 6.2**
  
  - [x] 1.6 Write unit tests for transformation utilities
    - Test empty assignments array
    - Test single assignment
    - Test multiple resources and dates
    - Test missing/null percentage values
    - _Requirements: 5.5, 6.4_

- [x] 2. Create base calendar component structure
  - [x] 2.1 Create ResourceAssignmentCalendar component
    - Set up component with props interface
    - Implement data fetching using assignmentsApi.getByProject
    - Implement loading and error states
    - Transform fetched data to grid structure
    - _Requirements: 6.1, 6.3, 6.5_
  
  - [x] 2.2 Create CalendarHeader component
    - Render date column headers
    - Apply styling (#A5C1D8 background, bold text)
    - Format dates consistently
    - _Requirements: 3.4, 7.1, 7.2_
  
  - [x] 2.3 Create ResourceRow component
    - Render resource name in sticky first cell
    - Render Capital and Expense rows
    - Apply visual distinction between row types
    - Render cells for each date
    - _Requirements: 1.1, 1.2, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 2.4 Write unit tests for base components
    - Test ResourceAssignmentCalendar data fetching
    - Test loading and error states
    - Test CalendarHeader rendering
    - Test ResourceRow structure
    - _Requirements: 6.3, 6.5, 9.1, 9.2, 9.3_

- [x] 3. Implement read-only calendar display
  - [x] 3.1 Implement cell rendering in read-only mode
    - Display percentage values in cells
    - Handle empty cells (no assignment)
    - Format percentages consistently
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [x] 3.2 Implement sticky column behavior
    - Apply CSS for sticky first column
    - Ensure horizontal scrolling works correctly
    - _Requirements: 1.2, 1.5_
  
  - [x] 3.3 Implement empty state handling
    - Display message when no assignments exist
    - Display message when no resources exist
    - Display message when project dates are missing
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [x] 3.4 Write integration test for read-only calendar
    - Test full calendar render with mock data
    - Test empty states
    - Test data display correctness
    - _Requirements: 1.1, 4.1, 4.2, 4.3, 9.1, 9.2, 9.3_

- [x] 4. Checkpoint - Verify read-only calendar works
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement edit mode infrastructure
  - [x] 5.1 Add edit mode state management
    - Add isEditMode state to ResourceAssignmentCalendar
    - Add editedCells Map to track changes
    - Add validationErrors Map to track errors
    - _Requirements: 11.1_
  
  - [x] 5.2 Create EditableCell component
    - Render as text in read-only mode
    - Render as input in edit mode
    - Handle onChange, onBlur, onKeyDown events
    - Display validation errors
    - _Requirements: 12.1, 12.2_
  
  - [x] 5.3 Implement Edit/Save/Cancel buttons
    - Add Edit button (top right)
    - Add Save and Cancel buttons (visible in edit mode)
    - Wire up button click handlers
    - _Requirements: 11.2, 14.1, 14.2_
  
  - [x] 5.4 Implement edit mode toggle logic
    - Check permissions before enabling edit mode
    - Toggle isEditMode state
    - Clear edits on cancel
    - _Requirements: 11.3, 11.4, 11.5, 14.5_
  
  - [x] 5.5 Write unit tests for edit mode
    - Test mode toggle
    - Test EditableCell in both modes
    - Test button visibility
    - Test permission checks
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 14.1, 14.2, 14.5_

- [x] 6. Implement cell editing and tracking
  - [x] 6.1 Implement cell change handler
    - Update editedCells Map when cell value changes
    - Track old and new values
    - Update UI optimistically
    - _Requirements: 17.1_
  
  - [x] 6.2 Implement EditTracker utility
    - Create addEdit, removeEdit, hasEdits, getEdits, clear methods
    - Use composite keys for tracking
    - _Requirements: 14.3_
  
  - [x] 6.3 Implement input validation for cell values
    - Validate numeric input only
    - Validate range (0-100)
    - Display inline errors for invalid input
    - _Requirements: 12.3, 12.4, 12.5_
  
  - [x] 6.4 Write property test for percentage range validation
    - **Property 6: Percentage Range Validation**
    - **Validates: Requirements 12.4**
  
  - [x] 6.5 Write unit tests for cell editing
    - Test cell value updates
    - Test edit tracking
    - Test input validation
    - Test error display
    - _Requirements: 12.3, 12.4, 12.5, 17.1_

- [x] 7. Implement cross-project allocation validation
  - [x] 7.1 Create validation service
    - Implement validateCellEdit function
    - Call assignmentsApi.getResourceAllocation
    - Calculate total allocation across projects
    - Check if total exceeds 100%
    - _Requirements: 13.4, 15.1, 15.2, 15.3_
  
  - [x] 7.2 Implement validation triggers
    - Validate on Enter key press
    - Validate on Tab key press
    - Validate on blur (click outside)
    - _Requirements: 13.1, 13.2, 13.3_
  
  - [x] 7.3 Implement validation error display
    - Show detailed error message with project breakdown
    - Highlight invalid cells
    - Revert cell value on validation failure
    - _Requirements: 13.5, 17.2_
  
  - [x] 7.4 Write property test for allocation validation
    - **Property 5: Cross-Project Allocation Validation**
    - **Validates: Requirements 13.4, 15.2, 15.3**
  
  - [x] 7.5 Write unit tests for validation
    - Test validation triggers
    - Test over-allocation detection
    - Test error message generation
    - Test cell revert on failure
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 15.1, 15.2, 15.3, 15.4, 15.5, 17.2_

- [x] 8. Checkpoint - Verify editing and validation work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Implement save functionality
  - [x] 9.1 Implement batch save logic
    - Validate all edited cells before save
    - Group edits by assignment (update vs create)
    - Call assignmentsApi.update for existing assignments
    - Call assignmentsApi.create for new assignments
    - _Requirements: 14.3, 14.4_
  
  - [x] 9.2 Implement save state management
    - Add isSaving state
    - Show loading indicator during save
    - Handle save success (show message, refetch data, exit edit mode)
    - Handle save failure (show error, preserve edits, allow retry)
    - _Requirements: 17.3, 17.4, 17.5_
  
  - [x] 9.3 Implement permission verification
    - Check permissions before save
    - Handle 403 errors from API
    - Display appropriate error messages
    - _Requirements: 16.1, 16.3, 16.4_
  
  - [x] 9.4 Write integration tests for save flow
    - Test successful save flow
    - Test validation failure during save
    - Test API error handling
    - Test permission errors
    - _Requirements: 14.3, 14.4, 16.1, 16.3, 17.3, 17.4, 17.5_

- [x] 10. Integrate calendar into ProjectDetailPage
  - [x] 10.1 Replace assignments table with calendar component
    - Import ResourceAssignmentCalendar component
    - Pass projectId, projectStartDate, projectEndDate props
    - Wire up success/error callbacks
    - Remove old table code
    - _Requirements: 1.1_
  
  - [x] 10.2 Test integration in ProjectDetailPage
    - Verify calendar renders in Assignments tab
    - Verify data flows correctly
    - Verify callbacks work
    - _Requirements: 1.1_

- [x] 11. Final polish and optimization
  - [x] 11.1 Add performance optimizations
    - Memoize grid transformation with React.useMemo
    - Optimize re-renders with React.memo for cells
    - Consider virtualization for large date ranges
    - _Requirements: 8.1, 8.4, 8.5_
  
  - [x] 11.2 Add accessibility features
    - Add ARIA labels for edit mode and buttons
    - Implement keyboard navigation (Tab, Enter, Escape)
    - Ensure screen reader support
    - _Requirements: Not explicitly in requirements, but best practice_
  
  - [x] 11.3 Write end-to-end integration test
    - Test complete flow: load → edit → validate → save
    - Test error recovery scenarios
    - Test permission-based access
    - _Requirements: All requirements_

- [x] 12. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation follows a bottom-up approach: utilities → components → features
