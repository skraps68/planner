# Actuals, Plan Comparison, Change Sets, and Bitemporal History — Design and Rollout

**Date:** 2026-07-28

**Status:** Core current-context views and minimum temporal capture implemented;
change sets, approved plan revisions, and historical/as-of UI deferred

**Scope:** Resource and project assignment timelines, actual-versus-plan visualization,
financial projections, future scenario change sets, approved-plan history, and
bitemporal "as-of" querying

**Implementation constraint:** The core actuals views may be delivered before the
change-set and historical-view UI, but temporal history must begin being captured
before any history that must later be queryable is overwritten.

---

## 1. Executive summary

The application already shows a financial snapshot containing budget, actual, and
forecast totals. The next goal is to bring actuals into the assignment timeline
grids so users can understand plan execution at the level where work and costs were
scheduled.

The recommended user experience is one shared grid with four visualization modes:

- **Combined** — the recommended default, showing the operational state of each
  period while preserving enough plan comparison to understand variance.
- **Plan** — the selected approved plan, historical plan, or proposed scenario.
- **Actual** — reported actuals, including explicit missing and pending states.
- **Variance** — signed differences between actuals and the selected plan.

The grid and its aligned chart will distinguish:

1. actuals that have replaced forecast operationally;
2. dates whose actuals have not yet been loaded;
3. dates that should have actuals but do not;
4. remaining future forecast;
5. actuals received where no plan existed.

The design must also remain compatible with future **change sets**: hypothetical
plan edits that can be evaluated against financials, submitted for approval, and
atomically applied to create a new approved plan.

Users must eventually be able to ask questions such as:

> What did the approved resource forecast for Project X say for August 15 when
> viewed today, one week ago, or immediately before the last change set was
> applied?

Answering that question requires bitemporal semantics:

- **effective/business time** — when the planned work, forecast, or actual applies;
- **recorded/system time** — when the system believed or recorded that value.

The complete bitemporal query and UI can be added later. However, immutable
revision capture cannot be deferred if earlier history must remain queryable.

---

## 2. Goals

### 2.1 Core actuals-view goals

- Show plans and progress against those plans in the same temporal context.
- Make it obvious which past forecast has been actualized.
- Make overdue forecast without actuals visible rather than silently dropping it.
- Distinguish genuinely missing actuals from actuals that have not yet been loaded.
- Make daily variance inspectable without permanently doubling grid complexity.
- Preserve the current compact assignment-grid mechanics:
  - horizontal scrolling;
  - sticky identity and type columns;
  - day/week/month period toggles;
  - chart show/hide;
  - consistent numeric alignment;
  - weekend shading;
  - period boundary emphasis;
  - edit mode restricted to daily view.
- Keep resource and project perspectives conceptually distinct while sharing
  presentation and navigation mechanics.
- Extend the same principles to non-labor cash-flow plans and actual amounts.

### 2.2 Change-set goals

- Let a user propose changes without mutating the approved plan.
- Calculate assignment, utilization, and financial effects using the proposal.
- Compare a proposal with the approved plan on which it was based.
- Support submission, approval, rejection, and atomic application.
- Detect when a change set's base plan has changed and require rebase or conflict
  resolution.
- Retain the proposed change set and its approval history after application.
- Preserve the plan state that existed before application.

### 2.3 Temporal-history goals

- Reproduce the approved plan as the system knew it at a prior time.
- Reproduce actuals as the system knew them before later corrections or imports.
- Distinguish backdated effective changes from the date they were recorded.
- Make all changes in one approved change set visible as one atomic plan revision.
- Keep current, historical, and scenario financial results isolated in querying
  and caching.

---

## 3. Non-goals for the first delivery

- Exposing change-set creation or approval controls in the first actuals-view
  release.
- Exposing an "as-of" date picker before historical query support is complete.
- Allowing edits while viewing an immutable historical plan.
- Real-time collaborative editing inside the same draft change set.
- Automatically deciding whether every allocation variance is favorable or
  adverse.
- Replacing the existing financial summary; the grid augments it with detail.
- Reconstructing reliable history from before immutable temporal capture begins.
- Implementing every possible scenario type in the first change-set release.

---

## 4. Terminology

| Term | Meaning |
|---|---|
| **Plan** | A set of planned assignments, budgets, rates, phases, and non-labor occurrences used to project work and cost. |
| **Current approved plan** | The latest officially applied plan revision. |
| **Plan revision** | One immutable approved state created by an atomic approval/application event. |
| **Baseline** | The selected plan against which actual or scenario variance is measured. It must be explicit and immutable for a meaningful comparison. |
| **Actual** | Reported work or cost for an effective business date. |
| **Actuals-through watermark** | The latest effective date for which an actuals source or import batch is considered complete. |
| **Current forecast** | Actuals through the applicable cutoff plus remaining forecast according to the selected plan and reporting policy. |
| **Change set** | A draft overlay of proposed creates, updates, and deletes based on a specific approved plan revision. |
| **Effective time** | The date or range when a plan or actual applies to the business. |
| **Recorded time** | The interval when that version was the state known to the system. |
| **Known as of** | User-facing name for the recorded-time point used to resolve a historical view. |
| **Reporting date** | The business cutoff used to divide actuals from remaining forecast. This is not the same as recorded/system time. |
| **View context** | The complete selection that determines which plan, actual history, scenario, and comparison the grid and financials render. |
| **Unplanned actual** | An actual received where the selected plan contains no corresponding assignment or planned occurrence. |

