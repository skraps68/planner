import { useId } from 'react'
import { Box, Typography } from '@mui/material'
import {
  COLOR_ACCENT,
  COLOR_LINE,
  COLOR_SLATE_WASH,
} from '../../theme'
import type { AssignmentPeriod } from './assignmentPeriods'
import type {
  AssignmentComparison,
  AssignmentDisplayMode,
} from './assignmentActuals'
import {
  ASSIGNMENTS_GRID_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_PROJECT_END_COLOR,
  ASSIGNMENTS_GRID_PROJECT_START_COLOR,
  ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_WEEKEND_BG,
  getAssignmentsGridBoundaryStrokeCenter,
} from './assignmentGridConstants'

const CHART_HEIGHT = 160
const PLOT_TOP = 16
const PLOT_BOTTOM = 132
const AVAILABLE_FILL = 'rgba(76, 175, 80, 0.20)'
const OVER_FILL = 'rgba(192, 57, 47, 0.22)'
const LIMIT_COLOR = '#c0392f'

export interface AssignmentUsageChartConfig {
  title: string
  subtitle: string
  seriesLabel: string
  values: number[]
  stackedSeries?: Array<{
    label: string
    values: number[]
    fill: string
  }>
  valueFormatter?: (value: number) => string
  deltaFormatter?: (value: number) => string
  capacityLimit?: number
  availableCapacityLabel?: string
  comparisons?: AssignmentComparison[]
  displayMode?: AssignmentDisplayMode
  actualsThroughDate?: string | null
  reportingDate?: string
  projectStartDate?: string
  projectEndDate?: string
}

interface AssignmentUsageChartProps {
  periods: AssignmentPeriod[]
  periodWidth: number
  identityWidth: number
  config: AssignmentUsageChartConfig
}

const chartPath = (points: Array<{ x: number; y: number }>, baseline: number): string => {
  if (points.length === 0) return ''
  const line = points.map(({ x, y }) => `L ${x} ${y}`).join(' ')
  return `M ${points[0].x} ${baseline} ${line} L ${points[points.length - 1].x} ${baseline} Z`
}

const linePath = (points: Array<{ x: number; y: number }>): string => {
  if (points.length === 0) return ''
  return points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ')
}

const bandPath = (
  topPoints: Array<{ x: number; y: number }>,
  bottomPoints: Array<{ x: number; y: number }>,
): string => {
  if (topPoints.length === 0) return ''
  return [
    `M ${topPoints[0].x} ${topPoints[0].y}`,
    ...topPoints.slice(1).map(({ x, y }) => `L ${x} ${y}`),
    ...[...bottomPoints].reverse().map(({ x, y }) => `L ${x} ${y}`),
    'Z',
  ].join(' ')
}

