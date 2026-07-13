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
})
