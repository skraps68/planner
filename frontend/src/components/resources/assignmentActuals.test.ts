import { describe, expect, it } from 'vitest'

import type { AssignmentPeriod } from './assignmentPeriods'
import {
  compareAssignmentPeriod,
  comparisonValue,
} from './assignmentActuals'

const date = (value: string) => new Date(`${value}T00:00:00.000Z`)
const period = (dates: string[]): AssignmentPeriod => ({
  key: dates.join(':'),
  label: 'period',
  ariaLabel: 'period',
  dates: dates.map(date),
  isWeekend: false,
  endsMajorPeriod: false,
})

describe('assignment actual comparison', () => {
  it('distinguishes missing actuals from pending actuals using the watermark', () => {
    const missing = compareAssignmentPeriod(
      period(['2026-07-20']),
      () => 80,
      () => ({ value: 0, present: false }),
      { watermark: '2026-07-21', reportingDate: '2026-07-25' },
    )
    const pending = compareAssignmentPeriod(
      period(['2026-07-22']),
      () => 80,
      () => ({ value: 0, present: false }),
      { watermark: '2026-07-21', reportingDate: '2026-07-25' },
    )

    expect(missing.state).toBe('missing')
    expect(pending.state).toBe('pending')
    expect(comparisonValue(missing, 'combined')).toBe(80)
    expect(comparisonValue(pending, 'actual')).toBeNull()
  })

  it('preserves future plan values in Combined mode', () => {
    const result = compareAssignmentPeriod(
      period(['2026-08-01']),
      () => 50,
      () => ({ value: 0, present: false }),
      { watermark: '2026-07-25', reportingDate: '2026-07-28' },
    )

    expect(result.state).toBe('future')
    expect(comparisonValue(result, 'combined')).toBe(50)
  })

  it('shows loaded actuals and signed percentage-point variance', () => {
    const result = compareAssignmentPeriod(
      period(['2026-07-20']),
      () => 75,
      () => ({ value: 60, present: true }),
      { watermark: '2026-07-25', reportingDate: '2026-07-28' },
    )

    expect(result.state).toBe('actualized')
    expect(comparisonValue(result, 'actual')).toBe(60)
    expect(comparisonValue(result, 'variance')).toBe(-15)
  })

  it('averages every calendar day while retaining partial coverage', () => {
    const result = compareAssignmentPeriod(
      period(['2026-07-19', '2026-07-20', '2026-07-21']),
      () => 100,
      (day) => day.toISOString().startsWith('2026-07-19')
        ? { value: 60, present: true }
        : { value: 0, present: false },
      { watermark: '2026-07-19', reportingDate: '2026-07-28' },
    )

    expect(result.plan).toBe(100)
    expect(result.actual).toBe(20)
    expect(result.combined).toBeCloseTo(260 / 3)
    expect(result.actualDays).toBe(1)
    expect(result.pendingDays).toBe(2)
  })

  it('sums non-labor periods instead of averaging them', () => {
    const result = compareAssignmentPeriod(
      period(['2026-07-19', '2026-07-20']),
      () => 100,
      () => ({ value: 80, present: true }),
      { aggregation: 'sum', watermark: '2026-07-20' },
    )

    expect(result.plan).toBe(200)
    expect(result.actual).toBe(160)
    expect(result.variance).toBe(-40)
  })
})
