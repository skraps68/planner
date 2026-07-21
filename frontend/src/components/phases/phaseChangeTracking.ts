import { ProjectPhase } from '../../types'

/** The four editable budget components; total_budget is derived from these. */
export const BUDGET_FIELDS: (keyof ProjectPhase)[] = [
  'labor_capital_budget',
  'labor_expense_budget',
  'nonlabor_capital_budget',
  'nonlabor_expense_budget',
]

/**
 * Fields whose per-cell deviation from a baseline we surface as a highlight.
 * total_budget is intentionally excluded — it is derived from the budget fields,
 * so highlighting it would double-report a budget change.
 */
export const TRACKED_FIELDS: (keyof ProjectPhase)[] = [
  'name',
  'description',
  'start_date',
  'end_date',
  ...BUDGET_FIELDS,
]

/** Coerce a budget value (which may arrive as a numeric string from the API) to a number. */
export const toNumber = (value: string | number | undefined | null): number => {
  if (value === undefined || value === null) return 0
  if (typeof value === 'string') return parseFloat(value) || 0
  return value
}

/**
 * Whether a single field deviates from its baseline. Budget fields are compared
 * numerically (so 100 and "100.00" are equal); everything else by normalized value.
 */
export const fieldChanged = (
  field: keyof ProjectPhase,
  baselineValue: unknown,
  currentValue: unknown
): boolean => {
  if (BUDGET_FIELDS.includes(field)) {
    return toNumber(baselineValue as string | number | undefined) !==
      toNumber(currentValue as string | number | undefined)
  }
  return (baselineValue ?? '') !== (currentValue ?? '')
}

/** Return a copy of the phase with total_budget re-synced to the sum of the four budgets. */
export const withSyncedTotal = (phase: Partial<ProjectPhase>): Partial<ProjectPhase> => ({
  ...phase,
  total_budget: BUDGET_FIELDS.reduce((sum, field) => sum + toNumber(phase[field]), 0),
})

/**
 * Derive, for every active phase, the set of fields that deviate from its baseline.
 *
 * This is a pure diff over current state, so it is immune to the stale-closure and
 * replace-vs-merge bugs of incremental tracking: a field is flagged iff it currently
 * differs from the baseline, and a revert automatically clears the flag. New phases
 * are diffed against their creation-time snapshot (supplied in baselineById), so their
 * cells highlight on deviation and clear on revert, just like saved phases.
 */
export const computeChangedFields = (
  phases: Partial<ProjectPhase>[],
  baselineById: Record<string, Partial<ProjectPhase>>,
  deletedPhaseIds: Set<string> = new Set()
): Record<string, Set<string>> => {
  const result: Record<string, Set<string>> = {}
  for (const phase of phases) {
    const id = phase.id
    if (!id || deletedPhaseIds.has(id)) continue
    const baseline = baselineById[id]
    if (!baseline) continue
    const changed = new Set<string>()
    for (const field of TRACKED_FIELDS) {
      if (fieldChanged(field, baseline[field], phase[field])) {
        changed.add(field as string)
      }
    }
    if (changed.size > 0) result[id] = changed
  }
  return result
}
