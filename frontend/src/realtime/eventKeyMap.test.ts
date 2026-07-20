import { describe, it, expect } from 'vitest'
import { queryKeyPrefixesFor } from './eventKeyMap'

describe('queryKeyPrefixesFor', () => {
  it('maps resource changes to resource + assignment lists', () => {
    expect(queryKeyPrefixesFor('resource')).toEqual(
      expect.arrayContaining([['resources'], ['resource'], ['assignments']]),
    )
  })
  it('maps worker changes to worker and resource lists (rename cascade)', () => {
    expect(queryKeyPrefixesFor('worker')).toEqual(
      expect.arrayContaining([['workers'], ['resources']]),
    )
  })
  it('returns [] for unknown types', () => {
    expect(queryKeyPrefixesFor('mystery')).toEqual([])
  })
  it('maps worker changes to worker-types (worker_count freshness)', () => {
    expect(queryKeyPrefixesFor('worker')).toEqual(
      expect.arrayContaining([['worker-types']]),
    )
  })
  it('maps resource changes to resource-roles (resource_count freshness)', () => {
    expect(queryKeyPrefixesFor('resource')).toEqual(
      expect.arrayContaining([['resource-roles']]),
    )
  })
  it('maps rate changes to worker-types (current_rate freshness)', () => {
    expect(queryKeyPrefixesFor('rate')).toEqual(
      expect.arrayContaining([['worker-types']]),
    )
  })
  it('maps resource_role changes to the resource-roles list', () => {
    expect(queryKeyPrefixesFor('resource_role')).toEqual(
      expect.arrayContaining([['resource-roles']]),
    )
  })
})