---

## 5. User questions the design must support

### 5.1 Current operational questions

- What was planned for this resource on this project?
- What actual was reported?
- Has actual data for this date been loaded yet?
- Which planned dates are overdue without actuals?
- How far did actual utilization differ from plan?
- Is the resource actually over 100% allocated?
- How many people were actually active on the project per day?
- What future forecast remains?
- Where did actual work or cost occur without a plan?

### 5.2 Scenario questions

- What would utilization look like if this proposed assignment changed?
- What would project and program financials look like under this scenario?
- How does the proposed change set differ from the current approved plan?
- Which projects, resources, periods, and financial categories are affected?
- Has the approved plan changed since the scenario was created?

### 5.3 Historical questions

- What was the forecast for business date Y as known on date T?
- What was the approved plan immediately before change set CS-104 was applied?
- What did a financial report show when it was originally produced?
- What actual had been reported before a later correction?
- What did the system consider pending or missing at that historical point?

---

## 6. Core view design

### 6.1 One grid, multiple modes

Do not permanently render two complete datasets in every cell. Keep the current
grid structure and add a visualization-mode selector:

```text
[Combined] [Plan] [Actual] [Variance]
```

This selector is separate from the existing period controls:

```text
[Day] [Week] [Month] [Chart]
```

The mode changes representation, not temporal column structure. Day/week/month
and chart show/hide behavior remain shared across all modes.

### 6.2 Combined mode

Combined mode is the recommended default.

- Past actualized cells show actual as the prominent value.
- A compact secondary value shows variance, not a second full-sized number.
- The original plan remains available in the tooltip/detail panel.
- Pending dates show the planned value with neutral treatment.
- Missing actual dates retain the planned value with a warning treatment.
- Future dates show the selected plan's forecast.
- Unplanned actuals show the actual with a distinct marker.

Example:

```text
 85
 +5
```

where the cell detail resolves:

```text
Plan:       80%
Actual:     85%
Variance:   +5 percentage points
State:      Actualized
Source:     Labor actuals import 2026-07-25 08:30
```

The compact variance line should be omitted when it is zero if that materially
improves density.

### 6.3 Plan mode

Plan mode shows the selected planning context without actual replacement:

- current approved plan;
- a selected historical approved revision;
- or a draft change-set projection.

Past dates remain visible because they are needed for comparison. Plan mode must
not substitute actuals into those cells.

### 6.4 Actual mode

Actual mode shows reported actuals only, while preserving semantic states:

- actual values where loaded;
- neutral pending cells after the actuals-through watermark;
- warning treatment where the watermark has passed but expected actual is absent;
- blank future cells unless future actual entry is explicitly supported;
- marked unplanned actuals where no plan exists.

Pending and missing must never collapse into the same blank appearance.

### 6.5 Variance mode

Variance mode replaces the cell's primary value with:

```text
actual - selected plan
```

Examples:

```text
+5   -10   0
```

Variance is calculated only where comparison is valid:

- actualized dates receive a value;
- pending dates receive an em dash or partial-status marker;
- missing actual dates receive a warning rather than a false zero;
- future dates remain blank for actual-versus-plan variance.

For allocation views, positive or negative is not automatically favorable or
adverse. Red remains reserved for hard rule violations such as actual allocation
over 100%. Cost views may use favorable/adverse coloring because higher cost has a
clearer business meaning.

Future scenario comparison should use a separately named comparison, such as
**Scenario Impact**, rather than overloading actual variance:

```text
proposed plan - approved base plan
```

### 6.6 The explanatory variance inset

The right-side "Variance Mode" box in the exploratory mockup was an explanatory
inset only. It is not part of the recommended product screen.

In the product:

- the main assignment grid uses the full available width;
- selecting Variance switches that main grid;
- a small collapsible legend may remain;
- no permanent secondary variance table is displayed beside it.

### 6.7 Editing behavior

Visualization mode and editing mode are separate concepts.

- Current approved-plan editing remains restricted to daily resolution.
- Combined, Actual, and Variance are read-only visualization modes in the initial
  release.
- Existing direct plan editing occurs in Plan mode/current approved context.
- An immutable historical revision is always read-only.
- A future draft change set may enable daily editing in Plan or Combined mode,
  but those edits apply to the scenario overlay, not the approved plan.
- Applying a change set requires the approval workflow; switching a selector must
  never implicitly apply proposed changes.

---

## 7. Cell-state model

### 7.1 Required states

