# Worker Type / Resource Role Refactor + Setup Screens — Design

**Date:** 2026-07-18
**Status:** Agreed design (brainstormed & confirmed 2026-07-18), not yet implemented. Build on a **new branch** off `main`.
**Scope:** Full-stack — data model, migration/seed, API, and frontend (worker/resource screens + three new admin-only Setup screens).

---

## 1. Goal

Refactor the semantics of `WorkerType`, `Worker`, and `Resource`, add a `ResourceRole` table, add three admin-only **Setup** screens (Worker Types, Rates, Resource Roles), and surface denormalized reference data (type, role, rate) on the worker and resource screens for at-a-glance context — without ever exposing that admin-owned reference data on an edit form.

## 2. Semantic shift (the heart of the change)

Today (verified in the live DB):
- `worker_types` are **job roles**: *Senior Software Engineer, Software Engineer, Junior Software Engineer, Solutions Architect, Project Manager, Business Analyst.*
- `Rate` is FK'd to `worker_type_id` — one rate **per job role**. Forecasting and labor-actuals cost (`rate × allocation%`) read `worker → worker_type → rate`.

After:
- `WorkerType` is repurposed to **employment class**: *Employee, Full-Time Contractor, Fixed Price Contractor.* It stays a table (Rate keeps its FK); it becomes admin-editable.
- The old job-roles move into a new **`ResourceRole`** table (job role lives on the *resource*, not the worker).
- `Rate` is **unchanged structurally** — still FK'd to `worker_type`, so there is now **one rate per employment class**. This is the confirmed model: a worker's/labor-resource's displayed rate = its employment class's current rate.

**Consequence (intended):** forecast and actual labor costs now derive from **employment-class** rates rather than job-role rates. No forecasting code changes — it already reads `worker → worker_type → rate` — but the numbers shift because the rate values behind those types change.

## 3. Data model

```
WorkerType     (table, unchanged shape)   seeded → { Employee, Full-Time Contractor, Fixed Price Contractor }; admin-editable
ResourceRole   (NEW table: name, description + BaseModel)   seeded → the 6 old job-roles + "Default"
Rate           (unchanged)                FK → worker_type_id  ⇒ one rate per employment class
Worker.worker_type_id      → WorkerType   (employment class)   [user-choosable on worker screen — already exists]
Resource.resource_role_id  → ResourceRole (NEW, nullable FK)   [labor only; user-choosable on create/edit]
```

`ResourceRole` model (`backend/app/models/resource.py`):
- `name` `String(100)`, `nullable=False`, `unique=True`, indexed
- `description` `String(1000)`, `nullable=True`
- inherits `BaseModel` (uuid id, timestamps, version)
- relationship: `Resource.resource_role` / `ResourceRole.resources`

`Resource.resource_role_id` — `GUID` FK → `resource_roles.id`, **nullable**, indexed, with a CHECK mirroring the existing labor/worker CHECK:
```
(resource_type = 'LABOR'     AND resource_role_id IS NOT NULL) OR
(resource_type = 'NON_LABOR' AND resource_role_id IS NULL)
```
So **labor resources require a role; non-labor resources have none** (confirmed decision).

## 4. Migration & seed (existing dev data transform)

