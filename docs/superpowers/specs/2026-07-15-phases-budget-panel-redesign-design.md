# Phases & Budget Panel Redesign — Design

**Date:** 2026-07-15
**Status:** Agreed design, not yet implemented. Frontend-only; build on a new branch off `main`.
**Scope:** The project-page **Overview** tab, where `PhaseEditor` renders the "Phase Timeline" and "Project Phases and Budget" sections.

---

## 1. Problem

On the Overview tab, [`PhaseEditor`](../../../frontend/src/components/phases/PhaseEditor.tsx) stacks **two separate `<Paper>` panels**:

1. `PhaseTimeline` — its own Paper + "Phase Timeline" title + an "Edit Timeline" button; a 40px bar plus top/bottom date-label bands.
2. `PhaseList` — its own Paper + "Project Phases and Budget" title + "Add Phase"; an 8-column table (Name, Description, Start, End, Labor Cap/Exp, Non-Labor Cap/Exp, Total, Actions) with a **per-row pencil** editor and a totals row.

Two problems:

- **Too much vertical space:** two headers, two paddings/margins, and the timeline's two date-label bands dominate the screen.
- **Two disconnected editing models:** the timeline has a panel-level "Edit Timeline" mode (drag-resize + reorder), while the table has an independent, always-on per-row pencil. The single "Save Changes" control lives in the timeline header and is **only visible in timeline edit mode** — so a table edit made outside edit mode is staged in state with no visible way to save it. `Cancel` (timeline) also silently discards staged table edits.

## 2. Goals

1. Merge the two sections into **one enclosing panel** with a single header.
2. **Reduce vertical footprint.**
3. **One coherent edit flow:** a single Edit button flips the whole panel editable, with one Save/Cancel.

Non-goals: any backend change (the batch endpoint and validation already cover everything); changes to the financial-summary panel above; changing the phase data model.

## 3. Agreed decisions

Confirmed with the user 2026-07-15:

- **A. Container:** one flat `<Paper>`, one header, timeline ribbon directly above the table (option A1).
- **B. Editing model:** a single **Edit button → whole-panel edit mode** — the timeline becomes draggable/reorderable **and** every table row's fields become inputs simultaneously — with one Save/Cancel. The per-row pencil is removed (option B1).
- **B′. Date editing — timeline owns *interior* boundaries; the info card owns the project range:** in the phases panel **all date columns are read-only in both view and edit mode**. Phase boundaries change only by dragging on the timeline, which can move only **interior** boundaries (there are no outer resize handles), so the first phase's Start and the last phase's End stay pinned to the project's dates by construction. The project's outer range is edited **only from the separate project-info card**, and the backend cascades that change into the first/last phase. **The phases panel never edits or persists project dates.** (Confirmed 2026-07-15.)
- **C. Read-mode density:** keep all four budget columns (Labor Cap/Exp, Non-Labor Cap/Exp) visible at all times; tighten row height; tuck the often-empty Description behind a hover/expand affordance rather than a permanent column.
- **D. Timeline:** an always-visible compact ribbon (not collapsible).

## 4. Target layout

**Read mode** — one panel, one header, compact ribbon + tight table:
```
┌─ Phases & Budget                                         [ Edit ] ─┐
│  ▓▓▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓   ← compact timeline ribbon        │
│  Name    Start    End       Labor Cap/Exp   NonLab Cap/Exp   Total  │
│  Design  01 Jan   31 Mar     100k / 50k        18k / 12k     180k    │
│  Build   01 Apr   30 Sep     …                                       │
│  ── Total ──────────────────────────────────────────────    600k    │
└─────────────────────────────────────────────────────────────────────┘
```

**Edit mode** — same panel; Edit → Save/Cancel; timeline handles show; rows become inputs; interior dates read-only:
```
┌─ Phases & Budget                       [+ Add Phase] [Cancel] [Save] ─┐
│  ◀▓▓▓▓▓▓▓▓▶░░░◀▓▓▓▓▓▓▓▓▓▓▓▓▶   ← drag edges / drag-to-reorder         │
│  [Design ]  01 Jan  31 Mar  [100k][50k] [18k][12k] 180k  🗑           │
│  [Build  ]  01 Apr  30 Sep  …name & budget inputs…                     │
└────────────────────────────────────────────────────────────────────────┘
```
(All date cells are read-only text — driven by the timeline for interior boundaries and by the project dates for the outer ones. Only name, the four budgets, and delete are editable here; project dates are changed from the info card.)

## 5. Component changes (presentation/state refactor only)

**`PhaseEditor`** stays the orchestrator and owns the merge:
- Renders a **single `<Paper>`** with a unified header ("Phases & Budget") and the action controls:
  - read mode → `[ Edit ]`
  - edit mode → `[ + Add Phase ] [ Cancel ] [ Save ]` (Save disabled when there are validation errors or no changes — reuse existing `hasChanges` / `hasValidationErrors`).
- Keeps `ValidationErrorDisplay` at the top of the panel.
- Existing state (`isEditMode`, `phases`, `changedFields`, `deletedPhaseIds`, `hasChanges`, `handleUpdatePhase`, `handleSave` via `phasesApi.batchUpdate`, `handleCancel` reverting to `originalPhases`) is reused. The key change is that `isEditMode` now also gates the table's editability, not just the timeline's.
- **Drop** the `onProjectDateChange` prop and `handleBoundaryDateChange` — the panel no longer reads or writes project dates. `handleSave` stays a **single `phasesApi.batchUpdate(phases)`** (no project PATCH, no two-step write).

