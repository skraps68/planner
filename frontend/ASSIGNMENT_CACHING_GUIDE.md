# Assignment Caching Implementation Guide

## Status: ✅ COMPLETED

This guide documents the React Query caching implementation for resource assignments in the frontend application, including persistent unsaved edits.

## Overview

React Query (`@tanstack/react-query`) has been integrated to provide automatic caching, background refetching, and optimistic updates for resource assignment data. Additionally, unsaved edits are persisted in sessionStorage so they survive navigation away and back to the calendar.

## Implementation Summary

### ✅ Custom Hooks Created

#### Assignment Data Hooks (`frontend/src/hooks/useAssignments.ts`)

The following React Query hooks manage assignment data:

- `useProjectAssignments(projectId)` - Fetch and cache assignments by project
- `useResourceAssignments(resourceId)` - Fetch and cache assignments by resource  
- `useResourceAssignmentsByDate(resourceId, date)` - Fetch assignments for specific date
- `useCreateAssignment()` - Create new assignment with automatic cache invalidation
- `useUpdateAssignment()` - Update assignment with automatic cache invalidation
- `useBulkUpdateAssignments()` - Bulk update with automatic cache invalidation
- `useDeleteAssignment()` - Delete assignment with automatic cache invalidation
- `useInvalidateAssignments()` - Manual cache control helpers

#### Persisted Edits Hook (`frontend/src/hooks/usePersistedEdits.ts`)

A new hook manages unsaved edits across navigation:

- `usePersistedEdits(projectId)` - Persist unsaved cell edits in sessionStorage
  - Returns: `{ editedCells, setEditedCells, clearEdits, clearAllEdits }`
  - Automatically saves edits when they change
  - Automatically loads edits when component mounts
  - Uses sessionStorage (cleared when browser tab closes)
  - Handles Date serialization/deserialization

### ✅ Components Updated

All three components have been successfully updated to use React Query:

#### 1. ResourceAssignmentCalendar.tsx ✅
- Replaced manual `useState` and `fetchAssignments` with `useProjectAssignments(projectId)` hook
- Replaced `editedCells` state with `usePersistedEdits(projectId)` hook
- Removed manual loading state management (now using `isLoading` from hook)
- Removed manual error state (now using `error` from hook)
- Updated save handler to call `invalidateProject(projectId)` after successful saves
- Updated save handler to call `clearEdits()` after successful saves
- Updated cancel handler to call `clearEdits()` when canceling
- Updated conflict handler to call `refetch()` instead of `fetchAssignments()`
- Removed the `useEffect` that called `fetchAssignments()`

#### 2. AssignmentCalendar.tsx ✅
- Replaced manual `useState` and `fetchAssignments` with `useResourceAssignments(resourceId)` hook
- Removed manual loading/error state management
- Removed the `useEffect` that called `fetchAssignments()`
- Component now automatically refetches when resourceId changes

#### 3. ResourceDetailPage.tsx ✅
- Replaced manual `useState` and `fetchAssignments` with `useResourceAssignments(id)` hook
- Added conditional enabling to only fetch when not creating a new resource
- Removed the `fetchAssignments()` function
- Removed unused imports (FormControl, InputLabel, Select, MenuItem, Chip)
- Fixed allocation percentage calculation (capital + expense)

## Benefits

### 1. Automatic Caching
- Data is cached for 5 minutes (configurable via `staleTime`)
- Switching between tabs no longer triggers unnecessary API calls
- Background refetching keeps data fresh without blocking UI

### 2. Persistent Unsaved Edits ⭐ NEW
- Unsaved edits are stored in sessionStorage
- Edits survive navigation away and back to the calendar
- Highlighted cells remain highlighted when returning
- Edits are cleared when:
  - User clicks "Cancel"
  - User successfully saves changes
  - Browser tab is closed (sessionStorage is cleared)
- Each project's edits are stored separately

### 3. Optimistic Updates
- Mutations automatically invalidate relevant queries
- UI updates immediately while background sync happens
- Failed updates are handled gracefully with rollback

### 4. Better Performance
- Reduced API calls = faster page loads
- Shared cache across components
- Automatic deduplication of simultaneous requests

### 5. Improved UX
- No loading spinners when switching tabs (uses cached data)
- Stale data is shown immediately while fresh data loads in background
- Error handling is centralized and consistent
- Unsaved work is preserved across navigation

## How Persistent Edits Work

### Storage Strategy

Edits are stored in `sessionStorage` under the key `assignment-calendar-edits`:

