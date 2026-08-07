const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/

/**
 * Parse an API date-only value without allowing the browser timezone to move
 * it to the preceding or following calendar day.
 */
export const parseDateOnly = (value: string): Date => {
  const match = DATE_ONLY_PATTERN.exec(value)
  if (!match) return new Date(value)

  const [, year, month, day] = match
  return new Date(Number(year), Number(month) - 1, Number(day))
}

export const localDateOnlyKey = (date: Date = new Date()): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

export type DateRangeStatus = 'planned' | 'active' | 'completed'

/**
 * Date ranges in Planner are inclusive at both ends. Comparing ISO date-only
 * keys keeps the entire end date active instead of completing at midnight.
 */
export const getInclusiveDateRangeStatus = (
  startDate: string,
  endDate: string,
  currentDate: string = localDateOnlyKey(),
): DateRangeStatus => {
  if (currentDate < startDate) return 'planned'
  if (currentDate > endDate) return 'completed'
  return 'active'
}
