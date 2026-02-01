# Design Document: Phase Reordering via Drag-and-Drop

## Overview

This design document specifies the implementation of drag-and-drop functionality for the phase timeline component, enabling users to reorder project phases by dragging phase rectangles and inserting them between other phases. The feature preserves phase durations while automatically recalculating dates to maintain timeline continuity and project boundary constraints.

The implementation extends the existing PhaseTimeline.tsx component with drag-and-drop capabilities using the HTML5 Drag and Drop API combined with React state management. The feature integrates with the existing change tracking system to support pending changes and save/cancel workflows.

## Architecture

### Component Structure

```
PhaseTimeline.tsx (Enhanced)
├── Drag State Management
│   ├── draggedPhaseId: string | null
│   ├── dropTargetIndex: number | null
│   └── previewPhases: ProjectPhase[]
├── Drag Event Handlers
│   ├── handleDragStart()
│   ├── handleDragOver()
│   ├── handleDragEnd()
│   └── handleDrop()
├── Reordering Logic
│   ├── reorderPhases()
│   ├── recalculatePhaseDates()
│   └── validateReordering()
└── Rendering
    ├── renderPhaseRectangle() (Enhanced)
    ├── renderDropZones()
    └── renderPreviewDates()
```

### Data Flow

1. **User initiates drag**: Phase rectangle becomes draggable, drag state is initialized
2. **Drag over timeline**: Drop zones are calculated and displayed, preview dates are computed
3. **User drops phase**: Reordering logic executes, dates are recalculated, change tracking is updated
4. **UI updates**: Timeline re-renders with new phase order and dates as pending changes
5. **User saves**: Changes are persisted to backend via existing save mechanism

### Integration Points

- **PhaseEditor.tsx**: Parent component that manages phase state and change tracking
- **phaseValidation.ts**: Utility functions for date calculations and validation
- **Change Tracking System**: Existing mechanism for tracking pending changes before save

## Components and Interfaces

### Enhanced PhaseTimeline Component

**New Props**:
```typescript
interface PhaseTimelineProps {
  // ... existing props ...
  onPhaseReorder?: (reorderedPhases: Partial<ProjectPhase>[]) => void
  enableReorder?: boolean
}
```

**New State**:
```typescript
interface DragState {
  draggedPhaseId: string | null
  dropTargetIndex: number | null  // Index where phase will be inserted
  previewPhases: Partial<ProjectPhase>[]  // Phases with preview dates
  isDragging: boolean
}
```

### Reordering Logic Module

**Core Functions**:

```typescript
/**
 * Reorders phases by moving a phase to a new position
 * @param phases - Current phase array
 * @param fromIndex - Current index of phase to move
 * @param toIndex - Target index for insertion
 * @returns Reordered phase array
 */
function reorderPhases(
  phases: Partial<ProjectPhase>[],
  fromIndex: number,
  toIndex: number
): Partial<ProjectPhase>[]

/**
 * Recalculates phase dates after reordering to maintain continuity
 * @param phases - Reordered phase array
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Phases with recalculated dates
 */
function recalculatePhaseDates(
  phases: Partial<ProjectPhase>[],
  projectStartDate: string,
  projectEndDate: string
): Partial<ProjectPhase>[]

/**
 * Validates that a reordering operation is valid
 * @param phases - Phases after reordering and date recalculation
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Validation result
 */
function validateReordering(
  phases: Partial<ProjectPhase>[],
  projectStartDate: string,
  projectEndDate: string
): { isValid: boolean; error?: string }
```

### Date Recalculation Algorithm

The date recalculation algorithm ensures phases remain contiguous and aligned with project boundaries:

1. **Preserve Durations**: Calculate and store each phase's duration before recalculation
2. **Set First Phase**: Set first phase start date to project start date
3. **Calculate Subsequent Phases**: For each phase after the first:
   - Set start date to previous phase's end date + 1 day
   - Set end date to start date + duration - 1 day
4. **Adjust Last Phase**: If last phase's calculated end date doesn't match project end date:
   - Adjust last phase's end date to project end date
   - This may change the last phase's duration to fit project boundaries