One Alembic migration (following the repo's raw-SQL-backfill pattern), reproducible via a fixed RNG seed:

1. Create `resource_roles` table.
2. Copy the 6 existing job-role `worker_types` rows into `resource_roles` (new ids; `type`→`name`, `description`→`description`); insert a **"Default"** role.
3. Insert the 3 employment-class `worker_types` (Employee, Full-Time Contractor, Fixed Price Contractor).
4. Reassign every `workers.worker_type_id` to one of the 3 new types, **~80% Employee** (remaining ~20% split across the two contractor types). (8 workers today → ≈6 / 1 / 1.)
5. Delete the old per-job-role `rates`, then delete the 6 old job-role `worker_types` (now unreferenced).
6. Seed **one current rate per employment class** (sample daily values, e.g. Employee 1,000 / FT Contractor 1,300 / Fixed Price 1,500; open-ended `start_date` = today).
7. Add `resources.resource_role_id` (nullable), backfill: **labor** resources → a random `ResourceRole` (excluding or including "Default" — random over all roles), **non-labor** → NULL; then add the CHECK constraint.

`downgrade()` reverses structurally (drops column/table); it documents that it restores the *structure*, not the pre-refactor row values (matches the repo's existing migration posture).

Also update **`backend/scripts/seed_data.py`** so a fresh seed produces the new world: 3 employment-class worker_types + rates, a `ResourceRole` set (job roles + Default), workers ~80% Employee, labor resources with roles.

## 5. Access control — client + server (confirmed)

Reference data (worker types, rates, resource roles) is **admin-only to define/edit**. Assigning a type/role to a worker/resource stays open to regular users.

**Server:** the existing `app.api.deps.check_admin_permission` dependency (→ `authorization_service.is_admin`) is added to the **write** endpoints (POST/PUT/DELETE) for:
- worker types (`/workers/types*`)
- rates (`/rates/*` mutations)
- resource roles (new `/resource-roles*`)

Read (GET) endpoints stay open (regular users need to populate dropdowns and see denormalized values). Worker and resource create/update stay **non-admin** (assigning a type/role is a normal user action).

**Client:** three new ADMIN-only permissions in `frontend/src/utils/permissions.ts` — `manage_worker_types`, `manage_rates`, `manage_resource_roles` (granted only to `ADMIN` in `rolePermissions`). The waffle Setup items and the routes are gated by these; a lightweight route guard redirects non-admins who deep-link.

## 6. Screens

### 6.1 New admin-only Setup screens (waffle → Setup)
- **Worker Types** (`/setup/worker-types`): list + create/edit/delete worker types (`workerTypesApi` already has full CRUD). Delete blocked when workers reference the type (server already enforces).
- **Rates** (`/setup/rates`): per employment class, show the current rate + history and let admins add a new dated rate (reuses `ratesApi` — `getRateHistory`, `updateRate`, `create`).
- **Resource Roles** (`/setup/resource-roles`): list + create/edit/delete resource roles (new `resourceRolesApi`). **"Default" is protected** from deletion; deletion otherwise blocked when resources reference the role.

All three appear in the waffle **Setup** group only for admins.

### 6.2 Worker detail (`WorkerDetailPage`)
- The employment-class dropdown already works once types are reseeded (populated from `workerTypesApi.list()`). ✓
- **Add a read-only "Rate"** field showing `worker.current_rate` (already on the API response). Shown in **read mode only** — hidden in edit mode (admin-owned reference value).

### 6.3 Resource detail/create (`ResourceDetailPage`)
- **Labor create/edit:** add a **Resource Role** dropdown (options from `resourceRolesApi.list()`), **pre-selected to "Default"**. Non-labor: no role field.
- **Read mode (labor):** a denormalized, read-only block — worker link (exists) + **worker type** + **rate**. Hidden in edit mode.

### 6.4 List screens
- **ResourcesListPage:** add columns for **Role**, and for labor rows **Type** + **Rate** (from the enriched response).
- **WorkersListPage:** add a **Rate** column (already on the response).

## 7. Denormalization delivery

- **Workers:** already done server-side (`WorkerResponse.worker_type_name`, `current_rate` populated in every worker endpoint). Frontend just needs to *show* them.
- **Resources:** extend `ResourceResponse` with `resource_role_id`, `resource_role_name`, and for labor: `worker_name`, `worker_type_name`, `current_rate`; populate them in the resource endpoints (join `resource → worker → worker_type → current rate`, and `resource → resource_role`). This also feeds the list columns.

**Edit-mode rule (explicit):** the denormalized *rate/type* values never render on an edit form. Users still pick `worker_type_id` (worker) and `resource_role_id` (resource) via dropdowns — those are the entity's own assignments — but the admin-owned **rate** (and the derived worker-type/rate block on the resource) appear only in read/detail views.

## 8. Non-goals / explicitly parked

- **Fixed-price cost accrual.** For now Fixed Price Contractor is treated uniformly with a daily rate (decision A). The conventional model — representing a fixed-price engagement as a **scheduled non-labor expense with an accrual method (start / end / prorated)** rather than a daily labor rate — is a **documented follow-up**, not built here. Nothing in this design blocks it.
- No change to the labor/non-labor budget split, forecasting math, or actuals import beyond the rate-value shift described in §2.
- No new WorkerType↔Rate combined screen (kept as two Setup screens per request).

## 9. Risks / notes

1. **Rate meaning shift** is the headline behavioral change — confirm sample rate values with finance before relying on forecast numbers.
2. **Migration ordering** — old rates and old worker_types must be deleted only after workers are reassigned; resource_role backfill must precede the CHECK constraint.
3. **`ResourceResponse` currently has no denormalized worker fields** — adding them touches every place that builds a `ResourceResponse` (create/list/get/update/labor-list/non-labor-list in `resources.py`); a shared enrichment helper keeps it DRY.
4. **Route guarding** for the admin Setup screens is currently only implicit (waffle hides items); add an explicit client guard so deep-links by non-admins redirect, backed by the server 403.

## 10. Test strategy (summary; full cases in the plan)

- **Model/constraint:** ResourceRole uniqueness; Resource CHECK (labor⇒role required, non-labor⇒role null).
- **Migration:** post-migration there are exactly 3 worker_types, the 6 job-roles + Default exist as resource_roles, every worker maps to a new type (~80% Employee), every labor resource has a role, non-labor have none, one rate per employment type.
- **Service:** resource create defaults role to "Default" for labor when omitted; rejects role on non-labor; rejects missing role... (defaulted, so effectively always set for labor).
- **API/admin:** worker-type/rate/resource-role writes 403 for non-admin, 200 for admin; reads open. `ResourceResponse` carries role + (labor) type/rate.
- **Frontend:** worker detail shows rate read-only (not in edit); resource create shows role dropdown defaulting to Default (labor only); Setup items visible only to admin; denormalized columns render.
