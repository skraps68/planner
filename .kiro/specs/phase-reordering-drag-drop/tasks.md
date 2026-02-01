# Implementation Plan: Phase Reordering via Drag-and-Drop

## Overview

This implementation plan breaks down the drag-and-drop phase reordering feature into discrete coding tasks. The approach follows an incremental strategy: first implementing core reordering logic and date recalculation, then adding drag-and-drop UI interactions, and finally integrating with the existing change tracking system.

## Tasks

- [x] 1. Implement core reordering and date recalculation logic
  - [x] 1.1 Create reordering utility functions in phaseValidation.ts
    - Implement `reorderPhases()` function to move a phase from one index to another
    - Implement `recalculatePhaseDates()` function to recalculate dates after reordering
    - Implement `validateReordering()` function to validate reordered phases
    - _Requirements: 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5_
  
  - [x] 1.2 Write property test for duration preservation
    - **Property 3: All Phase Durations Are Preserved**
    - **Validates: Requirements 2.1, 2.2, 2.3**
  
  - [x] 1.3 Write property test for phase contiguity
    - **Property 4: Phases Remain Contiguous After Reordering**
    - **Validates: Requirements 3.1, 3.4**
  
  - [x] 1.4 Write property test for boundary constraints
    - **Property 5: First Phase Starts at Project Start Date**
    - **Property 6: Last Phase Ends at Project End Date**
    - **Validates: Requirements 3.2, 3.3**
  
  - [x] 1.5 Write property test for last phase adjustment
    - **Property 7: Last Phase Duration Adjusts to Fit Project Boundaries**
    - **Validates: Requirements 3.5**
  
  - [x] 1.6 Write unit tests for reordering logic
    - Test moving first phase to last position
    - Test moving last phase to first position
    - Test moving middle phase to different position
    - Test no-op reordering (same position)
    - _Requirements: 1.4_

- [x] 2. Add drag-and-drop state management to PhaseTimeline
  - [x] 2.1 Add drag state to PhaseTimeline component
    - Add `DragDropState` interface and state variables
    - Add `enableReorder` prop to control drag-and-drop functionality
    - Add `onPhaseReorder` callback prop for parent notification
    - _Requirements: 1.1, 1.2, 1.3_
  
  - [x] 2.2 Implement drag event handlers
    - Implement `handleDragStart()` to initialize drag state
    - Implement `handleDragOver()` to calculate drop zones and preview
    - Implement `handleDrop()` to execute reordering
    - Implement `handleDragEnd()` to clean up drag state
    - _Requirements: 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.3 Write property test for correct reordering
    - **Property 1: Phase Reordering Produces Correct Order**
    - **Validates: Requirements 1.4**
  
  - [x] 2.4 Write property test for invalid drops
    - **Property 2: Invalid Drops Preserve Original Order**
    - **Validates: Requirements 1.5**

- [x] 3. Implement drop zone calculation and preview dates
  - [x] 3.1 Implement drop zone calculation logic
    - Calculate valid insertion positions between phases
    - Determine pixel positions for drop zone indicators
    - Handle edge cases (first position, last position)
    - _Requirements: 1.3_
  
  - [x] 3.2 Implement preview date calculation
    - Calculate preview dates for all phases during drag
    - Use same date recalculation logic as final reordering
    - Update preview state on drag over events
    - _Requirements: 4.5_
  
  - [x] 3.3 Write property test for preview date calculation
    - **Property 8: Preview Dates Are Correctly Calculated**
    - **Validates: Requirements 4.5**

- [x] 4. Add visual feedback for drag operations
  - [x] 4.1 Enhance phase rectangle rendering for drag-and-drop
    - Add `draggable` attribute to phase rectangles
    - Add hover styles to indicate draggability
    - Add dragging styles (reduced opacity, cursor changes)
    - _Requirements: 1.1, 1.2_
  
  - [x] 4.2 Implement drop zone rendering
    - Render drop zone indicators between phases during drag
    - Style drop zones with dashed borders and background color
    - Show/hide drop zones based on drag position
    - _Requirements: 1.3_
  
  - [x] 4.3 Implement preview date rendering
    - Display preview dates above/below phase rectangles during drag
    - Style preview dates with lighter color to distinguish from actual dates
    - Update preview dates as drag position changes
    - _Requirements: 4.5_

- [x] 5. Checkpoint - Ensure drag-and-drop works in isolation
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate with change tracking system
  - [x] 6.1 Connect PhaseTimeline to PhaseEditor change tracking
    - Call `onPhaseReorder` callback when drop completes
    - Pass reordered phases to parent component
    - Ensure changes are marked as pending in change tracking
    - _Requirements: 5.1, 5.4_
  
  - [x] 6.2 Test change tracking integration
    - Verify reordering marks changes as pending
    - Verify save persists reordered phases
    - Verify cancel discards reordered phases
    - _Requirements: 5.1, 5.2, 5.3_

- [x] 7. Add validation and error handling
  - [x] 7.1 Implement reordering validation
    - Validate reordered phases using existing validation logic
    - Prevent invalid reorderings from being applied
    - Return phases to original order on validation failure
    - _Requirements: 6.1, 6.3_
  
  - [x] 7.2 Add single-phase project handling
    - Disable drag-and-drop when only one phase exists
    - Don't attach drag handlers in single-phase case
    - _Requirements: 6.2_
  
  - [x] 7.3 Write property test for validation
    - **Property 9: Invalid Reorderings Are Rejected**
    - **Property 10: Failed Reorderings Preserve Previous State**
    - **Validates: Requirements 6.1, 6.3**
  
  - [x] 7.4 Write unit tests for error handling
    - Test single-phase project disables drag
    - Test invalid reordering is rejected
    - Test failed operation preserves state
    - _Requirements: 6.2, 6.3_

- [x] 8. Add accessibility support
  - [x] 8.1 Implement keyboard-based reordering
    - Add keyboard event handlers for arrow keys
    - Enable keyboard reordering mode on focus + shortcut
    - Allow arrow keys to move phase to different positions
    - Apply reordering on Enter, cancel on Escape
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 8.2 Add screen reader announcements
    - Add aria-live regions for drag-and-drop announcements
    - Announce when phase is picked up, moved, and dropped
    - Announce position changes and validation errors
    - _Requirements: 7.5_

- [x] 9. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation builds incrementally: core logic → UI interactions → integration → validation → accessibility