| State | Rule | Recommended visual treatment |
|---|---|---|
| **Actualized** | A matched actual exists for the plan/date in the selected knowledge context. | Solid slate-blue or current actual styling; actual prominent; variance secondary. |
| **Pending actual** | Effective date is after the actuals-through watermark and on or before the view's "today"/reporting date. | Neutral pale gray; planned value remains; optional clock/status marker. |
| **Missing actual** | Effective date is on or before the watermark, plan exists, and no matching actual exists. | Amber diagonal hatching plus warning marker; planned value remains. |
| **Future forecast** | Effective date is after the reporting/view date. | Existing light blue-gray forecast treatment. |
| **Unplanned actual** | Actual exists but no corresponding selected-plan record exists. | Distinct violet outline/marker; do not imply automatically favorable or adverse. |
| **No plan / no actual** | Neither exists. | Empty standard cell. |

Color alone must not carry meaning. Patterns, icons, labels, tooltips, and
accessible text are required.

### 7.2 State precedence

For a selected effective date and row:

1. Resolve the selected plan and actuals using the current view context.
2. If a matched actual exists:
   - if a plan exists, state is Actualized;
   - otherwise, state is Unplanned actual.
3. If no actual exists and a plan exists:
   - if effective date is on or before the actuals-through watermark, state is
     Missing actual;
   - else if effective date is on or before the reporting/view date, state is
     Pending actual;
   - otherwise, state is Future forecast.
4. If neither exists, state is No plan / no actual.

A period after the actuals-through watermark must not be declared missing merely
because it is before today.

### 7.3 Actuals-through watermark

The watermark is part of the data, not a UI guess.

It should be recorded for each actuals source/import batch and retained
historically. If multiple sources feed one view, the system must either:

- resolve a source-specific watermark per row/category; or
- expose a conservative combined watermark and make source details available.

A generic fixed grace period may be used only as an explicit business policy; it
must not substitute for known import completeness.

---

## 8. Chart design

The existing chart remains immediately above and temporally aligned with the
grid.

### 8.1 Recommended layers

- **100% capacity line:** unchanged for labor resource views.
- **Baseline/selected plan:** dashed or thin reference line.
- **Actual usage:** solid slate area through the resolved actualized periods.
- **Pending actual:** neutral pale-gray segment.
- **Missing actual:** amber hatched segment/gap.
- **Remaining future forecast:** light blue-gray area.
- **Actuals-through marker:** vertical line with date.
- **Today/reporting-date marker:** separate vertical line.
- **Under-capacity area:** preserve the existing light-green indication between
  the selected primary utilization series and the 100% line where it remains
  legible; it must not obscure pending, missing, actual, or forecast state
  treatments.

The chart must resize with daily, weekly, and monthly modes exactly as the grid
does.

### 8.2 Chart semantics

- Missing actual is not zero actual unless the business explicitly confirms zero.
- An actual must not erase the selected plan reference used for comparison.
- Historical views use the actuals and watermark known at the selected recorded
  time.
- Scenario views use the proposed plan as the selectable plan layer while actuals
  remain governed by the selected knowledge context.

---

## 9. Daily, weekly, and monthly behavior

### 9.1 Labor resource perspective

- Daily actual value: resource allocation percentage reported for that
  project/date.
- Weekly and monthly actual: average percentage across calendar days, consistent
  with the existing plan aggregation policy.
- Plan comparison for a partially loaded period must use the same loaded days as
  the actual calculation.
- Partial periods display coverage, for example:

  ```text
  4/7 days actualized
  ```

- Missing-day count is exposed at the aggregate cell:

  ```text
  2 missing
  ```

- Actual allocation over 100% retains explicit red rule-violation treatment.

### 9.2 Labor project perspective

- Individual resource rows show actual-versus-plan allocation percentages.
- The total row shows average actual heads per calendar day for weekly/monthly
  views, using the same denominator policy as plan.
- Over-allocation validation remains resource-specific:
  the project does not care that more than one person is assigned, but it must
  identify any individual resource whose total actual allocation exceeds 100%.
- Project totals and row-level actuals must be derived from the same resolved view
  context.

### 9.3 Non-labor perspective

- Values are amounts, not percentages.
- Daily/weekly/monthly values are sums, not averages.
- Actual amounts should reconcile to a plan line or occurrence when possible.
- If an actual is only partially matched to a planned amount, the business rule
  must determine whether the residual:
  - remains forecast;
  - is explicitly canceled;
  - or is considered variance only.
- Unmatched non-labor actuals remain visible and require reconciliation rather
  than disappearing from the grid.

---

## 10. Resource, project, and financial-summary behavior

### 10.1 Resource page

The resource page answers:

> How was this one resource planned and actually used across many projects?

- Project remains the primary row grouping.
- Actual allocation and variance are calculated per project/date.
- Total Allocation becomes selected-plan, actual, or variance depending on mode.
- The usage chart remains capped by the 100% reference line.

### 10.2 Project page

The project page answers:

> How did many resources contribute to this one project?

- Resource remains the primary row grouping.
- Individual percentage rows compare actual and selected plan.
- Labor totals compare planned and actual heads/day.
- Resource-specific over-allocation rules remain separate from project total
  headcount.

### 10.3 Financial summary

The financial section remains the high-level snapshot.

It must eventually render from the same view context as the detailed grid:

- Current approved + known now;
- historical approved + historical knowledge time;
- draft change set + chosen comparison;
- selected labor/non-labor and drill-down filters.

