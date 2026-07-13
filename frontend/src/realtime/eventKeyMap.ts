// Maps a backend ChangeEvent `type` to the React Query key prefixes that
// should be invalidated. Prefix arrays match any query key that starts with them.
const MAP: Record<string, Array<Array<string>>> = {
  resource: [['resources'], ['resource'], ['assignments']],
  resource_assignment: [['assignments'], ['forecast'], ['actuals']],
  worker: [['workers'], ['worker'], ['resources']],
  worker_type: [['workers'], ['worker-types']],
  project: [['projects'], ['project'], ['forecast']],
  project_phase: [['phases'], ['project'], ['forecast']],
  program: [['programs'], ['program']],
  portfolio: [['portfolios'], ['portfolio']],
  rate: [['rates'], ['forecast']],
  actual: [['actuals'], ['forecast']],
  presence: [['presence']],
  lock: [['lock']],
}

export function queryKeyPrefixesFor(entityType: string): Array<Array<string>> {
  return MAP[entityType] ?? []
}
