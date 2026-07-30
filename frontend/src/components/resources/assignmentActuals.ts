import type { SxProps, Theme } from '@mui/material/styles'

import type { Actual } from '../../types'
import type { AssignmentPeriod } from './assignmentPeriods'

export type AssignmentDisplayMode = 'combined' | 'plan' | 'actual' | 'variance'
export type AssignmentActualState =
  | 'actualized'
  | 'pending'
  | 'missing'
  | 'future'
  | 'unplanned'
  | 'empty'

export interface ActualValue {
  value: number
  present: boolean
}

export interface AssignmentComparison {
  plan: number
  actual: number
  combined: number
  variance: number
  state: AssignmentActualState
  actualDays: number
  missingDays: number
  pendingDays: number
  totalDays: number
}

const EPSILON = 0.000_001
const PLAN_VARIANCE_COLORS = [
  '#fff4bf',
  '#ffc766',
  '#f59ab2',
  '#c94f7c',
] as const

export interface VarianceHeatmapScale {
  minMagnitude: number
  maxMagnitude: number
}

export const actualDateKey = (value: Date): string => value.toISOString().slice(0, 10)

export const actualRecordKey = (
  projectId: string,
  resourceId: string,
  actualDate: string,
): string => `${projectId}:${resourceId}:${actualDate}`

export interface ActualTotals {
  allocation: number
  capitalAllocation: number
  expenseAllocation: number
  capitalAmount: number
  expenseAmount: number
  actualCost: number
  count: number
}

export const buildActualTotals = (actuals: Actual[]): Map<string, ActualTotals> => {
  const totals = new Map<string, ActualTotals>()
  actuals.forEach((actual) => {
    const key = actualRecordKey(actual.project_id, actual.resource_id, actual.actual_date)
    const current = totals.get(key) ?? {
      allocation: 0,
      capitalAllocation: 0,
      expenseAllocation: 0,
      capitalAmount: 0,
      expenseAmount: 0,
      actualCost: 0,
      count: 0,
    }
    const allocation = Number(actual.allocation_percentage ?? 0)
    const actualCost = Number(actual.actual_cost ?? 0)
    const capitalAmount = Number(actual.capital_amount ?? 0)
    const capitalRatio = actualCost > 0 ? capitalAmount / actualCost : 0
    current.allocation += allocation
    current.capitalAllocation += allocation * capitalRatio
    current.expenseAllocation += allocation * (1 - capitalRatio)
    current.capitalAmount += capitalAmount
    current.expenseAmount += Number(actual.expense_amount ?? 0)
    current.actualCost += actualCost
    current.count += 1
    totals.set(key, current)
  })
  return totals
}

const dailyState = (
  date: Date,
  plan: number,
  actual: ActualValue,
  watermark?: string | null,
  reportingDate?: string,
): AssignmentActualState => {
  const hasPlan = Math.abs(plan) > EPSILON
  const hasActual = actual.present
  if (hasActual) return hasPlan ? 'actualized' : 'unplanned'
  if (!hasPlan) return 'empty'

  const key = actualDateKey(date)
  if (reportingDate && key > reportingDate) return 'future'
  if (watermark && key <= watermark) return 'missing'
  return 'pending'
}

