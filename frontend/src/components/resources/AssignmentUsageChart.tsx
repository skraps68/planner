import { useId } from 'react'
import { Box, Typography } from '@mui/material'
import {
  COLOR_ACCENT,
  COLOR_LINE,
  COLOR_SLATE_WASH,
} from '../../theme'
import type { AssignmentPeriod } from './assignmentPeriods'
import {
  ASSIGNMENTS_GRID_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_WEEKEND_BG,
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
  capacityLimit?: number
  availableCapacityLabel?: string
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
  const peak = Math.max(0, ...config.values)
  const scaleMax = config.capacityLimit === undefined
    ? getProjectScaleMax(peak)
    : Math.max(config.capacityLimit * 1.2, peak * 1.05)
  const y = (value: number) =>
    PLOT_BOTTOM - (Math.max(0, value) / scaleMax) * (PLOT_BOTTOM - PLOT_TOP)
  const points = periods.map((_period, index) => ({
    x: index * periodWidth + periodWidth / 2,
    y: y(config.values[index] ?? 0),
  }))
  const usedPath = chartPath(points, PLOT_BOTTOM)
  const line = linePath(points)
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
        {config.capacityLimit !== undefined && config.availableCapacityLabel && (
          <Box sx={{
            position: 'absolute',
            left: '10px',
            top: `${61 + legendSeries.length * 21}px`,
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
            top: `${61 + (legendSeries.length + (config.availableCapacityLabel ? 1 : 0)) * 21}px`,
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
          {stackedAreas.length
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
              x1={(index + 1) * periodWidth}
              y1="0"
              x2={(index + 1) * periodWidth}
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
          {line && (
            <path
              d={line}
              fill="none"
              stroke={COLOR_ACCENT}
              strokeWidth="2.2"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {config.capacityLimit !== undefined && points.map((point, index) => (
            (config.values[index] ?? 0) > config.capacityLimit! && (
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