Changing the view context must update the grid, chart, and financial summary
coherently. A scenario must never update one surface while leaving another on the
approved plan.

---

## 11. View-context model

The frontend and backend should treat temporal/scenario selection as one explicit
context even while only the current context is available.

Conceptual shape:

```text
ViewContext
  plan_revision: current | approved revision ID
  knowledge_as_of: now | timestamp
  change_set_id: none | draft change-set ID
  comparison:
    none
    actual_vs_selected_plan
    selected_plan_vs_revision
    scenario_vs_base
  reporting_date: selected reporting cutoff
```

The actuals-through watermark is normally derived from the selected knowledge
context and data source, not supplied arbitrarily by the client.

### 11.1 Initial state

The first release can use a fixed internal context:

```text
plan_revision: current
knowledge_as_of: now
change_set_id: none
comparison: actual_vs_selected_plan
```

No inactive historical controls need to be displayed.

### 11.2 Future context bar

When historical and scenario support is ready:

```text
[Plan: Current Approved ▼] [Known as of: Now ▼] [Compare with: None ▼]
```

Scenario example:

```text
[Plan: CS-104 Staffing Alternative] [Based on: Approved v7]
[Compare with: Approved v7] [Status: Draft]
```

Historical example:

```text
[Plan: Approved v6] [Known as of: 2026-06-02]
[Compare with: Current Approved] [Status: Superseded]
```

User-facing language should prefer **Known as of** over database terminology such
as transaction time.

---

## 12. Change-set design

### 12.1 Core model

A change set is an immutable-base, mutable-draft overlay:

```text
ChangeSet
  id
  name
  description
  base_plan_revision_id
  owner
  status
  created_at / updated_at
  submitted_at
  approval metadata
  application transaction/revision ID
```

Each proposed operation records:

```text
ChangeSetOperation
  id
  change_set_id
  target entity type
  stable logical entity ID
  operation: create | update | delete
  base entity revision/version
  proposed values or field-level patch
  effective date/range
```

### 12.2 Scenario projection

Scenario calculations:

1. Resolve the base approved plan revision.
2. Apply the change-set overlay without mutating approved records.
3. Run assignment, utilization, and financial calculations against the resulting
   projection.
4. Cache the result under the complete scenario view context.
5. Compare with the base revision or another explicitly selected revision.

### 12.3 Approval and application

- Submission freezes or versions the submitted proposal.
- Approval records approver, decision, timestamp, and comments.
- Application is atomic across all included entities.
- Successful application creates one new approved plan revision.
- The prior approved revision remains immutable and queryable.
- The change set remains available for audit and scenario comparison.
- The application event links the change set, approval, and resulting plan
  revision.

### 12.4 Base-plan drift

If the approved plan changes after a draft was created:

- the change set is marked out of date;
- affected logical records are compared with their base revisions;
- non-conflicting operations may be rebased;
- conflicting operations require explicit user resolution;
- applying against an unvalidated stale base is prohibited.

Optimistic locking remains the correctness backstop. Change sets do not replace
concurrency control.

---

## 13. Bitemporal design

### 13.1 The two axes

For a value concerning Resource A, Project X, and effective date August 15:

| Known as of | Forecast for August 15 |
|---|---:|
| Two weeks ago | 60% |
| One week ago | 80% |
| Today after an approved change set | 50% |

All three values apply to the same business date. They differ by recorded time.

The system must answer:

```text
effective date = 2026-08-15
known as of = 2026-07-15
```

and return the version whose effective and recorded intervals contain those
points.

### 13.2 Reporting date is not knowledge time

The existing forecast/reporting "as of date" is a business reporting cutoff: it
decides which effective dates contribute actuals and which contribute remaining
forecast. By itself, it is not bitemporal.

The future UI and API must keep these concepts distinct:

```text
Reporting date: 2026-08-31
Known as of:     2026-07-15 14:00
```

This asks the system to produce an August 31 reporting view using only the plan,
rates, actuals, corrections, and completeness information known on July 15.
Calling both fields simply "as of" would be ambiguous and should be avoided.

### 13.3 Forecast changes

Forecast edits commonly apply to future effective dates but are recorded today.
Backdated edits apply to past effective dates but are also recorded today.

The historical record must retain both facts:

- what date the value applies to;
- when that value became known or approved.

### 13.4 Actual corrections

If an actual for June 10 is corrected on July 20:

- effective date remains June 10;
- original value is system truth until July 20;
- corrected value is system truth from July 20 onward;
- a report reproduced as known on July 15 uses the original actual.

Actual-import batch metadata and watermarks must follow the same temporal
principle.

### 13.5 Change sets as a third selection dimension

A draft change set is a scenario branch, not part of official recorded history.

- Before application, it is an overlay on its base approved revision.
- At application, it creates one new official recorded-time state.
- "Immediately before" and "immediately after" application are deterministic.
- Draft history may itself be versioned for audit, but it does not rewrite the
  approved-plan timeline.

### 13.6 Concurrency versus bitemporality

Multiple users create the need for:

- optimistic locking;
- conflict detection;
- advisory locks where appropriate;
- change-set rebase rules.