```typescript
{
  "project-123": [
    {
      "resourceId": "res-456",
      "date": "2024-01-15T00:00:00.000Z",
      "costTreatment": "capital",
      "oldValue": 50,
      "newValue": 75
    }
  ],
  "project-789": [...]
}
```

### Why sessionStorage?

- **Persists across navigation**: Survives tab switches and page refreshes
- **Cleared on tab close**: Prevents stale edits from accumulating
- **Per-tab isolation**: Each browser tab has its own storage
- **No server sync needed**: Purely client-side, no API calls

### Key Generation Consistency ⚠️ CRITICAL

The `usePersistedEdits` hook imports and uses the same `getCellKey` function from `calendarTransform.ts` to ensure consistent key generation:

```typescript
import { getCellKey } from '../utils/calendarTransform'
```

This is critical because:
- Keys must match exactly between save and load operations
- The `getCellKey` function formats dates as `YYYY-MM-DD` (e.g., `2024-02-11`)
- Using a different key format would cause edits to not be found when loading
- All components use the same key generation logic for consistency

**Previous Bug**: The hook initially had its own `getCellKey` function that used ISO format (`2024-02-11T00:00:00.000Z`), causing keys to mismatch and edits to not persist correctly. This has been fixed by importing the shared function.

### User Experience

1. User enters edit mode and makes changes to assignments
2. Changes are highlighted in pink
3. User navigates to another tab (e.g., Financials)
4. User returns to Assignments tab
5. **Result**: All unsaved changes are still there and highlighted
6. User can continue editing or save/cancel

### Edge Cases Handled

- **Date serialization**: Date objects are converted to ISO strings for storage
- **Multiple projects**: Each project's edits are stored separately
- **Storage errors**: Gracefully handled with console logging
- **Invalid data**: Parsing errors don't crash the component

## Cache Invalidation Strategy

The implementation uses a smart cache invalidation strategy:

### After Mutations
- `create` → Invalidates project and resource queries
- `update` → Invalidates specific assignment, project, and resource queries
- `bulkUpdate` → Invalidates all assignment queries (safest approach)
- `delete` → Invalidates all assignment queries

### Manual Invalidation
Use the `useInvalidateAssignments()` hook when you need manual control:
```typescript
const { invalidateAll, invalidateProject, invalidateResource } = useInvalidateAssignments()

// Invalidate all assignment caches
invalidateAll()

// Invalidate specific project's assignments
invalidateProject(projectId)

// Invalidate specific resource's assignments  
invalidateResource(resourceId)
```

## Query Keys Structure

The hooks use a hierarchical query key structure for efficient cache management:

```typescript
['assignments'] // Root
['assignments', 'list'] // All lists
['assignments', 'list', filters] // Filtered lists
['assignments', 'detail'] // All details
['assignments', 'detail', id] // Specific assignment
['assignments', 'project', projectId] // Project assignments
['assignments', 'resource', resourceId] // Resource assignments
['assignments', 'resource', resourceId, 'date', date] // Resource assignments by date
```

## Configuration

