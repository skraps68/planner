# Portfolio-Centric Navigation Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the sidebar-of-nav-items + breadcrumbs model with a Portfolios master-detail shell (rich table ↔ slim folder tree + detail pane) and a top-left waffle launcher for occasional destinations.

**Architecture:** A react-router pathless layout route (`PortfolioShell`) wraps `/portfolios` and the portfolio/program/project detail routes, rendering `[ slim tree | <Outlet/> ]` when a detail is open and the full-width rich table otherwise. Expansion/search state is shared through a sessionStorage-backed hook so the two hierarchy renderings stay in sync. The old Sidebar is deleted; Workers/Dashboard/Reports/Users and global Resources/Actuals move behind a waffle popover in the Header.

**Tech Stack:** React 18, TypeScript, MUI v5, react-router-dom v6, @tanstack/react-query, Redux Toolkit, vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-07-07-portfolio-nav-redesign-design.md`

## Global Constraints

- All commands run from `frontend/` unless stated otherwise.
- Branch: `nav-redesign` (already created; spec committed on it).
- Tests: `npx vitest run <file>`; type check: `npx tsc --noEmit`.
- `npx tsc --noEmit` has a **pre-existing error baseline** (mostly `.test.` files missing `version` fields, unused vars in detail pages). Rule: files you touch must introduce **no new** errors; do not attempt to fix the unrelated baseline.
- Slim tree (State 2) is a **headerless folder tree**: indentation + expand/collapse arrows only — no per-level headers, no per-level icons.
- Row click navigates; the **arrow button** is the only expand/collapse control (`stopPropagation` on it).
- Responsive: desktop-first; below MUI `md` (~900px) the shell swaps tree/content (never side-by-side).
- Dev servers for E2E: vite on `http://localhost:3000`, API on `http://localhost:8000`, login `admin`/`admin123` (token at `login.tokens.access_token`, stored in `localStorage.token`).

---

### Task 1: WaffleLauncher component + Header rework

**Files:**
- Create: `frontend/src/components/layout/WaffleLauncher.tsx`
- Create: `frontend/src/components/layout/WaffleLauncher.test.tsx`
- Modify: `frontend/src/components/layout/Header.tsx`

**Interfaces:**
- Consumes: `usePermissions()` from `src/hooks/usePermissions` (`hasPermission(permission: Permission): { hasPermission: boolean }`), `useNavigate()`.
- Produces: `<WaffleLauncher />` (no props) — the app launcher rendered in the Header, top-left.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/WaffleLauncher.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from '../../test/test-utils'
import WaffleLauncher from './WaffleLauncher'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

const adminStore = () =>
  createTestStore({
    auth: {
      user: {
        id: '1',
        username: 'admin',
        email: 'a@example.com',
        roles: ['ADMIN'],
        permissions: [],
      },
      token: 't',
      isAuthenticated: true,
    },
  })

