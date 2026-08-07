import {
  memo,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react'
import {
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
  SvgIcon,
  Typography,
} from '@mui/material'
import { styled } from '@mui/material/styles'
import {
  COLOR_ACCENT,
  COLOR_HEADER_BG,
  COLOR_HEADER_FG,
  COLOR_LINE,
} from '../../theme'
import { validatePercentage } from '../../utils/cellValidation'
import type { AssignmentPeriod, AssignmentViewMode } from './assignmentPeriods'
import type { AssignmentDisplayMode } from './assignmentActuals'
import {
  AssignmentUsageChart,
  type AssignmentUsageChartConfig,
} from './AssignmentUsageChart'
import {
  ASSIGNMENTS_GRID_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_CELL_PADDING,
  ASSIGNMENTS_GRID_DATE_WIDTH,
  ASSIGNMENTS_GRID_HEADER_HEIGHT,
  ASSIGNMENTS_GRID_MAX_HEIGHT,
  ASSIGNMENTS_GRID_MONTH_WIDTH,
  ASSIGNMENTS_GRID_PRIMARY_WIDTH,
  ASSIGNMENTS_GRID_PROJECT_END_COLOR,
  ASSIGNMENTS_GRID_PROJECT_START_COLOR,
  ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_ROW_HEIGHT,
  ASSIGNMENTS_GRID_TYPE_WIDTH,
  ASSIGNMENTS_GRID_VIEW_TOGGLE_HEIGHT,
  ASSIGNMENTS_GRID_WARNING_MARKER_COLOR,
  ASSIGNMENTS_GRID_WEEK_WIDTH,
  getAssignmentsGridBoundaryStrokeCenter,
} from './assignmentGridConstants'

export {
  ASSIGNMENTS_GRID_AGGREGATE_TYPE_WIDTH,
  ASSIGNMENTS_GRID_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_CELL_PADDING,
  ASSIGNMENTS_GRID_DATE_WIDTH,
  ASSIGNMENTS_GRID_HEADER_HEIGHT,
  ASSIGNMENTS_GRID_MAX_HEIGHT,
  ASSIGNMENTS_GRID_MONTH_WIDTH,
  ASSIGNMENTS_GRID_PRIMARY_WIDTH,
  ASSIGNMENTS_GRID_PROJECT_END_COLOR,
  ASSIGNMENTS_GRID_PROJECT_START_COLOR,
  ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR,
  ASSIGNMENTS_GRID_ROW_HEIGHT,
  ASSIGNMENTS_GRID_TOTAL_WEEKEND_BG,
  ASSIGNMENTS_GRID_TYPE_WIDTH,
  ASSIGNMENTS_GRID_VIEW_TOGGLE_HEIGHT,
  ASSIGNMENTS_GRID_WARNING_MARKER_COLOR,
  ASSIGNMENTS_GRID_WEEKEND_BG,
  ASSIGNMENTS_GRID_WEEK_WIDTH,
} from './assignmentGridConstants'

export const getAssignmentsGridPeriodWidth = (viewMode: AssignmentViewMode): number => {
  if (viewMode === 'weekly') return ASSIGNMENTS_GRID_WEEK_WIDTH
  if (viewMode === 'monthly') return ASSIGNMENTS_GRID_MONTH_WIDTH
  return ASSIGNMENTS_GRID_DATE_WIDTH
}

export const getAssignmentsGridPeriodSx = (period: AssignmentPeriod) => ({
  ...(period.endsMajorPeriod && {
    borderRight: `2px solid ${ASSIGNMENTS_GRID_BOUNDARY_COLOR} !important`,
  }),
})

const getAssignmentsGridTableBoundarySx = (
  periodIndex: number,
  edge: 'before' | 'after',
  color: string,
  style: 'solid' | 'dashed' = 'solid',
) => {
  if (periodIndex < 0) return {}

  const usePreviousColumn = edge === 'after' || periodIndex > 0
  const columnNumber = edge === 'after'
    ? periodIndex + 3
    : periodIndex > 0
      ? periodIndex + 2
      : 3
  const continuationColumnNumber = columnNumber - 1
  const border = usePreviousColumn ? 'borderRight' : 'borderLeft'
  const value = `2px ${style} ${color} !important`

  return {
    [`& [data-assignment-date-row="true"] > .MuiTableCell-root:nth-of-type(${columnNumber}), & .MuiTableBody-root > .MuiTableRow-root:not([data-assignment-rowspan-continuation="true"]) > .MuiTableCell-root:nth-of-type(${columnNumber})`]: {
      [border]: value,
    },
    [`& .MuiTableBody-root > .MuiTableRow-root[data-assignment-rowspan-continuation="true"] > .MuiTableCell-root:nth-of-type(${continuationColumnNumber})`]: {
      [border]: value,
    },
  }
}

const ASSIGNMENTS_GRID_YEAR_BAND_HEIGHT = 16

interface AssignmentYearGroup {
  key: string
  label: string
  periodCount: number
}

const getAssignmentYearGroups = (
  periods: AssignmentPeriod[],
): AssignmentYearGroup[] => periods.reduce<AssignmentYearGroup[]>(
  (groups, period) => {
    const years = [...new Set(period.dates.map((date) => date.getUTCFullYear()))]
    const label = years.length === 1
      ? String(years[0])
      : `${years[0]}/${String(years[years.length - 1]).slice(-2)}`
    const previous = groups[groups.length - 1]
    if (previous?.label === label) {
      previous.periodCount += 1
    } else {
      groups.push({
        key: `${period.key}-${label}`,
        label,
        periodCount: 1,
      })
    }
    return groups
  },
  [],
)

const localDateKey = (date: Date): string => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, '0'),
  String(date.getDate()).padStart(2, '0'),
].join('-')

