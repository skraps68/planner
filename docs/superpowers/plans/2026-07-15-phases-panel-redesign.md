# Phases & Budget Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the project Overview tab's "Phase Timeline" and "Project Phases and Budget" sections into one panel with a single Edit mode (timeline drag + all table rows editable, one Save/Cancel), and make the phases panel's date columns read-only (project dates are edited only from the info card).

**Architecture:** Frontend-only presentation/state refactor of three components, all consumed only by `PhaseEditor`, which is consumed only by `ProjectDetailPage`. `PhaseTimeline` gains an `embedded` (bare, compact) variant. `PhaseList` gains an `editMode` prop, loses its own `<Paper>`/title/Add-Phase button and its per-row pencil, and renders every date column read-only. `PhaseEditor` becomes the single `<Paper>` shell with one header (Edit → Add Phase/Cancel/Save) that gates both children's editability, drops all project-date handling, and keeps its existing single `phasesApi.batchUpdate` save. No backend, schema, or validation changes.

**Tech Stack:** React 18 + TypeScript + MUI + Recharts-free, React Query, Vitest + Testing Library. Working dir `frontend/`.

Design spec: [docs/superpowers/specs/2026-07-15-phases-budget-panel-redesign-design.md](../specs/2026-07-15-phases-budget-panel-redesign-design.md).

## Global Constraints

