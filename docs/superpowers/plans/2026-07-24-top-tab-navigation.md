# Top-Tab Navigation (waffle & title removed) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the waffle menu + "Program & Project Management" title with a permission-gated tab row in the app bar — hierarchy icon (Home) + `Workers, Ref Data, Users │ Resources, Actuals` — hide Dashboard/Reports entirely (redirects, no inbound links), and drop the Insights category.

**Architecture:** One new `NavTabs` component owns tab definitions, permission gating, and URL→active-tab mapping; `Header` swaps waffle+title for it. Hidden pages keep their files but lose their routes (replaced by redirects to `/portfolios`). Three inbound `/dashboard` links are re-pointed.

**Tech Stack:** React 18 + TypeScript + MUI v5 + react-router v6 + Vitest.

## Global Constraints (all confirmed by the user)

- Mockup approved: https://claude.ai/code/artifact/9d220e31-6fa0-4ce1-acd8-e48adc3ecdeb
- Tab labels exactly: hierarchy **icon** (leftmost, = Home → `/portfolios`), then `Workers`, `Ref Data`, `Users`, `Resources`, `Actuals`.
- **Group A** visual: a thin vertical divider between `Users` and `Resources` (Setup │ Global Lists). No group captions.
- Abbreviated **tab** labels only — page titles stay full ("User Management", "Reference Data").
- Dashboard + Reports: routes removed, **redirect to `/portfolios`**; page files stay on disk; zero inbound links remain.
- Notification bell: **keep** (still non-functional, for later).
- The expanded/collapsed hierarchy mechanics (incl. the "Back to tree view" contract control) are untouched.
- **Frontend tests:** `cd frontend && npx vitest run <path>` — never pass `-q`. If results look insane (`document is not defined`, wild counts), `pkill -f vitest` and re-run per file.
- **Type budget:** `cd frontend && npx tsc --noEmit | wc -l` stays at **234**.
- **Visual verification:** use the existing CDP screenshot harness at `/tmp/claude-1000/-home-peter-projects-planner/0494ff02-c6e5-488b-80cb-c73847c55b89/scratchpad/shot.mjs` (token in `token.txt` beside it; regenerate via `POST /api/v1/auth/login` `admin/admin123` if expired) and READ the png — do not claim visual success unseen.
- Branch: continue on `feat/detail-descriptions` (all restyle work lives there, unmerged).

## Permission map (carried over from WaffleLauncher verbatim)

| Tab | Path | Permission |
|---|---|---|
| (hierarchy icon) | `/portfolios` | — always visible |
| Workers | `/workers` | `view_workers` |
| Ref Data | `/setup/reference-data` | `manage_reference_data` |
| Users | `/admin/users` | `manage_users` |
| Resources | `/resources` | `view_resources` |
| Actuals | `/actuals` | `view_actuals` |

Active-tab mapping by path prefix: icon ← `/portfolios`, `/programs`, `/projects`; `Workers` ← `/workers`; `Ref Data` ← `/setup`; `Users` ← `/admin`; `Resources` ← `/resources`; `Actuals` ← `/actuals`; anything else → `false` (no selection — MUI accepts `value={false}`).

---

## Task 1: `NavTabs` component

**Files:**
- Create: `frontend/src/components/layout/NavTabs.tsx`
- Test: `frontend/src/components/layout/NavTabs.test.tsx`

**Interfaces:**
- Produces: `<NavTabs />` (no props) — reads `useLocation` for the active tab, `usePermissions()` for gating, `useNavigate` for clicks. Task 2 mounts it in `Header`.

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from '../../test/test-utils'
import NavTabs from './NavTabs'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))
let mockLocation = { pathname: '/portfolios' }

const storeFor = (roles: string[]) =>
  createTestStore({
    auth: { user: { id: '1', username: 'u', email: 'u@e.c', roles, permissions: [] }, token: 't', isAuthenticated: true },
  })

