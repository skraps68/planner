import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Stack,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Add as AddIcon,
  Cancel as CancelIcon,
  Edit as EditIcon,
  ExpandLess,
  ExpandMore,
  Save as SaveIcon,
} from '@mui/icons-material'
import { useQuery } from '@tanstack/react-query'

import { nonlaborPlansApi } from '../../api/nonlaborPlans'
import { useAuth } from '../../contexts/AuthContext'
import { useUserSettings } from '../../contexts/UserSettingsContext'
import type {
  NonLaborCostTreatment,
  NonLaborPlanLine,
  Project,
  Resource,
} from '../../types'
import { hasPermission } from '../../utils/permissions'
import {
  AssignmentsGrid,
  AssignmentsGridCell as TableCell,
  ASSIGNMENTS_GRID_PRIMARY_WIDTH,
  getAssignmentsGridPeriodSx,
  getAssignmentsGridPeriodWidth,
} from './AssignmentsGrid'
import {
  buildAssignmentPeriods,
  type AssignmentPeriod,
  type AssignmentViewMode,
} from './assignmentPeriods'
import NonLaborPlanDrawer from './NonLaborPlanDrawer'


interface NonLaborAssignmentsGridProps {
  perspective: 'project' | 'resource'
  project?: Pick<Project, 'id' | 'name' | 'start_date' | 'end_date' | 'currency_code'>
  resource?: Pick<Resource, 'id' | 'name' | 'external_references'>
}

interface Group {
  id: string
  name: string
  lines: NonLaborPlanLine[]
}

interface CellChange {
  planId: string
  occurrenceId: string
  amount: number
  baseAmount: number
  source: 'MANUAL' | 'GENERATED'
}

const parseDate = (value: string) => new Date(`${value}T00:00:00.000Z`)
const dateKey = (value: Date) => value.toISOString().slice(0, 10)
const addDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}
const inclusiveDates = (start: Date, end: Date) => {
  const dates: Date[] = []
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    dates.push(new Date(cursor))
  }
  return dates
}

const formatAmount = (value: number) =>
  Math.round(value).toLocaleString('en-US', { maximumFractionDigits: 0 })

const methodLabel = (line: NonLaborPlanLine) => {
  if (line.method === 'MANUAL') return 'Manual'
  const frequency = line.frequency
    ? `${line.frequency[0]}${line.frequency.slice(1).toLowerCase()}`
    : 'Spread'
  const placement = line.period_placement === 'PERIOD_START'
    ? 'Period start'
    : 'Period end'
  return `${frequency} · ${placement}`
}

const periodValue = (
  lines: NonLaborPlanLine[],
  period: AssignmentPeriod,
  treatment?: NonLaborCostTreatment,
  changes?: Map<string, CellChange>,
) => {
  const periodDates = new Set(period.dates.map(dateKey))
  return lines.reduce((lineTotal, line) => {
    if (treatment && line.cost_treatment !== treatment) return lineTotal
    return lineTotal + line.occurrences.reduce((sum, occurrence) => {
      if (!periodDates.has(occurrence.occurrence_date)) return sum
      const change = changes?.get(`${line.id}:${occurrence.id}`)
      return sum + (change?.amount ?? Number(occurrence.effective_amount))
    }, 0)
  }, 0)
}

const amountCellSx = (period: AssignmentPeriod, value: number) => ({
  backgroundColor: period.isWeekend
    ? '#edf1f5'
    : value !== 0 ? 'action.hover' : 'background.paper',
  ...getAssignmentsGridPeriodSx(period),
})

