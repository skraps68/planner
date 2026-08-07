import { describe, expect, it } from 'vitest'
import { format } from 'date-fns'
import {
  getInclusiveDateRangeStatus,
  parseDateOnly,
} from './dateOnly'

describe('date-only utilities', () => {
  it('preserves the API calendar date when formatted in the local timezone', () => {
    expect(format(parseDateOnly('2026-07-27'), 'M/d/yyyy')).toBe('7/27/2026')
  })

  it('treats both project boundaries as inclusive', () => {
    expect(getInclusiveDateRangeStatus(
      '2026-07-27',
      '2027-07-27',
      '2026-07-27',
    )).toBe('active')
    expect(getInclusiveDateRangeStatus(
      '2026-07-27',
      '2027-07-27',
      '2027-07-27',
    )).toBe('active')
    expect(getInclusiveDateRangeStatus(
      '2026-07-27',
      '2027-07-27',
      '2027-07-28',
    )).toBe('completed')
  })
})