**`PhaseTimeline`** — add a variant that renders **without its own `<Paper>` and title** (mirrors the existing `compact`/`actions` prop pattern), so it lives inside the shared panel as a ribbon. Trim vertical padding and the top/bottom date-label bands to reduce height. `enableResize`/`enableReorder` continue to be driven by `isEditMode`. Preserve the existing keyboard-reorder path (Ctrl/Cmd+Shift+M + arrows) for accessibility.

**`PhaseList`** — add an `editMode: boolean` prop and render **without its own `<Paper>`/title/Add-Phase button** (those move to the panel header):
- **Remove** the per-row pencil, `editingPhaseId`, `editValues`, and per-row Save/Cancel.
- **Read mode:** every cell is read-only text; Description is not a column — a phase with a description shows a small info/hover affordance; four budget columns always shown; totals row unchanged; tighter row density.
- **Edit mode:** each row renders inputs for **name and the four budget fields** (with the live Total recomputed as their sum). **All date columns stay read-only text** — interior boundaries change via timeline drag, project boundaries via the info card. Each input's `onChange` calls `onUpdate(phaseId, {field: value})` immediately (staging into `PhaseEditor.phases`, tracked by `changedFields`) — there is no per-row commit; the panel-level Save/Cancel is the only commit/revert. Delete (🗑) per row remains, edit-mode only. The old `onBoundaryDateChange` / boundary date-input handling is removed.
- **Description editing:** revealed via a small per-row expand toggle (edit mode), keeping the main grid narrow. (Low-priority refinement; may land as a follow-up if it complicates the first pass.)

## 6. Project-date synchronization

**Invariant (backend-enforced):** a project's date range is *definitionally* the span of its phases. [`phase_validator`](../../../backend/app/services/phase_validator.py) requires the **first phase to start exactly on `project.start_date`** and the **last phase to end exactly on `project.end_date`**, with no gaps/overlaps.

**Project dates are edited in exactly one place — the project-info card** (its own separate Edit/Save, above the phases panel). Editing Start/End there PATCHes `/projects/{id}` ([`update_project`](../../../backend/app/services/project.py)), and the backend **cascades** the change into the first/last phase, returning `phase_adjustments`; the page then refetches. This surface is **unchanged** by the redesign.

**The phases panel never edits or persists project dates.** All of its date columns are read-only. Timeline drag moves only *interior* boundaries (there are no outer resize handles — the first phase renders no left handle, the last no right handle), so it preserves `first-phase-start == project.start` and `last-phase-end == project.end` by construction. Consequently the panel's Save is a **single `phasesApi.batchUpdate(phases)`**, and its `validate_phase_timeline` boundary check always passes because the boundaries never leave the project range. There is no project PATCH from this panel, no `onProjectDateChange`, and none of today's eager-write behavior.

**Division of labor (what goes where):**
- Extend/shrink the whole **project** → the **info card** (cascades to the boundary phases server-side).
- Redistribute time **within** the project, or edit budgets/names → the **phases panel**.

No phases-panel operation ever needs to move the project's outer range: **Add Phase** splits the last phase in half (staying inside the range) and **delete** redistributes within the existing range. So Model B is complete — nothing forces date editing into the panel.

## 7. Risks / notes

- Many-phase projects show more inputs at once in edit mode; keeping **all** date columns read-only (dates live on the timeline / info card) holds the input count down and avoids competing date editors.
- No new backend or validation work — `phasesApi.batchUpdate` + `validatePhases` already exist and are reused as-is; the panel's Save is a single `batchUpdate` with no project write.
- Several existing `PhaseEditor`/`PhaseList`/`PhaseTimeline` tests reference the old per-row pencil, the two-panel structure, and the first/last date-input editing (now removed) and will need updating; some already sit in the documented pre-existing test-repair backlog. New tests must cover: read mode renders no inputs; one Edit toggles both timeline handles and all row inputs; one Save commits via `batchUpdate`; Cancel reverts; and that **every date cell stays read-only** in edit mode.

## 8. Test strategy (summary; full cases in the plan)

- **Read vs edit:** read mode = zero inputs, `[Edit]` present; clicking Edit reveals timeline resize handles and per-row inputs and swaps the header to `[+ Add Phase][Cancel][Save]`.
- **Single Save/Cancel:** editing a budget in a row + dragging a boundary both stage into one dirty state; Save issues a single `batchUpdate`; Cancel restores `originalPhases` (both timeline and table).
- **Date ownership:** every date column in the phases panel is read-only in both modes; the panel issues no `projectsApi.update`; Save is a single `batchUpdate`.
- **Project dates via info card (§6):** editing project Start/End on the info card cascades to the first/last phase (existing behavior; assert `phase_adjustments` and that the phases panel reflects the new boundaries after refetch).
- **Totals:** per-row Total = sum of the four budgets (live in edit mode); totals row sums each column.
- **Accessibility:** keyboard reorder still works in edit mode.
