# PhaseList Font Size Fix v3.0 - Complete

## Problem

After fixing the NaN issue, the user reported that font sizes still appeared larger in editable fields compared to non-editable text in the table.

## Root Cause Analysis

The initial fix used `fontSize: 'inherit'`, which seemed correct but didn't work as expected. Here's why:

1. **Material-UI's Table with `size="small"`** applies a font size of `0.875rem` (14px) to TableCell content
2. **TextField component** wraps the actual input element in multiple layers
3. **`fontSize: 'inherit'`** on the input causes it to inherit from the TextField wrapper, NOT from the TableCell
4. The TextField wrapper doesn't have the table's font size, so it defaults to the theme's body font size (typically 1rem or 16px)

## Solution

Changed from `fontSize: 'inherit'` to explicit `fontSize: '0.875rem'` to match Material-UI's small table font size exactly.

### Before (v2.0):
```typescript
sx={{ '& .MuiInputBase-input': { fontSize: 'inherit' } }}
```

### After (v3.0):
```typescript
sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
```

## Changes Applied

Updated all 6 TextField components in PhaseList.tsx:

1. **Name field** - `fontSize: '0.875rem'`
2. **Description field** - `fontSize: '0.875rem'`
3. **Start date field** - `fontSize: '0.875rem'`
4. **End date field** - `fontSize: '0.875rem'`
5. **Capital budget field** - `fontSize: '0.875rem', textAlign: 'right'`
6. **Expense budget field** - `fontSize: '0.875rem', textAlign: 'right'`

## Version Marker

Updated bugfix marker from v2.0 to v3.0:
```typescript
{/* BUGFIX MARKER: v3.0 - Font size fixed to 0.875rem + NaN fix applied */}
```

## Test Results

All 9 tests still passing:
- ✓ Font size consistency (2 tests)
- ✓ NaN prevention (6 tests)
- ✓ Integration test (1 test)

## How to Verify

1. **Hard refresh your browser** (Ctrl+Shift+R or Cmd+Shift+R)
2. Click the edit (pencil) icon on any phase
3. **Inspect the input element** in browser DevTools
4. Look for `font-size: 0.875rem` in the computed styles
5. Verify text size matches between edit and view modes

## Expected Result

- All text in the table should be exactly the same size (14px / 0.875rem)
- No visual "jump" or size change when entering edit mode
- Edit mode fields should be perfectly aligned with view mode text

## Technical Notes

### Why 0.875rem?

Material-UI's theme defines small table font sizes as:
- Default body text: `1rem` (16px)
- Small table cells: `0.875rem` (14px)
- Small buttons/inputs: `0.875rem` (14px)

By using `0.875rem`, we ensure perfect alignment with Material-UI's design system.

### Why Not Use `inherit`?

The CSS `inherit` keyword inherits from the immediate parent element. In the TextField component hierarchy:

```
TableCell (0.875rem) 
  └─ TextField wrapper (no explicit font-size, defaults to theme)
      └─ InputBase
          └─ input (inherits from InputBase, not TableCell)
```

The input element is too many layers deep to inherit from the TableCell.

## Files Modified

1. `frontend/src/components/phases/PhaseList.tsx`
   - Changed all TextField fontSize from 'inherit' to '0.875rem'
   - Updated bugfix marker to v3.0

2. `.kiro/specs/phase-reordering-drag-drop/BUGFIX_VERIFICATION.md`
   - Updated Fix 1 explanation with root cause
   - Updated verification steps to check for v3.0

## Summary

The font size issue is now fully resolved by using an explicit font size that matches Material-UI's small table design. Combined with the NaN fix from v2.0, both bugs are now completely fixed.

**Please hard refresh your browser to see the changes!**