- **Frontend only.** No backend/API/schema/validation change. Save remains a single `phasesApi.batchUpdate(phases)`; no `projectsApi.update` from this panel.
- **Project dates are read-only in this panel.** Every date column (Start, End) renders as read-only text in both view and edit mode. Project dates are edited only from the project-info card (unchanged); the timeline moves only interior boundaries (it has no outer resize handles).
- **One edit mode, one Save/Cancel.** A single Edit button flips the whole panel editable (timeline resize/reorder handles + every row's name & four budget inputs). No per-row pencil. Save is disabled unless there are changes and no validation errors.
- **Preserve accessibility:** keep `PhaseTimeline`'s keyboard-reorder path (Ctrl/Cmd+Shift+M + arrows) working whenever reorder is enabled.
- **Four budget fields stay the source of truth:** `labor_capital_budget`, `labor_expense_budget`, `nonlabor_capital_budget`, `nonlabor_expense_budget`; per-row Total = their sum; totals row sums each column. (Unchanged from the current table.)
- **No new TypeScript errors:** `npx tsc --noEmit` baseline is **242**; the delta must be ≤ 0.
- **No new test failures** beyond adapting the test files you touch. The pre-existing failing files `PhaseEditor.properties.test.tsx` and `PhaseEditor.reordering.integration.test.tsx` are documented debt (missing AuthProvider / fast-check flakiness) — do not fix them here, but do not add new failures.
- Run frontend tests with `cd frontend && npx vitest run <file>`.

---

## File Structure

- `frontend/src/components/phases/PhaseTimeline.tsx` — add `embedded` compact variant (Task 1)
- `frontend/src/components/phases/PhaseList.tsx` — `editMode` prop; drop Paper/title/Add/pencil; read-only dates (Task 2)
- `frontend/src/components/phases/PhaseEditor.tsx` — single-panel shell + unified header; drop project-date handling (Task 2)
- `frontend/src/pages/projects/ProjectDetailPage.tsx` — remove `onProjectDateChange`/`handleProjectDateChange` (Task 2)
- `frontend/src/components/phases/PhaseList.tsx` — Description → hover (read) / expand (edit) + density polish (Task 3)
- Tests: `PhaseTimeline.embedded.test.tsx` (new, Task 1); `PhaseList.budget-split.test.tsx`, `PhaseList.boundary-dates.test.tsx`, `PhaseEditor.test.tsx`, new `PhaseEditor.panel.test.tsx` (Task 2)

---

### Task 1: `PhaseTimeline` — embedded compact variant

**Files:**
- Modify: `frontend/src/components/phases/PhaseTimeline.tsx` (props + outer render, ~lines 6-17, 1229-1268)
- Test: `frontend/src/components/phases/PhaseTimeline.embedded.test.tsx` (create)

**Interfaces:**
- Produces: `PhaseTimeline` accepts `embedded?: boolean` (default `false`). When `true`, it renders **without** its own `<Paper>` and without the "Phase Timeline" title, as a compact ribbon (reduced padding + smaller date-label bands). All existing props/behavior (resize, reorder, keyboard, gaps/overlaps, boundary dates) are unchanged.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/phases/PhaseTimeline.embedded.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import PhaseTimeline from './PhaseTimeline'

const phases = [
  { id: '1', name: 'Design', start_date: '2024-01-01', end_date: '2024-03-31' },
  { id: '2', name: 'Build', start_date: '2024-04-01', end_date: '2024-12-31' },
]

const base = {
  phases, projectStartDate: '2024-01-01', projectEndDate: '2024-12-31',
  validationErrors: [], onPhaseResize: vi.fn(), onPhaseReorder: vi.fn(),
}

describe('PhaseTimeline embedded variant', () => {
  it('hides the section title when embedded', () => {
    render(<PhaseTimeline {...base} embedded />)
    expect(screen.queryByText(/Phase Timeline/i)).toBeNull()
    // phases still render
    expect(screen.getAllByText('Design').length).toBeGreaterThan(0)
  })

  it('shows the section title in the default (non-embedded) variant', () => {
    render(<PhaseTimeline {...base} />)
    expect(screen.getByText(/Phase Timeline/i)).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/phases/PhaseTimeline.embedded.test.tsx`
Expected: FAIL — the embedded case still finds "Phase Timeline" (prop ignored).

- [ ] **Step 3: Write minimal implementation**

Add `embedded` to the props interface (after `actions?`):

```tsx
  /** Render without an outer Paper/title, as a compact ribbon inside a parent panel */
  embedded?: boolean
```

Destructure it in the component signature (`embedded = false,`).

Replace the outer `return (<Paper sx={{ p: 2, mb: 2 }}> … </Paper>)` (currently line ~1230) with a container that is a plain `<Box>` when embedded, and drop the title in embedded mode. Concretely, wrap the existing body in a fragment and choose the shell:

```tsx
  const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) =>
    embedded
      ? <Box>{children}</Box>
      : <Paper sx={{ p: 2, mb: 2 }}>{children}</Paper>

  return (
    <Shell>
      {/* screen-reader announcer + <style> keyframes: keep exactly as-is */}
      …
      {/* Header row */}
      {!embedded && (
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" gutterBottom>
            Phase Timeline {enableResize && '(Interactive)'}
          </Typography>
          {actions && <Box sx={{ flexShrink: 0, ml: 2 }}>{actions}</Box>}
        </Box>
      )}

      <Box sx={{ mb: embedded ? 1 : 2 }}>
        <Box
          ref={timelineRef}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          sx={{
            position: 'relative',
            height: 40,
            backgroundColor: '#f5f5f5',
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            cursor: isDragging ? 'ew-resize' : 'default',
            userSelect: 'none',
            mb: embedded ? 1.5 : 2,   // room for bottom boundary-date labels
            mt: embedded ? 2.5 : 2,   // room for top boundary-date labels
          }}
        >
          {sortedPhases.map((phase, index) => renderPhase(phase, index))}
          {renderGaps()}
          {renderOverlaps()}
          {renderDropZones()}
          {renderPreviewDates()}
          {renderBoundaryDates()}
        </Box>
      </Box>
    </Shell>
  )
```

Keep the screen-reader announcer `<Box role="status">` and the `<style>` keyframes block exactly as they are today, inside `Shell`. Leave everything above the return unchanged.

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/phases/PhaseTimeline.embedded.test.tsx src/components/phases/PhaseTimeline.accessibility.test.tsx
```
Expected: embedded test PASSES (2 passed); accessibility test unchanged (no new failures).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/phases/PhaseTimeline.tsx frontend/src/components/phases/PhaseTimeline.embedded.test.tsx
git commit -m "feat(fe): PhaseTimeline embedded compact variant (no Paper/title)"
```

---

### Task 2: Merged single-edit panel (`PhaseList` editMode + `PhaseEditor` shell + `ProjectDetailPage` cleanup)

This task is **atomic** — `PhaseList`'s prop change, `PhaseEditor`'s consumption, and `ProjectDetailPage`'s prop removal must land together to keep the build green (these are the only call sites).

**Files:**
- Modify: `frontend/src/components/phases/PhaseList.tsx` (props + render)
- Modify: `frontend/src/components/phases/PhaseEditor.tsx` (single-panel shell, header, drop project-date handling)
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx` (remove `onProjectDateChange`/`handleProjectDateChange`)
- Modify: `frontend/src/components/phases/PhaseList.budget-split.test.tsx`, `PhaseList.boundary-dates.test.tsx`, `PhaseEditor.test.tsx`
- Test: `frontend/src/components/phases/PhaseEditor.panel.test.tsx` (create)

**Interfaces:**
- `PhaseList` new props:
  ```ts
  interface PhaseListProps {
    phases: Partial<ProjectPhase>[]
    editMode: boolean
    onUpdate: (phaseId: string, updates: Partial<ProjectPhase>) => void
    onDelete: (phaseId: string) => void
    changedFields?: Record<string, Set<string>>
    deletedPhaseIds?: Set<string>
  }
  ```
  Removed props: `onAdd`, `onBoundaryDateChange`, `readOnly`. `PhaseList` renders **no** `<Paper>`, title, or Add-Phase button.
- `PhaseEditor` prop `onProjectDateChange` is **removed** from its `PhaseEditorProps`.

#### PhaseList changes

- [ ] **Step 1: Write the failing test (PhaseList read vs edit)**

Rewrite `frontend/src/components/phases/PhaseList.budget-split.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1', project_id: 'x', name: 'Design', start_date: '2026-01-01', end_date: '2026-06-30',
  description: '', labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}

describe('PhaseList', () => {
  it('read mode: labor/non-labor headers, currency text, no inputs', () => {
    render(<PhaseList phases={[phase as any]} editMode={false} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Labor Budget')).toBeInTheDocument()
    expect(screen.getByText('Non-Labor Budget')).toBeInTheDocument()
    expect(screen.getAllByText('$200.00').length).toBeGreaterThan(0)
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)  // no number inputs
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)     // no text inputs
  })

  it('edit mode: name + four budget inputs, dates stay read-only text', () => {
    render(<PhaseList phases={[phase as any]} editMode onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // four numeric budget inputs
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4)
    // a name text input
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(1)
    // dates are NOT inputs (no type=date fields)
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBe(0)
  })

  it('edit mode: editing a budget calls onUpdate with that field', () => {
    const onUpdate = vi.fn()
    render(<PhaseList phases={[phase as any]} editMode onUpdate={onUpdate} onDelete={vi.fn()} />)
    const inputs = screen.getAllByRole('spinbutton')  // first budget input is labor_capital
    fireEvent.change(inputs[0], { target: { value: '150' } })
    expect(onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ labor_capital_budget: 150 }))
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/phases/PhaseList.budget-split.test.tsx`
Expected: FAIL — `PhaseList` doesn't accept `editMode`; read mode still shows a pencil / edit affordances.

- [ ] **Step 3: Rewrite `PhaseList`**

Replace the props interface and remove the per-row edit state. Key changes to `PhaseList.tsx`:

- New signature:
  ```tsx
  const PhaseList: React.FC<PhaseListProps> = ({ phases, editMode, onUpdate, onDelete, changedFields = {}, deletedPhaseIds = new Set() }) => {
  ```
  Delete `editingPhaseId`, `editValues`, `handleEdit`, `handleSave`, `handleCancel`, `handleChange` (the per-row buffer). Keep `sortedPhases`, `activePhaseCount`, `toNumber`, `totals` (already sums the four columns), `formatCurrency`, `formatDate`, `isFieldChanged`, `hasAnyChanges`, `getChangedCellStyle`, `isPhaseDeleted`.
- Remove the outer `<Paper sx={{ p: 2 }}>`, the "Project Phases" title box, and the "Add Phase" button (all move to `PhaseEditor`). Render a `<Box>` containing just the `<TableContainer>` (keep the existing two-row `<TableHead>` from the budget-split work).
- Drop the **Actions** header/column entirely in read mode; in edit mode keep only a **Delete** action per row.
- Row cells (per phase), using `editMode`:
  ```tsx
  // Name
  <TableCell sx={{ ...getChangedCellStyle(isFieldChanged(phase.id,'name')), textDecoration: isDeleted?'line-through':'none' }}>
    {editMode
      ? <TextField size="small" fullWidth value={phase.name || ''}
          onChange={(e)=>onUpdate(phase.id!, { name: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }} />
      : (phase.name || '-')}
  </TableCell>

  // Description (Task 3 will convert to hover/expand; for now: text in read, input in edit)
  <TableCell sx={{ ...getChangedCellStyle(isFieldChanged(phase.id,'description')), textDecoration: isDeleted?'line-through':'none' }}>
    {editMode
      ? <TextField size="small" fullWidth value={phase.description || ''}
          onChange={(e)=>onUpdate(phase.id!, { description: e.target.value })}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }} />
      : (phase.description || '-')}
  </TableCell>

  // Start / End — ALWAYS read-only text (dates owned by timeline/info card)
  <TableCell sx={{ textDecoration: isDeleted?'line-through':'none' }}>
    {phase.start_date ? formatDate(phase.start_date) : '-'}
  </TableCell>
  <TableCell sx={{ textDecoration: isDeleted?'line-through':'none' }}>
    {phase.end_date ? formatDate(phase.end_date) : '-'}
  </TableCell>
  ```
  For each of the four budgets, a numeric cell (shown here for `labor_capital_budget`; repeat for `labor_expense_budget`, `nonlabor_capital_budget`, `nonlabor_expense_budget` with their own field names):
  ```tsx
  <TableCell align="right" sx={{ ...getChangedCellStyle(isFieldChanged(phase.id,'labor_capital_budget')), textDecoration: isDeleted?'line-through':'none' }}>
    {editMode
      ? <TextField size="small" type="number" value={toNumber(phase.labor_capital_budget)}
          onChange={(e)=>onUpdate(phase.id!, { labor_capital_budget: parseFloat(e.target.value) || 0 })}
          inputProps={{ min: 0, step: 0.01 }}
          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }} />
      : formatCurrency(toNumber(phase.labor_capital_budget))}
  </TableCell>
  ```
  Total cell — read-only, live sum of the four:
  ```tsx
  <TableCell align="right" sx={{ textDecoration: isDeleted?'line-through':'none' }}>
    {formatCurrency(
      toNumber(phase.labor_capital_budget) + toNumber(phase.labor_expense_budget) +
      toNumber(phase.nonlabor_capital_budget) + toNumber(phase.nonlabor_expense_budget))}
  </TableCell>
  ```
  Delete cell — **edit mode only**:
  ```tsx
  {editMode && (
    <TableCell align="center">
      <IconButton size="small" color="error" onClick={()=>phase.id && onDelete(phase.id)}
        disabled={activePhaseCount === 1 || isDeleted} aria-label="delete">
        <DeleteIcon fontSize="small" />
      </IconButton>
    </TableCell>
  )}
  ```
- `<TableHead>`: keep the two-row Labor/Non-Labor header from the budget-split work, but the trailing **Actions** header cell should render only when `editMode` (adjust its `rowSpan`/placement accordingly). The empty-state and totals-row `colSpan`s must match the current column count (9 in read mode, 10 in edit mode). Keep the totals row (`totals.laborCapital` … `totals.total`).

Remove the now-unused `AddIcon`, `SaveIcon`, `CancelIcon`, `EditIcon`, `Button` imports if they're no longer referenced.

- [ ] **Step 4: Run PhaseList test to verify it passes**

Run: `cd frontend && npx vitest run src/components/phases/PhaseList.budget-split.test.tsx`
Expected: PASS (3 passed).

#### PhaseEditor changes

- [ ] **Step 5: Rewrite `PhaseEditor` render + drop project-date handling**

In `PhaseEditor.tsx`:
- Imports: add `Paper, Typography` from `@mui/material`; add `Add as AddIcon` from `@mui/icons-material`.
- Remove from `PhaseEditorProps`: `onProjectDateChange?: (...)`. Remove it from the destructured params.
- Delete `handleBoundaryDateChange` (the whole function, ~lines 262-285).
- `handlePhaseResize`, `handlePhaseReorder`, `handleAddPhase`, `handleUpdatePhase`, `handleDeletePhase`, `handleSave`, `handleCancel`, the validation `useEffect`, and `hasChanges`/`hasValidationErrors` are all **unchanged**.
- Replace the `timelineActions` block and the final `return` with a single-panel shell:

```tsx
  const headerActions = !isEditMode ? (
    canEdit ? (
      <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => setIsEditMode(true)}>
        Edit
      </Button>
    ) : null
  ) : (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddPhase}>
        Add Phase
      </Button>
      <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleCancel} disabled={isSaving}>
        Cancel
      </Button>
      <Button variant="contained" size="small"
        startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
        onClick={handleSave} disabled={isSaving || hasValidationErrors || !hasChanges}>
        Save Changes
      </Button>
    </Box>
  )

  return (
    <Paper sx={{ p: 2 }}>
      <ValidationErrorDisplay errors={validationErrors} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Phases &amp; Budget</Typography>
        {headerActions}
      </Box>

      <PhaseTimeline
        embedded
        phases={activePhases}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        validationErrors={validationErrors}
        onPhaseResize={handlePhaseResize}
        enableResize={isEditMode}
        onPhaseReorder={handlePhaseReorder}
        enableReorder={isEditMode}
      />

      <PhaseList
        editMode={isEditMode}
        phases={phases}
        onUpdate={handleUpdatePhase}
        onDelete={handleDeletePhase}
        changedFields={changedFields}
        deletedPhaseIds={deletedPhaseIds}
      />
    </Paper>
  )
```

(`activePhases` — the deleted-filtered list already computed near the end of the component — stays as the timeline's `phases`; `PhaseList` still gets the full `phases` so it can strike through pending-deleted rows.)

#### ProjectDetailPage cleanup

- [ ] **Step 6: Remove the project-date bridge**

In `frontend/src/pages/projects/ProjectDetailPage.tsx`:
- Delete the `onProjectDateChange={handleProjectDateChange}` line from the `<PhaseEditor>` usage (~line 530).
- Delete the entire `handleProjectDateChange` function (~lines 191-231). (Its `refetch`, `queryClient`, and `setSnackbar` are used elsewhere, so removing only this function is safe.)
- The project-info card's own date editing (`handleSaveInfo` → `projectsApi.update(editValues)`) is unchanged and remains the sole way to edit project dates.

- [ ] **Step 7: Update the remaining touched tests**

- `PhaseEditor.test.tsx` (currently exercises `PhaseList` with old props): update each `render(<PhaseList … onAdd=… capital_budget=… />)` to the new interface — remove `onAdd`, add `editMode={false}` (or `editMode` where the test needs inputs), and give fixtures the four `*_budget` fields. Delete assertions that depend on the removed per-row pencil / Add-Phase button inside `PhaseList` (Add now lives in `PhaseEditor`).
- `PhaseList.boundary-dates.test.tsx`: its premise (editing first/last boundary **dates** in the table) is removed by this redesign. Replace its body with a single assertion that **no date inputs render in edit mode**:
  ```tsx
  it('renders all date columns read-only in edit mode', () => {
    render(<PhaseList phases={mockPhases} editMode onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(document.querySelectorAll('input[type="date"]').length).toBe(0)
  })
  ```
- `PhaseList.bugfix.test.tsx`: if it renders `PhaseList`, update props to the new interface (add `editMode`), keep its total-calculation assertions.

- [ ] **Step 8: Write the panel integration test (new)**

```tsx
// frontend/src/components/phases/PhaseEditor.panel.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '../../test/test-utils'

// edit permission
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../utils/permissions', () => ({ hasPermission: () => ({ hasPermission: true }) }))

const listMock = vi.fn()
const batchMock = vi.fn()
vi.mock('../../api/phases', () => ({
  phasesApi: {
    list: (...a: any[]) => listMock(...a),
    batchUpdate: (...a: any[]) => batchMock(...a),
  },
}))

import PhaseEditor from './PhaseEditor'

const phases = [{
  id: 'p1', project_id: 'proj1', name: 'Design',
  start_date: '2026-01-01', end_date: '2026-12-31', description: '',
  labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}]

const renderEditor = () => render(
  <PhaseEditor projectId="proj1" projectStartDate="2026-01-01" projectEndDate="2026-12-31"
    onSaveSuccess={vi.fn()} onSaveError={vi.fn()} />
)

describe('PhaseEditor merged panel', () => {
  beforeEach(() => {
    listMock.mockReset(); batchMock.mockReset()
    listMock.mockResolvedValue(phases)
    batchMock.mockResolvedValue(phases)
  })

  it('read mode: one Edit button, no inputs', async () => {
    renderEditor()
    await waitFor(() => expect(screen.getByText('Design')).toBeTruthy())
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy()
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('Edit reveals inputs + Add/Cancel/Save; dates stay read-only', async () => {
    renderEditor()
    await waitFor(() => expect(screen.getByText('Design')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByRole('button', { name: /add phase/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4)   // four budgets
    expect(document.querySelectorAll('input[type="date"]').length).toBe(0)  // dates read-only
  })

  it('one Save issues a single batchUpdate', async () => {
    renderEditor()
    await waitFor(() => expect(screen.getByText('Design')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    const budget = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(budget, { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(batchMock).toHaveBeenCalledTimes(1))
    const [, payload] = batchMock.mock.calls[0]
    expect(payload.phases[0]).toEqual(expect.objectContaining({
      labor_capital_budget: 150, nonlabor_capital_budget: 30,
      total_budget: 250,  // 150 + 50 + 30 + 20
    }))
  })
})
```

- [ ] **Step 9: Run the full touched suite + tsc**

```bash
cd frontend && npx vitest run src/components/phases/
npx tsc --noEmit 2>&1 | wc -l
```
Expected: the files you touched pass; only the two pre-existing failing files (`PhaseEditor.properties`, `PhaseEditor.reordering.integration`) remain red; `tsc` count ≤ 242.

- [ ] **Step 10: Commit**

```bash
git add frontend/src/components/phases/PhaseList.tsx frontend/src/components/phases/PhaseEditor.tsx \
  frontend/src/pages/projects/ProjectDetailPage.tsx \
  frontend/src/components/phases/PhaseList.budget-split.test.tsx \
  frontend/src/components/phases/PhaseList.boundary-dates.test.tsx \
  frontend/src/components/phases/PhaseList.bugfix.test.tsx \
  frontend/src/components/phases/PhaseEditor.test.tsx \
  frontend/src/components/phases/PhaseEditor.panel.test.tsx
git commit -m "feat(fe): merge phase timeline + budget table into one single-edit panel"
```

---

### Task 3: Density polish — Description as hover (read) / expand (edit), tighter rows

**Files:**
- Modify: `frontend/src/components/phases/PhaseList.tsx`
- Test: `frontend/src/components/phases/PhaseList.density.test.tsx` (create)

**Interfaces:**
- Consumes: Task 2 `PhaseList`.
- Produces: read mode no longer shows a Description **column**; a phase with a description shows a small info affordance (MUI `Tooltip` around an info icon). Edit mode reveals a Description input via a per-row expand toggle rather than a permanent column. Table uses `size="small"` with reduced cell padding.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/components/phases/PhaseList.density.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1', project_id: 'x', name: 'Design', start_date: '2026-01-01', end_date: '2026-06-30',
  description: 'kickoff', labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}

describe('PhaseList density', () => {
  it('read mode has no Description column header', () => {
    render(<PhaseList phases={[phase as any]} editMode={false} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Description')).toBeNull()
  })
  it('read mode exposes the description via an info affordance', () => {
    render(<PhaseList phases={[phase as any]} editMode={false} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByLabelText(/description/i)).toBeTruthy()  // info icon button/tooltip trigger
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx vitest run src/components/phases/PhaseList.density.test.tsx`
Expected: FAIL — a "Description" header column is still present.

- [ ] **Step 3: Implement**

- Remove the Description `<TableCell>` header and drop it from the two-row header colspan math (read mode column count becomes 8; edit mode 9 incl. Delete).
- In each row's Name cell (read mode), when `phase.description` is non-empty, render an `<InfoOutlinedIcon fontSize="inherit">` wrapped in `<Tooltip title={phase.description}>` with `aria-label={`description: ${phase.description}`}` next to the name.
- In edit mode, add a small expand `IconButton` (chevron) in the Name cell that toggles a local `Set<string>` of expanded phase ids; when expanded, render a full-width row beneath the phase (`<TableRow><TableCell colSpan={…}>`) containing a Description `TextField` wired to `onUpdate(phase.id!, { description })`.
- Set the `<Table size="small">` and tighten cell `py` (e.g. `sx={{ py: 0.25 }}` on body cells) for a denser resting height.

- [ ] **Step 4: Run to verify it passes**

```bash
cd frontend && npx vitest run src/components/phases/PhaseList.density.test.tsx src/components/phases/PhaseList.budget-split.test.tsx
npx tsc --noEmit 2>&1 | wc -l
```
Expected: PASS; budget-split still green; tsc ≤ 242.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/phases/PhaseList.tsx frontend/src/components/phases/PhaseList.density.test.tsx
git commit -m "feat(fe): tighten phases table; description via hover/expand"
```

---

## Final verification (after all tasks)

- [ ] `cd frontend && npx vitest run src/components/phases/` — every file green except the two documented pre-existing failures (`PhaseEditor.properties`, `PhaseEditor.reordering.integration`); no new failures.
- [ ] `npx tsc --noEmit 2>&1 | wc -l` — ≤ 242 (no new type errors).
- [ ] Drive the app (Overview tab of a project): one panel titled "Phases & Budget"; read mode shows the compact timeline ribbon + tight table with the four budget columns and no inputs; a single **Edit** flips the timeline into resize/reorder handles **and** turns every row's name+budget cells into inputs with **Add Phase / Cancel / Save Changes** in the header; date cells stay read-only; **Save** persists via one `batchUpdate`; **Cancel** reverts. Confirm project dates still edit from the info card and cascade to the first/last phase.
- [ ] Confirm keyboard reorder (Ctrl/Cmd+Shift+M + arrows) still works in edit mode.

## Self-review (author)

- **Spec coverage:** §3-A container merge → Task 2 (single `<Paper>` + header); §3-B single edit mode → Task 2 (`editMode` gate + one Save/Cancel); §3-B′ / §6 dates read-only, project dates via info card only → Task 2 (read-only date cells, `onProjectDateChange` removed, single `batchUpdate`); §3-C density + Description hover → Task 3; §3-D compact always-on timeline → Task 1 (`embedded`).
- **Green-build ordering:** Task 1 is additive (backward-compatible prop); Task 2 changes `PhaseList`'s interface, `PhaseEditor`'s consumption, and `ProjectDetailPage`'s prop **together** (the only call sites) so the build never breaks between commits.
- **Type consistency:** `PhaseList` prop `editMode: boolean`; the four budget field names match the model/schema; `PhaseEditor` drops `onProjectDateChange` and both call sites (its interface and `ProjectDetailPage`) are updated in the same task.
- **No placeholders:** every step has concrete code or an exact command; test files are given in full or as precise edits.
