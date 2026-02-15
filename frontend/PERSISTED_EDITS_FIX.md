# Assignment Calendar Performance Fixes

## Summary
Fixed multiple performance issues in the Resource Assignment Calendar that were causing slow typing and tabbing between cells.

## Issues Fixed

### 1. Persisted Edits Not Loading (FIXED)
**Problem**: Unsaved edits were not being restored when navigating back to the calendar.

**Root Cause**: Key mismatch between save and load operations
- `usePersistedEdits` hook used its own `getCellKey` function with ISO date format
- `calendarTransform.ts` used YYYY-MM-DD format
- Keys didn't match, so edits couldn't be retrieved

**Solution**:
- Imported shared `getCellKey` function from `calendarTransform.ts` into `usePersistedEdits.ts`
- Added `isInitialized` flag to prevent race condition where save effect runs before load completes
- Debounced sessionStorage saves to 500ms to avoid blocking UI

**Files Modified**:
- `frontend/src/hooks/usePersistedEdits.ts`
- `frontend/src/components/resources/ResourceAssignmentCalendar.tsx`

### 2. Slow Typing Performance (FIXED)
**Problem**: 1 second delay between typing and value appearing on screen.

**Root Cause**: Extensive console logging in hot code paths
- `calendarTransform.ts` had 8+ console.log statements in `transformToGrid` (called on every render)
- Conditional logging in `getCellValue` (called for every cell on every render)
- `usePersistedEdits.ts` had console logging on every save

**Solution**:
- Removed all console logging except error logging
- Debounced sessionStorage saves (500ms)
- Memoized callbacks in ResourceAssignmentCalendar
- EditableCell only calls `onChange` on blur/Enter, not on every keystroke
- Local input state in EditableCell prevents parent re-renders during typing

**Files Modified**:
- `frontend/src/utils/calendarTransform.ts` (removed console logging)
- `frontend/src/hooks/usePersistedEdits.ts` (removed console logging, added debouncing)
- `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` (memoized callbacks)

### 3. Slow Tabbing Performance (IN PROGRESS)
**Problem**: Tabbing from cell to cell feels slow.

**Root Cause**: Async API call to `validateCellEdit` on every blur event
- When tabbing, blur fires on current cell before focus moves to next cell
- API call delay blocks the tab navigation

**Solution**:
- Removed async `validateCellEdit` API call from `handleCellBlur`
- Made `handleCellBlur` a no-op (empty function)
- Moved cross-project validation to save time only
- Removed inline validation on every keystroke in `handleChange`
- Validation now only happens on blur/Enter when committing the value

**Files Modified**:
- `frontend/src/components/resources/ResourceAssignmentCalendar.tsx`
  - `handleCellBlur` is now empty (line 730-734)
  - `handleCellChange` defers validation to save time (line 695-727)
  - `handleSaveClick` performs all validation before saving (line 485-509)
  - `EditableCell.handleChange` no longer validates on every keystroke (line 72-76)
  - `EditableCell.commitValue` validates only once on blur (line 90-103)

## Performance Optimizations Applied

### React Query Configuration
- `refetchOnWindowFocus: false` - prevents unnecessary refetches
- `staleTime: 5 * 60 * 1000` - 5 minute cache
- Proper query key structure for granular cache invalidation

### Component Optimization
- `EditableCell` wrapped in `React.memo` with custom comparison
- Lazy rendering: TextField only rendered when cell is focused
- Memoized callbacks: `handleCellChange`, `handleCellBlur`, `formatDate`
- Memoized grid data transformation

### State Management
- Local input state in EditableCell prevents parent re-renders
- Debounced sessionStorage saves (500ms)
- Validation errors stored in Map for O(1) lookup

### Validation Strategy
- Range validation (0-100) only on blur/Enter
- Cross-project validation deferred to save time
- No API calls during typing or tabbing
- Validation errors shown immediately on blur

## Testing Recommendations

### Manual Testing
1. Type in a cell - should feel instant with no delay
2. Tab between cells - should move immediately without lag
3. Navigate away and back - unsaved edits should be restored
4. Save changes - validation should catch errors before API call

### Performance Metrics
- Typing latency: < 50ms (should feel instant)
- Tab navigation: < 50ms (should feel instant)
- SessionStorage save: debounced to 500ms (non-blocking)
- Grid transformation: memoized (only recalculates when data changes)

## Known Limitations

### Large Date Ranges
For projects with > 365 days, consider implementing virtualization:
- Use `react-window` or `react-virtualized` to render only visible columns
- Current implementation handles up to ~365 days efficiently with memoization

### Validation Timing
- Cross-project validation only happens on save, not during editing
- This is intentional for performance - users see validation errors when they click Save
- Alternative: Could add debounced validation (e.g., 2 seconds after last edit)

## Future Improvements

### Potential Optimizations
1. Virtual scrolling for very large date ranges (> 365 days)
2. Web Worker for grid transformation if data set grows significantly
3. IndexedDB instead of sessionStorage for larger edit sets
4. Optimistic updates with rollback on conflict

### Monitoring
Consider adding performance monitoring:
- Track typing latency with Performance API
- Monitor sessionStorage size
- Alert if grid transformation takes > 100ms

## Related Files
- `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` - Main calendar component
- `frontend/src/hooks/usePersistedEdits.ts` - Persisted edits hook
- `frontend/src/utils/calendarTransform.ts` - Grid transformation utilities
- `frontend/src/utils/cellValidation.ts` - Validation utilities
- `frontend/src/hooks/useAssignments.ts` - React Query hooks
- `frontend/src/main.tsx` - React Query configuration