Bitemporality does not resolve concurrent edits. It records the resulting history
after conflicts and approvals are resolved.

---

## 14. Recommended temporal storage foundation

The exact physical schema requires a focused implementation design. The required
semantic properties are already clear.

### 14.1 Stable logical identity

A planned item must retain one stable logical ID across revisions. Row IDs for
individual stored revisions must not be the only identity available.

Examples include:

- labor assignment identity;
- project phase identity;
- non-labor plan-line identity;
- non-labor occurrence identity;
- rate identity;
- actual identity or source-record identity.

### 14.2 Immutable revisions

Every financially relevant mutation creates an immutable revision containing:

- stable logical ID;
- revision ID;
- complete record values;
- effective date/range;
- recorded-from timestamp;
- recorded-to timestamp or equivalent open-ended representation;
- actor;
- operation;
- atomic transaction/batch ID;
- source import ID, approval ID, or change-set ID when applicable;
- tombstone for deletion.

Complete record snapshots are preferred over an audit stream that records only
changed field names because historical projection must not depend on missing
context.

### 14.3 Approved plan revision

An approved plan revision acts as a coherent manifest/checkpoint across the
revisions of all plan entities affected by an approval.

This prevents a historical financial query from mixing:

- a new assignment revision;
- an old phase budget;
- and an unrelated rate state.

The implementation may use revision manifests, temporal predicates, or a hybrid,
but the externally visible plan state must be atomic.

### 14.4 Actual import history

Each actual import must record:

- immutable import/batch ID;
- source;
- file/source timestamp;
- imported-by user;
- recorded time;
- completeness watermark;
- accepted/rejected counts;
- source-record identity;
- corrections, reversals, and superseded records.

### 14.5 Deletion

Hard deletion of revision history is incompatible with as-of reconstruction.
User-visible deletion creates a tombstone/effective closure while historical
revisions remain subject to retention policy.

---

## 15. Actual-to-plan matching

### 15.1 Labor

Labor can generally match using:

- project;
- resource/worker;
- effective work date;
- cost treatment where necessary.

The matching rule must use stable IDs rather than display names.

### 15.2 Non-labor

Non-labor is more ambiguous when multiple plan lines or occurrences share a
project, resource, date, and treatment.

Recommended support:

- optional direct actual-to-plan-line link;
- optional actual-to-occurrence link;
- external reference matching;
- explicit unmatched/reconciliation queue;
- user-confirmed match history;
- partial-match support if business rules require it.

The system must not infer a destructive match when multiple candidates exist.

---

## 16. Query, projection, and API architecture

### 16.1 Projection resolver

Assignment grids and financial calculations should not query mutable current rows
independently. They should consume a resolved projection:

```text
resolve(view context)
  -> selected approved plan state
  -> optional change-set overlay
  -> actual state known at selected time
  -> actuals completeness watermarks
  -> derived cell states and financial values
```

The first release may resolve only the current context, but the boundary should be
preserved.

### 16.2 Shared calculation context

The grid, chart, and financial summary must receive the same resolved context.
Scenario and historical calculations should reuse the production forecasting
engine rather than maintain a second simplified scenario calculator.

### 16.3 Cache isolation

Cache keys must include every input that can alter the result:

- entity scope and ID;
- phase/project/program/portfolio drill-down;
- selected plan revision;
- knowledge-as-of timestamp;
- change-set ID and draft version;
- comparison revision/context;
- reporting date;
- labor/non-labor filters when applied server-side.

Example concept:

```text
forecast / project / project-id / plan-revision / knowledge-time /
change-set-version / reporting-date
```

Current, historical, and scenario results must never share an ambiguous cache
entry.

### 16.4 Invalidation

- Current approved and draft scenarios require targeted invalidation.
- A draft change-set edit invalidates only that scenario and dependent results.
- Applying a change set invalidates current approved projections and lists.
- Immutable historical approved revisions do not need mutation invalidation.
- Actual imports invalidate current and any historical query at or after their
  recorded time, but not immutable results known before that import.
- Real-time events carry identifiers/context and trigger clients to pull;
  payloads are not pushed through the event channel.

---

## 17. Minimum temporal capture that should not be deferred

The full temporal UI and query engine may wait. If history from the core-view
launch onward matters, the following should be in place before users begin making
changes that must later be reconstructed:

1. Immutable full-state revision capture for forecast and actual entities.
2. Stable logical IDs.
3. Effective dates/ranges on revisions.
4. Recorded timestamp and actor.
5. Atomic transaction/batch identifier.
6. Deletion tombstones.
7. Actual-import source and completeness-watermark history.
8. A seeded revision representing the current state at temporal-capture
   activation.

The existing audit log must be reviewed and must not be assumed sufficient. It is
sufficient only if it captures complete before/after state, effective dates,
deletions, batch boundaries, and every financially relevant entity.

History prior to activation cannot be guaranteed unless it exists in another
authoritative source.

---

## 18. Recommended rollout

The rollout consists of two coordinated tracks.

### Track A — core actuals views

#### A0. Finalize semantics and data contracts

