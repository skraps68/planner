# Reference Data Consolidation + Worker-Edit Rate Display — Design

**Date:** 2026-07-20
**Status:** Agreed design (brainstormed & confirmed 2026-07-20), not yet implemented. Build on a **new branch** off `main`.
**Scope:** Frontend only. No database, migration, service, or API changes. (The realtime *event-map* additions in §10 are frontend files.)

---

## 1. Goal

Consolidate the three separate admin-only Setup screens — **Worker Types**, **Rates**, and **Resource Roles** — into a single **Reference Data** screen reachable from a new admin-only waffle item. On that screen, place the **Worker Types** and **Rates** panels **side-by-side at the top** (they edit two different tables — `worker_types` and `rates` — so they stay visually and operationally separate), with **Resource Roles** below. Separately, make the worker **edit** screen keep showing the worker's rate as a non-editable value with a note directing rate changes to Reference Data. Make the "cannot delete an in-use Worker Type / Resource Role" restriction explicit and consistent with the app's existing alerting conventions. Build the new screen on **React Query** so it live-updates through the app's existing SSE invalidation.

## 2. Scope — frontend only

Everything the backend needs already exists and is unchanged:

- **Delete restrictions are already enforced server-side.**
  - `WorkerTypeService.delete_worker_type` (`backend/app/services/resource.py:477`) raises `ValueError("Cannot delete worker type '<type>' because it has <N> associated worker(s)")`.
  - `ResourceRoleService.delete_role` (`backend/app/services/resource_role.py:114`) raises `ValueError` for the `"Default"` role or a role with referencing resources.
  - Both surface as HTTP 400 with a `detail` message.
- **List endpoints already return the counts and rate the UI needs.**
  - `workerTypesApi.list()` → each `WorkerType` carries `worker_count` and `current_rate` (string).
  - `resourceRolesApi.list()` → each `ResourceRole` carries `resource_count`.
- **All mutation APIs already exist:** `workerTypesApi.create/update/delete`, `ratesApi.updateRate/getRateHistory`, `resourceRolesApi.create/update/delete`.
- **Change events auto-emit.** Global SQLAlchemy ORM listeners (`backend/app/realtime/listeners.py`) publish a `ChangeEvent` on every commit that touches a versioned model, typed by class name (`WorkerType`→`worker_type`, `Rate`→`rate`, `ResourceRole`→`resource_role`, `Worker`→`worker`, `Resource`→`resource`). So the existing mutations already broadcast the right events with no backend change; §10 only adjusts how the *client* maps those events to query keys.

No new endpoint, schema, service, migration, or server-side permission is introduced. The **atomicity of the two-table edit is a non-issue by design**: Worker-Type edits and Rate edits are separate panels with separate save actions (§5, §6), each a single API call — the user never triggers a combined type+rate save, so there is no partial-apply window.

## 3. Waffle, routing, and permission

### 3.1 Waffle menu (`frontend/src/components/layout/WaffleLauncher.tsx`)
- Under **Setup**, **remove** the three items `Worker Types` (`/setup/worker-types`), `Rates` (`/setup/rates`), and `Resource Roles` (`/setup/resource-roles`).
- **Add** a single item **`Reference Data`** → `/setup/reference-data`, gated by permission `manage_reference_data`.
- `Workers`, `User Management`, and other Setup items unchanged.

### 3.2 Routes (`frontend/src/App.tsx`)
- **Remove** the three routes and their `WorkerTypesPage` / `RatesPage` / `ResourceRolesPage` imports.
- **Add** route `/setup/reference-data`, wrapped in `<AdminRoute permission="manage_reference_data">`, rendering `<ReferenceDataPage />`.
- No redirects from the old paths — internal admin screens with no external links; outright removal.

### 3.3 Permission (`frontend/src/utils/permissions.ts`)
- Add `manage_reference_data` to the `Permission` union and grant it **only** to `ADMIN` in `rolePermissions`.
- **Remove** the three now-unused permissions `manage_worker_types`, `manage_rates`, `manage_resource_roles`. After the waffle items and routes are gone, the only remaining references are in tests:
  - `permissions.test.ts` — update to assert `manage_reference_data` is ADMIN-only and denied to non-admins; drop assertions for the removed three.
  - `AdminRoute.test.tsx` — uses `manage_resource_roles` as its sample permission (lines 25, 52); switch those to `manage_reference_data` so the guard test still compiles.

### 3.4 Pages removed
Delete `frontend/src/pages/setup/WorkerTypesPage.tsx`, `RatesPage.tsx`, `ResourceRolesPage.tsx` and their test files. Their behavior is reproduced (and rearranged) inside the new `ReferenceDataPage`.

## 4. The Reference Data screen (`frontend/src/pages/setup/ReferenceDataPage.tsx`)

