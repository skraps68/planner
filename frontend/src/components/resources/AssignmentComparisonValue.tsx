import { Box, Typography } from '@mui/material'

import {
  actualStateLabel,
  comparisonValue,
  type AssignmentComparison,
  type AssignmentDisplayMode,
} from './assignmentActuals'
import {
  ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_WARNING_MARKER_COLOR,
} from './assignmentGridConstants'

const STATE_MARKER = {
  actualized: '',
  pending: '◷',
  missing: '!',
  future: '',
  unplanned: '+',
  empty: '',
} as const

interface AssignmentComparisonValueProps {
  comparison: AssignmentComparison
  mode: AssignmentDisplayMode
  formatValue: (value: number) => string
  suffix?: string
  emphasized?: boolean
}

export function AssignmentComparisonValue({
  comparison,
  mode,
  formatValue,
  suffix = '',
  emphasized = false,
}: AssignmentComparisonValueProps) {
  const value = comparisonValue(comparison, mode)
  const visibleValue = value !== null
    && !(Math.abs(value) < 0.000_001 && comparison.state === 'empty')
  const variance = comparison.variance
  const state = actualStateLabel[comparison.state]
  const stateMarker = STATE_MARKER[comparison.state]
  const coverage = comparison.totalDays > 1
    ? `${comparison.actualDays}/${comparison.totalDays} days with actuals`
    : ''
  const planDetail = `Plan ${formatValue(comparison.plan)}${suffix}`
  const actualDetail = comparison.actualDays
    ? `Actual ${formatValue(comparison.actual)}${suffix}`
    : 'No actual loaded'
  const varianceDetail = comparison.actualDays
    ? `Variance ${variance >= 0 ? '+' : ''}${formatValue(variance)}${suffix}`
    : ''
  const useConciseTitle = (
    mode === 'plan'
    || mode === 'actual'
    || mode === 'variance'
    || mode === 'combined'
  )
    && (
      comparison.state === 'actualized'
      || comparison.state === 'pending'
    )
  const conciseValueDetails = mode === 'variance'
    ? comparison.actualDays
      ? [varianceDetail, planDetail, actualDetail]
      : ['Variance pending', planDetail]
    : mode === 'actual'
      ? [
          comparison.actualDays ? actualDetail : 'Actual pending',
          planDetail,
          varianceDetail,
        ]
      : [
          planDetail,
          comparison.actualDays ? actualDetail : 'Actual pending',
          varianceDetail,
        ]
  const valueDetails = [planDetail, actualDetail, varianceDetail]
  const title = (
    useConciseTitle
      ? conciseValueDetails
      : [state, coverage, ...valueDetails]
  ).filter(Boolean).join(' · ')

  return (
    <Box
      component="span"
      title={title}
      aria-label={title}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        minWidth: 0,
        gap: 0.25,
      }}
    >
      <Typography
        component="span"
        sx={{
          fontSize: '0.75rem',
          fontWeight: emphasized ? 700 : undefined,
          lineHeight: 1,
        }}
      >
        {!visibleValue || value === null ? '' : `${formatValue(value)}${suffix}`}
      </Typography>
      {stateMarker && (
        <Typography
          component="sup"
          sx={{
            color: comparison.state === 'missing'
              ? ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR
              : ASSIGNMENTS_GRID_WARNING_MARKER_COLOR,
            fontSize: '0.52rem',
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          {stateMarker}
        </Typography>
      )}
    </Box>
  )
}