const formatAxisValue = (value: number): string => {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

const getProjectScaleMax = (peak: number): number => {
  if (peak <= 1) return 1
  if (peak <= 5) return Math.ceil(peak * 2.2) / 2
  return Math.ceil(peak * 1.1)
}

export const AssignmentUsageChart = ({
  periods,
  periodWidth,
  identityWidth,
  config,
}: AssignmentUsageChartProps) => {
  const clipId = useId().replace(/:/g, '')
  const plotWidth = periods.length * periodWidth
  const peak = Math.max(
    0,
    ...config.values,
    ...(config.comparisons?.flatMap((comparison) => [
      comparison.plan,
      comparison.actual,
      comparison.combined,
    ]) ?? []),
  )
  const scaleMax = config.capacityLimit === undefined
    ? getProjectScaleMax(peak)
    : Math.max(config.capacityLimit * 1.2, peak * 1.05)
  const y = (value: number) =>
    PLOT_BOTTOM - (Math.max(0, value) / scaleMax) * (PLOT_BOTTOM - PLOT_TOP)
  const selectedValues = config.comparisons?.map((comparison) => {
    if (config.displayMode === 'plan') return comparison.plan
    if (config.displayMode === 'actual' || config.displayMode === 'variance') {
      return comparison.actual
    }
    return comparison.combined
  }) ?? config.values
  const points = periods.map((_period, index) => ({
    x: index * periodWidth + periodWidth / 2,
    y: y(selectedValues[index] ?? 0),
  }))
  const usedPath = chartPath(points, PLOT_BOTTOM)
  const planPoints = config.comparisons?.map((comparison, index) => ({
    x: index * periodWidth + periodWidth / 2,
    y: y(comparison.plan),
  })) ?? points
  const planLine = linePath(planPoints)
  const actualSegments = (config.comparisons ?? []).reduce<Array<Array<{
    index: number
    x: number
    y: number
  }>>>((segments, comparison, index) => {
    if (comparison.actualDays <= 0) return segments
    const currentSegment = segments[segments.length - 1]
    const previousIndex = currentSegment?.[currentSegment.length - 1]?.index
    if (previousIndex !== index - 1) segments.push([])
    segments[segments.length - 1].push({
      index,
      x: index * periodWidth + periodWidth / 2,
      y: y(comparison.actual),
    })
    return segments
  }, [])
  const actualAreaPaths = actualSegments.map((segment) => {
    if (segment.length > 1) return chartPath(segment, PLOT_BOTTOM)
    const [{ x, y: pointY }] = segment
    return [
      `M ${x - periodWidth / 2} ${PLOT_BOTTOM}`,
      `L ${x - periodWidth / 2} ${pointY}`,
      `L ${x + periodWidth / 2} ${pointY}`,
      `L ${x + periodWidth / 2} ${PLOT_BOTTOM}`,
      'Z',
    ].join(' ')
  })
  const varianceAreaPaths = actualSegments.map((segment) => {
    const planSegment = segment.map(({ index, x }) => ({
      x,
      y: y(config.comparisons![index].plan),
    }))
    if (segment.length > 1) return bandPath(segment, planSegment)
    const [{ x, y: actualY }] = segment
    const [{ y: planY }] = planSegment
    return [
      `M ${x - periodWidth / 2} ${actualY}`,
      `L ${x + periodWidth / 2} ${actualY}`,
      `L ${x + periodWidth / 2} ${planY}`,
      `L ${x - periodWidth / 2} ${planY}`,
      'Z',
    ].join(' ')
  })
  const limitY = config.capacityLimit === undefined ? undefined : y(config.capacityLimit)
  const availablePath = limitY === undefined || points.length === 0
    ? ''
    : [
        `M ${points[0].x} ${limitY}`,
        `L ${points[points.length - 1].x} ${limitY}`,
        ...[...points].reverse().map(({ x, y: pointY }) => `L ${x} ${pointY}`),
        'Z',
      ].join(' ')
  const stackedAreas = (config.stackedSeries ?? []).reduce<Array<{
    label: string
    fill: string
    values: number[]
    path: string
  }>>((areas, series) => {
    const lowerValues = areas.length
      ? areas[areas.length - 1].values
      : periods.map(() => 0)
    const upperValues = periods.map(
      (_period, index) =>
        (lowerValues[index] ?? 0) + (series.values[index] ?? 0),
    )
    const upperPoints = periods.map((_period, index) => ({
      x: index * periodWidth + periodWidth / 2,
      y: y(upperValues[index]),
    }))
    const lowerPoints = periods.map((_period, index) => ({
      x: index * periodWidth + periodWidth / 2,
      y: y(lowerValues[index] ?? 0),
    }))
    areas.push({
      label: series.label,
      fill: series.fill,
      values: upperValues,
      path: bandPath(upperPoints, lowerPoints),
    })
    return areas
  }, [])
  const legendSeries = config.stackedSeries ?? [{
    label: config.seriesLabel,
    values: config.values,
    fill: COLOR_SLATE_WASH,
  }]
  const valueFormatter = config.valueFormatter ?? formatAxisValue
  const deltaFormatter = config.deltaFormatter ?? ((value: number) =>
    `${value > 0 ? '+' : ''}${formatAxisValue(value)}`)
  const showPlanLegend = Boolean(config.comparisons && planLine)
  const showActualLegend = Boolean(
    config.comparisons?.some((comparison) => comparison.actualDays > 0),
  )
  const comparisonLegendCount =
    Number(showPlanLegend) + Number(showActualLegend)
  const axisLabels = config.capacityLimit === undefined
    ? [
        { value: scaleMax, label: formatAxisValue(scaleMax) },
        { value: scaleMax / 2, label: formatAxisValue(scaleMax / 2) },
        { value: 0, label: '0' },
      ]
    : [
        { value: config.capacityLimit, label: `${formatAxisValue(config.capacityLimit)}%`, alert: true },
        { value: config.capacityLimit / 2, label: `${formatAxisValue(config.capacityLimit / 2)}%` },
        { value: 0, label: '0%' },
      ]

  return (
    <Box
      data-testid="assignment-usage-chart"
      sx={{
        display: 'flex',
        width: identityWidth + plotWidth,
        minWidth: identityWidth + plotWidth,
        height: CHART_HEIGHT,
        borderBottom: `1px solid ${COLOR_LINE}`,
        backgroundColor: 'background.paper',
      }}
    >
      <Box
        sx={{
          position: 'sticky',
          left: 0,
          zIndex: 3,
          flex: `0 0 ${identityWidth}px`,
          height: CHART_HEIGHT,
          borderRight: `1px solid ${COLOR_LINE}`,
          backgroundColor: '#fbfcfd',
        }}
      >
        <Typography sx={{ position: 'absolute', left: '10px', top: '10px', fontSize: 12, fontWeight: 700 }}>
          {config.title}
        </Typography>
        <Typography sx={{ position: 'absolute', left: '10px', top: '29px', color: 'text.secondary', fontSize: 10 }}>
          {config.subtitle}
        </Typography>
        {legendSeries.map((series, index) => (
          <Box
            key={series.label}
            sx={{
              position: 'absolute',
              left: '10px',
              top: `${61 + index * 21}px`,
              display: 'flex',
              alignItems: 'center',
              gap: 0.75,
            }}
          >
            <Box
              sx={{
                width: 20,
                height: 9,
                borderTop: `2px solid ${COLOR_ACCENT}`,
                backgroundColor: series.fill,
              }}
            />
            <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>
              {series.label}
            </Typography>
          </Box>
        ))}
        {showPlanLegend && (
          <Box sx={{
            position: 'absolute',
            left: '10px',
            top: `${61 + legendSeries.length * 21}px`,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}>
            <Box
              data-testid="assignment-plan-legend-swatch"
              sx={{ position: 'relative', width: 20, height: 9 }}
            >
              <Box sx={{
                position: 'absolute',
                top: 4,
                left: 0,
                width: 20,
                borderTop: `2px solid ${COLOR_ACCENT}`,
              }} />
              {[3, 9, 15].map((left) => (
                <Box
                  key={left}
                  sx={{
                    position: 'absolute',
                    left,
                    top: 1.5,
                    width: 6,
                    height: 6,
                    border: `1.5px solid ${COLOR_ACCENT}`,
                    borderRadius: '50%',
                    backgroundColor: '#fff',
                  }}
                />
              ))}
            </Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>
              Plan
            </Typography>
          </Box>
        )}
        {showActualLegend && (
          <Box sx={{
            position: 'absolute',
            left: '10px',
            top: `${
              61 + (
                legendSeries.length + Number(showPlanLegend)
              ) * 21
            }px`,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}>
            <Box
              data-testid="assignment-actual-legend-swatch"
              sx={{ position: 'relative', width: 20, height: 9 }}
            >
              <Box sx={{
                position: 'absolute',
                top: 4,
                left: 0,
                width: 20,
                borderTop: '1.5px dotted #445968',
              }} />
              {[3, 9, 15].map((left) => (
                <Box
                  key={left}
                  sx={{
                    position: 'absolute',
                    left,
                    top: 2,
                    width: 5,
                    height: 5,
                    border: '1px solid #fff',
                    borderRadius: '50%',
                    backgroundColor: '#445968',
                    boxShadow: '0 0 0 0.5px #445968',
                  }}
                />
              ))}
            </Box>
            <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>
              Actual
            </Typography>
          </Box>
        )}
        {config.capacityLimit !== undefined && config.availableCapacityLabel && (
          <Box sx={{
            position: 'absolute',
            left: '10px',
            top: `${
              61 + (legendSeries.length + comparisonLegendCount) * 21
            }px`,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}>
            <Box sx={{ width: 20, height: 9, backgroundColor: AVAILABLE_FILL }} />
            <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>{config.availableCapacityLabel}</Typography>
          </Box>
        )}
        {config.capacityLimit !== undefined && (
          <Box sx={{
            position: 'absolute',
            left: '10px',
            top: `${
              61 + (
                legendSeries.length
                + comparisonLegendCount
                + (config.availableCapacityLabel ? 1 : 0)
              ) * 21
            }px`,
            display: 'flex',
            alignItems: 'center',
            gap: 0.75,
          }}>
            <Box sx={{ width: 20, borderTop: `2px dashed ${LIMIT_COLOR}` }} />
            <Typography sx={{ color: 'text.secondary', fontSize: 10 }}>Capacity limit</Typography>
          </Box>
        )}
        {axisLabels.map(({ value, label, alert }) => (
          <Typography
            key={`${value}-${label}`}
            sx={{
              position: 'absolute',
              right: '7px',
              top: y(value),
              transform: 'translateY(-50%)',
              color: alert ? LIMIT_COLOR : 'text.secondary',
              fontFamily: 'monospace',
              fontSize: 9,
              fontWeight: alert ? 700 : 400,
            }}
          >
            {label}
          </Typography>
        ))}
      </Box>
      <Box sx={{ flex: `0 0 ${plotWidth}px`, width: plotWidth, height: CHART_HEIGHT }}>
        <svg
          width={plotWidth}
          height={CHART_HEIGHT}
          viewBox={`0 0 ${plotWidth} ${CHART_HEIGHT}`}
          role="img"
          aria-label={`${config.title}: ${config.subtitle}`}
        >
          <title>{`${config.title}: ${config.subtitle}`}</title>
          <defs>
            {usedPath && config.comparisons && (
              <clipPath id={`${clipId}-selected-area`}>
                <path d={usedPath} />
              </clipPath>
            )}
            <pattern
              id={`${clipId}-missing`}
              width="6"
              height="6"
              patternUnits="userSpaceOnUse"
              patternTransform="rotate(135)"
            >
              <rect width="6" height="6" fill="rgba(223, 164, 57, 0.25)" />
              <line x1="0" y1="0" x2="0" y2="6" stroke="rgba(160, 99, 0, 0.34)" strokeWidth="2" />
            </pattern>
            {limitY !== undefined && (
              <>
                <clipPath id={`${clipId}-over`}>
                  <rect x="0" y="0" width={plotWidth} height={limitY} />
                </clipPath>
                <clipPath id={`${clipId}-under`}>
                  <rect x="0" y={limitY} width={plotWidth} height={PLOT_BOTTOM - limitY} />
                </clipPath>
              </>
            )}
          </defs>
          {periods.map((period, index) => period.isWeekend && (
            <rect
              key={`weekend-${period.key}`}
              x={index * periodWidth}
              y="0"
              width={periodWidth}
              height={CHART_HEIGHT}
              fill={ASSIGNMENTS_GRID_WEEKEND_BG}
            />
          ))}
          <line x1="0" y1={PLOT_BOTTOM} x2={plotWidth} y2={PLOT_BOTTOM} stroke={COLOR_LINE} />
          <line
            x1="0"
            y1={y(scaleMax / 2)}
            x2={plotWidth}
            y2={y(scaleMax / 2)}
            stroke="#edf0f4"
          />
          {limitY !== undefined && availablePath && (
            <path
              d={availablePath}
              fill={AVAILABLE_FILL}
              clipPath={`url(#${clipId}-under)`}
            />
          )}
          {config.comparisons && config.displayMode === 'variance'
            ? varianceAreaPaths.map((path, index) => (
                <path
                  key={`variance-area-${index}`}
                  data-testid="assignment-variance-area"
                  d={path}
                  fill={COLOR_SLATE_WASH}
                />
              ))
            : config.comparisons && config.displayMode === 'actual'
              ? actualAreaPaths.map((path, index) => (
                  <path
                    key={`actual-area-${index}`}
                    data-testid="assignment-actual-area"
                    d={path}
                    fill={COLOR_SLATE_WASH}
                  />
                ))
              : config.comparisons && config.displayMode === 'plan'
                ? stackedAreas.length
                  ? stackedAreas.map((area) => (
                      <path
                        key={area.label}
                        data-testid="assignment-plan-area"
                        d={area.path}
                        fill={area.fill}
                      />
                    ))
                  : usedPath && (
                      <path
                        data-testid="assignment-plan-area"
                        d={usedPath}
                        fill={COLOR_SLATE_WASH}
                      />
                    )
                : config.comparisons && usedPath
                  ? config.comparisons.map((comparison, index) => {
                      const fill = comparison.state === 'actualized'
                        ? COLOR_SLATE_WASH
                        : comparison.state === 'missing'
                          ? `url(#${clipId}-missing)`
                          : comparison.state === 'pending'
                            ? 'rgba(117, 127, 138, 0.16)'
                            : comparison.state === 'future'
                              ? 'rgba(95, 125, 148, 0.16)'
                              : comparison.state === 'unplanned'
                                ? 'rgba(112, 74, 151, 0.24)'
                                : 'transparent'
                      return (
                        <rect
                          key={`state-area-${periods[index].key}`}
                          x={index * periodWidth}
                          y={PLOT_TOP}
                          width={periodWidth}
                          height={PLOT_BOTTOM - PLOT_TOP}
                          fill={fill}
                          clipPath={`url(#${clipId}-selected-area)`}
                        />
                      )
                    })
                  : stackedAreas.length
                    ? stackedAreas.map((area) => (
                        <path key={area.label} d={area.path} fill={area.fill} />
                      ))
                    : usedPath && <path d={usedPath} fill={COLOR_SLATE_WASH} />}
          {limitY !== undefined && usedPath && (
            <path
              d={usedPath}
              fill={OVER_FILL}
              clipPath={`url(#${clipId}-over)`}
            />
          )}
          {periods.map((period, index) => (
            <line
              key={`grid-${period.key}`}
              data-testid={
                period.endsMajorPeriod
                  ? `assignment-chart-boundary-${index + 1}`
                  : undefined
              }
              x1={period.endsMajorPeriod
                ? getAssignmentsGridBoundaryStrokeCenter((index + 1) * periodWidth)
                : (index + 1) * periodWidth}
              y1="0"
              x2={period.endsMajorPeriod
                ? getAssignmentsGridBoundaryStrokeCenter((index + 1) * periodWidth)
                : (index + 1) * periodWidth}
              y2={CHART_HEIGHT}
              stroke={period.endsMajorPeriod ? ASSIGNMENTS_GRID_BOUNDARY_COLOR : COLOR_LINE}
              strokeWidth={period.endsMajorPeriod ? 2 : 1}
            />
          ))}
          {limitY !== undefined && (
            <>
              <line
                x1="0"
                y1={limitY}
                x2={plotWidth}
                y2={limitY}
                stroke={LIMIT_COLOR}
                strokeWidth="1.6"
                strokeDasharray="5 4"
              />
              <text
                x={Math.max(0, plotWidth - 6)}
                y={Math.max(10, limitY - 5)}
                textAnchor="end"
                fontSize="9"
                fontWeight="700"
                fill={LIMIT_COLOR}
              >
                {`${formatAxisValue(config.capacityLimit!)}% LIMIT`}
              </text>
            </>
          )}
          {planLine && (
            <path
              data-testid="assignment-plan-line"
              d={planLine}
              fill="none"
              stroke={COLOR_ACCENT}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {planPoints.map((point, index) => (
            <circle
              key={`plan-point-${periods[index].key}`}
              data-testid="assignment-plan-point"
              cx={point.x}
              cy={point.y}
              r="2.5"
              fill="#fff"
              stroke={COLOR_ACCENT}
              strokeWidth="1.4"
            />
          ))}
          {actualSegments.map((segment, index) => (
            <path
              key={`actual-line-${index}`}
              data-testid="assignment-actual-line"
              d={linePath(segment)}
              fill="none"
              stroke="#445968"
              strokeWidth="1.6"
              strokeDasharray="1.5 3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {config.comparisons?.map((comparison, index) => (
            comparison.actualDays > 0 && (
              <circle
                key={`actual-point-${periods[index].key}`}
                data-testid="assignment-actual-point"
                cx={points[index].x}
                cy={y(comparison.actual)}
                r="2.3"
                fill="#445968"
                stroke="#fff"
                strokeWidth="0.8"
              />
            )
          ))}
          {(config.displayMode === 'combined' || config.displayMode === 'variance')
            && config.comparisons?.map(
            (comparison, index) => {
              if (
                comparison.actualDays === 0
                || Math.abs(comparison.variance) < 0.000_001
              ) return null
              const labelY = Math.max(
                9,
                y(Math.max(comparison.plan, comparison.actual)) - 7,
              )
              return (
                <text
                  key={`delta-${periods[index].key}`}
                  data-testid="assignment-delta-label"
                  x={points[index].x}
                  y={labelY}
                  textAnchor="middle"
                  fill="#334155"
                  stroke="#fff"
                  strokeWidth="2.5"
                  paintOrder="stroke"
                  fontSize="8"
                  fontWeight="700"
                >
                  {`Δ${deltaFormatter(comparison.variance)}`}
                </text>
              )
            },
          )}
          {config.actualsThroughDate && (() => {
            let index = -1
            periods.forEach((period, periodIndex) => {
              if (period.dates.some((date) =>
                date.toISOString().slice(0, 10) <= config.actualsThroughDate!
              )) index = periodIndex
            })
            if (index < 0) return null
            const x = (index + 1) * periodWidth
            return (
              <g>
                <line x1={x} y1={0} x2={x} y2={CHART_HEIGHT} stroke="#9a6200" strokeWidth="1.4" strokeDasharray="3 3" />
                <text x={Math.min(plotWidth - 4, x + 4)} y="11" fontSize="8" fill="#7a5208">ACTUALS THROUGH</text>
              </g>
            )
          })()}
          {config.projectStartDate && (() => {
            const index = periods.findIndex((period) =>
              period.dates.some((date) =>
                date.toISOString().slice(0, 10) === config.projectStartDate
              )
            )
            if (index < 0) return null
            const x = getAssignmentsGridBoundaryStrokeCenter(index * periodWidth)
            return (
              <line
                data-testid="project-start-boundary"
                x1={x}
                y1={0}
                x2={x}
                y2={CHART_HEIGHT}
                stroke={ASSIGNMENTS_GRID_PROJECT_START_COLOR}
                strokeWidth="2"
              >
                <title>Project start</title>
              </line>
            )
          })()}
          {config.projectEndDate && (() => {
            const index = periods.findIndex((period) =>
              period.dates.some((date) =>
                date.toISOString().slice(0, 10) === config.projectEndDate
              )
            )
            if (index < 0) return null
            const x = getAssignmentsGridBoundaryStrokeCenter(
              (index + 1) * periodWidth,
            )
            return (
              <line
                data-testid="project-end-boundary"
                x1={x}
                y1={0}
                x2={x}
                y2={CHART_HEIGHT}
                stroke={ASSIGNMENTS_GRID_PROJECT_END_COLOR}
                strokeWidth="2"
              >
                <title>Project end</title>
              </line>
            )
          })()}
          {config.reportingDate && (() => {
            const index = periods.findIndex((period) =>
              period.dates.some((date) =>
                date.toISOString().slice(0, 10) === config.reportingDate
              )
            )
            if (index < 0) return null
            const x = getAssignmentsGridBoundaryStrokeCenter(index * periodWidth)
            return (
              <line
                data-testid="reporting-date-boundary"
                x1={x}
                y1={0}
                x2={x}
                y2={CHART_HEIGHT}
                stroke={ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR}
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            )
          })()}
          {config.capacityLimit !== undefined && points.map((point, index) => (
            (selectedValues[index] ?? 0) > config.capacityLimit! && (
              <circle
                key={`over-${periods[index].key}`}
                cx={point.x}
                cy={point.y}
                r="3.2"
                fill={LIMIT_COLOR}
                stroke="#fff"
                strokeWidth="1.2"
              />
            )
          ))}
          {periods.map((period, index) => (
            <rect
              key={`hit-${period.key}`}
              x={index * periodWidth}
              y={PLOT_TOP}
              width={periodWidth}
              height={PLOT_BOTTOM - PLOT_TOP}
              fill="transparent"
            >
              <title>
                {config.stackedSeries
                  ? [
                      `${period.ariaLabel}: ${valueFormatter(config.values[index] ?? 0)} total`,
                      ...config.stackedSeries.map((series) =>
                        `${series.label} ${valueFormatter(series.values[index] ?? 0)}`
                      ),
                    ].join(' · ')
                  : `${period.ariaLabel}: ${valueFormatter(config.values[index] ?? 0)}`}
              </title>
            </rect>
          ))}
        </svg>
      </Box>
    </Box>
  )
}