export const AssignmentsGridCell = styled(TableCell)({
  height: ASSIGNMENTS_GRID_ROW_HEIGHT,
  padding: `${ASSIGNMENTS_GRID_CELL_PADDING} !important`,
  borderRight: `1px solid ${COLOR_LINE}`,
  lineHeight: 1.15,
  whiteSpace: 'nowrap',
  '&:last-of-type': {
    borderRight: 0,
  },
  '&.MuiTableCell-head': {
    height: `${ASSIGNMENTS_GRID_HEADER_HEIGHT}px !important`,
  },
})

interface AssignmentsGridProps {
  ariaLabel: string
  periods: AssignmentPeriod[]
  viewMode: AssignmentViewMode
  onViewModeChange: (viewMode: AssignmentViewMode) => void
  primaryHeader: string
  primaryHeaderAriaLabel: string
  typeColumnWidth?: number
  children: ReactNode
  scrollContainerRef?: Ref<HTMLDivElement>
  maxHeight?: string | number
  isEditMode?: boolean
  disableViewModeChange?: boolean
  chartConfig?: AssignmentUsageChartConfig
  chartVisible?: boolean
  onChartVisibilityChange?: (visible: boolean) => void
  toolbarActions?: ReactNode
  viewSummary?: string
  periodWidthOverride?: number
  displayMode?: AssignmentDisplayMode
  onDisplayModeChange?: (mode: AssignmentDisplayMode) => void
  disableDisplayModeChange?: boolean
  actualsStatus?: ReactNode
}

const DailyViewIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 17 }}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 8h16" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <text x="12" y="17" textAnchor="middle" fontSize="9" fontWeight="700" fill="currentColor">1</text>
  </SvgIcon>
)

const WeeklyViewIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 17 }}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 8h16M6 9v11M8.5 9v11M11 9v11M13.5 9v11M16 9v11M18.5 9v11" fill="none" stroke="currentColor" strokeWidth="1" />
  </SvgIcon>
)

const MonthlyViewIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 17 }}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" />
    <path d="M4 8h16M8 9.5v10M12 9.5v10M16 9.5v10M4.5 13h15M4.5 16.5h15" fill="none" stroke="currentColor" strokeWidth=".9" />
  </SvgIcon>
)

