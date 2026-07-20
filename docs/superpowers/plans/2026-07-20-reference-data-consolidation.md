# Reference Data Consolidation + Worker-Edit Rate Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the three admin-only Setup screens (Worker Types, Rates, Resource Roles) into one React-Query-backed **Reference Data** screen, and show a worker's rate as read-only on the worker *edit* screen.

**Architecture:** Frontend only. A new `ReferenceDataPage` renders three panels — **Worker Types** and **Rates** side-by-side on top (they edit two different tables and stay separate; the Worker Types panel has no rate column), **Resource Roles** full-width below. The page uses React Query so it live-updates through the app's existing SSE invalidation; four `eventKeyMap` additions connect member/rate changes to the count/rate-bearing lists. Delete restrictions are surfaced with disabled icons + tooltips (backend already enforces them). The three old pages/routes/waffle items and their client permissions are retired.

**Tech Stack:** React 18 + TypeScript + MUI + React Query (`@tanstack/react-query`) + Vitest. `date-fns` for local dates.

## Global Constraints

- **Frontend only.** No backend, migration, service, or API changes. The design spec is `docs/superpowers/specs/2026-07-20-reference-data-consolidation-design.md`.
- **Type budget:** `cd frontend && npx tsc --noEmit | wc -l` must stay at **234** (net-zero) at every task boundary.
- **Test command:** `cd frontend && npx vitest run <path>` — note vitest here rejects the `-q` flag; do not pass it.
- **Alert conventions (do not deviate):** delete confirmation → `window.confirm` (app-wide standard); errors/success → bottom `Snackbar` toast; deletion restriction → disabled control + `Tooltip`. **No new MUI modal dialog.**
- **Effective date:** always `date-fns` `format(new Date(), 'yyyy-MM-dd')` (local date). Never `toISOString()`.
- `current_rate` is a **string** on the `Worker` and `WorkerType` types.
- Never stage or modify `.kiro/specs/ideas.txt` or `docs/database-erd.html`.
- Branch off `main`. Only stage files each task names.

---

## File Structure

**Created:**
- `frontend/src/pages/setup/ReferenceDataPage.tsx` — the consolidated screen (three panels + shared toast).
- `frontend/src/pages/setup/ReferenceDataPage.test.tsx` — component tests.

**Modified:**
- `frontend/src/realtime/eventKeyMap.ts` / `eventKeyMap.test.ts` — four live-update mappings.
- `frontend/src/utils/permissions.ts` / `permissions.test.ts` — swap three permissions for one.
- `frontend/src/components/common/AdminRoute.test.tsx` — sample permission swap.
- `frontend/src/App.tsx` — route swap.
- `frontend/src/components/layout/WaffleLauncher.tsx` — waffle item swap.
- `frontend/src/pages/workers/WorkerDetailPage.tsx` / `WorkerDetailPage.rate.test.tsx` — read-only rate in edit mode.

**Deleted:**
- `frontend/src/pages/setup/WorkerTypesPage.tsx` + `WorkerTypesPage.test.tsx`
- `frontend/src/pages/setup/RatesPage.tsx` + `RatesPage.test.tsx`
- `frontend/src/pages/setup/ResourceRolesPage.tsx` + `ResourceRolesPage.test.tsx`

---

## Task 1: eventKeyMap live-update additions

