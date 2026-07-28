// Maps a backend ChangeEvent `type` to the React Query key prefixes that
// should be invalidated. Prefix arrays match any query key that starts with them.
const MAP: Record<string, Array<Array<string>>> = {
  resource: [['resources'], ['resource'], ['assignments'], ['resource-roles']],
  resource_assignment: [['assignments'], ['forecast'], ['actuals']],
  worker: [['workers'], ['worker'], ['resources'], ['worker-types']],
  worker_type: [['workers'], ['worker-types']],
  project: [['projects'], ['project'], ['forecast']],
  project_phase: [['phases'], ['project'], ['forecast']],
  non_labor_plan_line: [['nonlabor-plans'], ['forecast']],
  non_labor_plan_occurrence: [['nonlabor-plans'], ['forecast']],
  non_labor_plan_line_reference: [['nonlabor-plans']],
  program: [['programs'], ['program']],
  portfolio: [['portfolios'], ['portfolio']],
  rate: [['rates'], ['forecast'], ['worker-types']],
  actual: [['actuals'], ['forecast']],
  resource_role: [['resource-roles']],
  presence: [['presence']],
  lock: [['lock']],
}

export function queryKeyPrefixesFor(entityType: string): Array<Array<string>> {
  return MAP[entityType] ?? []
}