export const compareAssignmentPeriod = (
  period: AssignmentPeriod,
  readPlan: (date: Date) => number,
  readActual: (date: Date) => ActualValue,
  options: {
    aggregation?: 'average' | 'sum'
    watermark?: string | null
    reportingDate?: string
  } = {},
): AssignmentComparison => {
  const aggregation = options.aggregation ?? 'average'
  const daily = period.dates.map((date) => {
    const plan = readPlan(date)
    const actual = readActual(date)
    return {
      plan,
      actual,
      state: dailyState(
        date,
        plan,
        actual,
        options.watermark,
        options.reportingDate,
      ),
    }
  })
  const divisor = aggregation === 'average' ? Math.max(1, daily.length) : 1
  const plan = daily.reduce((sum, item) => sum + item.plan, 0) / divisor
  const actual = daily.reduce(
    (sum, item) => sum + (item.actual.present ? item.actual.value : 0),
    0,
  ) / divisor
  const combined = daily.reduce(
    (sum, item) => sum + (item.actual.present ? item.actual.value : item.plan),
    0,
  ) / divisor
  const variance = daily.reduce(
    (sum, item) =>
      sum + (item.actual.present ? item.actual.value - item.plan : 0),
    0,
  ) / divisor
  const counts = {
    actualDays: daily.filter((item) => item.actual.present).length,
    missingDays: daily.filter((item) => item.state === 'missing').length,
    pendingDays: daily.filter((item) => item.state === 'pending').length,
  }
  const state: AssignmentActualState = counts.missingDays
    ? 'missing'
    : counts.pendingDays
      ? 'pending'
      : daily.some((item) => item.state === 'unplanned')
        ? 'unplanned'
        : counts.actualDays
          ? 'actualized'
          : daily.some((item) => item.state === 'future')
            ? 'future'
            : 'empty'

  return {
    plan,
    actual,
    combined,
    variance,
    state,
    ...counts,
    totalDays: daily.length,
  }
}

export const comparisonValue = (
  comparison: AssignmentComparison,
  mode: AssignmentDisplayMode,
): number | null => {
  if (mode === 'plan') return comparison.plan
  if (mode === 'combined') return comparison.combined
  if (mode === 'variance') {
    return comparison.actualDays ? comparison.variance : null
  }
  return comparison.actualDays ? comparison.actual : null
}

export const actualStateLabel: Record<AssignmentActualState, string> = {
  actualized: 'Actual loaded',
  pending: 'Actual pending',
  missing: 'Expected actual missing',
  future: 'Future forecast',
  unplanned: 'Unplanned actual',
  empty: 'No plan or actual',
}

export const getActualCellSx = (
  comparison: AssignmentComparison,
): SxProps<Theme> => {
  if (comparison.state === 'actualized') {
    return { backgroundColor: 'rgba(92, 111, 128, 0.18)' }
  }
  if (comparison.state === 'pending') {
    return { backgroundColor: 'rgba(117, 127, 138, 0.10)' }
  }
  if (comparison.state === 'missing') {
    return {
      backgroundColor: '#fff7e1',
      backgroundImage:
        'repeating-linear-gradient(135deg, transparent, transparent 4px, rgba(190, 126, 18, 0.14) 4px, rgba(190, 126, 18, 0.14) 6px)',
    }
  }
  if (comparison.state === 'future') {
    return { backgroundColor: 'rgba(95, 125, 148, 0.09)' }
  }
  if (comparison.state === 'unplanned') {
    return { backgroundColor: 'rgba(112, 74, 151, 0.14)' }
  }
  return {}
}

export const getVarianceHeatmapScale = (
  comparisons: AssignmentComparison[],
): VarianceHeatmapScale | null => {
  const magnitudes = comparisons
    .filter((comparison) => comparison.actualDays > 0)
    .map((comparison) => Math.abs(comparison.variance))
    .filter((magnitude) => magnitude > EPSILON)

  if (magnitudes.length === 0) return null
  return {
    minMagnitude: Math.min(...magnitudes),
    maxMagnitude: Math.max(...magnitudes),
  }
}

export const getVarianceHeatmapCellSx = (
  comparison: AssignmentComparison,
  scale: VarianceHeatmapScale | null,
): SxProps<Theme> => {
  const magnitude = Math.abs(comparison.variance)
  if (
    comparison.actualDays === 0
    || magnitude <= EPSILON
    || scale === null
  ) {
    return {}
  }

  const range = scale.maxMagnitude - scale.minMagnitude
  const normalized = range <= EPSILON
    ? 1
    : (magnitude - scale.minMagnitude) / range
  const colorIndex = Math.min(
    PLAN_VARIANCE_COLORS.length - 1,
    Math.floor(normalized * PLAN_VARIANCE_COLORS.length),
  )
  return { backgroundColor: PLAN_VARIANCE_COLORS[colorIndex] }
}
