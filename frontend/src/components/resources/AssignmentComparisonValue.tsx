import { Box, Typography } from '@mui/material'

import {
  actualStateLabel,
  comparisonValue,
  type AssignmentComparison,
  type AssignmentDisplayMode,
} from './assignmentActuals'

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
}

export function AssignmentComparisonValue({
  comparison,
  mode,
  formatValue,
  suffix = '',
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
  const title = [
    state,
    coverage,
    `Plan ${formatValue(comparison.plan)}${suffix}`,
    comparison.actualDays
      ? `Actual ${formatValue(comparison.actual)}${suffix}`
      : 'No actual loaded',
    comparison.actualDays
      ? `Variance ${variance >= 0 ? '+' : ''}${formatValue(variance)}${suffix}`
      : '',
  ].filter(Boolean).join(' · ')

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
      <Typography component="span" sx={{ fontSize: '0.75rem', lineHeight: 1 }}>
        {!visibleValue || value === null ? '' : `${formatValue(value)}${suffix}`}
      </Typography>
      {stateMarker && (
        <Typography
          component="sup"
          sx={{
            color: comparison.state === 'missing'
              ? '#9a6200'
              : comparison.state === 'unplanned'
                ? '#704a97'
                : 'text.secondary',
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