export default function NonLaborAssignmentsGrid({
  perspective,
  project,
  resource,
}: NonLaborAssignmentsGridProps) {
  const { user } = useAuth()
  const { settings, updateSettings } = useUserSettings()
  const preferenceKey = perspective === 'project'
    ? 'nonLaborProject'
    : 'nonLaborResource'
  const preference = settings.assignmentGrids?.[preferenceKey]
  const [viewMode, setViewMode] = useState<AssignmentViewMode>(
    () => preference?.period ?? 'daily',
  )
  const [chartVisible, setChartVisible] = useState(
    () => preference?.chartVisible ?? true,
  )
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<NonLaborPlanLine | undefined>()
  const [isEditMode, setIsEditMode] = useState(false)
  const [changes, setChanges] = useState<Map<string, CellChange>>(new Map())
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const canEdit = hasPermission(user, 'manage_resources').hasPermission

  useEffect(() => {
    setViewMode(preference?.period ?? 'daily')
    setChartVisible(preference?.chartVisible ?? true)
  }, [preference?.period, preference?.chartVisible])

  const queryParams = perspective === 'project'
    ? { project_id: project?.id }
    : { resource_id: resource?.id }
  const {
    data: lines = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['nonlabor-plans', perspective, project?.id ?? resource?.id],
    queryFn: () => nonlaborPlansApi.list(queryParams),
    enabled: Boolean(project?.id ?? resource?.id),
  })

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>()
    lines.forEach((line) => {
      const id = perspective === 'project' ? line.resource_id : line.project_id
      const name = perspective === 'project' ? line.resource_name : line.project_name
      const group = map.get(id) ?? { id, name, lines: [] }
      group.lines.push(line)
      map.set(id, group)
    })
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name))
  }, [lines, perspective])

  const dates = useMemo(() => {
    const occurrenceDates = lines.flatMap((line) =>
      line.occurrences.map((occurrence) => parseDate(occurrence.occurrence_date))
    )
    let start: Date
    let end: Date
    if (perspective === 'project' && project) {
      start = parseDate(project.start_date)
      end = parseDate(project.end_date)
    } else if (occurrenceDates.length) {
      start = new Date(Math.min(...occurrenceDates.map((value) => value.getTime())))
      end = new Date(Math.max(...occurrenceDates.map((value) => value.getTime())))
    } else {
      const now = new Date()
      start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, 0))
    }
    if (occurrenceDates.length) {
      start = new Date(Math.min(start.getTime(), ...occurrenceDates.map((value) => value.getTime())))
      end = new Date(Math.max(end.getTime(), ...occurrenceDates.map((value) => value.getTime())))
    }
    return inclusiveDates(start, end)
  }, [lines, perspective, project])

  const periods = useMemo(
    () => buildAssignmentPeriods(dates, viewMode),
    [dates, viewMode],
  )
  const totalValues = useMemo(
    () => periods.map((period) => periodValue(lines, period, undefined, changes)),
    [lines, periods, changes],
  )
  const capitalValues = useMemo(
    () => periods.map((period) =>
      periodValue(lines, period, 'CAPITAL', changes)
    ),
    [lines, periods, changes],
  )
  const expenseValues = useMemo(
    () => periods.map((period) =>
      periodValue(lines, period, 'EXPENSE', changes)
    ),
    [lines, periods, changes],
  )
  const maxFormattedLength = Math.max(
    1,
    ...totalValues.map((value) => formatAmount(value).length),
    ...lines.flatMap((line) =>
      periods.map((period) => formatAmount(periodValue([line], period, undefined, changes)).length)
    ),
  )
  const periodWidth = Math.min(
    116,
    Math.max(getAssignmentsGridPeriodWidth(viewMode), maxFormattedLength * 7 + 12),
  )
  const warnings = [...new Set(lines.flatMap((line) => line.warnings))]

  const handleViewModeChange = (nextMode: AssignmentViewMode) => {
    setViewMode(nextMode)
    updateSettings({
      assignmentGrids: {
        [preferenceKey]: { period: nextMode },
      },
    })
  }

  const handleChartVisibility = (visible: boolean) => {
    setChartVisible(visible)
    updateSettings({
      assignmentGrids: {
        [preferenceKey]: { chartVisible: visible },
      },
    })
  }

  const handleEdit = () => {
    setViewMode('daily')
    setChanges(new Map())
    setIsEditMode(true)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setSaveError(null)
      const byPlan = new Map<string, CellChange[]>()
      changes.forEach((change) => {
        byPlan.set(change.planId, [...(byPlan.get(change.planId) ?? []), change])
      })
      for (const [planId, planChanges] of byPlan) {
        let current = lines.find((line) => line.id === planId)!
        for (const change of planChanges) {
          const amount = change.source === 'GENERATED'
            && Math.abs(change.amount - change.baseAmount) < 0.000_001
            ? null
            : change.amount
          current = await nonlaborPlansApi.setOverride(
            planId,
            change.occurrenceId,
            amount,
            current.version,
          )
        }
      }
      setChanges(new Map())
      setIsEditMode(false)
      await refetch()
    } catch (saveFailure: unknown) {
      setSaveError(
        (saveFailure as { response?: { data?: { detail?: string } } })
          ?.response?.data?.detail
          || 'Unable to save non-labor amounts.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (isLoading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  }
  if (error) return <Alert severity="error">Failed to load non-labor cost plans.</Alert>

  return (
    <Box>
      {warnings.map((warning) => (
        <Alert key={warning} severity="warning" sx={{ mb: 1 }}>{warning}</Alert>
      ))}
      {saveError && <Alert severity="error" sx={{ mb: 1 }}>{saveError}</Alert>}
      <Paper sx={{ p: 1 }}>
        <AssignmentsGrid
          ariaLabel="Non-labor assignment calendar"
          periods={periods}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          primaryHeader={perspective === 'project' ? 'Resource' : 'Project'}
          primaryHeaderAriaLabel={
            perspective === 'project' ? 'Non-labor resource name' : 'Project name'
          }
          typeColumnWidth={68}
          scrollContainerRef={scrollRef}
          isEditMode={isEditMode}
          disableViewModeChange={isEditMode}
          periodWidthOverride={periodWidth}
          viewSummary={`${viewMode.toUpperCase()} VIEW · SUM OF CASH FLOWS`}
          chartConfig={{
            title: 'Non-Labor forecast over time',
            subtitle: 'Stacked cash-flow amounts',
            seriesLabel: 'Total forecast',
            values: totalValues,
            stackedSeries: [
              {
                label: 'Capital',
                values: capitalValues,
                fill: 'rgba(63, 115, 169, 0.28)',
              },
              {
                label: 'Expense',
                values: expenseValues,
                fill: 'rgba(183, 121, 31, 0.24)',
              },
            ],
            valueFormatter: (value) => `$${formatAmount(value)}`,
          }}
          chartVisible={chartVisible}
          onChartVisibilityChange={handleChartVisibility}
          toolbarActions={canEdit ? (
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  setSelectedPlan(undefined)
                  setDrawerOpen(true)
                }}
                disabled={saving}
              >
                Add Cost Plan
              </Button>
              {!isEditMode ? (
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={handleEdit}
                  disabled={lines.length === 0}
                >
                  Edit
                </Button>
              ) : (
                <>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<CancelIcon />}
                    disabled={saving}
                    onClick={() => {
                      setChanges(new Map())
                      setIsEditMode(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
                    disabled={saving || changes.size === 0}
                    onClick={handleSave}
                  >
                    Save Changes
                  </Button>
                </>
              )}
            </Stack>
          ) : undefined}
        >
          <TableRow>
            <TableCell sx={{
              position: 'sticky',
              left: 0,
              zIndex: 2,
              backgroundColor: '#e8f5e9',
              fontWeight: 'bold',
              textAlign: 'left !important',
            }}>
              Total Forecast
            </TableCell>
            <TableCell sx={{
              position: 'sticky',
              left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
              zIndex: 2,
              backgroundColor: '#e8f5e9',
              fontWeight: 'bold',
              textAlign: 'center !important',
            }}>
              $
            </TableCell>
            {periods.map((period, index) => (
              <TableCell
                key={period.key}
                sx={{
                  backgroundColor: period.isWeekend ? '#dfeae3' : '#e8f5e9',
                  fontWeight: 'bold',
                  ...getAssignmentsGridPeriodSx(period),
                }}
              >
                {totalValues[index] ? formatAmount(totalValues[index]) : ''}
              </TableCell>
            ))}
          </TableRow>

          {groups.map((group) => {
            const open = expanded.has(group.id)
            return (
              <React.Fragment key={group.id}>
                {(['CAPITAL', 'EXPENSE'] as NonLaborCostTreatment[]).map((treatmentValue, treatmentIndex) => (
                  <TableRow key={`${group.id}-${treatmentValue}`}>
                    {treatmentIndex === 0 && (
                      <TableCell
                        rowSpan={2}
                        sx={{
                          position: 'sticky',
                          left: 0,
                          zIndex: 2,
                          backgroundColor: 'background.paper',
                          textAlign: 'left !important',
                          verticalAlign: 'middle',
                        }}
                      >
                        <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
                          <IconButton
                            size="small"
                            onClick={() => setExpanded((current) => {
                              const next = new Set(current)
                              if (next.has(group.id)) next.delete(group.id)
                              else next.add(group.id)
                              return next
                            })}
                            aria-label={`${open ? 'Collapse' : 'Expand'} ${group.name}`}
                          >
                            {open ? <ExpandLess fontSize="small" /> : <ExpandMore fontSize="small" />}
                          </IconButton>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography
                              variant="body2"
                              color="primary"
                              fontWeight={600}
                              noWrap
                              title={group.name}
                            >
                              {group.name}
                            </Typography>
                            <Chip
                              size="small"
                              label={`${group.lines.length} line${group.lines.length === 1 ? '' : 's'}`}
                              sx={{ height: 17, fontSize: '0.62rem' }}
                            />
                          </Box>
                        </Box>
                      </TableCell>
                    )}
                    <TableCell sx={{
                      position: 'sticky',
                      left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                      zIndex: 2,
                      backgroundColor: 'background.paper',
                      textAlign: 'left !important',
                    }}>
                      {treatmentValue === 'CAPITAL' ? 'Cap $' : 'Exp $'}
                    </TableCell>
                    {periods.map((period) => {
                      const value = periodValue(group.lines, period, treatmentValue, changes)
                      return (
                        <TableCell key={period.key} sx={amountCellSx(period, value)}>
                          {value ? formatAmount(value) : ''}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}

                {open && group.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell sx={{
                      position: 'sticky',
                      left: 0,
                      zIndex: 2,
                      backgroundColor: '#fafbfd',
                      pl: '28px !important',
                      textAlign: 'left !important',
                    }}>
                      <Typography variant="caption" display="block" noWrap title={line.name}>
                        <Box
                          component="span"
                          sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}
                        >
                          <Box
                            component="span"
                            sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            {line.name}
                          </Box>
                          {canEdit && !isEditMode && (
                            <Tooltip title={`Edit ${line.name}`} arrow>
                              <IconButton
                                size="small"
                                aria-label={`Edit cost plan ${line.name}`}
                                onClick={() => {
                                  setSelectedPlan(line)
                                  setDrawerOpen(true)
                                }}
                                sx={{ ml: 'auto', p: 0.25 }}
                              >
                                <EditIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Typography>
                      <Chip
                        size="small"
                        label={methodLabel(line)}
                        sx={{ height: 16, fontSize: '0.58rem' }}
                      />
                    </TableCell>
                    <TableCell sx={{
                      position: 'sticky',
                      left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                      zIndex: 2,
                      backgroundColor: '#fafbfd',
                      textAlign: 'left !important',
                    }}>
                      {line.cost_treatment === 'CAPITAL' ? 'Cap $' : 'Exp $'}
                    </TableCell>
                    {periods.map((period) => {
                      const value = periodValue([line], period, undefined, changes)
                      const occurrence = viewMode === 'daily'
                        ? line.occurrences.find((item) =>
                            item.occurrence_date === dateKey(period.dates[0])
                          )
                        : undefined
                      const changeKey = occurrence ? `${line.id}:${occurrence.id}` : ''
                      const changed = changeKey ? changes.get(changeKey) : undefined
                      return (
                        <TableCell key={period.key} sx={amountCellSx(period, value)}>
                          {isEditMode && occurrence ? (
                            <TextField
                              variant="standard"
                              value={changed?.amount ?? Number(occurrence.effective_amount)}
                              type="number"
                              inputProps={{
                                min: 0,
                                step: '0.0001',
                                'aria-label': `${line.name} amount for ${period.ariaLabel}`,
                              }}
                              onFocus={(event) => event.target.select()}
                              onChange={(event) => {
                                const amount = Math.max(0, Number(event.target.value || 0))
                                setChanges((current) => {
                                  const next = new Map(current)
                                  next.set(changeKey, {
                                    planId: line.id,
                                    occurrenceId: occurrence.id,
                                    amount,
                                    baseAmount: Number(occurrence.base_amount),
                                    source: occurrence.source,
                                  })
                                  return next
                                })
                              }}
                              sx={{
                                width: '100%',
                                '& input': {
                                  p: 0,
                                  textAlign: 'center',
                                  fontSize: '0.75rem',
                                },
                              }}
                            />
                          ) : value ? formatAmount(value) : ''}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))}
              </React.Fragment>
            )
          })}

          {groups.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={Math.max(2, periods.length + 2)}
                sx={{ py: 2, color: 'text.secondary', textAlign: 'center !important' }}
              >
                No non-labor cost plans. Use Add Cost Plan to create the first forecast.
              </TableCell>
            </TableRow>
          )}
        </AssignmentsGrid>
      </Paper>

      <NonLaborPlanDrawer
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false)
          setSelectedPlan(undefined)
        }}
        onSaved={() => refetch()}
        fixedProject={project ? {
          id: project.id,
          name: project.name,
          start_date: project.start_date,
          end_date: project.end_date,
          currency_code: project.currency_code,
        } : undefined}
        fixedResource={resource}
        initialPlan={selectedPlan}
      />
    </Box>
  )
}