- Confirm plan-versus-actual formulas for each perspective.
- Confirm actuals-through watermark ownership and source behavior.
- Define partial-week/month denominators.
- Define actual-to-plan matching.
- Confirm whether Combined cells show `actual + variance` or `actual + plan`.
  Recommendation: actual + compact variance, with plan in details.
- Define unplanned-actual handling.
- Define non-labor partial-replacement behavior.
- Produce final resource labor, project labor, and non-labor mockups.

**Exit criterion:** every cell state and aggregate can be determined from explicit
data, without visual or business-rule ambiguity.

#### A1. Build the current-context projection/read model

- Introduce the view-context boundary fixed to current approved/known now.
- Return plan, actual, state, watermark, and variance data required by the grid.
- Ensure financial summary and grid calculations reconcile.
- Establish cache keys that can later accept revision and scenario dimensions.

**Exit criterion:** current data can be rendered without individual components
inventing temporal or matching rules.

#### A2. Add shared display mechanics

- Add Combined/Plan/Actual/Variance selector to the shared assignment-grid
  presentation layer.
- Add legend and accessible descriptions.
- Add actuals-through and reporting-date markers.
- Add state-specific cell presentation.
- Extend the aligned chart with actual, pending, missing, and future layers.
- Preserve existing scrolling, sticky columns, highlighting, toggles, and edit
  mechanics.

**Exit criterion:** shared mechanics work with fixture data independently of
resource/project validation rules.

#### A3. Resource labor pilot

- Implement current-context actual overlay on the resource labor page first.
- Preserve 100% capacity behavior and over-allocation coloring.
- Validate daily, weekly, and monthly calculations.
- Add cell details and missing/pending semantics.

**Exit criterion:** users can follow one resource across projects and reconcile
grid, chart, and financial totals.

#### A4. Project labor view

- Apply the shared display mechanics to the project labor grid.
- Preserve project-specific headcount totals.
- Preserve resource-specific allocation validation.
- Confirm actual heads/day and row percentages reconcile.

**Exit criterion:** project and resource pages share visual mechanics but retain
their distinct totals and validation semantics.

#### A5. Non-labor view

- Add actual amount matching and reconciliation.
- Render sums at daily/weekly/monthly levels.
- Support partial and unmatched actual states.
- Align non-labor grid totals with financial reporting.

**Exit criterion:** matched, partially matched, and unmatched cash actuals are
visible and financially consistent.

#### A6. Operational hardening

- Add performance tests on long timelines.
- Add accessibility and keyboard-navigation coverage.
- Add export/report behavior if required.
- Add telemetry for missing/unmatched actuals and projection failures.
- Complete user documentation.

### Track B — temporal foundation and future change sets

#### T0. Temporal architecture decision

- Inventory every entity that influences assignment and financial projections.
- Decide whether effective-dated rates, worker/resource relationships, project
  hierarchy, currency/reference values, and other calculation inputs participate
  in an approved plan revision or are resolved independently by knowledge time.
- Audit current mutation paths and audit-log coverage.
- Select the physical revision strategy:
  - temporal entity tables;
  - append-only revision tables plus plan manifests;
  - or a hybrid.
- Define timestamp precision, time zone policy, retention, and permissions.
- Define what constitutes one atomic approved plan.

**Exit criterion:** written schema and query design supports the example as-of
questions without reconstructing state from mutable rows.

#### T1. Immutable revision capture

- Seed current state as the first captured revision.
- Capture all relevant future mutations, including tombstones.
- Capture actual-import batches and watermarks.
- Group multi-record saves atomically.
- Verify that capture does not change current application behavior.

**Exit criterion:** current state can be reconstructed at any recorded timestamp
from activation onward.

#### T2. Temporal projection service

- Resolve current approved state through the same projection interface planned
  for historical state.
- Add internal as-of query tests without exposing UI.
- Compare projections with current production results.

**Exit criterion:** current projection parity is proven, and historical fixture
queries return correct states.

#### T3. Approved plan revisions

- Create explicit plan-revision metadata/manifests.
- Link approved mutations to one plan revision.
- Provide stable revision labels and audit metadata.
- Prevent historical revision mutation.

**Exit criterion:** the state immediately before and after an approved atomic
change is reproducible.

#### T4. Draft change-set overlays and scenario financials

- Add change-set metadata and operations.
- Resolve proposal over its base plan.
- Run normal utilization and financial calculations against the proposal.
- Add scenario-versus-base comparison.
- Isolate scenario caches and real-time invalidation.

**Exit criterion:** a draft can be evaluated without changing approved data.

#### T5. Approval, rebase, and atomic application

- Add submit/approve/reject workflow.
- Add permissions and approval audit trail.
- Detect base-plan drift.
- Implement rebase/conflict resolution.
- Apply approved changes atomically into one new approved revision.

**Exit criterion:** approval creates a reproducible new plan while retaining the
old plan and proposal.

#### T6. Historical and comparison UI

- Expose Plan, Known as of, and Compare with controls.
- Make historical views read-only.
- Reproduce historical actuals-through watermarks and cell states.
- Provide return-to-current affordance.
- Support current-versus-historical and revision-versus-revision comparison.

