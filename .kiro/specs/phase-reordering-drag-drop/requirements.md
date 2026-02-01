# Requirements Document

## Introduction

This document specifies the requirements for adding drag-and-drop functionality to the phase timeline, enabling users to reorder project phases by dragging phase rectangles and inserting them between other phases while preserving phase durations and maintaining date continuity. This feature addresses the current limitation where users can only adjust phase dates via timeline sliders, making it impossible to insert new phases between existing phases or reorganize the phase sequence efficiently.

## Glossary

- **Phase**: A distinct time period within a project with a defined start date, end date, and duration
- **Phase_Timeline**: The visual timeline component (PhaseTimeline.tsx) displaying phases as horizontal rectangles
- **Phase_Rectangle**: The visual representation of a phase in the Phase_Timeline as a horizontal bar
- **Phase_Duration**: The number of days between a phase's start date and end date (inclusive)
- **Phase_Order**: The sequential position of phases within a project
- **Drop_Zone**: A visual indicator showing where a dragged Phase_Rectangle can be inserted
- **Project_Start_Date**: The start date of the first phase in the project
- **Project_End_Date**: The end date of the last phase in the project
- **Change_Tracking_System**: The existing system that tracks pending changes before they are saved
- **Contiguous_Phases**: Phases arranged such that each phase's start date immediately follows the previous phase's end date with no gaps or overlaps
- **Insertion_Position**: The position between two phases where a dragged phase will be inserted

## Requirements

### Requirement 1: Drag-and-Drop Phase Reordering

**User Story:** As a project manager, I want to drag and drop phase rectangles in the timeline to reorder them, so that I can reorganize the phase sequence and insert phases between existing phases efficiently.

#### Acceptance Criteria

1. WHEN a user hovers over a Phase_Rectangle, THE Phase_Timeline SHALL display a visual indicator that the Phase_Rectangle is draggable
2. WHEN a user clicks and drags a Phase_Rectangle, THE Phase_Timeline SHALL visually indicate the phase is being dragged
3. WHEN a dragged Phase_Rectangle is moved over the timeline, THE Phase_Timeline SHALL display Drop_Zone indicators showing valid Insertion_Positions between other phases
4. WHEN a user releases a dragged Phase_Rectangle over a valid Drop_Zone, THE Phase_Timeline SHALL reorder the phases by inserting the phase at the new Insertion_Position
5. WHEN a user releases a dragged Phase_Rectangle outside valid Drop_Zones, THE Phase_Timeline SHALL return the phase to its original position

### Requirement 2: Duration Preservation

**User Story:** As a project manager, I want phase durations to remain unchanged when I reorder phases, so that the planned work duration for each phase is preserved.

#### Acceptance Criteria

1. WHEN a phase is reordered, THE System SHALL preserve the Phase_Duration of the moved phase
2. WHEN a phase is reordered, THE System SHALL preserve the Phase_Duration of all other phases
3. FOR ALL phases in the project, the Phase_Duration before reordering SHALL equal the Phase_Duration after reordering

### Requirement 3: Automatic Date Recalculation

**User Story:** As a project manager, I want phase dates to be automatically recalculated after reordering, so that phases remain contiguous and aligned with project boundaries.

#### Acceptance Criteria

1. WHEN phases are reordered, THE System SHALL recalculate all phase start and end dates to maintain Contiguous_Phases
2. WHEN phases are reordered, THE System SHALL set the first phase's start date to the Project_Start_Date
3. WHEN phases are reordered, THE System SHALL set the last phase's end date to the Project_End_Date
4. WHEN phases are reordered, THE System SHALL ensure each phase's start date equals the previous phase's end date plus one day
5. WHEN the last phase's calculated end date does not match the Project_End_Date, THE System SHALL adjust the last phase's duration to align with the Project_End_Date

### Requirement 4: Visual Feedback During Drag Operation

**User Story:** As a project manager, I want clear visual feedback during drag operations, so that I understand where I can insert the phase and what the result will be.

#### Acceptance Criteria

1. WHEN a Phase_Rectangle is being dragged, THE Phase_Timeline SHALL apply a visual style to the dragged Phase_Rectangle indicating it is in a dragged state
2. WHEN a dragged Phase_Rectangle moves over a valid Insertion_Position, THE Phase_Timeline SHALL display a Drop_Zone indicator at that position
3. WHEN a dragged Phase_Rectangle moves away from an Insertion_Position, THE Phase_Timeline SHALL remove the Drop_Zone indicator
4. WHEN a Phase_Rectangle is being dragged, THE Phase_Timeline SHALL display a ghost or placeholder element showing where the phase will be inserted
5. WHEN a Phase_Rectangle is being dragged, THE Phase_Timeline SHALL show preview dates for all phases based on the potential new order

### Requirement 5: Change Tracking Integration

**User Story:** As a project manager, I want phase reordering to integrate with the existing change tracking system, so that I can review changes before saving them.

#### Acceptance Criteria

1. WHEN a phase is reordered, THE System SHALL mark the reordering as a pending change in the Change_Tracking_System
2. WHEN a user clicks "Save Changes", THE System SHALL persist all pending phase reordering changes to the backend
3. WHEN a user cancels or navigates away without saving, THE System SHALL discard all pending phase reordering changes
4. WHEN phases are reordered, THE System SHALL display the updated phase order and dates in the UI immediately as pending changes

### Requirement 6: Validation and Error Handling

**User Story:** As a project manager, I want the system to validate phase reordering operations, so that I am prevented from creating invalid phase configurations.

#### Acceptance Criteria

1. WHEN a phase reordering would result in invalid dates, THE System SHALL prevent the reordering and display an error message
2. WHEN the Phase_Timeline contains only one phase, THE System SHALL disable drag-and-drop functionality for that phase
3. WHEN a phase reordering operation fails validation, THE System SHALL return all phases to their previous order
4. WHEN date recalculation after reordering fails, THE System SHALL display a descriptive error message to the user

### Requirement 7: Accessibility and Keyboard Support

**User Story:** As a project manager using keyboard navigation, I want to reorder phases without a mouse, so that the feature is accessible to all users.

#### Acceptance Criteria

1. WHEN a user focuses on a Phase_Rectangle and presses a keyboard shortcut, THE System SHALL enable keyboard-based reordering mode
2. WHEN keyboard reordering mode is active, THE System SHALL allow arrow keys to move the phase to different Insertion_Positions
3. WHEN a user confirms the new position via keyboard, THE System SHALL apply the reordering
4. WHEN a user cancels keyboard reordering mode, THE System SHALL return the phase to its original position
5. THE Phase_Timeline SHALL provide screen reader announcements for drag-and-drop operations and position changes
