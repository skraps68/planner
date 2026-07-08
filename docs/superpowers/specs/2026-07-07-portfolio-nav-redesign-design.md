# Portfolio-Centric Navigation Redesign — Design

**Date:** 2026-07-07
**Status:** Approved (design), pending implementation plan
**Branch:** `nav-redesign`
**Milestone baseline:** tag `v0.1.0`

## Problem & Goal

The app currently uses a left sidebar of peer navigation items (Portfolios,
Resources, Workers, Actuals, Reports, Dashboard, User Management) plus
hierarchy breadcrumbs on detail pages. After consolidating the three list
pages into one nested Portfolios list, the sidebar and breadcrumbs no longer
reflect how the app is actually used.

A project manager reaches ~90% of what they need through the **Portfolios
hierarchy**. Resources and Actuals are mostly accessed *contextually* from a
project; Workers, Dashboard, Reports, and User Management are occasional
"leave the workspace" destinations.

**Goal:** Make the Portfolios hierarchy the primary, always-present navigation
tool, demote everything else to a single top-left launcher, and give detail
pages an "instant navigation" master-detail experience without losing
deep-linking, the back button, or the session-state persistence already built.

## Core Model — one hierarchy widget, two states

There is a single hierarchy widget rendered in a persistent **Portfolios
shell**. It has two states, driven purely by whether a detail route is active:

- **State 1 — Home (`/portfolios`, no detail selected):** the hierarchy fills
  the width as the **rich all-columns table** (the current consolidated
  Portfolios list: aligned columns for owner/sponsor/manager, cost center,
  dates, status across portfolio → program → project). This is the
  scan-and-compare view. The Create Portfolio/Program/Project buttons live in
  its toolbar.
- **State 2 — Detail open (e.g. `/projects/:id`):** the hierarchy **compresses
  to a names-only tree** strip on the left; the detail page renders in a
  content pane on the right.

The user never sees the slim tree and the rich table at the same time — it is
one widget at one of two widths. Selecting a row navigates to its detail route
(→ State 2). Closing the detail (✕ or the home/logo affordance) navigates back
to `/portfolios` (→ State 1, rich table re-expands).

## Architecture

### Routing (react-router nested layout route)

A layout route renders `[ hierarchy pane | <Outlet/> ]` and wraps:

- `/portfolios` — Outlet empty → hierarchy is full-width rich table
- `/portfolios/:id` — portfolio detail in Outlet → compressed tree
- `/programs/:id` — program detail in Outlet → compressed tree
- `/projects/:id` — project detail in Outlet → compressed tree

URLs stay real, so deep links, the browser back button, and the existing
`sessionStorage` persistence (search, expansion, scroll) keep working
unchanged. The hierarchy pane determines its state from the matched route
(e.g. `useMatch`/route params): if a detail child is active it renders
compressed, otherwise full-width.

**Always in the shell:** any portfolio/program/project detail route renders
inside this shell regardless of entry point (Portfolios tree, a Resources
page, an Actuals row, a Reports link, or a bookmark/deep link). On load the
tree **auto-expands the ancestors** of the active item, highlights it, and
scrolls it into view.

### The Portfolios shell component

New component that owns the two-state hierarchy pane + the Outlet. Reuses the
existing consolidated-list rendering for State 1 (rich table) and a
names-only rendering for State 2 (compressed tree). Both share the same
expansion state and the same data (the three list queries already in
`PortfoliosListPage`).

Responsibilities:

- Render rich table (State 1) or compressed tree (State 2) based on route.
- Persist and restore search, expansion, and scroll (existing behavior,
  adapted so scroll applies to the hierarchy pane rather than the window).
- Given the active detail's id, resolve and expand its ancestor chain
  (project → `program_id` → `portfolio_id`), highlight, and scroll into view.

### Top bar (`Header.tsx`)

- **Remove** the hamburger and its `toggleSidebar` dispatch.
- **Add a waffle launcher top-left** (grid icon, tooltip/label) → popover menu,
  lightly grouped:
  - **Setup:** Workers, User Management
  - **Insights:** Dashboard, Reports
  - **Global lists:** Resources (all), Actuals (all)
- The title **"Program & Project Management"** becomes a home link → `/portfolios`.
- Account widgets on the right (notifications, username + role chip, avatar
  account menu) are unchanged. App-navigation stays separate from the account
  menu.