### 4.1 Layout
A single page titled **Reference Data**, using an MUI `Grid` container:

- **Top row (two panels side-by-side):**
  - **Worker Types** panel — `Grid item xs={12} md={6}` (left)
  - **Rates** panel — `Grid item xs={12} md={6}` (right)
  - On narrow screens (`< md`) they stack.
- **Below (full width):**
  - **Resource Roles** panel — `Grid item xs={12}`

Each panel is a headed `Paper` mirroring the current pages' structure. One shared error/success `Snackbar` (toast) anchored bottom-center.

### 4.2 Data loading — React Query
- `useQuery(['worker-types'], () => workerTypesApi.list())` — **shared by both top panels**: the Worker Types panel renders `type / description / worker_count`; the Rates panel renders `type / current_rate` from the same array (both fields are on the one `WorkerType` list response).
- `useQuery(['resource-roles'], () => resourceRolesApi.list())` — Resource Roles panel.
- Rate history (lazy, per expanded row): `useQuery(['rates', workerTypeId, 'history'], () => ratesApi.getRateHistory(workerTypeId), { enabled: expanded })`.
- All mutations use `useMutation` with `onSuccess` invalidation of the relevant keys (detailed per panel below). This gives the acting client instant feedback; the SSE map (§10) covers other clients and cross-entity count/rate freshness.
- A failure in any query/mutation surfaces via the shared toast (`err.response?.data?.detail` fallback text, matching the current pages).

## 5. Worker Types panel

- **Columns:** `Type | Description | Workers | Actions`. **No rate column** — the current rate is shown in the Rates panel immediately to the right.
- **Add / Edit** (header `Add Worker Type` button and per-row Edit icon) → dialog with `Type` (required) and `Description` (required — backend `min_length=1`). Calls `workerTypesApi.create` / `workerTypesApi.update` (update carries `version`; on `409/ConflictError`, toast the message and let the query refetch). `onSuccess` → invalidate `['worker-types']`.
- **Delete:** icon **disabled when `worker_count > 0`**, wrapped `<Tooltip><span>…</span></Tooltip>` reading *"Can't delete — N worker(s) still use this type. Reassign them first."* When `0`, enabled → `window.confirm(...)` → `workerTypesApi.delete(id)` → invalidate `['worker-types']`. Backend in-use rejection remains a toast backstop.

## 6. Rates panel

- **Columns:** `⏵ | Type | Current Rate | Actions`. `Current Rate` is read from the shared `['worker-types']` data (`workerType.current_rate`, formatted, or `—`).
- The **⏵ chevron** expands the row to show that type's full **rate history** (`Rate | Start Date | End Date`) via the lazy `['rates', id, 'history']` query (same UX as today's `RatesPage`).
- **Set Rate** (per-row button) → dialog with `Amount` (number, `> 0`) and `Effective Date` (date, defaulting to today via `date-fns format(new Date(), 'yyyy-MM-dd')` — **local date, not `toISOString()`**). Calls `ratesApi.updateRate(id, Number(amount), effectiveDate)` (which closes the current rate and inserts a new dated one). `onSuccess` → invalidate `['worker-types']` (refreshes the `Current Rate` value) **and** `['rates']` (refreshes any open history view).
- No delete on this panel — rates are append-only history managed via Set Rate.

## 7. Resource Roles panel

- **Columns:** `Name | Description | Resources | Actions`.
- **Add / Edit** → dialog with `Name` (required), `Description` (optional). Calls `resourceRolesApi.create` / `update`. `onSuccess` → invalidate `['resource-roles']`.
- **Delete:** icon **disabled** when `name === 'Default'` **or** `resource_count > 0`:
  - `Default` → tooltip *"Default role cannot be deleted"* (existing wording).
  - in-use → tooltip *"Can't delete — N resource(s) still use this role. Reassign them first."*
  - Otherwise enabled → `window.confirm` → `resourceRolesApi.delete(id)` → invalidate `['resource-roles']`.
- Backend rejection (Default or in-use) remains a toast backstop.

## 8. Alerts & confirmations — the consistency rule

- **Restriction alerts** ("can't delete, still in use") → **disabled control + Tooltip**, matching the existing `Default`-role disable. No modal dialog.
- **Operational errors and successes** → the existing bottom **`Snackbar` toast** (`severity="error"` / `"success"`).
- **Delete confirmation** → **`window.confirm`**, the app-wide standard (`WorkersListPage`, `UsersListPage`, `RoleScopesPage`, `UserRolesPage`, and the current setup pages). We deliberately do **not** introduce an MUI confirmation dialog, per the "don't use a modal if it isn't the standard" requirement.

## 9. Worker edit screen (`frontend/src/pages/workers/WorkerDetailPage.tsx`)

Current behavior: the **Rate** grid item renders only when `!effectiveEditing` (read mode), from `worker.current_rate`.