const ChartViewIcon = () => (
  <SvgIcon viewBox="0 0 24 24" sx={{ fontSize: 17 }}>
    <path d="M4 19.5V5M4 19.5h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    <path d="M5.5 16.5l4-4 3 2 6-7v10h-13z" fill="currentColor" opacity=".35" />
    <path d="M5.5 16.5l4-4 3 2 6-7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </SvgIcon>
)

const VIEW_OPTIONS: Array<{
  mode: AssignmentViewMode
  label: string
  icon: ReactNode
}> = [
  { mode: 'daily', label: 'Daily view', icon: <DailyViewIcon /> },
  { mode: 'weekly', label: 'Weekly view', icon: <WeeklyViewIcon /> },
  { mode: 'monthly', label: 'Monthly view', icon: <MonthlyViewIcon /> },
]

const getViewSummary = (viewMode: AssignmentViewMode): string => {
  if (viewMode === 'daily') return 'DAILY VIEW · WEEKENDS SHADED'
  if (viewMode === 'weekly') return 'WEEKLY VIEW · SUN–SAT · AVERAGE OF ALL 7 CALENDAR DAYS'
  return 'MONTHLY VIEW · AVERAGE OF ALL CALENDAR DAYS'
}

/**
 * Domain-neutral assignment grid structure. Each perspective supplies its
 * own rows, totals, validation, and save behavior.
 */