**Exit criterion:** users can answer the agreed as-of questions from the normal
grid and financial surfaces.

#### T7. Retention, scale, and audit hardening

- Index temporal predicates and plan manifests.
- Establish retention and archival policy.
- Add history access auditing.
- Add reconciliation and integrity jobs.
- Test high-volume imports and long revision histories.

### 18.1 Recommended combined delivery order

The two tracks should be interleaved:

1. A0 + T0 — finalize semantics and temporal architecture.
2. T1 — begin immutable capture before history is lost.
3. A1 + T2 — create one current-context projection boundary.
4. A2 — shared grid/chart mechanics.
5. A3 — resource labor pilot.
6. A4 — project labor.
7. A5 — non-labor.
8. T3 — explicit approved plan revisions.
9. T4 + T5 — change sets, scenario calculations, approval, and application.
10. T6 — expose historical/as-of controls.
11. A6 + T7 — operational hardening and scale.

After T1 is safely deployed, most of Track A can proceed without waiting for the
change-set workflow.

---

## 19. Testing strategy

### 19.1 Core-view tests

- Every cell-state rule, including precedence.
- Actualized, pending, missing, future, unplanned, and empty cases.
- Watermark boundary dates.
- Daily/weekly/monthly aggregation.
- Partial-week and partial-month coverage.
- Resource actual allocation over 100%.
- Project actual heads/day.
- Non-labor sum and partial-match rules.
- Mode switching without changing the selected period range.
- Chart/grid temporal alignment.
- Cell detail provenance.
- Keyboard navigation and screen-reader state descriptions.
- Color-independent differentiation.
- Financial summary reconciliation.

### 19.2 Temporal tests

- Same effective date returns different values for different knowledge times.
- Backdated plan revision.
- Future-effective plan revision.
- Corrected historical actual.
- Historical watermark resolution.
- Tombstoned record visible before deletion and absent after deletion.
- Atomic plan revision never returns a mixed intermediate state.
- Current projection equals pre-temporal production behavior.
- Time-zone and timestamp-boundary behavior.

### 19.3 Change-set tests

- Draft overlay does not mutate approved plan.
- Scenario calculations use the base revision plus all proposal operations.
- Scenario-versus-base comparison.
- Base-plan drift detection.
- Non-conflicting rebase.
- Conflicting rebase requires resolution.
- Rejection leaves approved state unchanged.
- Approval/application is atomic.
- Pre- and post-application revisions remain queryable.
- Permissions and audit records.

### 19.4 Cache and real-time tests

- Current, historical, and scenario contexts use different cache entries.
- Draft edit invalidates only dependent scenario queries.
- Approved application refreshes current financials and grids.
- Historical immutable entries remain stable.
- Actual import invalidation respects recorded-time boundaries.
- Reconnect/refetch cannot replace a selected historical view with current data.

---

## 20. Migration and historical boundary

When temporal capture is enabled:

1. Take a consistent snapshot of all in-scope current records.
2. Create the initial approved plan revision.
3. Record the activation timestamp.
4. Treat that snapshot as the earliest guaranteed known state.
5. Capture every subsequent mutation.

If reliable older history exists in authoritative imports or records, it may be
backfilled separately. Otherwise, the UI and documentation must state:

```text
Historical plan data is available from <activation timestamp>.
```

The system must not fabricate earlier states from incomplete audit events.

---

## 21. Security and permissions

- Historical access follows the same portfolio/program/project scope rules as
  current data.
- Change-set creation, submission, approval, and application are distinct
  permissions.
- A user must not infer restricted historical entities through revision metadata
  or event streams.
- Approval and historical-report access should be auditable.
- Scenario calculations must enforce scope at both base-plan resolution and
  overlay application.

---

## 22. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Users confuse pending with missing actuals. | Use recorded watermarks, distinct neutral/amber treatments, and explicit labels. |
| Historical variance changes after plan edits. | Compare with an immutable selected plan revision, never mutable current rows. |
| Scenario results contaminate current cache. | Include complete view context and draft version in query keys. |
| Revision storage grows quickly. | Immutable revision indexes, retention/archival policy, and plan manifests/checkpoints. |
| Non-labor actuals match the wrong plan line. | Stable references, explicit reconciliation, and no destructive ambiguous inference. |
| Partial periods produce misleading averages. | Use common denominators and show actualized-day coverage. |
| Change set is based on stale plan. | Base revision, drift detection, and explicit rebase/conflict workflow. |
| Historical query returns mixed entity versions. | Atomic approved plan revisions and transaction grouping. |
| Color semantics imply value judgments for allocation. | Use signed neutral variance; reserve red for rule violations. |
| Existing audit history is incomplete. | Audit it explicitly; seed temporal history at activation; do not promise earlier reconstruction. |
| Core-view work hard-codes "current." | Introduce view-context and projection boundaries before building the views. |

---

## 23. Decisions agreed so far

- Use one full-width grid, not a permanent side-by-side variance grid.
- Provide Combined, Plan, Actual, and Variance modes.
- Combined is the recommended default.
- Keep period and chart controls independent from visualization mode.
- Use an actuals-through watermark to distinguish pending from missing.
- A date after the watermark cannot be classified as missing.
- Preserve future forecast rather than silently dropping it.
- Retain the selected plan for variance even after actual operationally replaces
  forecast.