**Files:**
- Modify: `frontend/src/realtime/eventKeyMap.ts`
- Test: `frontend/src/realtime/eventKeyMap.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `queryKeyPrefixesFor('worker')` now includes `['worker-types']`; `('resource')` includes `['resource-roles']`; `('rate')` includes `['worker-types']`; `('resource_role')` returns `[['resource-roles']]`. Task 2/3 rely on these so the Reference Data panels live-refresh.

**Context:** `useRealtime` maps each backend `ChangeEvent.type` to React Query key prefixes and invalidates them. Backend events auto-emit from ORM listeners; no backend change. The count/rate a panel shows lives on a *parent* list (`worker_count`/`current_rate` on `['worker-types']`, `resource_count` on `['resource-roles']`), so member/rate changes must also invalidate those parents.

- [ ] **Step 1: Add the four assertions to the test**

Append to `frontend/src/realtime/eventKeyMap.test.ts` inside the existing `describe`:

```typescript
  it('maps worker changes to worker-types (worker_count freshness)', () => {
    expect(queryKeyPrefixesFor('worker')).toEqual(
      expect.arrayContaining([['worker-types']]),
    )
  })
  it('maps resource changes to resource-roles (resource_count freshness)', () => {
    expect(queryKeyPrefixesFor('resource')).toEqual(
      expect.arrayContaining([['resource-roles']]),
    )
  })
  it('maps rate changes to worker-types (current_rate freshness)', () => {
    expect(queryKeyPrefixesFor('rate')).toEqual(
      expect.arrayContaining([['worker-types']]),
    )
  })
  it('maps resource_role changes to the resource-roles list', () => {
    expect(queryKeyPrefixesFor('resource_role')).toEqual(
      expect.arrayContaining([['resource-roles']]),
    )
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/realtime/eventKeyMap.test.ts`
Expected: FAIL — the four new expectations don't match the current map (and `resource_role` returns `[]`).

- [ ] **Step 3: Update the map**

In `frontend/src/realtime/eventKeyMap.ts`, change the affected entries so `MAP` reads:

```typescript
const MAP: Record<string, Array<Array<string>>> = {
  resource: [['resources'], ['resource'], ['assignments'], ['resource-roles']],
  resource_assignment: [['assignments'], ['forecast'], ['actuals']],
  worker: [['workers'], ['worker'], ['resources'], ['worker-types']],
  worker_type: [['workers'], ['worker-types']],
  project: [['projects'], ['project'], ['forecast']],
  project_phase: [['phases'], ['project'], ['forecast']],
  program: [['programs'], ['program']],
  portfolio: [['portfolios'], ['portfolio']],
  rate: [['rates'], ['forecast'], ['worker-types']],
  actual: [['actuals'], ['forecast']],
  resource_role: [['resource-roles']],
  presence: [['presence']],
  lock: [['lock']],
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/realtime/eventKeyMap.test.ts`
Expected: PASS (all, including the pre-existing cases).

- [ ] **Step 5: Type check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/realtime/eventKeyMap.ts frontend/src/realtime/eventKeyMap.test.ts
git commit -m "feat(realtime): invalidate worker-types/resource-roles on member and rate changes"
```

---

## Task 2: ReferenceDataPage — Worker Types & Rates panels

**Files:**
- Create: `frontend/src/pages/setup/ReferenceDataPage.tsx`
- Test: `frontend/src/pages/setup/ReferenceDataPage.test.tsx`

**Interfaces:**
- Consumes: `workerTypesApi.list/create/update/delete` and `ratesApi.updateRate/getRateHistory` (`frontend/src/api/workers.ts`, `frontend/src/api/rates.ts`); `WorkerType` type (`id, type, description, worker_count?, current_rate?, version`). React Query keys `['worker-types']` and `['rates', <id>, 'history']`.
- Produces: default-exported `ReferenceDataPage` React component with a top-row `Grid` holding the **Worker Types** panel (`role="region" aria-label="Worker Types"`) and **Rates** panel (`role="region" aria-label="Rates"`), plus a shared toast via an internal `notify(message, severity)` helper. Task 3 adds the Resource Roles panel to this same file; Task 4 routes to this component.

**Context:** This reproduces the old `WorkerTypesPage` (minus its rate column) and `RatesPage`, on React Query, side-by-side. Both panels read the same `['worker-types']` query (React Query dedupes to one request). The Worker Types delete icon is disabled when the type still has workers (backend enforces; this is the UX affordance). `formatRate`/`today` mirror the old pages.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/pages/setup/ReferenceDataPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import ReferenceDataPage from './ReferenceDataPage'
import { workerTypesApi } from '../../api/workers'
import { ratesApi } from '../../api/rates'

vi.mock('../../api/workers', () => ({
  workerTypesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../../api/rates', () => ({
  ratesApi: {
    updateRate: vi.fn(),
    getRateHistory: vi.fn(),
  },
}))
vi.mock('../../api/resourceRoles', () => ({
  resourceRolesApi: { list: vi.fn().mockResolvedValue([]) },
}))

const employee = {
  id: 'wt1', type: 'Employee', description: 'Perm staff',
  worker_count: 5, current_rate: '1000.00', version: 1,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const contractor = {
  id: 'wt2', type: 'Full-Time Contractor', description: 'FTC',
  worker_count: 0, current_rate: '1300.00', version: 1,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

describe('ReferenceDataPage — Worker Types & Rates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerTypesApi.list).mockResolvedValue([employee, contractor] as any)
    vi.mocked(ratesApi.getRateHistory).mockResolvedValue({
      worker_type_id: 'wt1', worker_type_name: 'Employee', current_rate: 1000,
      rate_history: [{ id: 'r1', rate_amount: 1000, start_date: '2024-01-01', end_date: undefined, is_current: true, created_at: '2024-01-01T00:00:00Z' }],
    } as any)
  })

  it('shows Workers (not rate) in the Worker Types panel and Current Rate in the Rates panel', async () => {
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    const wt = within(screen.getByRole('region', { name: 'Worker Types' }))
    expect(wt.getByText('Workers')).toBeInTheDocument()
    expect(wt.queryByText('Current Rate')).toBeNull()

    const rates = within(screen.getByRole('region', { name: 'Rates' }))
    expect(rates.getByText('Current Rate')).toBeInTheDocument()
    expect(rates.getByText('$1000.00')).toBeInTheDocument()
  })

  it('disables Worker Type delete when the type still has workers', async () => {
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    expect(screen.getByRole('button', { name: /Delete Employee/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Delete Full-Time Contractor/i })).toBeEnabled()
  })

  it('edits a worker type via update (type/description only)', async () => {
    const user = userEvent.setup()
    vi.mocked(workerTypesApi.update).mockResolvedValue(employee as any)
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    await user.click(screen.getByRole('button', { name: /Edit Employee/i }))
    const desc = await screen.findByLabelText('Description')
    await user.clear(desc)
    await user.type(desc, 'Updated desc')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => expect(workerTypesApi.update).toHaveBeenCalledWith(
      'wt1', expect.objectContaining({ type: 'Employee', description: 'Updated desc', version: 1 }),
    ))
    expect(ratesApi.updateRate).not.toHaveBeenCalled()
  })

  it('sets a rate via ratesApi.updateRate with id, amount, and date', async () => {
    const user = userEvent.setup()
    vi.mocked(ratesApi.updateRate).mockResolvedValue({} as any)
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    const rates = within(screen.getByRole('region', { name: 'Rates' }))
    await user.click(rates.getAllByRole('button', { name: /Set Rate/i })[0])
    const amount = await screen.findByLabelText('Amount')
    await user.type(amount, '1100')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => expect(ratesApi.updateRate).toHaveBeenCalledWith(
      'wt1', 1100, expect.any(String),
    ))
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/setup/ReferenceDataPage.test.tsx`
Expected: FAIL — module `./ReferenceDataPage` does not exist yet.

- [ ] **Step 3: Create the component (page shell + both top panels)**

Create `frontend/src/pages/setup/ReferenceDataPage.tsx`:

```tsx
import React, { useState } from 'react'
import {
  Box, Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, CircularProgress, Alert, Snackbar,
  Dialog, DialogActions, DialogContent, DialogTitle, Collapse, Tooltip, Grid,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  KeyboardArrowDown as ExpandIcon, KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { workerTypesApi } from '../../api/workers'
import { ratesApi } from '../../api/rates'
import { WorkerType } from '../../types'

type Severity = 'success' | 'error'
type Notify = (message: string, severity: Severity) => void

const formatRate = (rate?: string | number | null) =>
  rate !== undefined && rate !== null && rate !== '' ? `$${rate}` : '—'
const today = () => format(new Date(), 'yyyy-MM-dd')
const errText = (e: any, fallback: string) => e?.response?.data?.detail || fallback

// ---------- Worker Types panel ----------
const WorkerTypesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: workerTypes = [], isLoading } = useQuery({
    queryKey: ['worker-types'],
    queryFn: () => workerTypesApi.list(),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkerType | null>(null)
  const [form, setForm] = useState({ type: '', description: '' })

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? workerTypesApi.update(editing.id, { type: form.type, description: form.description, version: editing.version })
        : workerTypesApi.create({ type: form.type, description: form.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-types'] })
      setDialogOpen(false)
    },
    onError: (e: any) => notify(errText(e, 'Failed to save worker type'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (wt: WorkerType) => workerTypesApi.delete(wt.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['worker-types'] }),
    onError: (e: any) => notify(errText(e, 'Failed to delete worker type'), 'error'),
  })

  const openCreate = () => { setEditing(null); setForm({ type: '', description: '' }); setDialogOpen(true) }
  const openEdit = (wt: WorkerType) => { setEditing(wt); setForm({ type: wt.type, description: wt.description || '' }); setDialogOpen(true) }
  const handleDelete = (wt: WorkerType) => {
    if ((wt.worker_count ?? 0) > 0) return
    if (!window.confirm(`Are you sure you want to delete the "${wt.type}" worker type?`)) return
    deleteMut.mutate(wt)
  }

  return (
    <Paper component="section" role="region" aria-label="Worker Types" sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Worker Types</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          Add Worker Type
        </Button>
      </Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Workers</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workerTypes.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No worker types found</TableCell></TableRow>
              ) : (
                workerTypes.map((wt) => {
                  const inUse = (wt.worker_count ?? 0) > 0
                  return (
                    <TableRow key={wt.id} hover>
                      <TableCell><Typography variant="body2" fontWeight="medium">{wt.type}</Typography></TableCell>
                      <TableCell>{wt.description}</TableCell>
                      <TableCell>{wt.worker_count ?? 0}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" aria-label={`Edit ${wt.type}`} onClick={() => openEdit(wt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={inUse ? `Can't delete — ${wt.worker_count} worker(s) still use this type. Reassign them first.` : ''}>
                          <span>
                            <IconButton size="small" aria-label={`Delete ${wt.type}`} disabled={inUse} onClick={() => handleDelete(wt)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Worker Type' : 'Add Worker Type'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField label="Type" value={form.type} required fullWidth
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
            <TextField label="Description" value={form.description} required fullWidth multiline rows={3}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.type || !form.description || saveMut.isPending}
            onClick={() => saveMut.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

// ---------- Rates panel ----------
const RateHistoryRows: React.FC<{ workerTypeId: string; open: boolean }> = ({ workerTypeId, open }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rates', workerTypeId, 'history'],
    queryFn: () => ratesApi.getRateHistory(workerTypeId),
    enabled: open,
  })
  const history = data?.rate_history ?? []
  if (isLoading) return <CircularProgress size={20} />
  return (
    <Table size="small">
      <TableHead>
        <TableRow><TableCell>Rate</TableCell><TableCell>Start Date</TableCell><TableCell>End Date</TableCell></TableRow>
      </TableHead>
      <TableBody>
        {history.length === 0 ? (
          <TableRow><TableCell colSpan={3} align="center">No rate history</TableCell></TableRow>
        ) : (
          history.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatRate(Number(r.rate_amount).toFixed(2))}</TableCell>
              <TableCell>{r.start_date}</TableCell>
              <TableCell>{r.end_date || '—'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

const RatesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: workerTypes = [], isLoading } = useQuery({
    queryKey: ['worker-types'],
    queryFn: () => workerTypesApi.list(),
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [target, setTarget] = useState<WorkerType | null>(null)
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(today())

  const setRateMut = useMutation({
    mutationFn: () => ratesApi.updateRate(target!.id, Number(amount), effectiveDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-types'] })
      qc.invalidateQueries({ queryKey: ['rates'] })
      setDialogOpen(false)
    },
    onError: (e: any) => notify(errText(e, 'Failed to set rate'), 'error'),
  })

  const openSetRate = (wt: WorkerType) => {
    setTarget(wt); setAmount(''); setEffectiveDate(today()); setDialogOpen(true)
  }

  return (
    <Paper component="section" role="region" aria-label="Rates" sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>Rates</Typography>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Current Rate</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workerTypes.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No worker types found</TableCell></TableRow>
              ) : (
                workerTypes.map((wt) => (
                  <React.Fragment key={wt.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" aria-label={`Expand ${wt.type}`}
                          onClick={() => setExpandedId(expandedId === wt.id ? null : wt.id)}>
                          {expandedId === wt.id ? <CollapseIcon /> : <ExpandIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell><Typography variant="body2" fontWeight="medium">{wt.type}</Typography></TableCell>
                      <TableCell>{formatRate(wt.current_rate)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => openSetRate(wt)}>Set Rate</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 0, borderBottom: expandedId === wt.id ? undefined : 'none' }}>
                        <Collapse in={expandedId === wt.id} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            <RateHistoryRows workerTypeId={wt.id} open={expandedId === wt.id} />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Rate{target ? ` — ${target.type}` : ''}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField label="Amount" type="number" value={amount} required fullWidth
              inputProps={{ min: 0, step: '0.01' }}
              onChange={(e) => setAmount(e.target.value)} />
            <TextField label="Effective Date" type="date" value={effectiveDate} required fullWidth
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setEffectiveDate(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!(Number(amount) > 0) || !effectiveDate || setRateMut.isPending}
            onClick={() => setRateMut.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

// ---------- Page ----------
const ReferenceDataPage: React.FC = () => {
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false, message: '', severity: 'error',
  })
  const notify: Notify = (message, severity) => setSnackbar({ open: true, message, severity })

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1.5 }}>Reference Data</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}><WorkerTypesPanel notify={notify} /></Grid>
        <Grid item xs={12} md={6}><RatesPanel notify={notify} /></Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ReferenceDataPage
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/setup/ReferenceDataPage.test.tsx`
Expected: PASS (all four tests).

- [ ] **Step 5: Type check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/setup/ReferenceDataPage.tsx frontend/src/pages/setup/ReferenceDataPage.test.tsx
git commit -m "feat(setup): Reference Data page with side-by-side Worker Types and Rates panels"
```

---

## Task 3: ReferenceDataPage — Resource Roles panel

**Files:**
- Modify: `frontend/src/pages/setup/ReferenceDataPage.tsx`
- Test: `frontend/src/pages/setup/ReferenceDataPage.test.tsx`

**Interfaces:**
- Consumes: `resourceRolesApi.list/create/update/delete` (`frontend/src/api/resourceRoles.ts`); `ResourceRole` type (`id, name, description?, resource_count?, version`); React Query key `['resource-roles']`.
- Produces: a full-width **Resource Roles** panel (`role="region" aria-label="Resource Roles"`) mounted below the top row in the same page.

**Context:** Reproduces the old `ResourceRolesPage` on React Query. Delete disabled for the `Default` role (existing wording) or a role with resources (new wording). The Task 2 test already mocks `resourceRolesApi.list` returning `[]`; this task adds real data + assertions.

- [ ] **Step 1: Add failing tests for the Resource Roles panel**

In `frontend/src/pages/setup/ReferenceDataPage.test.tsx`, extend the `resourceRolesApi` mock to include mutations and add role data. Replace the existing `vi.mock('../../api/resourceRoles', …)` line with:

```tsx
vi.mock('../../api/resourceRoles', () => ({
  resourceRolesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
```

The `.mockResolvedValue([])` default keeps the Task-2 describe block (which now renders the full three-panel page but doesn't set a roles return) resolving safely; `vi.clearAllMocks()` preserves mock implementations, so this default survives into every test that doesn't override it.

Add this import near the top:

```tsx
import { resourceRolesApi } from '../../api/resourceRoles'
```

Add a second `describe` block at the end of the file:

```tsx
const defaultRole = { id: 'rr0', name: 'Default', description: 'Fallback', resource_count: 2, version: 1 }
const architect = { id: 'rr1', name: 'Architect', description: 'Designs', resource_count: 3, version: 1 }
const analyst = { id: 'rr2', name: 'Analyst', description: 'Analysis', resource_count: 0, version: 1 }

describe('ReferenceDataPage — Resource Roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerTypesApi.list).mockResolvedValue([] as any)
    vi.mocked(resourceRolesApi.list).mockResolvedValue([defaultRole, architect, analyst] as any)
  })

  it('renders the roles with resource counts', async () => {
    render(<ReferenceDataPage />)
    const roles = within(await screen.findByRole('region', { name: 'Resource Roles' }))
    expect(roles.getByText('Architect')).toBeInTheDocument()
    expect(roles.getByText('Resources')).toBeInTheDocument()
  })

  it('disables delete for Default and for in-use roles, enables for unused', async () => {
    render(<ReferenceDataPage />)
    await screen.findByRole('region', { name: 'Resource Roles' })
    expect(screen.getByRole('button', { name: /Delete Default/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Delete Architect/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Delete Analyst/i })).toBeEnabled()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/setup/ReferenceDataPage.test.tsx`
Expected: FAIL — no `Resource Roles` region exists yet.

- [ ] **Step 3: Add the Resource Roles panel to the page**

In `frontend/src/pages/setup/ReferenceDataPage.tsx`:

Add to the imports from `../../api/resourceRoles` and the type import:

```tsx
import { resourceRolesApi } from '../../api/resourceRoles'
import { WorkerType, ResourceRole } from '../../types'
```

(Replace the existing `import { WorkerType } from '../../types'` line with the combined one above.)

Add the constant near the other module constants:

```tsx
const DEFAULT_ROLE_NAME = 'Default'
```

Add this panel component just above the `// ---------- Page ----------` section:

```tsx
// ---------- Resource Roles panel ----------
const ResourceRolesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['resource-roles'],
    queryFn: () => resourceRolesApi.list(),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ResourceRole | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? resourceRolesApi.update(editing.id, { name: form.name, description: form.description || undefined, version: editing.version })
        : resourceRolesApi.create({ name: form.name, description: form.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource-roles'] })
      setDialogOpen(false)
    },
    onError: (e: any) => notify(errText(e, 'Failed to save resource role'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (role: ResourceRole) => resourceRolesApi.delete(role.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resource-roles'] }),
    onError: (e: any) => notify(errText(e, 'Failed to delete resource role'), 'error'),
  })

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setDialogOpen(true) }
  const openEdit = (role: ResourceRole) => { setEditing(role); setForm({ name: role.name, description: role.description || '' }); setDialogOpen(true) }
  const handleDelete = (role: ResourceRole) => {
    if (role.name === DEFAULT_ROLE_NAME || (role.resource_count ?? 0) > 0) return
    if (!window.confirm(`Are you sure you want to delete the "${role.name}" role?`)) return
    deleteMut.mutate(role)
  }

  return (
    <Paper component="section" role="region" aria-label="Resource Roles" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Resource Roles</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>Add Role</Button>
      </Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Resources</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No resource roles found</TableCell></TableRow>
              ) : (
                roles.map((role) => {
                  const isDefault = role.name === DEFAULT_ROLE_NAME
                  const inUse = (role.resource_count ?? 0) > 0
                  const disabled = isDefault || inUse
                  const title = isDefault
                    ? 'Default role cannot be deleted'
                    : inUse
                      ? `Can't delete — ${role.resource_count} resource(s) still use this role. Reassign them first.`
                      : ''
                  return (
                    <TableRow key={role.id} hover>
                      <TableCell><Typography variant="body2" fontWeight="medium">{role.name}</Typography></TableCell>
                      <TableCell>{role.description}</TableCell>
                      <TableCell>{role.resource_count ?? 0}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" aria-label={`Edit ${role.name}`} onClick={() => openEdit(role)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={title}>
                          <span>
                            <IconButton size="small" aria-label={`Delete ${role.name}`} disabled={disabled} onClick={() => handleDelete(role)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Role' : 'Add Role'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField label="Name" value={form.name} required fullWidth
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <TextField label="Description" value={form.description} fullWidth multiline rows={3}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.name || saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}
```

Then mount it in the `ReferenceDataPage` `Grid`, below the two top panels:

```tsx
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}><WorkerTypesPanel notify={notify} /></Grid>
        <Grid item xs={12} md={6}><RatesPanel notify={notify} /></Grid>
        <Grid item xs={12}><ResourceRolesPanel notify={notify} /></Grid>
      </Grid>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/setup/ReferenceDataPage.test.tsx`
Expected: PASS (all tests, both describe blocks).

- [ ] **Step 5: Type check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/setup/ReferenceDataPage.tsx frontend/src/pages/setup/ReferenceDataPage.test.tsx
git commit -m "feat(setup): add Resource Roles panel to Reference Data page"
```

---

## Task 4: Wire route + waffle, swap permission, retire old screens

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/WaffleLauncher.tsx`
- Modify: `frontend/src/utils/permissions.ts`
- Modify: `frontend/src/utils/permissions.test.ts`
- Modify: `frontend/src/components/common/AdminRoute.test.tsx`
- Delete: `frontend/src/pages/setup/WorkerTypesPage.tsx`, `WorkerTypesPage.test.tsx`, `RatesPage.tsx`, `RatesPage.test.tsx`, `ResourceRolesPage.tsx`, `ResourceRolesPage.test.tsx`

**Interfaces:**
- Consumes: `ReferenceDataPage` (Task 2/3); `manage_reference_data` permission (added here).
- Produces: `/setup/reference-data` route (admin-gated) and a single **Reference Data** waffle item; the three old routes/items/pages/permissions are gone.

**Context:** This is the atomic cut-over: all references to the three old permissions and pages are removed in one commit so the project stays compiling. After this task, `manage_worker_types`/`manage_rates`/`manage_resource_roles` no longer exist anywhere.

- [ ] **Step 1: Update the permission tests (they will fail until code changes land)**

Replace the body of `frontend/src/utils/permissions.test.ts` with:

```typescript
import { describe, test, expect } from 'vitest'
import { hasPermission } from './permissions'

const admin = { roles: ['ADMIN'] } as any
const viewer = { roles: ['VIEWER'] } as any

describe('permissions', () => {
  test('admin has the reference-data permission', () => {
    expect(hasPermission(admin, 'manage_reference_data').hasPermission).toBe(true)
  })

  test('viewer lacks the reference-data permission', () => {
    expect(hasPermission(viewer, 'manage_reference_data').hasPermission).toBe(false)
  })
})
```

In `frontend/src/components/common/AdminRoute.test.tsx`, change **both** occurrences of `permission="manage_resource_roles"` (lines ~25 and ~52) to `permission="manage_reference_data"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd frontend && npx vitest run src/utils/permissions.test.ts src/components/common/AdminRoute.test.tsx`
Expected: FAIL — `manage_reference_data` is not yet a `Permission`.

- [ ] **Step 3: Swap the permission definition**

In `frontend/src/utils/permissions.ts`:
- In the `Permission` union, remove the three lines `| 'manage_rates'`, `| 'manage_resource_roles'`, `| 'manage_worker_types'` and add `| 'manage_reference_data'` in their place.
- In `rolePermissions.ADMIN`, remove the three entries `'manage_rates',`, `'manage_resource_roles',`, `'manage_worker_types',` and add `'manage_reference_data',`.

- [ ] **Step 4: Swap the route (`frontend/src/App.tsx`)**

- Remove the three imports (lines ~34–36):
  ```tsx
  import ResourceRolesPage from './pages/setup/ResourceRolesPage'
  import WorkerTypesPage from './pages/setup/WorkerTypesPage'
  import RatesPage from './pages/setup/RatesPage'
  ```
  and replace them with:
  ```tsx
  import ReferenceDataPage from './pages/setup/ReferenceDataPage'
  ```
- Remove the three `<Route path="/setup/resource-roles" …>`, `"/setup/worker-types"`, and `"/setup/rates"` blocks (lines ~87–110) and replace them with:
  ```tsx
                    <Route
                      path="/setup/reference-data"
                      element={
                        <AdminRoute permission="manage_reference_data">
                          <ReferenceDataPage />
                        </AdminRoute>
                      }
                    />
  ```

- [ ] **Step 5: Swap the waffle item (`frontend/src/components/layout/WaffleLauncher.tsx`)**

In the `Setup` group's `items` array, remove the three items:
```tsx
      { label: 'Resource Roles', path: '/setup/resource-roles', permission: 'manage_resource_roles' },
      { label: 'Worker Types', path: '/setup/worker-types', permission: 'manage_worker_types' },
      { label: 'Rates', path: '/setup/rates', permission: 'manage_rates' },
```
and add one, immediately after the `Workers` item:
```tsx
      { label: 'Reference Data', path: '/setup/reference-data', permission: 'manage_reference_data' },
```

- [ ] **Step 6: Delete the retired pages and their tests**

```bash
git rm frontend/src/pages/setup/WorkerTypesPage.tsx frontend/src/pages/setup/WorkerTypesPage.test.tsx \
       frontend/src/pages/setup/RatesPage.tsx frontend/src/pages/setup/RatesPage.test.tsx \
       frontend/src/pages/setup/ResourceRolesPage.tsx frontend/src/pages/setup/ResourceRolesPage.test.tsx
```

- [ ] **Step 7: Run tests + type check**

Run: `cd frontend && npx vitest run src/utils/permissions.test.ts src/components/common/AdminRoute.test.tsx src/pages/setup/`
Expected: PASS — permissions, AdminRoute, and ReferenceDataPage tests all green; no references to the deleted pages remain.

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234` (no dangling references to removed permissions/pages).

- [ ] **Step 8: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/WaffleLauncher.tsx \
        frontend/src/utils/permissions.ts frontend/src/utils/permissions.test.ts \
        frontend/src/components/common/AdminRoute.test.tsx
git commit -m "feat(setup): route Reference Data, retire Worker Types/Rates/Resource Roles screens"
```

---

## Task 5: Worker edit screen — read-only rate + note in edit mode

**Files:**
- Modify: `frontend/src/pages/workers/WorkerDetailPage.tsx`
- Test: `frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx`

**Interfaces:**
- Consumes: existing `worker.current_rate` and the loaded `workerTypes` list (each `WorkerType` has `current_rate`). No new APIs.
- Produces: a Rate field visible in both read and edit mode; in edit mode it is static text derived from the selected worker type, with a caption note.

**Context:** Currently the Rate grid item renders only when `!effectiveEditing` (read mode) from `worker.current_rate` (`WorkerDetailPage.tsx:225–232`). The existing test `WorkerDetailPage.rate.test.tsx` asserts the rate is *hidden* in edit mode — that assertion is now wrong and must be replaced. In edit mode the displayed rate should track the selected `worker_type_id` so it updates live when the dropdown changes.

- [ ] **Step 1: Rewrite the rate test to the new behavior**

Replace the two `it(...)` blocks in `frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx` (keep the imports, mocks, and fixtures). First, give the `workerType` fixture a rate so the edit-mode derivation has a value — change the `workerType` object to include `current_rate: '1000.00'`:

```tsx
const workerType = {
  id: 'wt1',
  type: 'Employee',
  description: 'Employee type',
  current_rate: '1000.00',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}
```

Then replace the two tests with:

```tsx
  it('shows the formatted rate in read mode', async () => {
    render(<WorkerDetailPage />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('keeps the rate visible (read-only) with a note after entering edit mode', async () => {
    const user = userEvent.setup()
    render(<WorkerDetailPage />)
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /edit/i }))

    // Rate still shown, as static text (not an input), with the guidance note.
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    expect(screen.getByText(/Rates are managed in Setup → Reference Data/i)).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /rate/i })).toBeNull()
  })
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd frontend && npx vitest run src/pages/workers/WorkerDetailPage.rate.test.tsx`
Expected: FAIL — the note isn't rendered and the rate is currently hidden in edit mode.

- [ ] **Step 3: Show the rate read-only in edit mode**

In `frontend/src/pages/workers/WorkerDetailPage.tsx`, replace the existing read-mode-only Rate grid item (currently guarded by `{!effectiveEditing && ( … )}` at lines ~225–232) with an always-present item whose value depends on mode:

```tsx
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Rate</Typography>
                <Typography variant="body1">
                  {(() => {
                    const displayRate = effectiveEditing
                      ? workerTypes.find((t) => t.id === formData.worker_type_id)?.current_rate
                      : worker?.current_rate
                    return displayRate
                      ? `$${Number(displayRate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : '—'
                  })()}
                </Typography>
                {effectiveEditing && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                    Rates are managed in Setup → Reference Data.
                  </Typography>
                )}
              </Grid>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd frontend && npx vitest run src/pages/workers/WorkerDetailPage.rate.test.tsx`
Expected: PASS (both tests).

- [ ] **Step 5: Type check**

Run: `cd frontend && npx tsc --noEmit | wc -l`
Expected: `234`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/workers/WorkerDetailPage.tsx frontend/src/pages/workers/WorkerDetailPage.rate.test.tsx
git commit -m "feat(workers): show read-only rate with Reference Data note on the worker edit screen"
```

---

## Final Verification (after all tasks)

- [ ] Full type budget: `cd frontend && npx tsc --noEmit | wc -l` → `234`.
- [ ] Focused suite green: `cd frontend && npx vitest run src/pages/setup/ src/pages/workers/ src/realtime/eventKeyMap.test.ts src/utils/permissions.test.ts src/components/common/AdminRoute.test.tsx`.
- [ ] Manual smoke (optional, dev server): as an admin, the waffle shows a single **Reference Data** item under Setup; `/setup/reference-data` shows Worker Types + Rates side-by-side with Resource Roles below; deleting an in-use type/role is blocked with a tooltip; setting a rate updates the Current Rate and history; the worker edit screen shows the rate read-only with the note. The old `/setup/worker-types|rates|resource-roles` paths 404/redirect.
