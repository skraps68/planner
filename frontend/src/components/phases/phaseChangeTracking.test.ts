import { describe, it, expect } from 'vitest'
import {
  computeChangedFields,
  withSyncedTotal,
  TRACKED_FIELDS,
} from './phaseChangeTracking'

const basePhase = {
  id: 'p1',
  name: 'Phase 1',
  description: 'desc',
  start_date: '2024-01-01',
  end_date: '2024-03-31',
  labor_capital_budget: 0,
  labor_expense_budget: 0,
  nonlabor_capital_budget: 0,
  nonlabor_expense_budget: 0,
  total_budget: 0,
}

describe('withSyncedTotal', () => {
  it('sets total_budget to the sum of the four budget fields', () => {
    const p = withSyncedTotal({ ...basePhase, labor_capital_budget: 100, nonlabor_expense_budget: 25 })
    expect(p.total_budget).toBe(125)
  })

  it('keeps total consistent across a sequence of independent field updates (Issue 2)', () => {
    // Simulate rapid edits: each update merges onto the latest phase, then re-syncs total.
    let p: any = { ...basePhase }
    p = withSyncedTotal({ ...p, labor_capital_budget: 100 })
    p = withSyncedTotal({ ...p, labor_expense_budget: 50 })
    p = withSyncedTotal({ ...p, nonlabor_capital_budget: 10 })
    // total must always equal the sum — never a stale partial sum
    expect(p.total_budget).toBe(160)
    expect(p.total_budget).toBe(
      p.labor_capital_budget + p.labor_expense_budget + p.nonlabor_capital_budget + p.nonlabor_expense_budget
    )
  })
})

describe('computeChangedFields', () => {
  const baselineById = { p1: { ...basePhase } }

  it('returns no entry when a phase matches its baseline', () => {
    const result = computeChangedFields([{ ...basePhase }], baselineById)
    expect(result.p1).toBeUndefined()
  })

  it('flags only the field that deviates', () => {
    const result = computeChangedFields([{ ...basePhase, labor_capital_budget: 500 }], baselineById)
    expect([...result.p1]).toEqual(['labor_capital_budget'])
  })

  it('clears the flag when the field reverts to its baseline value', () => {
    const changed = computeChangedFields([{ ...basePhase, labor_capital_budget: 500 }], baselineById)
    expect(changed.p1.has('labor_capital_budget')).toBe(true)
    const reverted = computeChangedFields([{ ...basePhase, labor_capital_budget: 0 }], baselineById)
    expect(reverted.p1).toBeUndefined()
  })

  it('does not raise a false positive for a numeric-vs-string budget baseline', () => {
    const stringBaseline = { p1: { ...basePhase, labor_capital_budget: '100.00' as any } }
    const result = computeChangedFields([{ ...basePhase, labor_capital_budget: 100 }], stringBaseline)
    expect(result.p1).toBeUndefined()
  })

  // Issue 1: a new phase is diffed against its creation baseline; multiple edited
  // fields accumulate rather than replacing one another, and a dragged date stays
  // flagged while amounts are edited.
  it('accumulates multiple changed fields for a new phase (does not replace)', () => {
    const creationBaseline = { 'temp-1': { ...basePhase, id: 'temp-1' } }
    const edited = {
      ...basePhase,
      id: 'temp-1',
      start_date: '2024-01-15', // date dragged
      labor_capital_budget: 300, // then an amount edited
      labor_expense_budget: 75, // then another amount edited
    }
    const result = computeChangedFields([edited], creationBaseline)
    expect([...result['temp-1']].sort()).toEqual(
      ['labor_capital_budget', 'labor_expense_budget', 'start_date'].sort()
    )
  })

  it('clears a new-phase amount flag when it reverts to the original value of 0', () => {
    const creationBaseline = { 'temp-1': { ...basePhase, id: 'temp-1' } }
    const changed = computeChangedFields([{ ...basePhase, id: 'temp-1', labor_capital_budget: 300 }], creationBaseline)
    expect(changed['temp-1'].has('labor_capital_budget')).toBe(true)
    const reverted = computeChangedFields([{ ...basePhase, id: 'temp-1', labor_capital_budget: 0 }], creationBaseline)
    expect(reverted['temp-1']).toBeUndefined()
  })

  it('excludes phases marked for deletion', () => {
    const result = computeChangedFields(
      [{ ...basePhase, labor_capital_budget: 500 }],
      baselineById,
      new Set(['p1'])
    )
    expect(result.p1).toBeUndefined()
  })

  it('never flags the derived total_budget field', () => {
    expect(TRACKED_FIELDS).not.toContain('total_budget')
  })
})