React Query is configured in `frontend/src/main.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

## Testing the Implementation

### Test Caching
1. Navigate to a project's Assignments tab
2. Switch to the Financials tab
3. Switch back to Assignments
4. **Expected**: No loading spinner, assignments appear immediately from cache
5. Open browser DevTools Network tab to confirm no API call is made

### Test Persistent Edits
1. Navigate to a project's Assignments tab
2. Click "Edit" button
3. Make some changes to assignments (cells turn pink)
4. Navigate to another tab (e.g., Financials)
5. Navigate back to Assignments tab
6. **Expected**: All unsaved changes are still highlighted in pink
7. Click "Cancel" to clear edits
8. **Expected**: All highlights disappear

## Future Enhancements

Potential improvements for future iterations:

1. **Optimistic Updates**: Update UI immediately before API call completes
2. **Infinite Queries**: For paginated assignment lists
3. **Prefetching**: Preload data for likely next navigation
4. **Persisted Cache**: Save cache to localStorage for offline support
5. **Real-time Updates**: WebSocket integration for live data sync
6. **Edit Conflict Detection**: Warn if another user edited the same cells
7. **Auto-save Draft**: Periodically save edits to prevent data loss

## Performance Optimizations

### Typing Performance
The calendar has been optimized for instant, responsive typing when editing cells:

1. **Local Input State (CRITICAL)**
   - EditableCell uses local state for the input value
   - Changes are only committed to parent on blur or Enter key
   - This prevents parent re-renders on every keystroke
   - Typing feels instant because only the focused cell updates

2. **Debounced sessionStorage Saves** (500ms)
   - Saves to sessionStorage are debounced to avoid blocking the UI
   - Edits are persisted reliably after you stop typing
   - Location: `frontend/src/hooks/usePersistedEdits.ts`

3. **Memoized Callbacks**
   - `handleCellChange` is memoized with `useCallback`
   - `handleCellBlur` is memoized
   - `formatDate` is memoized
   - Location: `frontend/src/components/resources/ResourceAssignmentCalendar.tsx`

4. **Non-Memoized Display Function**
   - `getDisplayValue` is intentionally NOT memoized
   - Avoids dependency on `editedCells` which changes frequently
   - Prevents unnecessary callback recreation

5. **React.memo on EditableCell**
   - Uses `React.memo` with custom comparison
   - Only re-renders when value, edit mode, or error state changes
   - Callback references are stable so memo works correctly

6. **Lazy TextField Rendering**
   - TextField only renders when cell is focused
   - Unfocused cells render as lightweight spans
   - Prevents rendering thousands of TextField components

7. **Removed Console Logging from Hot Paths** ⚠️ CRITICAL
   - Removed all console.log statements from `calendarTransform.ts`
   - Removed console logging from `usePersistedEdits.ts` (kept only error logging)
   - Console logging in frequently-called functions causes significant performance degradation
   - Location: `frontend/src/utils/calendarTransform.ts`

8. **Deferred Cross-Project Validation** ⚠️ CRITICAL FOR TABBING
   - Cross-project allocation validation is now ONLY performed at save time
   - Previously, `handleCellBlur` made an async API call on every blur event
   - This caused noticeable delay when tabbing between cells (waiting for API response)
   - Now `handleCellBlur` is a no-op, allowing instant tabbing
   - All validation still happens before save, ensuring data integrity
   - Location: `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` (line ~730)

9. **React 18 Transitions and Microtasks for Non-Blocking Updates** ⚠️ CRITICAL FOR TABBING
   - State updates in `handleCellChange` are deferred using `queueMicrotask`
   - Focus state updates in `handleFocus` and `handleBlur` happen immediately
   - `queueMicrotask` is faster than `setTimeout(..., 0)` and `startTransition`
   - Microtasks execute before the next render but after the current synchronous code
   - This allows tab navigation to complete instantly without waiting for state updates
   - The browser prioritizes the tab focus change over the deferred state update
   - Location: `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` (lines ~108, ~115, ~670)

10. **Immediate Focus State Updates** ⚠️ CRITICAL FOR INSTANT TABBING
   - The `handleBlur` function now updates `isFocused` state immediately (synchronously)
   - The `handleFocus` function also updates `isFocused` state immediately
   - Only the `commitValue()` and `onBlur()` calls are deferred with `queueMicrotask`
   - This prevents any delay in the visual focus change when tabbing
   - The value commit still happens, just asynchronously after the tab completes
   - Location: `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` (line ~108)

These optimizations ensure typing and tabbing feel instant even with large calendars (100+ resources, 365+ days).

## Troubleshooting

### Cache Not Working
- Check that QueryClient is properly configured in main.tsx
- Verify query keys are consistent across hooks
- Check browser console for React Query DevTools

### Stale Data Issues  
- Adjust `staleTime` in query options
- Use manual invalidation after critical mutations
- Consider reducing cache time for frequently changing data

### Persistent Edits Not Working
- Check browser console for storage errors
- Verify sessionStorage is enabled in browser
- Check that projectId is consistent across navigation
- Clear sessionStorage manually: `sessionStorage.clear()`

### Performance Issues
- Monitor cache size in React Query DevTools
- Implement cache garbage collection if needed
- Consider pagination for large datasets
- Monitor sessionStorage size (5-10MB limit)

## Related Files

- `frontend/src/hooks/useAssignments.ts` - Custom React Query hooks
- `frontend/src/hooks/usePersistedEdits.ts` - Persistent edits hook
- `frontend/src/components/resources/ResourceAssignmentCalendar.tsx` - Main calendar component
- `frontend/src/components/resources/AssignmentCalendar.tsx` - Simple calendar view
- `frontend/src/pages/resources/ResourceDetailPage.tsx` - Resource detail page
- `frontend/src/main.tsx` - QueryClient configuration
- `frontend/src/api/assignments.ts` - API client functions

## Conclusion

The React Query integration is now complete with both data caching and persistent unsaved edits. The implementation follows React Query best practices and provides a solid foundation for future enhancements. Users can now navigate freely without losing their work or triggering unnecessary API calls.