### Detail pages (rendered in the content pane)

`ProjectDetailPage`, `ProgramDetailPage`, `PortfolioDetailPage` remain
route-driven (`useParams`, same data fetching). Changes:

- **Remove `ScopeBreadcrumbs`** from these three pages.
- **Move the status chip** (Active/Planned/Completed) into the detail header.
- **Add a ✕ close** control in the content-pane header → navigate to
  `/portfolios` (State 1).
- **Project detail:** add a contextual **Actuals tab** (pre-scoped to the
  project) alongside Details and Assignments. (Resources is already the
  Assignments tab.)
- **Drop** the `fromResourceBreadcrumbs` return-trail logic — the browser back
  button covers returning to a resource page.

### Waffle destinations (full-page, outside the shell)

Workers, Dashboard, Reports, User Management, and the **global** Resources and
Actuals list pages render as normal full-page routes with **no hierarchy tree**.
Their internals are unchanged this pass. The global Resources/Actuals lists are
retained (behind the waffle) for cross-project/reconciliation use; contextual
project tabs are the primary path.

### Layout & Sidebar

The old left **`Sidebar` of nav items is removed** — the hierarchy tree is the
new left navigation, and the waffle holds everything else. `Layout.tsx` is
reworked: no `Sidebar`; the main region hosts either the Portfolios shell or a
full-page waffle destination. The `ui.sidebarOpen` Redux state and
`toggleSidebar` become unused and are removed.

## Responsive (desktop-first, graceful fallback)

- **Wide (≥ ~900px, MUI `md`):** full experience — waffle in the top bar, and
  `[ tree | content ]` in the shell.
- **Narrow (< ~900px):** **master-detail swap** — show the tree *or* the
  content, not both, with a "‹ list" affordance to return to the tree from an
  open detail. The rich table (State 1) is horizontally scrollable on narrow
  screens.

Mobile is usable but basic in this pass; a polished mobile experience is a
future iteration.

## State & Behaviors

- **Persistence (existing, adapted):** search text, expanded portfolios/
  programs, and scroll position persist in `sessionStorage` so returning to
  the list (back button, home, or closing a detail) restores it. Scroll now
  applies to the hierarchy pane.
- **Selection/auto-expand:** the active detail's ancestors expand
  automatically even if not previously expanded.
- **Home affordance:** the title/logo returns to `/portfolios` (State 1).

## Testing

- Update `App.test` routing tests for the new layout-route structure.
- Update `PortfoliosListPage` tests (rich table now lives inside the shell).
- New tests for the shell: State 1 ↔ State 2 transition on select/close,
  ancestor auto-expand + highlight from a deep-linked detail route, and the
  responsive swap boundary.
- Verify (headless browser) that deep-linking a `/projects/:id` opens the shell
  with the tree expanded to that project.

## Out of Scope (unchanged)

- Detail-page internals (the compact details+financials split, drill-down
  charts, variance shading, whole-dollar formatting).
- Waffle destination pages' internals (Workers, Dashboard, Reports, Users, and
  the global Resources/Actuals lists themselves).
- Backend / data fetching.

## Defaults chosen (easily revisited)

- Waffle grouping labels: Setup / Insights / Global lists.
- Responsive breakpoint: MUI `md` (~900px).
- Create Portfolio/Program/Project buttons remain in the rich-table toolbar.

## Risks / Watch-items

- **Horizontal space:** the content pane is narrower than a full-width page
  today; the detail split (Details + Financials + charts) is snug below
  ~1100px total. The names-only tree (~220–260px) is the main width cost;
  keeping it slim matters.
- **Breadcrumb removal has dependents** (14 touch points, 7 pages render
  `ScopeBreadcrumbs`): the status chip relocation and the resource→project
  return path must be handled, not just deleted.
- **`Always in the shell`** applies specifically to portfolio/program/project
  detail routes — every entry point to one of those three opens inside the
  shell. Resource/worker/user detail pages are *not* hierarchy items and remain
  full-page waffle-side views. This consistency for the three hierarchy detail
  types requires the router restructure and ancestor auto-expansion to be solid.

- **The contextual Actuals tab is a new view.** No per-project actuals view
  exists today (the Actuals page is global with a project filter); the plan
  will likely reuse that list scoped to the project rather than build a new one.
