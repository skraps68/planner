export type AssignmentViewMode = 'daily' | 'weekly' | 'monthly'

export interface AssignmentPeriod {
  key: string
  label: string
  ariaLabel: string
  dates: Date[]
  isWeekend: boolean
  endsMajorPeriod: boolean
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

const utcDate = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))

const dateKey = (date: Date): string => date.toISOString().slice(0, 10)

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const inclusiveDates = (start: Date, end: Date): Date[] => {
  const dates: Date[] = []
  for (let date = start; date <= end; date = addDays(date, 1)) {
    dates.push(new Date(date))
  }
  return dates
}

const longDate = (date: Date): string =>
  `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`

const weeklyLabel = (start: Date, end: Date): string =>
  `${start.getUTCMonth() + 1}/${start.getUTCDate()}-${end.getUTCMonth() + 1}/${end.getUTCDate()}`

const monthlyLabel = (date: Date): string =>
  `${date.getUTCMonth() + 1} '${String(date.getUTCFullYear()).slice(-2)}`

const containsMonthEnd = (dates: Date[]): boolean =>
  dates.some((date) => addDays(date, 1).getUTCMonth() !== date.getUTCMonth())

/**
 * Builds complete UTC calendar periods. Weekly periods are Sunday–Saturday,
 * and boundary periods are expanded so every average uses a complete week or
 * calendar month. Dates not present in the source are represented in the
 * period and therefore contribute zero when the value reader returns zero.
 */
export function buildAssignmentPeriods(
  sourceDates: Date[],
  viewMode: AssignmentViewMode,
): AssignmentPeriod[] {
  if (sourceDates.length === 0) return []

  const normalized = sourceDates.map(utcDate).sort((a, b) => a.getTime() - b.getTime())
  const first = normalized[0]
  const last = normalized[normalized.length - 1]

  if (viewMode === 'daily') {
    return inclusiveDates(first, last).map((date) => ({
      key: dateKey(date),
      label: `${date.getUTCMonth() + 1}/${date.getUTCDate()}`,
      ariaLabel: `Date: ${longDate(date)}`,
      dates: [date],
      isWeekend: date.getUTCDay() === 0 || date.getUTCDay() === 6,
      endsMajorPeriod: date.getUTCDay() === 6,
    }))
  }

  if (viewMode === 'weekly') {
    const start = addDays(first, -first.getUTCDay())
    const end = addDays(last, 6 - last.getUTCDay())
    const periods: AssignmentPeriod[] = []

    for (let weekStart = start; weekStart <= end; weekStart = addDays(weekStart, 7)) {
      const weekEnd = addDays(weekStart, 6)
      const dates = inclusiveDates(weekStart, weekEnd)
      periods.push({
        key: `week-${dateKey(weekStart)}`,
        label: weeklyLabel(weekStart, weekEnd),
        ariaLabel: `Week: ${longDate(weekStart)} through ${longDate(weekEnd)}`,
        dates,
        isWeekend: false,
        endsMajorPeriod: containsMonthEnd(dates),
      })
    }
    return periods
  }

  const monthStart = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth(), 1))
  const finalMonth = new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), 1))
  const periods: AssignmentPeriod[] = []

  for (
    let current = monthStart;
    current <= finalMonth;
    current = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 1))
  ) {
    const monthEnd = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + 1, 0))
    periods.push({
      key: `month-${current.getUTCFullYear()}-${String(current.getUTCMonth() + 1).padStart(2, '0')}`,
      label: monthlyLabel(current),
      ariaLabel: `Month: ${MONTH_NAMES[current.getUTCMonth()]} ${current.getUTCFullYear()}`,
      dates: inclusiveDates(current, monthEnd),
      isWeekend: false,
      endsMajorPeriod: current.getUTCMonth() === 11,
    })
  }

  return periods
}

export function averageAssignmentPeriod(
  period: AssignmentPeriod,
  readValue: (date: Date) => number,
): number {
  if (period.dates.length === 0) return 0
  return period.dates.reduce((sum, date) => sum + readValue(date), 0) / period.dates.length
}

export function formatAssignmentAverage(value: number): string {
  if (Math.abs(value) < 0.000_001) return ''
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