Changes:
- **Show the Rate field in edit mode too** — remove the `!effectiveEditing &&` guard so it is always present for an existing worker, **always static read-only text, never an input.**
- **Value source:** read mode keeps `worker.current_rate`; **edit mode derives from the currently selected `worker_type_id`** by looking up that type's `current_rate` in the already-loaded `workerTypes` list, so the rate live-updates when the admin changes the Worker Type dropdown. Show `—` when the selected type has no rate.
- **Note:** directly beneath the Rate value in edit mode, a `Typography variant="caption" color="text.secondary"` reading *"Rates are managed in Setup → Reference Data."*
- **Create-worker mode is out of scope** — no persisted worker/rate there; unchanged.
- Rate formatting reuses the existing `$` + `toLocaleString` (2 fraction digits) idiom already in the file.

## 10. Realtime invalidation additions (`frontend/src/realtime/eventKeyMap.ts`)

The new page reads its data through React Query, so it will consume the app's existing SSE invalidation — but the current map doesn't connect member-changes to the count/rate-bearing parent lists, and has no `resource_role` entry. Add:

| Event `type` | Add prefix | Why |
|---|---|---|
| `worker` | `['worker-types']` | a worker created/deleted/reassigned changes a type's `worker_count` (and delete-disable) |
| `resource` | `['resource-roles']` | a resource created/deleted/re-roled changes a role's `resource_count` (and delete-disable) |
| `rate` | `['worker-types']` | a new rate changes the `current_rate` shown in the Rates panel (served on the worker-types list) |
| `resource_role` (new key) | `['resource-roles']` | role create/update/delete refreshes the Resource Roles panel |

`worker_type` already maps to `[['workers'], ['worker-types']]` and `rate` already maps to `['rates']`, so type/description edits and rate-history refreshes are already covered. Update `eventKeyMap.test.ts` to assert the four additions. No backend change — events auto-emit (§2).

## 11. Out of scope / explicitly not changing

- Worker-type / rate / resource-role **data model, migrations, backend services, and API endpoints** — untouched.
- The resource-side denormalized role/type/rate display (`ResourceDetailPage`, `ResourcesListPage`) — untouched.
- The `Default` resource-role protection — preserved.
- Worker **create** view's field set — unchanged.
- Forecasting/actuals consumption of rates/types/roles — none.

## 12. Testing strategy (full cases in the plan)

- **`ReferenceDataPage`** (new component test, React Query wrapper):
  - Renders all three panels from the two list queries; the Worker Types panel has **no rate column**; the Rates panel shows `current_rate`.
  - Worker Types Edit calls `workerTypesApi.update` and invalidates `['worker-types']`; Rates Set Rate calls `ratesApi.updateRate` (id, amount, effective date) and invalidates `['worker-types']` + `['rates']`.
  - Worker Type delete icon disabled + in-use tooltip when `worker_count > 0`, enabled when `0`.
  - Resource Role delete disabled for `Default` and when `resource_count > 0`; enabled otherwise.
  - Rate-history row expands and calls `getRateHistory` once.
- **`WorkerDetailPage`** (extend existing rate test): rate visible in edit mode as static text (no input) with the "managed in Reference Data" note; edit-mode rate live-derives from the selected type; read mode still shows `worker.current_rate`.
- **`eventKeyMap.test.ts`:** the four new mappings.
- **`permissions.test.ts`:** `manage_reference_data` ADMIN-only and denied to non-admins; the three removed permissions are gone.
- **Removed:** `WorkerTypesPage.test.tsx`, `RatesPage.test.tsx`, `ResourceRolesPage.test.tsx`.
- **Type budget:** `npx tsc --noEmit | wc -l` stays at **234** (net-zero).

## 13. Risks / notes

1. **Partial-apply is designed out.** Because type edits and rate edits are separate panels with separate single-call save actions, there is no combined save and therefore no type-succeeds/rate-fails window. (This is why the two-frontend-calls approach was chosen over a combined atomic endpoint — the repo layer commits per-operation, so true atomicity would have required a bespoke flush-only service method; separating the UI removes the need entirely.)
2. **Stale counts are now live**, not just backstopped: the page is on React Query and §10 wires `worker`/`resource`/`rate`/`resource_role` events to the count/rate-bearing lists, so counts and delete-disable refresh when workers/resources/rates change elsewhere. The backend guard + toast remains the authority for the rare race between an SSE event and a click.
3. **Local-date idiom for `Effective Date`** — use `date-fns format`, never `toISOString()`, to avoid the off-by-one-day UTC bug previously fixed in `RatesPage`.
4. **React Query divergence** — the retired pages used raw `fetch`/`useState`; the new page intentionally uses React Query (the app's broader pattern) so it plugs into SSE invalidation. This is a deliberate, contained choice for one new page, not an app-wide migration.
