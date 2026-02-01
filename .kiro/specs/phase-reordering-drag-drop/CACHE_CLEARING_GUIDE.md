# Cache Clearing Guide - PhaseList v5.0

## Problem

You're still seeing the validation error even though the fix is in place. This is a browser caching issue.

## How to Verify the Fix is Loading

1. **Open Browser Console** (F12)
2. **Navigate to a project's Phases tab**
3. **Click edit (pencil) icon** on any phase
4. **Edit the expense budget**
5. **Click save**
6. **Check console** for this message:
   ```
   [PhaseList v5.0] Saving phase without total_budget: {editingPhaseId: "...", updateData: {...}, removedTotalBudget: ...}
   ```

If you see this message, the fix is loading correctly!

## If You DON'T See the Console Message

The browser is still loading the old code. Try these steps in order:

### Step 1: Hard Refresh (Most Common Solution)
- **Windows/Linux**: Ctrl + Shift + R or Ctrl + F5
- **Mac**: Cmd + Shift + R

### Step 2: Clear Browser Cache
1. Open DevTools (F12)
2. Right-click the refresh button
3. Select "Empty Cache and Hard Reload"

OR

1. Press Ctrl+Shift+Delete (Cmd+Shift+Delete on Mac)
2. Select "Cached images and files"
3. Click "Clear data"

### Step 3: Disable Cache in DevTools
1. Open DevTools (F12)
2. Go to Network tab
3. Check "Disable cache"
4. Keep DevTools open
5. Refresh the page

### Step 4: Clear Service Workers
1. Open DevTools (F12)
2. Go to Application tab
3. Click "Service Workers" in left sidebar
4. Click "Unregister" for any service workers
5. Refresh the page

### Step 5: Try Incognito/Private Mode
1. Open a new incognito/private window
2. Navigate to your app
3. Test the phase editing

### Step 6: Restart Dev Server
```bash
# In the frontend directory
# Stop the server (Ctrl+C)
npm run dev
```

Wait for "✓ built in XXXms" message, then refresh browser.

### Step 7: Clear Node Modules Cache (Nuclear Option)
```bash
cd frontend
rm -rf node_modules/.vite
npm run dev
```

## What the Fix Does

The v5.0 fix removes `total_budget` from the update payload:

**Before (v4.0)**:
```javascript
onUpdate(editingPhaseId, editValues)
// Sends: { capital_budget: 150000, expense_budget: 75000, total_budget: 225000 }
```

**After (v5.0)**:
```javascript
const { total_budget, ...updateData } = editValues
onUpdate(editingPhaseId, updateData)
// Sends: { capital_budget: 150000, expense_budget: 75000 }
// Backend calculates total_budget itself
```

## Expected Behavior After Fix

1. Edit expense budget → Total updates on screen ✓
2. Click save → **No validation error** ✓
3. Backend calculates total_budget from capital + expense ✓
4. UI refreshes with backend-calculated total ✓

## Still Having Issues?

If you've tried all the above steps and still see the error:

1. Check the browser console for the v5.0 log message
2. If you see it, the issue might be in the parent component or backend
3. If you don't see it, try a different browser
4. Check if there are multiple tabs open with the app

## Verification Checklist

- [ ] Hard refreshed browser (Ctrl+Shift+R)
- [ ] Cleared browser cache
- [ ] Disabled cache in DevTools
- [ ] Checked console for v5.0 log message
- [ ] Tried incognito/private mode
- [ ] Restarted dev server
- [ ] Cleared Vite cache

If all checked and still not working, there may be a different issue.