describe('NavTabs', () => {
  it('renders the hierarchy icon + the five labelled tabs for an admin', () => {
    mockLocation = { pathname: '/portfolios' }
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getByRole('tab', { name: /hierarchy/i })).toBeInTheDocument()
    for (const label of ['Workers', 'Ref Data', 'Users', 'Resources', 'Actuals']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('hides permission-gated tabs for a viewer (Users needs manage_users)', () => {
    mockLocation = { pathname: '/portfolios' }
    render(<NavTabs />, { store: storeFor(['VIEWER']) })
    expect(screen.queryByRole('tab', { name: 'Users' })).toBeNull()
    expect(screen.getByRole('tab', { name: /hierarchy/i })).toBeInTheDocument()
  })

  it('selects the hierarchy tab on program/project detail routes', () => {
    mockLocation = { pathname: '/programs/abc-123' }
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getByRole('tab', { name: /hierarchy/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('selects Workers on /workers/:id and survives unmatched routes', () => {
    mockLocation = { pathname: '/workers/w1' }
    const { unmount } = render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getByRole('tab', { name: 'Workers' })).toHaveAttribute('aria-selected', 'true')
    unmount()
    mockLocation = { pathname: '/demo' } // no tab matches — must not crash
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
  })

  it('navigates on click', async () => {
    mockLocation = { pathname: '/portfolios' }
    const user = userEvent.setup()
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    await user.click(screen.getByRole('tab', { name: 'Actuals' }))
    expect(mockNavigate).toHaveBeenCalledWith('/actuals')
  })
})
```

- [ ] **Step 2: Run to verify failure** — `cd frontend && npx vitest run src/components/layout/NavTabs.test.tsx` → FAIL (module missing).

- [ ] **Step 3: Implement**

```tsx
import React from 'react'
import { Tabs, Tab, Tooltip } from '@mui/material'
import { AccountTree } from '@mui/icons-material'
import { useNavigate, useLocation } from 'react-router-dom'
import { usePermissions } from '../../hooks/usePermissions'
import { Permission } from '../../utils/permissions'

interface NavTabDef {
  value: string            // navigation target + Tab value
  label?: string
  icon?: React.ReactElement
  tooltip?: string
  permission?: Permission
  match: string[]          // path prefixes that make this tab active
  groupStart?: boolean     // Group A: draw the Setup │ Global Lists divider before this tab
}

const TAB_DEFS: NavTabDef[] = [
  { value: '/portfolios', icon: <AccountTree fontSize="small" />, tooltip: 'Hierarchy (Home)', match: ['/portfolios', '/programs', '/projects'] },
  { value: '/workers', label: 'Workers', permission: 'view_workers', match: ['/workers'] },
  { value: '/setup/reference-data', label: 'Ref Data', permission: 'manage_reference_data', match: ['/setup'] },
  { value: '/admin/users', label: 'Users', permission: 'manage_users', match: ['/admin'] },
  { value: '/resources', label: 'Resources', permission: 'view_resources', match: ['/resources'], groupStart: true },
  { value: '/actuals', label: 'Actuals', permission: 'view_actuals', match: ['/actuals'] },
]

/**
 * The app's primary navigation: a permission-gated tab row in the app bar.
 * Leftmost is the hierarchy icon (Home -> /portfolios); a thin divider separates
 * the Setup tabs (Workers / Ref Data / Users) from the Global Lists
 * (Resources / Actuals). Active tab follows the URL by path prefix.
 */
const NavTabs: React.FC = () => {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { hasPermission } = usePermissions()

  const tabs = TAB_DEFS.filter((t) => !t.permission || hasPermission(t.permission).hasPermission)
  const active = tabs.find((t) => t.match.some((m) => pathname === m || pathname.startsWith(m + '/')))
  const value = active ? active.value : false

  return (
    <Tabs
      value={value}
      onChange={(_e, v) => navigate(v)}
      sx={{ minHeight: 48, '& .MuiTabs-flexContainer': { height: 48 } }}
    >
      {tabs.map((t) => {
        const tab = (
          <Tab
            key={t.value}
            value={t.value}
            label={t.label}
            icon={t.icon}
            aria-label={t.label || 'Hierarchy'}
            sx={{
              minHeight: 48,
              // Group A divider: a short vertical rule before the first Global Lists tab
              ...(t.groupStart && {
                ml: 1.5,
                position: 'relative',
                '&::before': {
                  content: '""', position: 'absolute', left: -6, top: '30%', height: '40%',
                  width: '1px', backgroundColor: 'divider',
                },
              }),
            }}
          />
        )
        return t.tooltip ? <Tooltip key={t.value} title={t.tooltip}>{tab}</Tooltip> : tab
      })}
    </Tabs>
  )
}

export default NavTabs
```

> Note: MUI `Tabs` requires `Tab` children (or elements forwarding its injected props). `Tooltip` wrapping a `Tab` forwards props, so the icon tab keeps its tooltip. If the injected-props forwarding misbehaves in tests, move the tooltip inside the icon instead: `icon={<Tooltip title="Hierarchy (Home)"><AccountTree fontSize="small" /></Tooltip>}` and drop the wrapper.

- [ ] **Step 4: Run to verify pass** — same command → 5 tests PASS.
- [ ] **Step 5: Type check** — `npx tsc --noEmit | wc -l` → 234.
- [ ] **Step 6: Commit** — `git add frontend/src/components/layout/NavTabs.tsx frontend/src/components/layout/NavTabs.test.tsx && git commit -m "feat(nav): NavTabs — permission-gated top tabs with hierarchy home"`

---

## Task 2: Header rewrite + waffle deletion

**Files:**
- Modify: `frontend/src/components/layout/Header.tsx`
- Delete: `frontend/src/components/layout/WaffleLauncher.tsx`, `frontend/src/components/layout/WaffleLauncher.test.tsx`

**Interfaces:** Consumes `<NavTabs />` (Task 1). Bell + user menu untouched.

- [ ] **Step 1: Edit Header**
  - Remove `import WaffleLauncher from './WaffleLauncher'`; add `import NavTabs from './NavTabs'`.
  - In the `<Toolbar>`: replace `<WaffleLauncher />` **and** the whole title `<Typography …>Program &amp; Project Management</Typography>` block with:
    ```tsx
        <NavTabs />
        <Box sx={{ flexGrow: 1 }} />
    ```
    (the spacer keeps bell + user menu right-aligned; everything else in the file stays).
- [ ] **Step 2: Delete the waffle** — `git rm frontend/src/components/layout/WaffleLauncher.tsx frontend/src/components/layout/WaffleLauncher.test.tsx`
- [ ] **Step 3: Fix fallout** — `grep -rn "WaffleLauncher\|Program & Project Management\|Program &amp; Project" frontend/src | grep -v node_modules` → update any test that asserted the title or waffle (expected: `Layout.realtime.test.tsx` and/or `PortfolioShell.test.tsx` if they render Header; adjust their queries to something still present, e.g. the bell or a tab).
- [ ] **Step 4: Verify** — `npx vitest run src/components/layout/` (expect NavTabs 5 pass + remaining layout tests at their prior profile); `npx tsc --noEmit | wc -l` → 234.
- [ ] **Step 5: Commit** — `git commit -am "feat(nav): tabs replace waffle menu and title in the app bar"`

---

## Task 3: Re-point the three inbound `/dashboard` links

**Files:**
- Modify: `frontend/src/pages/auth/LoginPage.tsx` (line ~25): `navigate('/dashboard')` → `navigate('/portfolios')`
- Modify: `frontend/src/components/common/PermissionGuard.tsx` (line ~70): `navigate('/dashboard')` → `navigate('/portfolios')`; if its button copy says "Dashboard", change to `Go to Home`.
- Modify: `frontend/src/pages/resources/ResourceDetailPage.tsx` (line ~927): `{ label: 'Home', path: '/dashboard' }` → `{ label: 'Home', path: '/portfolios' }`

- [ ] **Step 1: Make the three edits** (grep each file for `/dashboard` after editing → zero matches).
- [ ] **Step 2: Check login tests** — `npx vitest run src/pages/auth/` (update any assertion expecting the `/dashboard` redirect).
- [ ] **Step 3: Type check 234, commit** — `git commit -am "fix(nav): login, permission fallback, and breadcrumbs land on the hierarchy"`

---

## Task 4: Remove Dashboard/Reports routes; add redirects

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Edit routes**
  - Delete the 6 routes: `/dashboard`, `/reports`, `/reports/budget-vs-actual`, `/reports/time-series`, `/reports/resource-utilization`, `/reports/drill-down`.
  - Delete the now-unused imports: `DashboardPage`, `ReportsIndexPage`, `BudgetVsActualDashboard`, `TimeSeriesCostReport`, `ResourceUtilizationReport`, `DrillDownReport`.
  - Add, where the old routes were:
    ```tsx
    {/* Hidden for now (unused): bookmarks land on the hierarchy instead */}
    <Route path="/dashboard" element={<Navigate to="/portfolios" replace />} />
    <Route path="/reports/*" element={<Navigate to="/portfolios" replace />} />
    ```
- [ ] **Step 2: Type check** — 234 (removed imports must not orphan anything).
- [ ] **Step 3: Commit** — `git commit -am "feat(nav): hide Dashboard and Reports behind redirects to the hierarchy"`

---

## Task 5: Sweep + full verification

- [ ] **Step 1: Reference sweep** — must return ONLY the two redirect lines in `App.tsx` (page files under `src/pages/reports/` + `DashboardPage.tsx` and tests are exempt — they're unrouted):
  `grep -rnE "'/dashboard'|\"/dashboard\"|'/reports|\"/reports" frontend/src --include=*.tsx --include=*.ts | grep -vE "test|src/pages/reports/|DashboardPage"`
- [ ] **Step 2: Type budget** — `npx tsc --noEmit | wc -l` → **234**.
- [ ] **Step 3: Test sweep (per-file, flaky env)** — NavTabs, layout tests, LoginPage tests, WorkersListPage, PortfoliosListPage, UsersListPage → prior profiles, no new failures.
- [ ] **Step 4: Visual verification (CDP)** — screenshot `/portfolios` and `/workers`; READ the pngs and confirm: no waffle, no title, icon+5 tabs with the divider, correct active tab per page, bell + user menu intact.
- [ ] **Step 5: User QA** — hand over for browser inspection (tab keyboard nav, viewer-role gating, bookmarks to `/dashboard` redirecting).
- [ ] **Step 6: Commit any sweep fixes** — `git commit -am "chore(nav): reference sweep for hidden pages"`
