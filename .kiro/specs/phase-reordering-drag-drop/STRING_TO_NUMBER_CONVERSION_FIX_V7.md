# String to Number Budget Conversion Fix (v7.0)

## Problem
The backend validation was failing with error: "total budget must equal capital + expense" even though the frontend was correctly calculating and displaying the total.

## Root Cause
Budget values from the Python backend API are serialized as strings (e.g., `'150000.00'`) due to Decimal type serialization. When these string values were sent back to the API in update requests, the backend's Pydantic validation was comparing:
- `capital_budget: '150000.00'` (string)
- `expense_budget: 102000` (number)
- `total_budget: calculated sum` (number)

This caused type mismatches and validation failures.

## Console Evidence
```
PhaseList.tsx:85 [PhaseList v5.0] Saving phase without total_budget:
updateData contains assignment_count, created_at, updated_at, project_id, 
capital_budget: '150000.00', expense_budget: 102000
```

## Solution
Added explicit type conversion in both PhaseList and PhaseEditor components to convert string budget values to numbers before sending to the API.

### Changes Made

#### 1. PhaseList.tsx (v7.0)
- Added conversion in `handleSave()` to convert `capital_budget` and `expense_budget` from strings to numbers
- Used existing `toNumber()` helper function
- Updated console log to v7.0 to track this fix

```typescript
// Convert string budget values to numbers for API
if (updateData.capital_budget !== undefined) {
  updateData.capital_budget = toNumber(updateData.capital_budget)
}
if (updateData.expense_budget !== undefined) {
  updateData.expense_budget = toNumber(updateData.expense_budget)
}
```

#### 2. PhaseEditor.tsx
- Added `toNumber()` helper function (same as PhaseList)
- Modified batch update to convert budgets before sending:

```typescript
capital_budget: toNumber(phase.capital_budget),
expense_budget: toNumber(phase.expense_budget),
```

## Why This Works
1. **Preserves original data types in state** - No false change detection
2. **Converts only when sending to API** - Ensures backend receives numbers
3. **Backend validation passes** - Numbers can be properly compared and summed
4. **Consistent with previous fixes** - Uses same `toNumber()` helper for display calculations

## Testing Instructions
1. Hard refresh browser (Ctrl+Shift+R) to clear cache
2. Edit a phase's expense budget
3. Verify total updates correctly on screen
4. Click save
5. Should save successfully without validation error

## Related Fixes
- v5.0: Removed `total_budget` from update payload
- v6.0: Removed `total_budget` from batch updates in PhaseEditor
- v7.0: Convert string budgets to numbers before API calls (this fix)

## Files Modified
- `frontend/src/components/phases/PhaseList.tsx`
- `frontend/src/components/phases/PhaseEditor.tsx`