- Include an explicit unplanned-actual state.
- Do not rely on color alone.
- Keep project and resource validation/totals separate while sharing mechanics.
- Treat change sets as overlays on a specific approved revision.
- Apply an approved change set atomically into a new plan revision.
- Retain pre-application and post-application plan states.
- Support effective time and recorded time.
- The full as-of UI may wait; immutable history capture may not wait if its
  history will later be required.

---

## 24. Open decisions before implementation

1. Exact plan entities included in the first temporal-capture scope.
2. Exact entities allowed in the first change-set MVP.
3. Physical revision schema and plan-manifest strategy.
4. Whether Combined cells show variance only when nonzero.
5. Variance unit labels: percentage points versus percent change.
6. Source and ownership of each actuals-through watermark.
7. Policy for multiple actual sources with different cutoffs.
8. Weekly/monthly partial-period denominator and display details.
9. Non-labor partial actualization and residual forecast policy.
10. Non-labor matching and reconciliation workflow.
11. Plan revision naming and user-facing labels.
12. Change-set approval roles and number of approval stages.
13. Rebase UX and whether non-conflicting changes rebase automatically.
14. Historical timestamp precision and application time-zone policy.
15. Retention and archival requirements.
16. Whether historical financial exports must be byte-for-byte reproducible or
    numerically reproducible.
17. Whether users may compare two historical plans without actuals.
18. Whether draft change-set history itself requires temporal versioning in the
    first release.
19. Whether Combined/Plan/Actual/Variance selection is remembered per user and
    perspective or resets to Combined on each visit.
20. Which non-assignment calculation inputs—especially rates and resource/worker
    relationships—must be frozen into plan revisions for reproducible financials.

---

## 25. Implementation gates

No application implementation should begin until:

- A0 and T0 decisions are recorded;
- the existing actual, assignment, forecast, import, and audit models are
  inventoried;
- the historical availability boundary is accepted;
- actual-to-plan matching rules are agreed;
- temporal capture and current projection have explicit test plans;
- the resource labor mockup is finalized without the explanatory side inset;
- cache-key composition is agreed.

The first production core-view release should not proceed until:

- temporal capture is active if history from that release onward is required;
- current projection parity is proven;
- the watermark can be sourced reliably;
- accessibility does not rely on color;
- grid and financial totals reconcile.

---

## 26. Final recommendation

Proceed with the proposed actuals visualization and preserve the existing compact
assignment-grid interaction model. Build it against a view-context projection
boundary so the same components can later display approved history and scenario
overlays.

Do not block the core views on the complete change-set workflow or historical UI.
Do deploy minimum immutable temporal capture before any plan or actual changes
that users will later expect to query historically.

---

## 27. Implementation record — 2026-07-28

The first delivery intentionally implements the current-context experience and
minimum history capture while deferring change sets and full bitemporal query
surfaces.

Implemented:

- Shared Combined, Plan, Actual, and Variance modes for resource labor, project
  labor, and non-labor assignment grids.
- Shared actualized, pending, missing, future, and unplanned state semantics,
  including text/symbol affordances in addition to color.
- Daily, Sunday-through-Saturday weekly, and monthly plan/actual aggregation.
  Labor periods average every calendar day; non-labor periods sum cash flows.
- Resource capacity and project heads/day totals remain perspective-specific.
- Aligned charts now use the same selected projection, state fills, plan
  comparison line, actual points, 100% capacity behavior, actuals-through
  marker, and reporting-date marker.
- Non-labor actuals reconcile at the reliable project/resource/date grouping.
  Expanded line detail labels group actuals as unmatched instead of inferring a
  cost-plan line.
- Explicit actual-import batches with source type, file name, actor,
  transaction ID, record count, and actuals-through date.
- Atomic labor and non-labor import transactions. Imported rows, the batch
  watermark, and their revision records commit or roll back together.
- A current-context actuals timeline API returning actual rows, reporting date,
  knowledge timestamp, and labor/non-labor completeness watermarks.
- User preference persistence for the four-value display mode independently for
  each assignment-grid perspective.
- Immutable full-state revision capture for financially relevant plan,
  assignment, rate, resource/worker, actual, and actual-import entities.
  Revisions include effective dates, recorded timestamp, actor, transaction ID,
  operation, entity version, and tombstones.
- A migration seed representing the current state at activation. No claim is
  made that state before the activation boundary can be reconstructed.

Deferred by explicit scope decision:

- Draft change-set authoring, proposal overlays, approvals, rebasing, and atomic
  application into named approved plan revisions.
- User-facing Plan revision, Known as of, and Compare with controls.
- General historical/bitemporal query endpoints and plan-revision manifests.
- Automatic line-level matching for non-labor actuals where no unambiguous
  source reference exists.
- Historical reconstruction for dates recorded before temporal capture was
  activated.

This sequence delivers current operational value while avoiding a future rewrite
and, most importantly, avoids permanently losing the data needed for "what did we
know then?" questions.
