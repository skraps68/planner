# Task 10 Report: Worker rate display (read-only)

## Status: DONE

## Commit
af39c4a — feat(fe): show worker rate (read-only) on detail + list

## Summary

Followed TDD (superpowers:test-driven-development skill).

1. Wrote `frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx` first:
   - Mocks `../../api/workers` (workersApi.get returns worker with `current_rate: '1000.00'`, `worker_type_name: 'Employee'`, `version: 1`; workerTypesApi.list returns `[{id, type: 'Employee', ...}]`).
   - Mocks `react-router-dom` via `vi.importActual` + override `useParams` to return `{ id: 'w1' }`.
   - Mocks `../../realtime/usePresence`, `../../realtime/useEntityLock`, `../../realtime/PresenceBadge`, `../../realtime/LockBanner` per brief.
   - Test (a): read mode shows `$1,000.00` (chose comma-grouped, 2-decimal format via `toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })`).
   - Test (b): after clicking Edit, `$1,000.00` is no longer in the document.
   - Ran and confirmed RED (both tests failed — text not found) before implementing.

2. Implemented in `frontend/src/pages/workers/WorkerDetailPage.tsx`:
   - Added a new `Grid item xs={12} sm={4}` with caption "Rate" and value `${worker?.current_rate formatted}` or `'—'`, wrapped in `{!effectiveEditing && (...)}` so it renders only in read mode within the existing (non-new-worker) grid. Not added to the edit branch or the create-form branch — it's fully omitted (not disabled/greyed) when editing.

3. Implemented in `frontend/src/pages/workers/WorkersListPage.tsx`:
   - Added a "Rate" column header after "Worker Type", and a cell rendering `row.current_rate` formatted the same way (`'—'` fallback) after the worker-type cell, before the "Created" cell.
   - Bumped the empty-state row's `colSpan` from 5 to 6 to match the new column count (necessary side effect of adding a column; not called out explicitly in the brief but required for correct rendering).

## Verification

- `npx vitest run src/pages/workers/WorkerDetailPage.rate.test.tsx` → 2/2 pass.
- `npx vitest run src/pages/workers/` → 2 files, 6/6 tests pass (WorkerDetailPage.rate.test.tsx: 2, WorkersListPage.test.tsx: 4). No pre-existing failures; no regression (all workers-dir tests were passing before and after — WorkersListPage.test.tsx already existed and passed).
- `npx tsc --noEmit 2>&1 | wc -l` → 237 (matches required baseline).

## Files touched
- /home/peter/projects/planner/frontend/src/pages/workers/WorkerDetailPage.tsx
- /home/peter/projects/planner/frontend/src/pages/workers/WorkersListPage.tsx
- /home/peter/projects/planner/frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx (new)

## Concerns
None. Staged and committed only the three files above; left unrelated pre-existing working-tree changes (`.kiro/specs/ideas.txt` modified, `docs/database-erd.html` untracked) alone as instructed ("stage only your files").