const viewerStore = () =>
  createTestStore({
    auth: {
      user: {
        id: '2',
        username: 'viewer',
        email: 'v@example.com',
        roles: ['VIEWER'],
        permissions: [],
      },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('WaffleLauncher', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('opens the menu and shows all destinations for an admin', async () => {
    const user = userEvent.setup()
    render(<WaffleLauncher />, { store: adminStore() })

    await user.click(screen.getByRole('button', { name: /apps/i }))

    for (const label of ['Workers', 'User Management', 'Dashboard', 'Reports', 'Resources', 'Actuals']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('navigates and closes when a destination is clicked', async () => {
    const user = userEvent.setup()
    render(<WaffleLauncher />, { store: adminStore() })

    await user.click(screen.getByRole('button', { name: /apps/i }))
    await user.click(screen.getByText('Workers'))

    expect(mockNavigate).toHaveBeenCalledWith('/workers')
  })

  it('hides destinations the user lacks permission for', async () => {
    const user = userEvent.setup()
    render(<WaffleLauncher />, { store: viewerStore() })

    await user.click(screen.getByRole('button', { name: /apps/i }))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('User Management')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/WaffleLauncher.test.tsx`
Expected: FAIL — cannot resolve `./WaffleLauncher`.

- [ ] **Step 3: Implement WaffleLauncher**

Create `frontend/src/components/layout/WaffleLauncher.tsx`:

```tsx
import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconButton, Menu, MenuItem, ListSubheader, Tooltip } from '@mui/material'
import { Apps as AppsIcon } from '@mui/icons-material'
import { usePermissions } from '../../hooks/usePermissions'
import { Permission } from '../../utils/permissions'

interface Destination {
  label: string
  path: string
  permission?: Permission
}

interface DestinationGroup {
  title: string
  items: Destination[]
}

// Occasional ("10%") destinations. The Portfolios hierarchy is the primary nav.
const GROUPS: DestinationGroup[] = [
  {
    title: 'Setup',
    items: [
      { label: 'Workers', path: '/workers', permission: 'view_workers' },
      { label: 'User Management', path: '/admin/users', permission: 'manage_users' },
    ],
  },
  {
    title: 'Insights',
    items: [
      { label: 'Dashboard', path: '/dashboard' },
      { label: 'Reports', path: '/reports', permission: 'view_reports' },
    ],
  },
  {
    title: 'Global lists',
    items: [
      { label: 'Resources', path: '/resources', permission: 'view_resources' },
      { label: 'Actuals', path: '/actuals', permission: 'view_actuals' },
    ],
  },
]

const WaffleLauncher: React.FC = () => {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const visibleGroups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.permission || hasPermission(item.permission).hasPermission
    ),
  })).filter((group) => group.items.length > 0)

  const go = (path: string) => {
    setAnchorEl(null)
    navigate(path)
  }

  return (
    <>
      <Tooltip title="Apps">
        <IconButton
          aria-label="apps"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          edge="start"
          sx={{ mr: 1.5 }}
        >
          <AppsIcon />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      >
        {visibleGroups.flatMap((group) => [
          <ListSubheader key={`${group.title}-header`} sx={{ lineHeight: '30px' }}>
            {group.title}
          </ListSubheader>,
          ...group.items.map((item) => (
            <MenuItem key={item.path} onClick={() => go(item.path)}>
              {item.label}
            </MenuItem>
          )),
        ])}
      </Menu>
    </>
  )
}

export default WaffleLauncher
```

Note: check `src/utils/permissions.ts` for the exact `Permission` union member names (`view_workers`, `manage_users`, `view_reports`, `view_resources`, `view_actuals` — these are the names the old Sidebar used). If a name differs, use the Sidebar's exact former value.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/WaffleLauncher.test.tsx`
Expected: PASS (3 tests). If the permission test fails because VIEWER receives `manage_users`, inspect `src/utils/permissions.ts` and pick a permission VIEWER genuinely lacks for the third test.

- [ ] **Step 5: Rework Header (remove hamburger, add waffle, title = home link)**

In `frontend/src/components/layout/Header.tsx`:

1. Delete the hamburger `IconButton` block (the one dispatching `toggleSidebar`), the `Menu as MenuIcon` import, the `useDispatch` import/usage, and the `toggleSidebar` import.
2. Add imports: `import { useNavigate } from 'react-router-dom'` and `import WaffleLauncher from './WaffleLauncher'`.
3. Inside the component add `const navigate = useNavigate()`.
4. Replace the deleted hamburger with `<WaffleLauncher />` as the first child of `<Toolbar>`.
5. Make the title a home link:

```tsx
<Typography
  variant="h6"
  component="div"
  onClick={() => navigate('/portfolios')}
  sx={{ flexGrow: 1, color: 'primary.main', cursor: 'pointer', userSelect: 'none' }}
>
  Program &amp; Project Management
</Typography>
```

- [ ] **Step 6: Type check and re-run tests**

Run: `npx tsc --noEmit 2>&1 | grep -E "Header.tsx|WaffleLauncher"` → expect no output.
Run: `npx vitest run src/components/layout/WaffleLauncher.test.tsx` → PASS.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/WaffleLauncher.tsx frontend/src/components/layout/WaffleLauncher.test.tsx frontend/src/components/layout/Header.tsx
git commit -m "feat: waffle launcher in header, remove hamburger, title links home"
```

---

### Task 2: Retire the Sidebar (Layout, uiSlice, tests)

**Files:**
- Delete: `frontend/src/components/layout/Sidebar.tsx`, `frontend/src/components/layout/Sidebar.test.tsx`
- Modify: `frontend/src/components/layout/Layout.tsx`
- Modify: `frontend/src/store/slices/uiSlice.ts`
- Modify: `frontend/src/App.test.tsx` (drop `ui.sidebarOpen` seeds)

**Interfaces:**
- Produces: `Layout` renders `Header` + main content only (no Sidebar). `uiSlice` no longer exports `toggleSidebar`/`setSidebarOpen`.

- [ ] **Step 1: Delete Sidebar files**

```bash
git rm frontend/src/components/layout/Sidebar.tsx frontend/src/components/layout/Sidebar.test.tsx
```

- [ ] **Step 2: Rework Layout.tsx**

Replace the full contents of `frontend/src/components/layout/Layout.tsx` with:

```tsx
import React from 'react'
import { Box } from '@mui/material'
import Header from './Header'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Header />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          mt: '48px',
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout
```

- [ ] **Step 3: Remove sidebar state from uiSlice**

In `frontend/src/store/slices/uiSlice.ts`: remove `sidebarOpen: boolean` from `UiState`, remove `sidebarOpen: true` from `initialState`, remove the `toggleSidebar` and `setSidebarOpen` reducers, and remove both from the exported actions destructuring.

- [ ] **Step 4: Fix remaining references**

Run: `grep -rn "sidebarOpen\|toggleSidebar\|setSidebarOpen\|layout/Sidebar" src --include="*.ts" --include="*.tsx"`

Expected remaining hits: `src/App.test.tsx` (two `ui: { sidebarOpen: true }` seeds) — delete the whole `ui:` block from both `createTestStore` calls. If any other file appears, remove its reference the same way.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit 2>&1 | grep -E "Layout.tsx|uiSlice|App.test"` → expect no output.
Run: `npx vitest run src/App.test.tsx` → PASS (5 tests).
Run: `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/src/components/layout/Layout.tsx` → 200 (if dev server running).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: remove sidebar nav; layout is header + content only"
```

---

### Task 3: Extract `usePortfolioListState` hook (shared expansion/search state)

**Files:**
- Create: `frontend/src/hooks/usePortfolioListState.ts`
- Create: `frontend/src/hooks/usePortfolioListState.test.ts`
- Modify: `frontend/src/pages/portfolios/PortfoliosListPage.tsx` (consume the hook; delete the now-duplicated inline logic)

**Interfaces:**
- Produces (exact — later tasks depend on this):

```ts
export interface PortfolioListState {
  search: string
  setSearch: (s: string) => void
  expandedPortfolios: Set<string>
  expandedPrograms: Set<string>
  togglePortfolio: (id: string) => void
  toggleProgram: (id: string) => void
  /** Union-in ids (used by the tree to auto-expand ancestors of the active item) */
  expandMany: (portfolioIds: string[], programIds: string[]) => void
}
export function usePortfolioListState(): PortfolioListState
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/hooks/usePortfolioListState.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePortfolioListState } from './usePortfolioListState'

describe('usePortfolioListState', () => {
  beforeEach(() => sessionStorage.clear())

  it('starts empty and persists changes to sessionStorage', () => {
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.search).toBe('')
    expect(result.current.expandedPortfolios.size).toBe(0)

    act(() => {
      result.current.setSearch('crm')
      result.current.togglePortfolio('pf1')
      result.current.toggleProgram('pg1')
    })

    const saved = JSON.parse(sessionStorage.getItem('portfoliosListState')!)
    expect(saved.search).toBe('crm')
    expect(saved.portfolios).toEqual(['pf1'])
    expect(saved.programs).toEqual(['pg1'])
  })

  it('initializes from previously saved state', () => {
    sessionStorage.setItem(
      'portfoliosListState',
      JSON.stringify({ search: 'web', portfolios: ['pf9'], programs: [] })
    )
    const { result } = renderHook(() => usePortfolioListState())
    expect(result.current.search).toBe('web')
    expect(result.current.expandedPortfolios.has('pf9')).toBe(true)
  })

  it('toggle removes an already-expanded id', () => {
    const { result } = renderHook(() => usePortfolioListState())
    act(() => result.current.togglePortfolio('pf1'))
    act(() => result.current.togglePortfolio('pf1'))
    expect(result.current.expandedPortfolios.has('pf1')).toBe(false)
  })

  it('expandMany unions ids without collapsing existing ones', () => {
    const { result } = renderHook(() => usePortfolioListState())
    act(() => result.current.togglePortfolio('pf1'))
    act(() => result.current.expandMany(['pf2'], ['pg1', 'pg2']))
    expect(result.current.expandedPortfolios.has('pf1')).toBe(true)
    expect(result.current.expandedPortfolios.has('pf2')).toBe(true)
    expect(result.current.expandedPrograms.has('pg2')).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/usePortfolioListState.test.ts`
Expected: FAIL — cannot resolve `./usePortfolioListState`.

- [ ] **Step 3: Implement the hook**

Create `frontend/src/hooks/usePortfolioListState.ts` (logic moved from `PortfoliosListPage`, plus `expandMany`):

```ts
import { useState, useEffect, useRef } from 'react'

// Session-scoped persistence so the hierarchy looks the same when the user
// returns from a detail page (browser back button, home link, or ✕ close).
// Shared by the rich table (State 1) and the slim tree (State 2).
const LIST_STATE_KEY = 'portfoliosListState'

interface SavedListState {
  search: string
  portfolios: string[]
  programs: string[]
}

const loadSavedListState = (): SavedListState => {
  try {
    const raw = sessionStorage.getItem(LIST_STATE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        search: typeof parsed.search === 'string' ? parsed.search : '',
        portfolios: Array.isArray(parsed.portfolios) ? parsed.portfolios : [],
        programs: Array.isArray(parsed.programs) ? parsed.programs : [],
      }
    }
  } catch {
    // Corrupted saved state — start fresh
  }
  return { search: '', portfolios: [], programs: [] }
}

const toggled = (set: Set<string>, id: string): Set<string> => {
  const next = new Set(set)
  next.has(id) ? next.delete(id) : next.add(id)
  return next
}

export interface PortfolioListState {
  search: string
  setSearch: (s: string) => void
  expandedPortfolios: Set<string>
  expandedPrograms: Set<string>
  togglePortfolio: (id: string) => void
  toggleProgram: (id: string) => void
  expandMany: (portfolioIds: string[], programIds: string[]) => void
}

export function usePortfolioListState(): PortfolioListState {
  const saved = useRef(loadSavedListState()).current
  const [search, setSearch] = useState(saved.search)
  const [expandedPortfolios, setExpandedPortfolios] = useState<Set<string>>(
    new Set(saved.portfolios)
  )
  const [expandedPrograms, setExpandedPrograms] = useState<Set<string>>(
    new Set(saved.programs)
  )

  useEffect(() => {
    sessionStorage.setItem(
      LIST_STATE_KEY,
      JSON.stringify({
        search,
        portfolios: [...expandedPortfolios],
        programs: [...expandedPrograms],
      })
    )
  }, [search, expandedPortfolios, expandedPrograms])

  return {
    search,
    setSearch,
    expandedPortfolios,
    expandedPrograms,
    togglePortfolio: (id) => setExpandedPortfolios((prev) => toggled(prev, id)),
    toggleProgram: (id) => setExpandedPrograms((prev) => toggled(prev, id)),
    expandMany: (portfolioIds, programIds) => {
      if (portfolioIds.length) {
        setExpandedPortfolios((prev) => new Set([...prev, ...portfolioIds]))
      }
      if (programIds.length) {
        setExpandedPrograms((prev) => new Set([...prev, ...programIds]))
      }
    },
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/usePortfolioListState.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Refactor PortfoliosListPage to use the hook**

In `frontend/src/pages/portfolios/PortfoliosListPage.tsx`:

1. Remove: `LIST_STATE_KEY`, the `SavedListState` interface, `loadSavedListState`, the `savedState` ref, the three `useState` calls seeded from it, the persist `useEffect`, and the local `toggle` helper. **Keep** `LIST_SCROLL_KEY` and both scroll effects (window scroll stays a page concern).
2. Add: `import { usePortfolioListState } from '../../hooks/usePortfolioListState'` and inside the component:
   `const { search, setSearch, expandedPortfolios, expandedPrograms, togglePortfolio, toggleProgram } = usePortfolioListState()`
3. Replace the two arrow-button click handlers:
   - portfolio arrow: `setExpandedPortfolios((prev) => toggle(prev, portfolio.id))` → `togglePortfolio(portfolio.id)`
   - program arrow: `setExpandedPrograms((prev) => toggle(prev, program.id))` → `toggleProgram(program.id)`

- [ ] **Step 6: Verify no behavior change**

Run: `npx vitest run src/pages/portfolios/PortfoliosListPage.test.tsx` → PASS (10 tests).
Run: `npx tsc --noEmit 2>&1 | grep -E "PortfoliosListPage|usePortfolioListState"` → no output.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/hooks/usePortfolioListState.ts frontend/src/hooks/usePortfolioListState.test.ts frontend/src/pages/portfolios/PortfoliosListPage.tsx
git commit -m "refactor: extract shared sessionStorage-backed portfolio list state hook"
```

---

### Task 4: HierarchyTree (slim headerless folder tree)

**Files:**
- Create: `frontend/src/components/portfolio/HierarchyTree.tsx`
- Create: `frontend/src/components/portfolio/HierarchyTree.test.tsx`

**Interfaces:**
- Consumes: `usePortfolioListState()` (Task 3), the three list APIs (`portfoliosApi.list`, `programsApi.list`, `projectsApi.list` with `{ limit: 1000 }`), `useScopeFilter()` (`filterPrograms`, `filterProjects`), `useNavigate()`.
- Produces (exact):

```tsx
export type HierarchyItemType = 'portfolio' | 'program' | 'project'
interface HierarchyTreeProps {
  activeType: HierarchyItemType
  activeId: string
  /** Called after a row navigation (used by the narrow-screen swap to hide the tree) */
  onNavigate?: () => void
}
export default HierarchyTree
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/portfolio/HierarchyTree.test.tsx`. Mock the three API modules the same way `PortfoliosListPage.test.tsx` mocks `portfoliosApi` (copy its `vi.mock` pattern):

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import HierarchyTree from './HierarchyTree'
import { portfoliosApi } from '../../api/portfolios'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
}))
vi.mock('../../api/portfolios', () => ({ portfoliosApi: { list: vi.fn() } }))
vi.mock('../../api/programs', () => ({ programsApi: { list: vi.fn() } }))
vi.mock('../../api/projects', () => ({ projectsApi: { list: vi.fn() } }))

const pf = { id: 'pf1', name: 'Default Portfolio', description: '', owner: 'o', reporting_start_date: '2024-01-01', reporting_end_date: '2026-12-31', program_count: 1, version: 1, created_at: '', updated_at: '' }
const pg = { id: 'pg1', name: 'Customer Experience', portfolio_id: 'pf1', business_sponsor: 'b', program_manager: 'm', technical_lead: 't', start_date: '2024-01-01', end_date: '2025-12-31', version: 1, created_at: '', updated_at: '' }
const pj = { id: 'pj1', name: 'CRM System Upgrade', program_id: 'pg1', business_sponsor: 'b', project_manager: 'p', technical_lead: 't', cost_center_code: 'CC-1', start_date: '2024-01-01', end_date: '2025-06-30', version: 1, created_at: '', updated_at: '' }

const makeStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'admin', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('HierarchyTree', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockNavigate.mockClear()
    vi.mocked(portfoliosApi.list).mockResolvedValue({ items: [pf], total: 1, page: 1, size: 1000, pages: 1 } as any)
    vi.mocked(programsApi.list).mockResolvedValue({ items: [pg], total: 1, page: 1, size: 1000, pages: 1 } as any)
    vi.mocked(projectsApi.list).mockResolvedValue({ items: [pj], total: 1, page: 1, size: 1000, pages: 1 } as any)
  })

  it('auto-expands ancestors of the active project and highlights it', async () => {
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })

    // Ancestors auto-expanded => all three names visible without any clicks
    await waitFor(() => {
      expect(screen.getByText('Default Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Customer Experience')).toBeInTheDocument()
      expect(screen.getByText('CRM System Upgrade')).toBeInTheDocument()
    })
    expect(screen.getByText('CRM System Upgrade').closest('[data-active="true"]')).not.toBeNull()
  })

  it('navigates when a row name is clicked', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.click(screen.getByText('Customer Experience'))
    expect(mockNavigate).toHaveBeenCalledWith('/programs/pg1', expect.anything())
  })

  it('arrow button collapses without navigating', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('CRM System Upgrade')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Collapse Customer Experience' }))
    await waitFor(() =>
      expect(screen.queryByText('CRM System Upgrade')).not.toBeInTheDocument()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/portfolio/HierarchyTree.test.tsx`
Expected: FAIL — cannot resolve `./HierarchyTree`.

- [ ] **Step 3: Implement HierarchyTree**

Create `frontend/src/components/portfolio/HierarchyTree.tsx`:

```tsx
import React, { useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Box, IconButton, Paper, Typography } from '@mui/material'
import { KeyboardArrowDown, KeyboardArrowRight } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { Program, Project } from '../../types'
import { useScopeFilter } from '../../hooks/usePermissions'
import { usePortfolioListState } from '../../hooks/usePortfolioListState'

export type HierarchyItemType = 'portfolio' | 'program' | 'project'

interface HierarchyTreeProps {
  activeType: HierarchyItemType
  activeId: string
  onNavigate?: () => void
}

/**
 * Slim (State 2) hierarchy: a headerless folder tree. Level is conveyed by
 * indentation + expand/collapse arrows only (no per-level headers or icons).
 * Clicking a name navigates to that item's detail; the arrow is the only
 * expand/collapse control. Ancestors of the active item auto-expand.
 */
const HierarchyTree: React.FC<HierarchyTreeProps> = ({ activeType, activeId, onNavigate }) => {
  const navigate = useNavigate()
  const { filterPrograms, filterProjects } = useScopeFilter()
  const { expandedPortfolios, expandedPrograms, togglePortfolio, toggleProgram, expandMany } =
    usePortfolioListState()
  const activeRowRef = useRef<HTMLDivElement | null>(null)

  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios', 'consolidated-list'],
    queryFn: () => portfoliosApi.list({ limit: 1000 }),
  })
  const { data: programsData } = useQuery({
    queryKey: ['programs', 'consolidated-list'],
    queryFn: () => programsApi.list({ limit: 1000 }),
  })
  const { data: projectsData } = useQuery({
    queryKey: ['projects', 'consolidated-list'],
    queryFn: () => projectsApi.list({ limit: 1000 }),
  })

  const portfolios = portfoliosData?.items || []
  const programs = useMemo(
    () => filterPrograms(programsData?.items || []),
    [programsData?.items, filterPrograms]
  )
  const projects = useMemo(
    () => filterProjects(projectsData?.items || []),
    [projectsData?.items, filterProjects]
  )

  const programsByPortfolio = useMemo(() => {
    const map = new Map<string, Program[]>()
    for (const program of programs) {
      const key = program.portfolio_id || 'none'
      map.set(key, [...(map.get(key) || []), program])
    }
    return map
  }, [programs])

  const projectsByProgram = useMemo(() => {
    const map = new Map<string, Project[]>()
    for (const project of projects) {
      map.set(project.program_id, [...(map.get(project.program_id) || []), project])
    }
    return map
  }, [projects])

  // Auto-expand the active item's ancestors (project -> program -> portfolio)
  useEffect(() => {
    if (!activeId || programs.length === 0) return
    const portfolioIds: string[] = []
    const programIds: string[] = []
    if (activeType === 'project') {
      const project = projects.find((p) => p.id === activeId)
      const program = project && programs.find((g) => g.id === project.program_id)
      if (program) {
        programIds.push(program.id)
        if (program.portfolio_id) portfolioIds.push(program.portfolio_id)
      }
    } else if (activeType === 'program') {
      const program = programs.find((g) => g.id === activeId)
      if (program?.portfolio_id) portfolioIds.push(program.portfolio_id)
    }
    if (portfolioIds.length || programIds.length) expandMany(portfolioIds, programIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType, activeId, programs, projects])

  // Keep the active row visible within the tree pane
  useEffect(() => {
    activeRowRef.current?.scrollIntoView({ block: 'nearest' })
  })

  const go = (path: string, state?: object) => {
    navigate(path, state ? { state } : undefined)
    onNavigate?.()
  }

  const row = (
    depth: number,
    isActive: boolean,
    arrow: React.ReactNode,
    label: string,
    onClick: () => void,
    key: string
  ) => (
    <Box
      key={key}
      ref={isActive ? activeRowRef : undefined}
      data-active={isActive ? 'true' : undefined}
      onClick={onClick}
      sx={{
        display: 'flex',
        alignItems: 'center',
        pl: 0.5 + depth * 1.75,
        pr: 0.5,
        py: 0.25,
        cursor: 'pointer',
        borderRadius: 1,
        backgroundColor: isActive ? 'primary.main' : 'transparent',
        color: isActive ? 'primary.contrastText' : 'text.primary',
        '&:hover': { backgroundColor: isActive ? 'primary.main' : 'action.hover' },
      }}
    >
      {arrow}
      <Typography variant="body2" noWrap title={label} sx={{ fontSize: '0.78rem' }}>
        {label}
      </Typography>
    </Box>
  )

  const arrowButton = (open: boolean, label: string, onToggle: () => void) => (
    <IconButton
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      size="small"
      sx={{ p: 0.25, mr: 0.25, color: 'inherit' }}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      {open ? <KeyboardArrowDown fontSize="inherit" /> : <KeyboardArrowRight fontSize="inherit" />}
    </IconButton>
  )

  // 22px spacer keeps leaf names aligned with expandable siblings' names
  const leafSpacer = <Box sx={{ width: 22, flexShrink: 0 }} />

  return (
    <Paper
      sx={{
        width: 240,
        flexShrink: 0,
        overflowY: 'auto',
        maxHeight: 'calc(100vh - 96px)',
        py: 0.5,
        pr: 0.5,
      }}
    >
      {portfolios.map((portfolio) => {
        const pfOpen = expandedPortfolios.has(portfolio.id)
        const children = programsByPortfolio.get(portfolio.id) || []
        return (
          <React.Fragment key={portfolio.id}>
            {row(
              0,
              activeType === 'portfolio' && activeId === portfolio.id,
              arrowButton(pfOpen, portfolio.name, () => togglePortfolio(portfolio.id)),
              portfolio.name,
              () => go(`/portfolios/${portfolio.id}`),
              `pf-${portfolio.id}`
            )}
            {pfOpen &&
              children.map((program) => {
                const pgOpen = expandedPrograms.has(program.id)
                const projectChildren = projectsByProgram.get(program.id) || []
                return (
                  <React.Fragment key={program.id}>
                    {row(
                      1,
                      activeType === 'program' && activeId === program.id,
                      arrowButton(pgOpen, program.name, () => toggleProgram(program.id)),
                      program.name,
                      () =>
                        go(`/programs/${program.id}`, {
                          portfolioId: portfolio.id,
                          portfolioName: portfolio.name,
                        }),
                      `pg-${program.id}`
                    )}
                    {pgOpen &&
                      projectChildren.map((project) =>
                        row(
                          2,
                          activeType === 'project' && activeId === project.id,
                          leafSpacer,
                          project.name,
                          () =>
                            go(`/projects/${project.id}`, {
                              programId: program.id,
                              programName: program.name,
                              portfolioId: portfolio.id,
                              portfolioName: portfolio.name,
                            }),
                          `pj-${project.id}`
                        )
                      )}
                  </React.Fragment>
                )
              })}
          </React.Fragment>
        )
      })}
    </Paper>
  )
}

export default HierarchyTree
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/portfolio/HierarchyTree.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/portfolio/HierarchyTree.tsx frontend/src/components/portfolio/HierarchyTree.test.tsx
git commit -m "feat: slim headerless hierarchy folder tree with ancestor auto-expand"
```

---

### Task 5: PortfolioShell layout route + route restructure + home = /portfolios

**Files:**
- Create: `frontend/src/components/layout/PortfolioShell.tsx`
- Create: `frontend/src/components/layout/PortfolioShell.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/contexts/AuthContext.tsx` (login lands on `/portfolios`)
- Modify: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `HierarchyTree` (Task 4).
- Produces: `PortfolioShell` — a pathless layout route element rendering `[tree | <Outlet/>]` when a hierarchy detail route matches, plain `<Outlet/>` otherwise.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/layout/PortfolioShell.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import PortfolioShell from './PortfolioShell'

vi.mock('../portfolio/HierarchyTree', () => ({
  default: ({ activeType, activeId }: any) => (
    <div data-testid="hierarchy-tree">{activeType}:{activeId}</div>
  ),
}))

const makeStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'admin', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<PortfolioShell />}>
          <Route path="/portfolios" element={<div data-testid="rich-list" />} />
          <Route path="/projects/:id" element={<div data-testid="project-detail" />} />
        </Route>
      </Routes>
    </MemoryRouter>,
    { store: makeStore(), queryClient: createTestQueryClient(), router: false } as any
  )

describe('PortfolioShell', () => {
  it('renders the outlet full-width with no tree on /portfolios (State 1)', () => {
    renderAt('/portfolios')
    expect(screen.getByTestId('rich-list')).toBeInTheDocument()
    expect(screen.queryByTestId('hierarchy-tree')).not.toBeInTheDocument()
  })

  it('renders tree + detail when a project detail route is active (State 2)', () => {
    renderAt('/projects/pj1')
    expect(screen.getByTestId('project-detail')).toBeInTheDocument()
    expect(screen.getByTestId('hierarchy-tree')).toHaveTextContent('project:pj1')
  })
})
```

Note: `test-utils`'s `render` may wrap children in a router already. Check `src/test/test-utils.tsx` first: if it always wraps in a `BrowserRouter`/`MemoryRouter`, either use its documented escape hatch or render the `MemoryRouter` tree through the raw RTL `render` with the store/query providers composed manually (copy the provider composition from `test-utils`). The assertion content stays the same.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/layout/PortfolioShell.test.tsx`
Expected: FAIL — cannot resolve `./PortfolioShell`.

- [ ] **Step 3: Implement PortfolioShell**

Create `frontend/src/components/layout/PortfolioShell.tsx`:

```tsx
import React from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import { Box } from '@mui/material'
import HierarchyTree, { HierarchyItemType } from '../portfolio/HierarchyTree'

interface DetailMatch {
  type: HierarchyItemType
  id: string
}

const DETAIL_PATTERNS: Array<{ pattern: string; type: HierarchyItemType }> = [
  { pattern: '/portfolios/:id', type: 'portfolio' },
  { pattern: '/programs/:id', type: 'program' },
  { pattern: '/projects/:id', type: 'project' },
]

const useHierarchyDetailMatch = (): DetailMatch | null => {
  const location = useLocation()
  for (const { pattern, type } of DETAIL_PATTERNS) {
    const match = matchPath({ path: pattern, end: true }, location.pathname)
    if (match?.params.id) return { type, id: match.params.id }
  }
  return null
}

/**
 * Persistent Portfolios workspace shell (layout route).
 * State 1 (/portfolios): outlet full-width — the rich all-columns table.
 * State 2 (a hierarchy detail route): slim folder tree | detail content.
 */
const PortfolioShell: React.FC = () => {
  const detail = useHierarchyDetailMatch()

  if (!detail) {
    return <Outlet />
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <HierarchyTree activeType={detail.type} activeId={detail.id} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}

export default PortfolioShell
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/layout/PortfolioShell.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Restructure App.tsx routes**

In `frontend/src/App.tsx`:

1. Add `import PortfolioShell from './components/layout/PortfolioShell'`.
2. Change the root redirect: `<Route path="/" element={<Navigate to="/portfolios" replace />} />`.
3. Group the four hierarchy routes under the shell (form/edit routes stay **outside** — static segments like `/portfolios/new` outrank `/portfolios/:id`, so they keep matching their own full-page routes):

```tsx
<Route element={<PortfolioShell />}>
  <Route path="/portfolios" element={<PortfoliosListPage />} />
  <Route path="/portfolios/:id" element={<PortfolioDetailPage />} />
  <Route path="/programs/:id" element={<ProgramDetailPage />} />
  <Route path="/projects/:id" element={<ProjectDetailPage />} />
</Route>
```

Remove the four original standalone `<Route>` lines for those paths; leave `/portfolios/new`, `/programs/new`, `/programs/:id/edit`, `/projects/new`, `/projects/:id/edit`, and the `/programs`→`/portfolios`, `/projects`→`/portfolios` redirects exactly where they are.

4. In `frontend/src/contexts/AuthContext.tsx`, change the post-login `navigate('/dashboard')` to `navigate('/portfolios')`.

- [ ] **Step 6: Update App.test.tsx**

In the "Root Routing" describe block: the two tests currently assert the dashboard. Change them to assert Portfolios:

```tsx
it('should redirect from "/" to Portfolios', async () => {
  window.history.pushState({}, 'Test page', '/')
  render(<App />, { store })
  await waitFor(() => {
    expect(screen.getByTestId('portfolios-list')).toBeInTheDocument()
  })
  expect(window.location.pathname).toBe('/portfolios')
})

it('should display the Dashboard when navigating to /dashboard', async () => {
  window.history.pushState({}, 'Test page', '/dashboard')
  render(<App />, { store })
  await waitFor(() => {
    expect(screen.getByTestId('dashboard')).toBeInTheDocument()
  })
})
```

(`portfolios-list` is already a mocked testid in this file.)

- [ ] **Step 7: Verify**

Run: `npx vitest run src/App.test.tsx src/components/layout/PortfolioShell.test.tsx` → PASS.
Run: `npx tsc --noEmit 2>&1 | grep -E "App.tsx|PortfolioShell|AuthContext"` → no output.
If AuthContext has its own test asserting `/dashboard`, run `grep -rn "navigate('/dashboard')" src --include="*.test.*"` and update any hit to `/portfolios`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: PortfolioShell layout route; home and login land on /portfolios"
```

---

### Task 6: Narrow-screen swap (tree OR content)

**Files:**
- Modify: `frontend/src/components/layout/PortfolioShell.tsx`
- Modify: `frontend/src/components/layout/PortfolioShell.test.tsx`

**Interfaces:**
- Consumes: `HierarchyTree`'s `onNavigate` prop (Task 4).
- Produces: below MUI `md`, the shell shows content with a "‹ List" button, or the tree alone after pressing it.

- [ ] **Step 1: Add failing tests**

Append to `PortfolioShell.test.tsx` (mock `useMediaQuery`):

```tsx
import * as muiMaterial from '@mui/material'

describe('PortfolioShell narrow screens', () => {
  it('shows content + "List" button instead of the side tree when narrow', async () => {
    const spy = vi.spyOn(muiMaterial, 'useMediaQuery').mockReturnValue(true)
    renderAt('/projects/pj1')
    expect(screen.getByTestId('project-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('hierarchy-tree')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument()
    spy.mockRestore()
  })

  it('pressing the List button swaps to the tree', async () => {
    const spy = vi.spyOn(muiMaterial, 'useMediaQuery').mockReturnValue(true)
    const user = (await import('@testing-library/user-event')).default.setup()
    renderAt('/projects/pj1')
    await user.click(screen.getByRole('button', { name: /list/i }))
    expect(screen.getByTestId('hierarchy-tree')).toBeInTheDocument()
    expect(screen.queryByTestId('project-detail')).not.toBeInTheDocument()
    spy.mockRestore()
  })
})
```

If `vi.spyOn` on the barrel export fails ("not configurable"), switch to `vi.mock('@mui/material', async () => ({ ...(await vi.importActual<any>('@mui/material')), useMediaQuery: vi.fn(() => mockNarrow) }))` at the top of the file with a `let mockNarrow = false` toggled per test.

- [ ] **Step 2: Run to verify the new tests fail**

Run: `npx vitest run src/components/layout/PortfolioShell.test.tsx`
Expected: the two new tests FAIL (no "List" button yet); the original two still pass.

- [ ] **Step 3: Implement the swap**

Replace the `PortfolioShell` component body with:

```tsx
import React, { useState } from 'react'
import { Outlet, matchPath, useLocation } from 'react-router-dom'
import { Box, Button, useMediaQuery, useTheme } from '@mui/material'
import { ChevronLeft } from '@mui/icons-material'
import HierarchyTree, { HierarchyItemType } from '../portfolio/HierarchyTree'

// ... DETAIL_PATTERNS and useHierarchyDetailMatch unchanged ...

const PortfolioShell: React.FC = () => {
  const detail = useHierarchyDetailMatch()
  const theme = useTheme()
  const isNarrow = useMediaQuery(theme.breakpoints.down('md'))
  const [treeVisibleOnNarrow, setTreeVisibleOnNarrow] = useState(false)

  if (!detail) {
    return <Outlet />
  }

  if (isNarrow) {
    // Master-detail swap: tree OR content, never side by side
    if (treeVisibleOnNarrow) {
      return (
        <HierarchyTree
          activeType={detail.type}
          activeId={detail.id}
          onNavigate={() => setTreeVisibleOnNarrow(false)}
        />
      )
    }
    return (
      <Box>
        <Button
          size="small"
          startIcon={<ChevronLeft />}
          onClick={() => setTreeVisibleOnNarrow(true)}
          sx={{ mb: 1 }}
        >
          List
        </Button>
        <Outlet />
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
      <HierarchyTree activeType={detail.type} activeId={detail.id} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </Box>
    </Box>
  )
}
```

Note: when narrow and the tree is shown, widen it: in `HierarchyTree`, `width: 240` stays fine for this pass (it renders alone; a fixed slim width on mobile is acceptable per the desktop-first constraint).

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/components/layout/PortfolioShell.test.tsx` → PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/layout/PortfolioShell.tsx frontend/src/components/layout/PortfolioShell.test.tsx
git commit -m "feat: narrow-screen master-detail swap in portfolio shell"
```

---

### Task 7: DetailPaneHeader + ProjectDetailPage rework (breadcrumbs out, chip + ✕ in)

**Files:**
- Create: `frontend/src/components/common/DetailPaneHeader.tsx`
- Create: `frontend/src/components/common/DetailPaneHeader.test.tsx`
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx`

**Interfaces:**
- Produces (exact — Tasks 8 uses it too):

```tsx
interface DetailPaneHeaderProps {
  title: string
  statusChip?: React.ReactNode
  onClose: () => void
}
export default DetailPaneHeader
```

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/common/DetailPaneHeader.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from '@mui/material'
import DetailPaneHeader from './DetailPaneHeader'

describe('DetailPaneHeader', () => {
  it('renders title, chip, and calls onClose from the close button', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <DetailPaneHeader title="CRM System Upgrade" statusChip={<Chip label="Active" />} onClose={onClose} />
    )
    expect(screen.getByText('CRM System Upgrade')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /close detail/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/common/DetailPaneHeader.test.tsx`
Expected: FAIL — cannot resolve `./DetailPaneHeader`.

- [ ] **Step 3: Implement DetailPaneHeader**

Create `frontend/src/components/common/DetailPaneHeader.tsx`:

```tsx
import React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import { Close } from '@mui/icons-material'

interface DetailPaneHeaderProps {
  title: string
  statusChip?: React.ReactNode
  onClose: () => void
}

/**
 * Header row for a detail page rendered in the Portfolios shell content pane:
 * title + status chip on the left, ✕ close (back to the rich list) on the right.
 * Replaces the removed breadcrumb bar.
 */
const DetailPaneHeader: React.FC<DetailPaneHeaderProps> = ({ title, statusChip, onClose }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Typography variant="h6" noWrap title={title}>
      {title}
    </Typography>
    {statusChip}
    <Box sx={{ flex: 1 }} />
    <IconButton aria-label="Close detail" size="small" onClick={onClose}>
      <Close fontSize="small" />
    </IconButton>
  </Box>
)

export default DetailPaneHeader
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/common/DetailPaneHeader.test.tsx` → PASS.

- [ ] **Step 5: Rework ProjectDetailPage**

In `frontend/src/pages/projects/ProjectDetailPage.tsx`:

1. Remove imports: `ScopeBreadcrumbs`, `truncateAtLoop`.
2. Add import: `import DetailPaneHeader from '../../components/common/DetailPaneHeader'`.
3. Delete the whole `navigationState` block and the entire `breadcrumbItems` construction (everything from `const breadcrumbItems: Array<...> = []` through `breadcrumbItems.push({ label: project.name })`).
4. Replace the `<ScopeBreadcrumbs items={...} statusChip={...} />` element with:

```tsx
<DetailPaneHeader
  title={project.name}
  statusChip={<Chip label={status} color={statusColor} />}
  onClose={() => navigate('/portfolios')}
/>
```

(`navigate` is already available once re-added: `const navigate = useNavigate()` exists but was flagged unused before — it becomes used now.)

5. The `ResourceAssignmentCalendar` currently receives `projectBreadcrumbItems={[...breadcrumbItems.slice(0, -1), ...]}`. Replace with a minimal self-contained chain (the prop is optional, typed `BreadcrumbItem[]`, and resource pages still use breadcrumbs):

```tsx
projectBreadcrumbItems={[
  { label: project.name, path: `/projects/${id}?tab=1` },
]}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "pages/projects/ProjectDetailPage.tsx" | grep -v "\.test\.\|\.integration\.\|\.calendar\."`
Expected: strictly fewer or equal errors vs baseline (the `navigate`/`truncateAtLoop` unused-var errors disappear; **no new** errors).
Run: `npx vitest run src/pages/projects/ProjectDetailPage.integration.test.tsx src/pages/projects/ProjectDetailPage.calendar.test.tsx`
Expected: same pass/fail counts as on `main` before this task (run them on the base commit first if unsure). If a test fails **because it asserts breadcrumb labels**, replace that assertion with `expect(screen.getByRole('button', { name: /close detail/i })).toBeInTheDocument()`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: detail pane header with close on project page; drop breadcrumbs"
```

---

### Task 8: ProgramDetailPage + PortfolioDetailPage + rich-list breadcrumb removal

**Files:**
- Modify: `frontend/src/pages/programs/ProgramDetailPage.tsx`
- Modify: `frontend/src/pages/portfolios/PortfolioDetailPage.tsx`
- Modify: `frontend/src/pages/portfolios/PortfoliosListPage.tsx`
- Modify (if needed): `frontend/src/pages/portfolios/PortfoliosListPage.test.tsx`

**Interfaces:**
- Consumes: `DetailPaneHeader` (Task 7).

- [ ] **Step 1: ProgramDetailPage**

Same recipe as Task 7 Step 5:
1. Remove the `ScopeBreadcrumbs` import; add the `DetailPaneHeader` import.
2. Delete the `navigationState` const and the whole `breadcrumbItems` construction block.
3. Replace `<ScopeBreadcrumbs items={breadcrumbItems} statusChip={<Chip label={status} color={statusColor} />} />` with:

```tsx
<DetailPaneHeader
  title={program.name}
  statusChip={<Chip label={status} color={statusColor} />}
  onClose={() => navigate('/portfolios')}
/>
```

4. `handleProjectRowClick` referenced `navigationState` for portfolio context — replace its navigation state with data-derived values:

```tsx
navigate(`/projects/${project.id}`, {
  state: {
    portfolioId: program?.portfolio?.id,
    portfolioName: program?.portfolio?.name,
    programId: program?.id,
    programName: program?.name,
  },
})
```

- [ ] **Step 2: PortfolioDetailPage**

1. Remove the `ScopeBreadcrumbs` import; add the `DetailPaneHeader` import.
2. Replace the `<ScopeBreadcrumbs items={[...]} statusChip={<Chip label={status} color={statusColor} />} />` block (around line 234) with:

```tsx
<DetailPaneHeader
  title={portfolio.name}
  statusChip={<Chip label={status} color={statusColor} />}
  onClose={() => navigate('/portfolios')}
/>
```

- [ ] **Step 3: PortfoliosListPage (rich table)**

Remove the `ScopeBreadcrumbs` import and the `<ScopeBreadcrumbs items={[{ label: 'Home', ... }, { label: 'Portfolios' }]} />` element (keep `<ScopeFilterBanner />`). The shell + header title now provide orientation.

- [ ] **Step 4: Verify**

Run: `npx vitest run src/pages/portfolios/PortfoliosListPage.test.tsx`
Expected: the "should display page title" test asserts `getByText('Portfolios')` which came from the breadcrumb — it will now FAIL. Update that test to assert the search box instead (stable identity of the page):

```tsx
it('should display the list search box', () => {
  render(<PortfoliosListPage />, { store, queryClient })
  expect(
    screen.getByPlaceholderText('Search portfolios, programs, projects...')
  ).toBeInTheDocument()
})
```

Re-run → PASS (10 tests).
Run: `npx tsc --noEmit 2>&1 | grep -E "ProgramDetailPage.tsx|PortfolioDetailPage.tsx|PortfoliosListPage.tsx" | grep -v test` → no new errors vs baseline.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: detail pane headers on program/portfolio pages; remove breadcrumb bars"
```

---

### Task 9: Contextual Actuals tab on ProjectDetailPage

**Files:**
- Create: `frontend/src/components/actuals/ProjectActualsTab.tsx`
- Create: `frontend/src/components/actuals/ProjectActualsTab.test.tsx`
- Modify: `frontend/src/pages/projects/ProjectDetailPage.tsx`

**Interfaces:**
- Consumes: `actualsApi.listActuals(params)` (existing; params `{ page, size, project_id }`; returns `{ items, total, ... }`).
- Produces: `<ProjectActualsTab projectId={string} />`.

- [ ] **Step 1: Write the failing test**

Create `frontend/src/components/actuals/ProjectActualsTab.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import ProjectActualsTab from './ProjectActualsTab'
import { actualsApi } from '../../api/actuals'

vi.mock('../../api/actuals', () => ({ actualsApi: { listActuals: vi.fn() } }))

const makeStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'admin', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('ProjectActualsTab', () => {
  beforeEach(() => {
    vi.mocked(actualsApi.listActuals).mockResolvedValue({
      items: [
        {
          id: 'a1',
          project_id: 'pj1',
          project_name: 'CRM',
          external_worker_id: 'EMP001',
          worker_name: 'John Smith',
          actual_date: '2026-01-15',
          allocation_percentage: 50,
          actual_cost: 625,
          capital_amount: 375,
          expense_amount: 250,
        },
      ],
      total: 1,
      page: 1,
      size: 25,
      pages: 1,
    } as any)
  })

  it('fetches actuals scoped to the project and renders rows', async () => {
    render(<ProjectActualsTab projectId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('John Smith')).toBeInTheDocument())
    expect(vi.mocked(actualsApi.listActuals)).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'pj1' })
    )
    // No Project column — the whole tab is scoped to one project
    expect(screen.queryByText('Project')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/actuals/ProjectActualsTab.test.tsx`
Expected: FAIL — cannot resolve `./ProjectActualsTab`.

- [ ] **Step 3: Implement ProjectActualsTab**

Create `frontend/src/components/actuals/ProjectActualsTab.tsx` (columns copied from `ActualsListPage`, minus the Project column; server pagination):

```tsx
import { useState } from 'react'
import { Paper } from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel, GridValueFormatterParams } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { actualsApi } from '../../api/actuals'

interface ProjectActualsTabProps {
  projectId: string
}

const columns: GridColDef[] = [
  {
    field: 'actual_date',
    headerName: 'Date',
    width: 120,
    valueFormatter: (params: GridValueFormatterParams) =>
      format(new Date(params.value as string), 'yyyy-MM-dd'),
  },
  { field: 'worker_name', headerName: 'Worker', width: 180 },
  { field: 'external_worker_id', headerName: 'Worker ID', width: 120 },
  {
    field: 'allocation_percentage',
    headerName: 'Allocation %',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `${params.value}%`,
  },
  {
    field: 'actual_cost',
    headerName: 'Cost',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
  },
  {
    field: 'capital_amount',
    headerName: 'Capital',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
  },
  {
    field: 'expense_amount',
    headerName: 'Expense',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
  },
]

/** Actuals recorded against a single project — the contextual Actuals tab. */
const ProjectActualsTab: React.FC<ProjectActualsTabProps> = ({ projectId }) => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['actuals', 'project', projectId, paginationModel],
    queryFn: () =>
      actualsApi.listActuals({
        project_id: projectId,
        page: paginationModel.page + 1,
        size: paginationModel.pageSize,
      }),
  })

  return (
    <Paper sx={{ height: 'calc(100vh - 260px)', width: '100%' }}>
      <DataGrid
        rows={data?.items || []}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50, 100]}
        rowCount={data?.total || 0}
        paginationMode="server"
        loading={isLoading}
        disableRowSelectionOnClick
      />
    </Paper>
  )
}

export default ProjectActualsTab
```

Check `src/api/actuals.ts` for the exact `listActuals` param names (`project_id`, `page`, `size` — the ones `ActualsListPage` already passes).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/actuals/ProjectActualsTab.test.tsx` → PASS.

- [ ] **Step 5: Wire the tab into ProjectDetailPage**

In `frontend/src/pages/projects/ProjectDetailPage.tsx`:

1. `import ProjectActualsTab from '../../components/actuals/ProjectActualsTab'`.
2. Add `<Tab label="Actuals" />` after `<Tab label="Assignments" />`.
3. Update the URL-tab clamp from `Math.min(Math.max(parsed, 0), 1)` to `Math.min(Math.max(parsed, 0), 2)` (the old Financials index 2 is now the Actuals tab — an acceptable landing for stale links).
4. Add after the Assignments `TabPanel`:

```tsx
<TabPanel value={tabValue} index={2}>
  <ProjectActualsTab projectId={id!} />
</TabPanel>
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit 2>&1 | grep "ProjectDetailPage.tsx" | grep -v "\.test\.\|\.integration\.\|\.calendar\."` → no new errors.
Run: `npx vitest run src/components/actuals/ProjectActualsTab.test.tsx` → PASS.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: contextual Actuals tab on project detail"
```

---

### Task 10: Full verification + live E2E

**Files:**
- No new source files. Uses a throwaway script at `/tmp/nav_e2e.py`.

- [ ] **Step 1: Full frontend test suite for touched areas**

Run:
```bash
npx vitest run src/App.test.tsx src/components/layout src/components/portfolio/HierarchyTree.test.tsx src/components/common/DetailPaneHeader.test.tsx src/components/actuals src/hooks/usePortfolioListState.test.ts src/pages/portfolios/PortfoliosListPage.test.tsx
```
Expected: all PASS.

- [ ] **Step 2: Type-check delta**

Run: `npx tsc --noEmit 2>&1 | grep -v "\.test\.\|\.integration\.\|\.calendar\.\|\.properties\." | sort > /tmp/tsc_now.txt` and compare with the same command's output on the branch base (`git stash` if needed): **no new non-test errors**.

- [ ] **Step 3: Live E2E via headless Chrome CDP**

Prereqs: vite dev server on :3000, backend on :8000 (docker-compose). Write `/tmp/nav_e2e.py`:

```python
import json, subprocess, time, urllib.request, websocket

login = json.loads(urllib.request.urlopen(urllib.request.Request(
    "http://localhost:8000/api/v1/auth/login",
    data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
    headers={"Content-Type": "application/json"})).read())
access, refresh = login["tokens"]["access_token"], login["tokens"].get("refresh_token", "")
req = urllib.request.Request("http://localhost:8000/api/v1/projects/?limit=1",
                             headers={"Authorization": f"Bearer {access}"})
proj = json.loads(urllib.request.urlopen(req).read())["items"][0]

chrome = subprocess.Popen(
    ["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu",
     "--remote-debugging-port=9223", "--remote-allow-origins=*",
     "--window-size=1680,1050", "about:blank"],
    stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    for _ in range(50):
        try:
            targets = json.loads(urllib.request.urlopen("http://localhost:9223/json").read())
            page = next(t for t in targets if t["type"] == "page"); break
        except Exception: time.sleep(0.2)
    ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=30)
    n = [0]
    def cdp(method, **params):
        n[0] += 1; ws.send(json.dumps({"id": n[0], "method": method, "params": params}))
        while True:
            m = json.loads(ws.recv())
            if m.get("id") == n[0]: return m.get("result", {})
    def js(expr):
        return cdp("Runtime.evaluate", expression=expr, returnByValue=True).get("result", {}).get("value")
    cdp("Page.enable")
    cdp("Page.navigate", url="http://localhost:3000/login"); time.sleep(2.5)
    js(f"localStorage.setItem('token', {json.dumps(access)}); localStorage.setItem('refreshToken', {json.dumps(refresh)}); sessionStorage.clear(); 1")

    # 1. Deep-link a project -> shell with tree, active row highlighted
    cdp("Page.navigate", url=f"http://localhost:3000/projects/{proj['id']}"); time.sleep(4)
    print("deep-link:", js("""JSON.stringify({
        url: location.pathname,
        treeActive: !!document.querySelector('[data-active="true"]'),
        activeText: (document.querySelector('[data-active="true"]')||{}).textContent || null,
        closeBtn: !!document.querySelector('[aria-label="Close detail"]'),
        noBreadcrumbs: !document.querySelector('.MuiBreadcrumbs-root')
    })"""))

    # 2. Close detail -> back to rich table (State 1)
    js("document.querySelector('[aria-label=\\'Close detail\\']').click()"); time.sleep(2)
    print("after close:", js("""JSON.stringify({
        url: location.pathname,
        richTable: !!document.querySelector('input[placeholder^="Search"]'),
        treeGone: !document.querySelector('[data-active="true"]')
    })"""))

    # 3. Waffle -> Workers
    js("document.querySelector('[aria-label=\\'apps\\']').click()"); time.sleep(1)
    js("[...document.querySelectorAll('li')].find(li => li.textContent.trim()==='Workers').click()"); time.sleep(2)
    print("waffle:", js("location.pathname"))
finally:
    chrome.terminate()
```

Run: `python3 /tmp/nav_e2e.py`
Expected output:
- `deep-link:` `url` is `/projects/<id>`, `treeActive` true, `activeText` = the project name, `closeBtn` true, `noBreadcrumbs` true
- `after close:` `url` = `/portfolios`, `richTable` true, `treeGone` true
- `waffle:` `/workers`

- [ ] **Step 4: Fix anything the E2E surfaces, re-run, commit**

```bash
git add -A
git commit -m "test: verify portfolio shell navigation end to end"
```

---

## Self-Review Notes

- **Spec coverage:** waffle + header (Task 1), sidebar removal (Task 2), shared state (Task 3), slim tree incl. option-C form + auto-expand + scroll-into-view (Task 4), shell + always-in-shell routing + home=/portfolios (Task 5), responsive swap (Task 6), breadcrumb removal + chip + ✕ on all three detail pages and the rich list (Tasks 7–8), contextual Actuals tab (Task 9), deep-link/close/waffle E2E (Task 10). Scroll persistence for the rich list is retained as-is (window scroll, kept in the page in Task 3); the slim tree uses `scrollIntoView` per spec.
- **Types:** `usePortfolioListState` signature (Task 3) matches usage in Tasks 4–5; `HierarchyTreeProps` (Task 4) matches Task 5/6 usage; `DetailPaneHeaderProps` (Task 7) matches Task 8 usage.
- **Known judgment calls encoded:** form/edit routes stay outside the shell; stale `?tab=2` links land on the new Actuals tab; `ResourceAssignmentCalendar` gets a minimal one-item breadcrumb chain since resource pages keep breadcrumbs.