export const AssignmentsGrid = ({
  ariaLabel,
  periods,
  viewMode,
  onViewModeChange,
  primaryHeader,
  primaryHeaderAriaLabel,
  typeColumnWidth = ASSIGNMENTS_GRID_TYPE_WIDTH,
  children,
  scrollContainerRef,
  maxHeight = ASSIGNMENTS_GRID_MAX_HEIGHT,
  isEditMode = false,
  disableViewModeChange = isEditMode,
  chartConfig,
  chartVisible,
  onChartVisibilityChange,
  toolbarActions,
  viewSummary,
  periodWidthOverride,
  displayMode,
  onDisplayModeChange,
  disableDisplayModeChange = isEditMode,
  actualsStatus,
}: AssignmentsGridProps) => {
  const [internalChartVisible, setInternalChartVisible] = useState(true)
  const isChartVisible = chartVisible ?? internalChartVisible
  const toggleChartVisibility = () => {
    const nextVisible = !isChartVisible
    if (chartVisible === undefined) setInternalChartVisible(nextVisible)
    onChartVisibilityChange?.(nextVisible)
  }
  const periodWidth = periodWidthOverride ?? getAssignmentsGridPeriodWidth(viewMode)
  const identityWidth = ASSIGNMENTS_GRID_PRIMARY_WIDTH + typeColumnWidth
  const tableWidth =
    identityWidth
    + periods.length * periodWidth
  const reportingDate = chartConfig?.reportingDate ?? localDateKey(new Date())
  const reportingPeriodIndex = periods.findIndex((period) =>
    period.dates.some(
      (date) => date.toISOString().slice(0, 10) === reportingDate,
    ),
  )
  const projectStartPeriodIndex = chartConfig?.projectStartDate
    ? periods.findIndex((period) => period.dates.some(
      (date) => date.toISOString().slice(0, 10) === chartConfig.projectStartDate,
    ))
    : -1
  const projectEndPeriodIndex = chartConfig?.projectEndDate
    ? periods.findIndex((period) => period.dates.some(
      (date) => date.toISOString().slice(0, 10) === chartConfig.projectEndDate,
    ))
    : -1
  const showYearBand = viewMode === 'daily' || viewMode === 'weekly'
  const yearGroups = showYearBand ? getAssignmentYearGroups(periods) : []
  const yearBandBoundaryIndexes = showYearBand
    ? [...new Set([
        ...periods.flatMap((period, index) =>
          period.endsMajorPeriod ? [index + 1] : []
        ),
        ...yearGroups.slice(0, -1).reduce<number[]>((indexes, group) => {
          indexes.push((indexes[indexes.length - 1] ?? 0) + group.periodCount)
          return indexes
        }, []),
      ])]
    : []

  return (
    <Box>
      <Box
        role="toolbar"
        aria-label="Assignment calendar controls"
        sx={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          width: '100%',
          height: ASSIGNMENTS_GRID_VIEW_TOGGLE_HEIGHT,
          backgroundColor: 'background.paper',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 0.75,
            width: identityWidth,
            height: 27,
          }}
        >
          <ToggleButtonGroup
            exclusive
            size="small"
            value={viewMode}
            onChange={(_event, nextMode: AssignmentViewMode | null) => {
              if (nextMode) onViewModeChange(nextMode)
            }}
            aria-label="Assignment calendar period"
            sx={{
              height: 27,
              '& .MuiToggleButton-root': {
                width: 35,
                minWidth: 35,
                height: 27,
                p: 0,
                color: 'text.secondary',
                borderColor: '#b8c1cb',
                '&.Mui-selected': {
                  backgroundColor: COLOR_ACCENT,
                  color: '#fff',
                  '&:hover': { backgroundColor: COLOR_ACCENT },
                },
              },
            }}
          >
            {VIEW_OPTIONS.map((option) => {
              const disabled = disableViewModeChange && option.mode !== 'daily'
              return (
                <Tooltip key={option.mode} title={option.label} arrow>
                  <span>
                    <ToggleButton
                      value={option.mode}
                      aria-label={option.label}
                      disabled={disabled}
                    >
                      {option.icon}
                    </ToggleButton>
                  </span>
                </Tooltip>
              )
            })}
          </ToggleButtonGroup>
          {chartConfig && (
            <Tooltip title={isChartVisible ? 'Hide allocation chart' : 'Show allocation chart'} arrow>
              <ToggleButton
                value="chart"
                selected={isChartVisible}
                onChange={toggleChartVisibility}
                aria-label={isChartVisible ? 'Hide allocation chart' : 'Show allocation chart'}
                sx={{
                  width: 27,
                  minWidth: 27,
                  height: 27,
                  p: 0,
                  color: COLOR_ACCENT,
                  borderColor: COLOR_ACCENT,
                  '&.Mui-selected': {
                    backgroundColor: COLOR_ACCENT,
                    color: '#fff',
                    '&:hover': { backgroundColor: COLOR_ACCENT },
                  },
                }}
              >
                <ChartViewIcon />
              </ToggleButton>
            </Tooltip>
          )}
        </Box>
        {displayMode && onDisplayModeChange && (
          <Box
            sx={{
              position: 'absolute',
              left: identityWidth + 8,
              top: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              height: 27,
            }}
          >
            <ToggleButtonGroup
              exclusive
              size="small"
              value={displayMode}
              onChange={(_event, nextMode: AssignmentDisplayMode | null) => {
                if (nextMode) onDisplayModeChange(nextMode)
              }}
              aria-label="Plan and actual display"
              sx={{
                height: 27,
                '& .MuiToggleButton-root': {
                  minWidth: 46,
                  height: 27,
                  px: 0.75,
                  borderColor: '#b8c1cb',
                  color: 'text.secondary',
                  fontSize: '0.61rem',
                  fontWeight: 700,
                  textTransform: 'none',
                  '&.Mui-selected': {
                    backgroundColor: COLOR_ACCENT,
                    color: '#fff',
                    '&:hover': { backgroundColor: COLOR_ACCENT },
                  },
                },
              }}
            >
              {([
                ['plan', 'Plan'],
                ['actual', 'Actual'],
                ['variance', 'Variance'],
                ['combined', 'Curr Fcst'],
              ] as Array<[AssignmentDisplayMode, string]>).map(([mode, label]) => (
                <ToggleButton
                  key={mode}
                  value={mode}
                  disabled={disableDisplayModeChange && mode !== 'plan'}
                  aria-label={`${label} values`}
                >
                  {label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            {actualsStatus}
            <Tooltip
              arrow
              title="◷: actual pending · !: expected actual missing · +: unplanned actual"
            >
              <Chip
                size="small"
                variant="outlined"
                label={(
                  <Box
                    component="span"
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.4,
                      fontWeight: 800,
                    }}
                  >
                    <Box component="span" sx={{ color: ASSIGNMENTS_GRID_WARNING_MARKER_COLOR }}>
                      ◷
                    </Box>
                    <Box component="span" sx={{ color: 'text.secondary' }}>·</Box>
                    <Box component="span" sx={{ color: ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR }}>
                      !
                    </Box>
                    <Box component="span" sx={{ color: 'text.secondary' }}>·</Box>
                    <Box component="span" sx={{ color: ASSIGNMENTS_GRID_WARNING_MARKER_COLOR }}>
                      +
                    </Box>
                  </Box>
                )}
                aria-label="Status key: clock actual pending, exclamation expected actual missing, plus unplanned actual"
                sx={{ height: 22, fontSize: '0.58rem' }}
              />
            </Tooltip>
          </Box>
        )}
        <Typography
          sx={{
            position: 'absolute',
            left: identityWidth,
            right: toolbarActions ? 140 : 0,
            top: 0,
            display: displayMode ? 'none' : 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 27,
            color: 'text.secondary',
            fontSize: '0.62rem',
            fontWeight: 600,
            letterSpacing: '0.03em',
            pointerEvents: 'none',
          }}
        >
          {viewSummary ?? getViewSummary(viewMode)}
        </Typography>
        {toolbarActions}
      </Box>
      <TableContainer
        ref={scrollContainerRef}
        sx={{
          width: '100%',
          maxHeight,
          overflow: 'auto',
          border: `1px solid ${isEditMode ? COLOR_ACCENT : COLOR_LINE}`,
          borderRadius: 0,
        }}
      >
        {isEditMode && (
          <Box
            role="status"
            aria-live="polite"
            sx={{
              position: 'sticky',
              left: 0,
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              minHeight: 22,
              px: 0.75,
              borderBottom: `1px solid ${COLOR_ACCENT}`,
              backgroundColor: 'rgba(40, 94, 130, 0.08)',
              color: 'primary.dark',
              fontSize: '0.68rem',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            EDITING ASSIGNMENTS · TYPE TO REPLACE A VALUE · TAB MOVES BETWEEN CELLS
          </Box>
        )}
        {chartConfig && isChartVisible && (
          <AssignmentUsageChart
            periods={periods}
            periodWidth={periodWidth}
            identityWidth={identityWidth}
            config={{ ...chartConfig, reportingDate }}
          />
        )}
        {showYearBand && (
          <Box
            data-testid="assignment-year-band"
            aria-hidden="true"
            sx={{
              position: 'sticky',
              top: 0,
              zIndex: 6,
              display: 'flex',
              width: tableWidth,
              minWidth: tableWidth,
              height: ASSIGNMENTS_GRID_YEAR_BAND_HEIGHT,
              backgroundColor: '#26313e',
            }}
          >
            <Box
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 7,
                flex: `0 0 ${identityWidth}px`,
                width: identityWidth,
                height: ASSIGNMENTS_GRID_YEAR_BAND_HEIGHT,
                backgroundColor: '#26313e',
                borderRight: `1px solid ${COLOR_LINE}`,
              }}
            />
            {yearGroups.map((group) => (
              <Box
                key={group.key}
                data-testid={`assignment-year-${group.label}`}
                sx={{
                  boxSizing: 'border-box',
                  flex: `0 0 ${group.periodCount * periodWidth}px`,
                  width: group.periodCount * periodWidth,
                  height: ASSIGNMENTS_GRID_YEAR_BAND_HEIGHT,
                  overflow: 'hidden',
                  backgroundColor: '#26313e',
                  color: '#dbe3eb',
                  fontSize: '0.57rem',
                  fontWeight: 700,
                  lineHeight: `${ASSIGNMENTS_GRID_YEAR_BAND_HEIGHT}px`,
                  letterSpacing: '0.04em',
                  textAlign: 'center',
                  whiteSpace: 'nowrap',
                }}
              >
                {group.label}
              </Box>
            ))}
            {yearBandBoundaryIndexes.map((boundaryIndex) => (
              <Box
                key={`year-band-boundary-${boundaryIndex}`}
                data-testid={`assignment-year-boundary-${boundaryIndex}`}
                sx={{
                  position: 'absolute',
                  zIndex: 1,
                  top: 0,
                  bottom: 0,
                  left: identityWidth + getAssignmentsGridBoundaryStrokeCenter(
                    boundaryIndex * periodWidth,
                  ),
                  width: 2,
                  transform: 'translateX(-50%)',
                  backgroundColor: ASSIGNMENTS_GRID_BOUNDARY_COLOR,
                  pointerEvents: 'none',
                }}
              />
            ))}
            {projectStartPeriodIndex >= 0 && (
              <Box
                data-testid="assignment-year-project-start-boundary"
                sx={{
                  position: 'absolute',
                  zIndex: 2,
                  top: 0,
                  bottom: 0,
                  left: identityWidth + getAssignmentsGridBoundaryStrokeCenter(
                    projectStartPeriodIndex * periodWidth,
                  ),
                  width: 2,
                  transform: 'translateX(-50%)',
                  backgroundColor: ASSIGNMENTS_GRID_PROJECT_START_COLOR,
                  pointerEvents: 'none',
                }}
              />
            )}
            {projectEndPeriodIndex >= 0 && (
              <Box
                data-testid="assignment-year-project-end-boundary"
                sx={{
                  position: 'absolute',
                  zIndex: 2,
                  top: 0,
                  bottom: 0,
                  left: identityWidth + getAssignmentsGridBoundaryStrokeCenter(
                    (projectEndPeriodIndex + 1) * periodWidth,
                  ),
                  width: 2,
                  transform: 'translateX(-50%)',
                  backgroundColor: ASSIGNMENTS_GRID_PROJECT_END_COLOR,
                  pointerEvents: 'none',
                }}
              />
            )}
            {reportingPeriodIndex >= 0 && (
              <Box
                data-testid="assignment-year-reporting-boundary"
                sx={{
                  position: 'absolute',
                  zIndex: 3,
                  top: 0,
                  bottom: 0,
                  left: identityWidth + getAssignmentsGridBoundaryStrokeCenter(
                    reportingPeriodIndex * periodWidth,
                  ),
                  width: 2,
                  transform: 'translateX(-50%)',
                  backgroundImage: `repeating-linear-gradient(to bottom, ${ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR} 0 4px, transparent 4px 7px)`,
                  pointerEvents: 'none',
                }}
              />
            )}
          </Box>
        )}
        <Table
        aria-label={ariaLabel}
        role="grid"
        size="small"
        padding="none"
        stickyHeader
        sx={{
          width: tableWidth,
          minWidth: tableWidth,
          tableLayout: 'fixed',
          '& .MuiTableCell-root': {
            height: `${ASSIGNMENTS_GRID_ROW_HEIGHT}px !important`,
            padding: `${ASSIGNMENTS_GRID_CELL_PADDING} !important`,
            borderRight: `1px solid ${COLOR_LINE}`,
            lineHeight: 1.15,
            whiteSpace: 'nowrap',
            textAlign: 'center',
          },
          '& .MuiTableCell-root:last-of-type': {
            borderRight: 0,
          },
          '& .MuiTableCell-head': {
            top: 0,
            height: `${ASSIGNMENTS_GRID_HEADER_HEIGHT}px !important`,
            padding: `${ASSIGNMENTS_GRID_CELL_PADDING} !important`,
          },
          ...(showYearBand && {
            '& [data-assignment-date-row="true"] > .MuiTableCell-head': {
              top: `${ASSIGNMENTS_GRID_YEAR_BAND_HEIGHT}px`,
            },
          }),
          ...getAssignmentsGridTableBoundarySx(
            projectStartPeriodIndex,
            'before',
            ASSIGNMENTS_GRID_PROJECT_START_COLOR,
          ),
          ...getAssignmentsGridTableBoundarySx(
            projectEndPeriodIndex,
            'after',
            ASSIGNMENTS_GRID_PROJECT_END_COLOR,
          ),
          ...getAssignmentsGridTableBoundarySx(
            reportingPeriodIndex,
            'before',
            ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR,
            'dashed',
          ),
        }}
      >
        <colgroup>
          <col style={{ width: ASSIGNMENTS_GRID_PRIMARY_WIDTH }} />
          <col style={{ width: typeColumnWidth }} />
          {periods.map((period) => (
            <col key={period.key} style={{ width: periodWidth }} />
          ))}
        </colgroup>
        <TableHead>
          <TableRow role="row" data-assignment-date-row="true">
            <AssignmentsGridCell
              aria-label={primaryHeaderAriaLabel}
              role="columnheader"
              sx={{
                position: 'sticky',
                left: 0,
                zIndex: 4,
                width: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                minWidth: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                maxWidth: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                textAlign: 'left !important',
                backgroundColor: COLOR_HEADER_BG,
                color: COLOR_HEADER_FG,
              }}
            >
              {primaryHeader}
            </AssignmentsGridCell>
            <AssignmentsGridCell
              aria-label="Cost treatment type"
              role="columnheader"
              sx={{
                position: 'sticky',
                left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                zIndex: 4,
                width: typeColumnWidth,
                minWidth: typeColumnWidth,
                maxWidth: typeColumnWidth,
                textAlign: 'left !important',
                backgroundColor: COLOR_HEADER_BG,
                color: COLOR_HEADER_FG,
              }}
            >
              Type
            </AssignmentsGridCell>
            {periods.map((period) => (
              <AssignmentsGridCell
                key={period.key}
                align="center"
                aria-label={period.ariaLabel}
                role="columnheader"
                sx={{
                  width: periodWidth,
                  minWidth: periodWidth,
                  maxWidth: periodWidth,
                  overflow: 'hidden',
                  textOverflow: 'clip',
                  fontSize: '0.62rem',
                  letterSpacing: 0,
                  textTransform: 'none',
                  backgroundColor: period.isWeekend ? '#3d4959' : COLOR_HEADER_BG,
                  color: COLOR_HEADER_FG,
                  ...getAssignmentsGridPeriodSx(period),
                }}
              >
                {period.label}
              </AssignmentsGridCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>{children}</TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

interface AssignmentPercentageCellProps {
  value: number
  isEditMode: boolean
  isEdited: boolean
  hasError: boolean
  errorMessage?: string
  ariaLabel?: string
  onChange: (value: number) => void
  onBlur?: () => void
}

/**
 * Shared percentage-cell mechanics: tabbing, type-to-edit, focus treatment,
 * dirty highlighting, basic numeric input handling, and error presentation.
 * Aggregate allocation rules remain in the perspective-specific controller.
 */
export const AssignmentPercentageCell = memo(({
  value,
  isEditMode,
  isEdited,
  hasError,
  errorMessage,
  ariaLabel = 'Allocation percentage',
  onChange,
  onBlur,
}: AssignmentPercentageCellProps) => {
  const [inputValue, setInputValue] = useState(value.toString())
  const [localError, setLocalError] = useState<string>()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const capturedKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isFocused) setInputValue(value.toString())
  }, [isFocused, value])

  useEffect(() => {
    if (!isFocused || !inputRef.current) return

    if (capturedKeyRef.current) {
      const length = inputRef.current.value.length
      inputRef.current.setSelectionRange(length, length)
      capturedKeyRef.current = null
    } else {
      inputRef.current.select()
    }
  }, [isFocused])

  const commitValue = () => {
    if (inputValue === value.toString()) {
      setLocalError(undefined)
      return
    }

    if (inputValue.trim() === '') {
      if (value !== 0) onChange(0)
      setLocalError(undefined)
      return
    }

    const numericValue = Number(inputValue)
    if (!Number.isFinite(numericValue)) {
      setLocalError('Value must be a number')
      return
    }

    const validation = validatePercentage(numericValue)
    if (!validation.isValid) {
      setLocalError(validation.errorMessage)
      return
    }

    if (numericValue !== value) onChange(numericValue)
    setLocalError(undefined)
  }

  const finishEditing = () => {
    commitValue()
    setIsFocused(false)
    onBlur?.()
  }

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      finishEditing()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setInputValue(value.toString())
      setLocalError(undefined)
      setIsFocused(false)
      onBlur?.()
    }
  }

  const handleDisplayKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
    if (event.key === 'Tab') return

    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault()
      const typedValue = event.key.length === 1 ? event.key : ''
      capturedKeyRef.current = event.key.length === 1 ? event.key : null
      setInputValue(typedValue)
      setIsFocused(true)
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      capturedKeyRef.current = null
      setIsFocused(true)
    }
  }

  const displayError = hasError || Boolean(localError)
  const displayErrorMessage = errorMessage || localError
  const formattedValue = value === 0 ? '' : String(Math.round(value))
  const backgroundColor = isEdited ? 'rgba(255, 182, 193, 0.3)' : 'transparent'
  const commonSx = {
    display: 'inline-block',
    boxSizing: 'border-box',
    width: '100%',
    minWidth: 30,
    maxWidth: ASSIGNMENTS_GRID_DATE_WIDTH - 6,
    minHeight: 18,
    padding: 0,
    textAlign: 'center',
    fontSize: '0.75rem',
    lineHeight: '18px',
    borderRadius: 0,
  } as const

  if (!isEditMode) {
    return (
      <Box
        component="span"
        sx={{
          ...commonSx,
          border: '1px solid transparent',
          backgroundColor: 'transparent',
        }}
      >
        {formattedValue}
      </Box>
    )
  }

  if (isFocused) {
    const input = (
      <Box
        component="input"
        ref={inputRef}
        value={inputValue}
        onChange={(event) => {
          setInputValue(event.target.value)
          setLocalError(undefined)
        }}
        onBlur={finishEditing}
        onKeyDown={handleInputKeyDown}
        autoFocus
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        aria-label={ariaLabel}
        aria-invalid={displayError}
        sx={{
          ...commonSx,
          display: 'block',
          margin: '0 auto',
          border: `2px solid ${displayError ? '#d32f2f' : COLOR_ACCENT}`,
          outline: 'none',
          backgroundColor: isEdited ? 'rgba(255, 193, 7, 0.18)' : '#ffffff',
        }}
      />
    )

    return displayError && displayErrorMessage
      ? <Tooltip title={displayErrorMessage} arrow>{input}</Tooltip>
      : input
  }

  const display = (
    <Box
      component="span"
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-invalid={displayError}
      onClick={() => {
        setInputValue(value === 0 ? '' : String(Math.round(value)))
        capturedKeyRef.current = null
        setIsFocused(true)
      }}
      onKeyDown={handleDisplayKeyDown}
      sx={{
        ...commonSx,
        border: '1px solid transparent',
        borderBottomColor: displayError ? '#d32f2f' : 'rgba(40, 94, 130, 0.32)',
        backgroundColor: isEdited ? 'rgba(255, 193, 7, 0.18)' : backgroundColor,
        cursor: 'text',
        '&:hover': {
          backgroundColor: isEdited
            ? 'rgba(255, 193, 7, 0.24)'
            : 'rgba(40, 94, 130, 0.08)',
        },
        '&:focus': {
          outline: `2px solid ${COLOR_ACCENT}`,
          outlineOffset: '-2px',
          backgroundColor: isEdited
            ? 'rgba(255, 193, 7, 0.24)'
            : 'rgba(40, 94, 130, 0.08)',
          color: 'text.primary',
        },
      }}
    >
      {formattedValue}
    </Box>
  )

  return displayError && displayErrorMessage
    ? <Tooltip title={displayErrorMessage} arrow>{display}</Tooltip>
    : display
})

AssignmentPercentageCell.displayName = 'AssignmentPercentageCell'