**Pseudocode**:
```
function recalculatePhaseDates(phases, projectStartDate, projectEndDate):
  // Step 1: Preserve durations
  durations = []
  for each phase in phases:
    duration = calculateDaysBetween(phase.start_date, phase.end_date) + 1
    durations.append(duration)
  
  // Step 2: Set first phase
  phases[0].start_date = projectStartDate
  phases[0].end_date = addDays(projectStartDate, durations[0] - 1)
  
  // Step 3: Calculate subsequent phases
  for i from 1 to phases.length - 1:
    phases[i].start_date = addDays(phases[i-1].end_date, 1)
    phases[i].end_date = addDays(phases[i].start_date, durations[i] - 1)
  
  // Step 4: Adjust last phase to project end date
  lastIndex = phases.length - 1
  phases[lastIndex].end_date = projectEndDate
  
  return phases
```

## Data Models

### ProjectPhase (Existing)

```typescript
interface ProjectPhase {
  id: string
  project_id: string
  name: string
  description?: string
  start_date: string  // ISO date format
  end_date: string    // ISO date format
  capital_budget: number
  expense_budget: number
  total_budget: number
  created_at: string
  updated_at: string
}
```

### DragDropState (New)

```typescript
interface DragDropState {
  draggedPhaseId: string | null
  dropTargetIndex: number | null
  previewPhases: Partial<ProjectPhase>[]
  isDragging: boolean
}
```

### DropZone (New)

