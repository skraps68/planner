import { describe, expect, it } from 'vitest'
import {
  averageAssignmentPeriod,
  buildAssignmentPeriods,
  formatAssignmentAverage,
} from './assignmentPeriods'

const utc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month - 1, day))

describe('assignment periods', () => {
  it('densifies daily dates and identifies weekends and Saturday boundaries', () => {
    const periods = buildAssignmentPeriods(
      [utc(2026, 7, 3), utc(2026, 7, 6)],
      'daily',
    )

    expect(periods.map((period) => period.label)).toEqual(['7/3', '7/4', '7/5', '7/6'])
    expect(periods.map((period) => period.isWeekend)).toEqual([false, true, true, false])
    expect(periods.map((period) => period.endsMajorPeriod)).toEqual([false, true, false, false])
  })

  it('builds complete Sunday-through-Saturday weeks with numeric labels', () => {
    const periods = buildAssignmentPeriods(
      [utc(2026, 7, 1), utc(2026, 7, 8)],
      'weekly',
    )

    expect(periods.map((period) => period.label)).toEqual([
      '6/28-7/4',
      '7/5-7/11',
    ])
    expect(periods[0].dates).toHaveLength(7)
    expect(periods[0].dates[0].getUTCDay()).toBe(0)
    expect(periods[0].dates[6].getUTCDay()).toBe(6)
    expect(periods[0].endsMajorPeriod).toBe(true)
    expect(periods[0].ariaLabel).toContain('June 28, 2026 through July 4, 2026')
  })

  it('builds full calendar months with abbreviated numeric headers', () => {
    const periods = buildAssignmentPeriods(
      [utc(2026, 7, 20), utc(2027, 1, 2)],
      'monthly',
    )

    expect(periods.map((period) => period.label)).toEqual([
      "7 '26",
      "8 '26",
      "9 '26",
      "10 '26",
      "11 '26",
      "12 '26",
      "1 '27",
    ])
    expect(periods[0].dates).toHaveLength(31)
    expect(periods[5].endsMajorPeriod).toBe(true)
  })

  it('averages every calendar day, including zero-valued days', () => {
    const [period] = buildAssignmentPeriods([utc(2026, 7, 6)], 'weekly')
    const average = averageAssignmentPeriod(
      period,
      (date) => (date.getUTCDate() === 6 ? 100 : 0),
    )

    expect(average).toBeCloseTo(100 / 7)
    expect(formatAssignmentAverage(average)).toBe('14.3')
    expect(formatAssignmentAverage(50)).toBe('50')
    expect(formatAssignmentAverage(0)).toBe('')
  })

  it('returns no periods for an empty range', () => {
    expect(buildAssignmentPeriods([], 'daily')).toEqual([])
  })
})
