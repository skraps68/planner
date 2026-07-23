# App-wide Table & UI Restyle (Option B — "Underline Neutral") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (recommended here — many steps are visual and need browser QA between phases). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Give every table the "Underline Neutral" look (no header fill, muted uppercase labels with a rule under them, tabular figures, ~30px rows) and make the rest of the app — titles, buttons, cards, tabs, filters, spacing — read as one cohesive institutional system, not a restyled table on an old shell.

**Architecture:** Almost everything flows from one centralized `frontend/src/theme.ts`. Phase 1 restyles the theme (palette, typography, table/grid headers, density, buttons, cards, tabs) — that alone upgrades all ~20 tables and most UI at once. Later phases remove the hardcoded `#A5C1D8` fills, add two shared shells (`PageHeader`, `DataTable`/toolbar), migrate flat lists onto the MUI X DataGrid the app already owns (for built-in sort/filter), restyle the genuinely custom tables (hierarchy, phase editor, calendars), and do a consistency sweep.

**Tech Stack:** React 18 + TypeScript + MUI v5 + `@mui/x-data-grid` v6 (already a dependency) + Vitest.

## Global Constraints

- **Design decision confirmed by the user:** Option B (Underline Neutral) + the tighter (~30px) row spacing.
- **Frontend tests:** `cd frontend && npx vitest run <path>` — this vitest **rejects `-q`**; never pass it. The environment is flaky under load; if a run reports `document is not defined` / wildly varying counts, `pkill -f vitest`, wait, and re-run individual files.
- **Type budget:** `cd frontend && npx tsc --noEmit | wc -l` must not exceed the current baseline (**234**). Record the exact number before starting each task; net-new errors are not allowed.
- **No behavior regressions:** each table keeps its current data, navigation, delete, inline-edit, and highlight behavior. This is a *visual + filtering* change only.
- **Verify visually:** after each phase, load the running app (http://localhost:3000) and eyeball the affected pages. Do **not** trust unit tests alone for look/density (they mock and don't render pixels) — this rule exists because a mocked test earlier hid a real API failure.
- App is **light-mode only** today (no dark palette in the theme); keep it light-only.

## Design tokens (the Option-B system, app-wide)

Add these to `frontend/src/theme.ts` as exported constants and wire them through the theme. Every later task references them.

```ts
// Neutrals — cool-biased, chosen (not default grey)
export const COLOR_BG      = '#f4f6f8'  // app background
export const COLOR_SURFACE = '#ffffff'  // paper/cards/table surface
export const COLOR_INK     = '#18212e'  // primary text + table header rule
export const COLOR_MUTED   = '#64707f'  // labels, captions, secondary text
export const COLOR_LINE    = '#e4e8ee'  // borders, row dividers

// Accent — the single brand hue (see DECISION below)
export const COLOR_ACCENT      = '#0e7c7b' // teal
export const COLOR_ACCENT_DARK = '#0b5f5e'
export const COLOR_ACCENT_LT   = '#2f9d9a'

// Semantic (institutional, muted — separate from the accent)
export const COLOR_GOOD = '#1f8a54'
export const COLOR_WARN = '#b7791f'
export const COLOR_BAD  = '#c0392f'

// Density / tables
export const TABLE_ROW_HEIGHT   = 30   // was 36
export const TABLE_HEADER_HEIGHT = 34  // was 36
export const TABLE_CELL_PADDING = '4px 12px'
export const NUMERIC_FONT = 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
```

**DECISION TO CONFIRM AT REVIEW (one thing):** the accent. Option B was rendered in **teal (`#0e7c7b`)**, which becomes the app's `primary` (buttons, links, tabs, active sort, focus) — replacing today's bright `#1565c0`. That is what makes the whole app match the table. If you'd rather keep a blue identity, the drop-in alternative is an **institutional navy `#1b4965`** (same structure, different hue). Everything else in this plan is identical either way. **The plan assumes teal; say the word to switch to navy.**

**The Underline-Neutral table header** (applied via theme, so both MUI `<Table>` and DataGrid inherit it):
- No background fill (remove `#A5C1D8`).
- Labels: `COLOR_MUTED`, `text-transform: uppercase`, `font-size: 0.68rem`, `letter-spacing: 0.08em`, `font-weight: 600`.
- A `2px solid COLOR_INK` rule under the whole header row.
- Active-sort column: label + rule switch to `COLOR_ACCENT`.
- Numeric columns: right-aligned, `font-variant-numeric: tabular-nums`; financial columns may opt into `NUMERIC_FONT`.

---

## Task 1: Theme foundation — palette, type, header, density (the big lever)

**Files:**
- Modify: `frontend/src/theme.ts` (whole `palette`, `typography`, `shape`, and the `MuiTableCell` / `MuiTableRow` / `MuiDataGrid` / `MuiButton` / `MuiCard` / `MuiPaper` / `MuiTabs` component overrides)
- Test: `frontend/src/theme.test.ts` (new — assert the exported tokens so later tasks can rely on them)

**Interfaces:**
- Produces: the exported `COLOR_*`, `TABLE_ROW_HEIGHT`, `TABLE_HEADER_HEIGHT`, `TABLE_CELL_PADDING`, `NUMERIC_FONT` constants and a themed header/row/DataGrid style. All later tasks consume these. `TABLE_HEADER_BG` is **removed** (its 18 call sites are handled in Task 2).

**Context:** `TABLE_HEADER_BG` is currently exported and used in 18 files as `backgroundColor: '#A5C1D8'` on header rows/cells. Do **not** delete the export yet — keep a temporary `export const TABLE_HEADER_BG = 'transparent'` so the 18 sites compile until Task 2 removes them, then delete it at the end of Task 2.

- [ ] **Step 1: Record the type baseline**

Run: `cd frontend && npx tsc --noEmit | wc -l` → note the number (expected **234**).

- [ ] **Step 2: Write the token test**

Create `frontend/src/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import theme, {
  COLOR_ACCENT, COLOR_INK, COLOR_MUTED, COLOR_LINE, TABLE_ROW_HEIGHT, TABLE_HEADER_HEIGHT, TABLE_CELL_PADDING,
} from './theme'

describe('theme tokens (Underline-Neutral)', () => {
  it('exposes the density constants', () => {
    expect(TABLE_ROW_HEIGHT).toBe(30)
    expect(TABLE_HEADER_HEIGHT).toBe(34)
    expect(TABLE_CELL_PADDING).toBe('4px 12px')
  })
  it('uses the accent as the MUI primary', () => {
    expect(theme.palette.primary.main.toLowerCase()).toBe(COLOR_ACCENT.toLowerCase())
  })
  it('table headers have no background fill', () => {
    const head = (theme.components?.MuiTableCell?.styleOverrides as any)?.head
    expect(head.backgroundColor === undefined || head.backgroundColor === 'transparent').toBe(true)
  })
  it('keeps neutral tokens defined', () => {
    expect(COLOR_INK).toBeTruthy(); expect(COLOR_MUTED).toBeTruthy(); expect(COLOR_LINE).toBeTruthy()
  })
})
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd frontend && npx vitest run src/theme.test.ts`
Expected: FAIL (tokens not yet defined / primary still blue).

- [ ] **Step 4: Rewrite `theme.ts`**

Replace the token block, `palette`, `typography`, `shape`, and the relevant component overrides. Concretely:

Token block (replace lines 4–9):
```ts
export const COLOR_BG = '#f4f6f8'
export const COLOR_SURFACE = '#ffffff'
export const COLOR_INK = '#18212e'
export const COLOR_MUTED = '#64707f'
export const COLOR_LINE = '#e4e8ee'
export const COLOR_ACCENT = '#0e7c7b'
export const COLOR_ACCENT_DARK = '#0b5f5e'
export const COLOR_ACCENT_LT = '#2f9d9a'
export const COLOR_GOOD = '#1f8a54'
export const COLOR_WARN = '#b7791f'
export const COLOR_BAD = '#c0392f'
export const TABLE_ROW_HEIGHT = 30
export const TABLE_HEADER_HEIGHT = 34
export const TABLE_CELL_PADDING = '4px 12px'
export const NUMERIC_FONT = 'ui-monospace, "SF Mono", "Roboto Mono", Menlo, Consolas, monospace'
// Temporary shim so the 18 legacy header sites still compile until Task 2; deleted there.
export const TABLE_HEADER_BG = 'transparent'
```

`palette`:
```ts
  palette: {
    primary:   { main: COLOR_ACCENT, light: COLOR_ACCENT_LT, dark: COLOR_ACCENT_DARK, contrastText: '#ffffff' },
    secondary: { main: '#5b6b7f' },
    error:   { main: COLOR_BAD },
    warning: { main: COLOR_WARN },
    success: { main: COLOR_GOOD },
    text: { primary: COLOR_INK, secondary: COLOR_MUTED },
    divider: COLOR_LINE,
    background: { default: COLOR_BG, paper: COLOR_SURFACE },
  },
```

`shape`: `{ borderRadius: 6 }`.

`MuiTableCell.styleOverrides` (the core of the look):
```ts
    MuiTableCell: {
      styleOverrides: {
        root: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem', borderColor: COLOR_LINE },
        head: {
          backgroundColor: 'transparent',
          color: COLOR_MUTED,
          fontWeight: 600,
          fontSize: '0.68rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          padding: '6px 12px',
          borderBottom: `2px solid ${COLOR_INK}`,
          whiteSpace: 'nowrap',
        },
        sizeSmall: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem' },
      },
    },
```

`MuiDataGrid.styleOverrides` (so grids match the same header):
```ts
    MuiDataGrid: {
      defaultProps: { density: 'compact', rowHeight: TABLE_ROW_HEIGHT, columnHeaderHeight: TABLE_HEADER_HEIGHT },
      styleOverrides: {
        root: { border: `1px solid ${COLOR_LINE}`, borderRadius: 6 },
        cell: { padding: TABLE_CELL_PADDING, fontSize: '0.8rem', borderColor: COLOR_LINE },
        columnHeaders: { backgroundColor: 'transparent', borderBottom: `2px solid ${COLOR_INK}` },
        columnHeader: { padding: TABLE_CELL_PADDING },
        columnHeaderTitle: { fontWeight: 600, fontSize: '0.68rem', letterSpacing: '0.08em', textTransform: 'uppercase', color: COLOR_MUTED },
        columnSeparator: { display: 'none' },
        row: { '&:hover': { backgroundColor: 'rgba(24,33,46,0.03)' } },
      },
    },
```

`MuiCard` / `MuiPaper`: subtle border + hairline shadow:
```ts
    MuiCard: { styleOverrides: { root: { border: `1px solid ${COLOR_LINE}`, boxShadow: '0 1px 2px rgba(20,30,45,0.05)', borderRadius: 6 } } },
    MuiPaper: { styleOverrides: { root: { boxShadow: '0 1px 2px rgba(20,30,45,0.05)' }, elevation1: { boxShadow: '0 1px 2px rgba(20,30,45,0.05)' } } },
```

`MuiButton`: keep the existing size overrides; the palette change makes primary buttons teal automatically. Add `disableElevation: true` to `defaultProps` for a flatter, institutional button.

`MuiTabs`: `indicator` in accent is automatic via primary. Leave `MuiTab` as-is.

(Leave the `AppBar`, `Toolbar`, `Dialog`, `Alert`, `Accordion`, `Menu`, `List` overrides unchanged.)

- [ ] **Step 5: Run the token test + type check**

Run: `cd frontend && npx vitest run src/theme.test.ts`
Expected: PASS (4 tests).
Run: `cd frontend && npx tsc --noEmit | wc -l` → still **234** (the `TABLE_HEADER_BG` shim keeps the 18 sites compiling).

- [ ] **Step 6: Browser QA**

Load the app; open Resources and Actuals (DataGrids) — headers should now be underline-style (no blue fill), rows ~30px. The 18 MUI `<Table>` pages still show a `transparent` header row (correct interim state) — Task 2 finishes them.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/theme.ts frontend/src/theme.test.ts
git commit -m "feat(theme): Underline-Neutral design tokens, headers, density, teal accent"
```

---

## Task 2: Remove the 18 hardcoded `#A5C1D8` header fills

**Files (all 18 — remove the fill; the themed `head` style now supplies the look):**
`pages/actuals/ActualsImportPage.tsx`, `pages/setup/ReferenceDataPage.tsx`, `pages/programs/ProgramDetailPage.tsx`, `pages/resources/ResourceDetailPage.tsx`, `pages/workers/WorkersListPage.tsx`, `pages/admin/UsersListPage.tsx`, `pages/actuals/VarianceAnalysisPage.tsx`, `pages/admin/UserAuditPage.tsx`, `pages/portfolios/PortfolioDetailPage.tsx`, `components/portfolio/FinancialSummaryTable.tsx`, `pages/reports/DrillDownReport.tsx`, `components/actuals/AllocationConflictDialog.tsx`, `components/phases/PhaseList.tsx`, `pages/portfolios/PortfoliosListPage.tsx`, `components/resources/CalendarHeader.tsx`, `components/resources/AllocationConflictView.tsx`, `pages/reports/ResourceUtilizationReport.tsx`, `components/resources/ResourceAssignmentCalendar.tsx`
- Finally: `frontend/src/theme.ts` (delete the `TABLE_HEADER_BG` shim + its import sites)

**Interfaces:**
- Consumes: the themed `MuiTableCell.head` style (Task 1).

**Context:** Each site sets the fill in one of two shapes — `<TableRow sx={{ backgroundColor: '#A5C1D8' }}>` (or `backgroundColor: TABLE_HEADER_BG`) on the header row, or a `sx` on individual head cells. Removing the `backgroundColor` lets the themed header show through. Some sites also set `fontWeight: 'bold'` per cell — that's now in the theme; leave or remove, but don't add new per-cell colors.

- [ ] **Step 1: Per-file edit (repeat for each of the 18)**

For each file: `grep -n "A5C1D8\|TABLE_HEADER_BG" <file>`, then remove the `backgroundColor` from that header `sx`. Example (WorkersListPage):

```tsx
// before
<TableRow sx={{ backgroundColor: '#A5C1D8', height: TABLE_ROW_HEIGHT }}>
// after
<TableRow sx={{ height: TABLE_ROW_HEIGHT }}>
```

If a file imports `TABLE_HEADER_BG`, drop that import. If removing `backgroundColor` empties an `sx={{}}`, remove the empty `sx`.

- [ ] **Step 2: Delete the shim**

In `frontend/src/theme.ts`, delete `export const TABLE_HEADER_BG = 'transparent'`.

- [ ] **Step 3: Verify nothing references it**

Run: `cd frontend && grep -rn "A5C1D8\|TABLE_HEADER_BG" src` → **no matches**.
Run: `cd frontend && npx tsc --noEmit | wc -l` → **234**.

- [ ] **Step 4: Regression tests for the touched pages**

Run: `cd frontend && npx vitest run src/pages/workers/WorkersListPage.test.tsx src/pages/portfolios/PortfolioDetailPage.test.tsx src/components/phases`
Expected: same pass/fail profile as before this branch (pre-existing failures unchanged).

- [ ] **Step 5: Browser QA + commit**

Eyeball 3–4 of the varied pages (Workers list, a detail page's inner table, PhaseList, a report). All header rows should be underline-style, no blue.

```bash
git add -A && git commit -m "refactor(tables): drop hardcoded #A5C1D8 header fills; use themed header"
```

---

## Task 3: Shared shells — `PageHeader` and `DataTable`

**Files:**
- Create: `frontend/src/components/common/PageHeader.tsx` (+ `PageHeader.test.tsx`)
- Create: `frontend/src/components/common/DataTable.tsx` (+ `DataTable.test.tsx`)

**Interfaces:**
- Produces:
  - `PageHeader({ title, actions?, dense? })` — one consistent page title (replaces the ad-hoc `h4`/`h5`/`h6` titles) with an optional right-aligned actions slot.
  - `DataTable` — a thin wrapper over `@mui/x-data-grid`'s `DataGrid` that wires a standard slim toolbar (a **quick-filter search** + the built-in **columns / filter / density / export** buttons) and the themed look, so every migrated list gets identical sort/filter with zero per-page filter code.

**Context:** DataGrid Community already ships sorting, a filter panel, and `GridToolbarQuickFilter`. `DataTable` centralizes the toolbar so pages stop hand-rolling `<Select>`/search filters.

- [ ] **Step 1: PageHeader test + component**

Test (`PageHeader.test.tsx`): renders the title text; renders an actions node when provided.

Component:
```tsx
import React from 'react'
import { Box, Typography } from '@mui/material'

const PageHeader: React.FC<{ title: string; actions?: React.ReactNode }> = ({ title, actions }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, minHeight: 34 }}>
    <Typography sx={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</Typography>
    {actions ? <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box> : null}
  </Box>
)
export default PageHeader
```

- [ ] **Step 2: DataTable test + component**

Test (`DataTable.test.tsx`): renders rows/columns; the toolbar exposes a search box (`role="textbox"` / placeholder "Search").

Component:
```tsx
import React from 'react'
import { Paper } from '@mui/material'
import { DataGrid, DataGridProps, GridToolbarContainer, GridToolbarQuickFilter,
  GridToolbarColumnsButton, GridToolbarFilterButton, GridToolbarDensitySelector, GridToolbarExport } from '@mui/x-data-grid'

const Toolbar = () => (
  <GridToolbarContainer sx={{ p: 1, gap: 1, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
    <GridToolbarQuickFilter variant="outlined" size="small" placeholder="Search…" sx={{ flex: '0 0 260px' }} />
    <span style={{ flex: 1 }} />
    <GridToolbarColumnsButton /><GridToolbarFilterButton /><GridToolbarDensitySelector /><GridToolbarExport />
  </GridToolbarContainer>
)

const DataTable: React.FC<DataGridProps & { height?: number | string }> = ({ height = 'calc(100vh - 220px)', sx, ...props }) => (
  <Paper sx={{ height, width: '100%' }}>
    <DataGrid slots={{ toolbar: Toolbar }} disableRowSelectionOnClick sx={sx} {...props} />
  </Paper>
)
export default DataTable
```

- [ ] **Step 3: Run tests + type check + commit**

Run: `cd frontend && npx vitest run src/components/common/PageHeader.test.tsx src/components/common/DataTable.test.tsx` → PASS.
`npx tsc --noEmit | wc -l` → **234**.
```bash
git add frontend/src/components/common/PageHeader.tsx frontend/src/components/common/PageHeader.test.tsx frontend/src/components/common/DataTable.tsx frontend/src/components/common/DataTable.test.tsx
git commit -m "feat(ui): shared PageHeader and DataTable (grid + standard sort/filter toolbar)"
```

---

## Task 4: Migrate the flat list pages to `DataTable` (built-in sort/filter)

**Per-table treatment (the whole inventory, decided up front):**

| Page / table | Today | Target | Filtering |
|---|---|---|---|
| `resources/ResourcesListPage` | DataGrid | keep grid → wrap in `DataTable` | grid quick-filter + column filters (drop the custom search) |
| `actuals/ActualsListPage` | DataGrid | wrap in `DataTable` | keep the date/project filters (domain-specific) **above** the grid; add grid quick-filter |
| `workers/WorkersListPage` | MUI Table + custom filter | **DataGrid via `DataTable`** | grid quick-filter (name+ID) + a Worker-Type column filter; keep highlight? see note |
| `admin/UsersListPage` | MUI Table | **DataGrid via `DataTable`** | grid quick-filter + column filters |
| `admin/UserAuditPage` | MUI Table | **DataGrid via `DataTable`** | grid quick-filter |
| `setup/ReferenceDataPage` (Worker Types / Roles) | MUI Tables | **DataGrid via `DataTable`** (two grids) | grid quick-filter |

> **Highlight note (Workers):** DataGrid quick-filter highlights matches natively via `getRowClassName`/cell rendering is limited; if you want the amber highlight kept, render the Name/ID columns with a `renderCell` that reuses `HighlightedLabel` fed by the grid's quick-filter value (read from `useGridApiContext`). If that's more than it's worth, accept the grid's built-in match styling. **Flag for the reviewer per page.**

- [ ] **Step 1: Migrate one page end-to-end as the reference — `admin/UsersListPage`**

Convert its `<Table>` to `columns: GridColDef[]` + `<DataTable rows={users} columns={columns} loading={...} onRowClick={...} />`, replace the title with `<PageHeader title="Users" actions={<CreateButton/>} />`, delete the hand-rolled filter state. Keep row-click navigation and any delete action (as a grid action column).

- [ ] **Step 2: tests + type check + browser QA + commit** (per page)

Update/replace that page's test to query grid rows (`role="row"`) rather than table cells. `tsc` stays 234. Eyeball it.

- [ ] **Step 3: Repeat Steps 1–2 for `WorkersListPage`, `UserAuditPage`, `ReferenceDataPage`, and wrap `ResourcesListPage` + `ActualsListPage` in `DataTable`.**

Each is its own commit: `feat(<area>): move list onto DataTable with built-in sort/filter`.

---

## Task 5: Restyle the genuinely custom tables (keep behavior, new look)

These can't become flat grids; they keep MUI `<Table>` but now inherit the themed header/density automatically (Task 1/2). This task standardizes their **filters** and confirms density.

**Files & treatment:**
- `portfolios/PortfoliosListPage` (nested hierarchy) — keep the tree + type-ahead + `HighlightedLabel` (already good); restyle the search input to the shared style; confirm 30px rows.
- `portfolios/PortfolioDetailPage`, `programs/ProgramDetailPage`, `projects/ProjectDetailPage` — inner tables inherit the theme; verify row height/padding.
- `components/phases/PhaseList` — keep inline edit + change highlight; verify the new header + `TABLE_ROW_HEIGHT` don't fight the fixed row heights there.
- `components/resources/ResourceAssignmentCalendar` + `CalendarHeader` — verify the header rule reads well on the calendar grid; if the 2px `COLOR_INK` rule is too heavy there, override locally to `1px COLOR_LINE`.
- Report tables (`reports/*`, `actuals/VarianceAnalysisPage`, `DrillDownReport`, `ResourceUtilizationReport`) — inherit theme; give any inline filter `<Select>`s the shared toolbar look.

- [ ] **Step 1:** For each, load in the browser, confirm the themed look, and only touch code where something reads wrong (heavy rule on calendars, a stray hardcoded color, a too-tall row). Commit per component.

---

## Task 6: Consistency sweep (titles, filters, breadcrumbs, buttons) + final QA

- [ ] **Step 1: Titles** — replace every page's ad-hoc `<Typography variant="h4|h5|h6">Title</Typography>` header with `<PageHeader title=… actions=… />`. Inventory: `actuals/ActualsListPage`, `workers/WorkersListPage`, `admin/UsersListPage`, `admin/UserRolesPage`, `admin/RoleScopesPage`, `reports/*` (4), `resources/ResourcesListPage`, `portfolios/PortfolioFormPage`, `setup/ReferenceDataPage`. (In-content section headings like "Filters"/"Assigned Roles" stay as `h6`.)

- [ ] **Step 2: Breadcrumbs** — the app has been dropping `ScopeBreadcrumbs`; finish it. `grep -rn "ScopeBreadcrumbs" src/pages` → replace each remaining usage's role with `PageHeader`. Decide with the reviewer whether `ScopeBreadcrumbs` is retired entirely.

- [ ] **Step 3: Filters** — confirm no page still hand-rolls a `<FormControl><Select>` list filter that DataTable's toolbar now covers; leave only the *domain* filters (Actuals date range, calendar week picker) as styled toolbars above their grid/table.

- [ ] **Step 4: Full verification**
  - `cd frontend && npx tsc --noEmit | wc -l` → **234**.
  - `cd frontend && npx vitest run src/` → no new failures vs. the documented pre-existing debt.
  - Browser pass over every list + one detail per type + one report, in light mode, at a normal window size: headers underline-style, rows ~30px, numbers right-aligned/tabular, primary controls in the accent, titles identical weight/size, cards/borders consistent.

- [ ] **Step 5: Finish the branch** — use superpowers:finishing-a-development-branch.

---

## Notes for the reviewer (decide before Task 1)

1. **Accent = teal (`#0e7c7b`) or navy (`#1b4965`)?** This is the one identity call; the plan assumes teal (from Option B). Everything else is unchanged either way.
2. **Row height 30px** everywhere (Resources already ~36 → will tighten to 30 too, staying consistent).
3. **Flat lists → DataGrid** for real sort/filter (Workers, Users, Audit, Reference Data), grids you already own; **custom tables** (hierarchy, phase editor, calendars) stay MUI tables with the new theme.
4. **Workers highlight**: keep the amber type-ahead highlight (extra `renderCell` work) or accept the grid's native match styling? (per-page choice in Task 4).