```typescript
interface DropZone {
  index: number  // Insertion index
  position: number  // Pixel position on timeline
  isValid: boolean  // Whether drop is valid at this position
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing the acceptance criteria, I identified the following testable properties. Some properties were redundant and have been consolidated:

- **2.1, 2.2, 2.3** all test duration preservation and can be combined into a single comprehensive property
- **3.1 and 3.4** both test contiguity and can be combined
- **3.2 and 3.3** test boundary constraints and are kept separate as they test different boundaries

The following properties provide comprehensive coverage of the functional requirements:

### Property 1: Phase Reordering Produces Correct Order

*For any* list of phases and any valid insertion position, when a phase is moved from its current position to the insertion position, the resulting phase order should have the moved phase at the target position with all other phases maintaining their relative order.

**Validates: Requirements 1.4**

### Property 2: Invalid Drops Preserve Original Order

*For any* phase order, when a drop operation is performed at an invalid position (outside valid drop zones), the phase order should remain unchanged.

**Validates: Requirements 1.5**

### Property 3: All Phase Durations Are Preserved

*For any* reordering operation, the duration of every phase (moved or not) before reordering should equal its duration after reordering and date recalculation.

**Validates: Requirements 2.1, 2.2, 2.3**

### Property 4: Phases Remain Contiguous After Reordering

*For any* reordered phase list, each phase's start date should equal the previous phase's end date plus one day, ensuring no gaps or overlaps exist between consecutive phases.

**Validates: Requirements 3.1, 3.4**

### Property 5: First Phase Starts at Project Start Date

*For any* reordering operation, after date recalculation, the first phase's start date should equal the project start date.

**Validates: Requirements 3.2**

### Property 6: Last Phase Ends at Project End Date

*For any* reordering operation, after date recalculation, the last phase's end date should equal the project end date.

**Validates: Requirements 3.3**

### Property 7: Last Phase Duration Adjusts to Fit Project Boundaries

*For any* reordering operation where the sum of phase durations doesn't perfectly match the project duration, the last phase's duration should be adjusted to ensure the last phase ends exactly at the project end date.

**Validates: Requirements 3.5**

### Property 8: Preview Dates Are Correctly Calculated

*For any* drag position over the timeline, the preview dates calculated for all phases should satisfy the same constraints as final dates (contiguous, within project boundaries, durations preserved).

**Validates: Requirements 4.5**

### Property 9: Invalid Reorderings Are Rejected

*For any* reordering operation that would result in invalid dates (phases outside project boundaries, negative durations, etc.), the validation function should return false and prevent the reordering.

**Validates: Requirements 6.1**

### Property 10: Failed Reorderings Preserve Previous State

*For any* reordering operation that fails validation, the phase order and dates should remain exactly as they were before the operation was attempted.

**Validates: Requirements 6.3**

## Error Handling

### Validation Errors

**Invalid Drop Position**:
- **Trigger**: User drops phase outside valid drop zones
- **Handling**: Silently return phase to original position, no error message needed
- **Recovery**: Phase order remains unchanged

**Date Recalculation Failure**:
- **Trigger**: Date recalculation produces invalid dates (e.g., phases outside project boundaries)
- **Handling**: Display error message: "Unable to reorder phases: resulting dates would be invalid"
- **Recovery**: Revert to previous phase order and dates

**Single Phase Project**:
- **Trigger**: User attempts to drag when only one phase exists
- **Handling**: Disable drag functionality, no error message needed
- **Prevention**: Don't attach drag handlers when phase count is 1

### Edge Cases

**Phase Duration Exceeds Project Duration**:
- **Scenario**: A single phase's duration is longer than the project duration
- **Handling**: This is a pre-existing validation error, not specific to reordering
- **Behavior**: Reordering should still work, but validation will show errors

**Rounding Errors in Date Calculations**:
- **Scenario**: Date arithmetic produces fractional days
- **Handling**: Always round to nearest whole day using Math.round()
- **Prevention**: Use integer day calculations throughout

**Concurrent Drag Operations**:
- **Scenario**: User initiates multiple drags simultaneously (edge case with touch devices)
- **Handling**: Only process the first drag, ignore subsequent drags until first completes
- **Prevention**: Check isDragging flag before starting new drag

### User Feedback

**During Drag**:
- Visual feedback: Dragged phase has reduced opacity (0.5)
- Drop zones: Highlighted with dashed border and background color
- Preview dates: Shown above/below phase rectangles in lighter color
- Cursor: Changes to "grabbing" during drag

**On Drop**:
- Success: Timeline smoothly animates to new order
- Failure: Phase snaps back to original position with brief shake animation
- Error: Toast notification with error message

**Accessibility**:
- Screen reader announces: "Phase [name] moved to position [index]"
- Screen reader announces: "Reordering failed: [error message]"
- Keyboard users receive same feedback via aria-live regions

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests to ensure comprehensive coverage:

**Unit Tests**: Focus on specific examples, edge cases, and integration points
- Specific reordering scenarios (move first to last, move middle to beginning, etc.)
- Edge cases (single phase, two phases, many phases)
- Integration with change tracking system
- Error handling and validation

**Property Tests**: Verify universal properties across all inputs
- Duration preservation across random reorderings
- Date continuity across random reorderings
- Boundary constraints across random reorderings
- Validation correctness across random invalid inputs

Together, these approaches provide comprehensive coverage: unit tests catch concrete bugs in specific scenarios, while property tests verify general correctness across the entire input space.

### Property-Based Testing Configuration

**Library**: fast-check (TypeScript property-based testing library)

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with: `Feature: phase-reordering-drag-drop, Property {number}: {property_text}`
- Each correctness property implemented by a SINGLE property-based test

**Test Data Generators**:
```typescript
// Generate random phases with valid dates
const phaseGenerator = fc.array(
  fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 50 }),
    start_date: fc.date(),
    end_date: fc.date(),
    // ... other fields
  }),
  { minLength: 2, maxLength: 10 }
)

// Generate random insertion indices
const insertionIndexGenerator = (phaseCount: number) =>
  fc.integer({ min: 0, max: phaseCount - 1 })
```

### Unit Testing Focus Areas

**Reordering Logic**:
- Move first phase to last position
- Move last phase to first position
- Move middle phase to different middle position
- Move phase to same position (no-op)

**Date Recalculation**:
- Phases with equal durations
- Phases with varying durations
- Last phase adjustment when durations don't fit perfectly
- Boundary date alignment

**Change Tracking Integration**:
- Reordering marks changes as pending
- Save persists reordered phases
- Cancel discards reordered phases

**Validation**:
- Single phase project disables drag
- Invalid reorderings are rejected
- Failed operations preserve state

### Integration Testing

**End-to-End Scenarios**:
1. User drags phase to new position → dates recalculate → changes marked pending → user saves → backend persists
2. User drags phase → dates recalculate → user cancels → original order restored
3. User drags phase to invalid position → phase returns to original position → no changes made

**Component Integration**:
- PhaseTimeline drag events trigger PhaseEditor state updates
- PhaseEditor change tracking reflects reordering changes
- ValidationErrorDisplay shows errors from failed reorderings
