# Total Budget Calculation Fix (v8.0)

## Problem
After converting string budgets to numbers (v7.0), the validation error persisted: "total budget must equal capital + expense"

## Root Cause Analysis
The backend's `PhaseBatchItem` schema has a `@field_validator` that validates `total_budget` equals `capital_budget + expense_budget`:

```python
@field_validator('total_budget')
@classmethod
def validate_total_budget(cls, v, info):
    """Validate that total_budget equals capital_budget + expense_budget."""
    if 'capital_budget' in info.data and 'expense_budget' in info.data:
        expected_total = info.data['capital_budget'] + info.data['expense_budget']
        if v != expected_total:
            raise ValueError(f'Total budget must equal capital + expense ({expected_total})')
    return v
```

This validation happens **during Pydantic model instantiation**, which occurs when the request payload is parsed - BEFORE any service layer logic runs.

## Why Previous Fixes Didn't Work
- **v5.0**: Removed `total_budget` from PhaseList updates → But backend schema requires it
- **v6.0**: Removed `total_budget` from PhaseEditor batch updates → But backend schema requires it
- **v7.0**: Converted strings to numbers → Good, but still didn't send `total_budget`

The issue was that we were trying to let the backend "calculate" `total_budget`, but the validation happens at the schema level before any calculation logic can run.

## Solution (v8.0)
Calculate `total_budget` on the frontend and send it with the correct numeric value that matches `capital_budget + expense_budget`.

### Changes Made

#### 1. PhaseEditor.tsx
```typescript
const phasesData = activePhases.map((phase) => ({
  id: phase.id?.startsWith('temp-') ? null : phase.id,
  name: phase.name!,
  start_date: phase.start_date!,
  end_date: phase.end_date!,
  description: phase.description || '',
  capital_budget: toNumber(phase.capital_budget),
  expense_budget: toNumber(phase.expense_budget),
  total_budget: toNumber(phase.capital_budget) + toNumber(phase.expense_budget), // ← Calculate here
}))
```

#### 2. PhaseList.tsx (v8.0)
```typescript
// Remove read-only fields but KEEP total_budget
const { 
  assignment_count, 
  created_at, 
  updated_at, 
  project_id,
  ...updateData 
} = editValues

// Convert budgets to numbers
if (updateData.capital_budget !== undefined) {
  updateData.capital_budget = toNumber(updateData.capital_budget)
}
if (updateData.expense_budget !== undefined) {
  updateData.expense_budget = toNumber(updateData.expense_budget)
}
// Calculate total_budget from numeric values
updateData.total_budget = toNumber(updateData.capital_budget) + toNumber(updateData.expense_budget)
```

## Why This Works
1. **Converts strings to numbers** - Ensures type consistency
2. **Calculates total_budget correctly** - Satisfies backend validation
3. **Sends all required fields** - Backend schema validation passes
4. **Timing is correct** - Calculation happens before API call, validation passes during request parsing

## Testing Instructions
1. Hard refresh browser (Ctrl+Shift+R)
2. Edit a phase's expense budget
3. Verify total updates on screen
4. Click save
5. Should save successfully without validation error

## Backend Schema Consideration
If we wanted to avoid this frontend calculation, we would need to modify the backend:

**Option A**: Make `total_budget` optional in `PhaseBatchItem` and remove the validator
**Option B**: Add a `model_validator` that calculates `total_budget` if not provided

But since the current backend design validates at the schema level, the frontend must provide the correct value.

## Files Modified
- `frontend/src/components/phases/PhaseList.tsx` (v8.0)
- `frontend/src/components/phases/PhaseEditor.tsx`

## Version History
- v5.0: Removed total_budget from PhaseList updates
- v6.0: Removed total_budget from PhaseEditor batch updates  
- v7.0: Added string-to-number conversion
- v8.0: Calculate and send total_budget with correct value (this fix)
