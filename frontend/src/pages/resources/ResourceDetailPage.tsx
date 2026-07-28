import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { truncateAtLoop } from '../../utils/breadcrumbs'
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  Snackbar,
  TableRow,
  FormControl,
  InputLabel,
  IconButton,
  Select,
  MenuItem,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
  DeleteOutline as DeleteIcon,
} from '@mui/icons-material'
import { resourcesApi, ResourceUpdateInput } from '../../api/resources'
import { externalReferenceTypesApi } from '../../api/externalReferenceTypes'
import { projectsApi } from '../../api/projects'
import { resourceRolesApi } from '../../api/resourceRoles'
import { assignmentsApi, BulkAssignmentUpdate, BulkUpdateResult } from '../../api/assignments'
import {
  ExternalReferenceType,
  Project,
  Resource,
  ResourceAssignment,
  ResourceRole,
} from '../../types'
import WorkerSearchAutocomplete from '../../components/resources/WorkerSearchAutocomplete'
import { AssignmentEntityAutocomplete } from '../../components/resources/AssignmentEntityAutocomplete'
import { AssignmentDraftRows } from '../../components/resources/AssignmentDraftRows'
import PageHeader from '../../components/common/PageHeader'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission } from '../../utils/permissions'
import { validatePercentage } from '../../utils/cellValidation'
import { usePresence } from '../../realtime/usePresence'
import { PresenceBadge } from '../../realtime/PresenceBadge'
import { useEntityLock } from '../../realtime/useEntityLock'
import { LockBanner } from '../../realtime/LockBanner'
import {
  AssignmentsGrid,
  AssignmentPercentageCell,
  AssignmentsGridCell as TableCell,
  ASSIGNMENTS_GRID_PRIMARY_WIDTH,
  ASSIGNMENTS_GRID_TYPE_WIDTH,
  ASSIGNMENTS_GRID_TOTAL_WEEKEND_BG,
  ASSIGNMENTS_GRID_WEEKEND_BG,
  getAssignmentsGridPeriodSx,
  getAssignmentsGridPeriodWidth,
} from '../../components/resources/AssignmentsGrid'
import NonLaborAssignmentsGrid from '../../components/resources/NonLaborAssignmentsGrid'
import {
  averageAssignmentPeriod,
  buildAssignmentPeriods,
  formatAssignmentAverage,
  type AssignmentViewMode,
} from '../../components/resources/assignmentPeriods'
import { assignmentKeys, useResourceAssignments } from '../../hooks/useAssignments'
import { useUserSettings } from '../../contexts/UserSettingsContext'

// ─── Resource Allocation Calendar ───────────────────────────────────────────

interface ProjectRow {
  projectId: string
  projectName: string
}

interface ResourceReferenceDraft {
  reference_type_id: string
  reference_type_name?: string
  value: string
}

interface DraftProjectTimelineShift {
  direction: 'past' | 'future'
  targetDate: string
}

function getDraftProjectTimelineShift(
  assignments: ResourceAssignment[],
  draftProject: Project | null,
): DraftProjectTimelineShift | null {
  if (
    assignments.length === 0
    || !draftProject?.start_date
    || !draftProject.end_date
  ) {
    return null
  }

  const assignmentDates = assignments
    .map((assignment) => assignment.assignment_date)
    .sort()
  const timelineStart = assignmentDates[0]
  const timelineEnd = assignmentDates[assignmentDates.length - 1]

  if (draftProject.end_date < timelineStart) {
    return { direction: 'past', targetDate: draftProject.end_date }
  }
  if (draftProject.start_date > timelineEnd) {
    return { direction: 'future', targetDate: draftProject.start_date }
  }
  return null
}

/**
 * Generates a sorted, deduplicated list of UTC date strings from assignments
 */
function buildDateRange(
  assignments: ResourceAssignment[],
  draftProject: Project | null = null,
): Date[] {
  const dateSet = new Set<string>()
  assignments.forEach((a) => dateSet.add(a.assignment_date))
  const timelineShift = getDraftProjectTimelineShift(assignments, draftProject)
  if (
    draftProject?.start_date
    && draftProject.end_date
    && (dateSet.size === 0 || timelineShift)
  ) {
    const [startYear, startMonth, startDay] = draftProject.start_date.split('-').map(Number)
    const [endYear, endMonth, endDay] = draftProject.end_date.split('-').map(Number)
    const cursor = new Date(Date.UTC(startYear, startMonth - 1, startDay))
    const end = new Date(Date.UTC(endYear, endMonth - 1, endDay))
    while (cursor <= end) {
      dateSet.add(dateKey(cursor))
      cursor.setUTCDate(cursor.getUTCDate() + 1)
    }
  }
  const sourceDates = Array.from(dateSet)
    .sort()
    .map((d) => {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, day))
    })
  return buildAssignmentPeriods(sourceDates, 'daily').map((period) => period.dates[0])
}

function dateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface BreadcrumbItem {
  label: string
  path?: string
  state?: any
}

// ─── Resource Allocation Calendar ────────────────────────────────────────────

const ResourceAllocationCalendar: React.FC<{
  resourceId: string
  allowAddProject: boolean
  resourceBreadcrumbItems?: BreadcrumbItem[]
}> = ({ resourceId, allowAddProject, resourceBreadcrumbItems }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { settings, updateSettings } = useUserSettings()
  const canEdit = useMemo(() => hasPermission(user, 'manage_resources').hasPermission, [user])

  const { data: assignments = [], isLoading, error } = useResourceAssignments(resourceId)

  const [isEditMode, setIsEditMode] = useState(false)
  const [viewMode, setViewMode] = useState<AssignmentViewMode>(
    () => settings.assignmentGrids?.resource?.period ?? 'daily',
  )
  const [chartVisible, setChartVisible] = useState(
    () => settings.assignmentGrids?.resource?.chartVisible ?? true,
  )
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const { state: lockState, holder: lockHolder, takeOver: takeOverLock } = useEntityLock(
    'resource',
    resourceId,
    isEditMode,
  )
  // Advisory: while blocked, render the calendar read-only even though the
  // user has clicked "Edit" (isEditMode stays true so the hook keeps trying
  // to acquire); the L1 bulk-conflict handling above remains the backstop.
  const effectiveEditMode = isEditMode && lockState !== 'blocked'
  const [isSaving, setIsSaving] = useState(false)
  // editedCells key: "${projectId}:${dateStr}:capital|expense"
  const [editedCells, setEditedCells] = useState<Map<string, number>>(new Map())
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isAddingProject, setIsAddingProject] = useState(false)
  const [draftProject, setDraftProject] = useState<Project | null>(null)
  const lastTimelineShiftRef = React.useRef<string | null>(null)

  useEffect(() => {
    setViewMode(settings.assignmentGrids?.resource?.period ?? 'daily')
    setChartVisible(settings.assignmentGrids?.resource?.chartVisible ?? true)
  }, [
    settings.assignmentGrids?.resource?.period,
    settings.assignmentGrids?.resource?.chartVisible,
  ])

  const ck = (projectId: string, dateStr: string, type: 'capital' | 'expense') =>
    `${projectId}:${dateStr}:${type}`

  const assignedProjectIds = useMemo(
    () => new Set(assignments.map((assignment) => assignment.project_id)),
    [assignments],
  )

  const searchProjects = useCallback(async (query: string) => {
    const response = await projectsApi.list({ search: query, page: 1, size: 100 })
    return response.items.filter((project) => !assignedProjectIds.has(project.id))
  }, [assignedProjectIds])

  const draftProjectTimelineShift = useMemo(
    () => getDraftProjectTimelineShift(assignments, draftProject),
    [assignments, draftProject],
  )

  const { dates, projects, cellMap } = useMemo(() => {
    const dates = buildDateRange(assignments, draftProject)
    const projectMap = new Map<string, string>()
    assignments.forEach((a) => {
      if (!projectMap.has(a.project_id))
        projectMap.set(a.project_id, (a as any).project_name || a.project_id)
    })
    const existingProjects: ProjectRow[] = Array.from(projectMap.entries()).map(([id, name]) => ({
      projectId: id,
      projectName: name,
    }))
    const projects = draftProject && !projectMap.has(draftProject.id)
      ? [
          { projectId: draftProject.id, projectName: draftProject.name },
          ...existingProjects,
        ]
      : existingProjects
    const cellMap = new Map<string, { capital: number; expense: number }>()
    assignments.forEach((a) => {
      cellMap.set(`${a.project_id}::${a.assignment_date}`, {
        capital: Math.round(Number(a.capital_percentage)),
        expense: Math.round(Number(a.expense_percentage)),
      })
    })
    return { dates, projects, cellMap }
  }, [assignments, draftProject])

  const periods = useMemo(
    () => buildAssignmentPeriods(dates, viewMode),
    [dates, viewMode],
  )

  useEffect(() => {
    if (!draftProject || !draftProjectTimelineShift || viewMode !== 'daily') {
      lastTimelineShiftRef.current = null
      return
    }

    const shiftKey = [
      draftProject.id,
      draftProjectTimelineShift.direction,
      draftProjectTimelineShift.targetDate,
    ].join(':')
    if (lastTimelineShiftRef.current === shiftKey) return

    const frame = requestAnimationFrame(() => {
      const container = scrollContainerRef.current
      if (!container) return

      const targetIndex = periods.findIndex(
        (period) => dateKey(period.dates[0]) === draftProjectTimelineShift.targetDate,
      )
      if (targetIndex < 0) return

      const periodWidth = getAssignmentsGridPeriodWidth('daily')
      if (draftProjectTimelineShift.direction === 'past') {
        const visibleTimelineWidth = Math.max(
          periodWidth,
          container.clientWidth
            - ASSIGNMENTS_GRID_PRIMARY_WIDTH
            - ASSIGNMENTS_GRID_TYPE_WIDTH,
        )
        container.scrollLeft = Math.max(
          0,
          (targetIndex + 1) * periodWidth - visibleTimelineWidth,
        )
      } else {
        container.scrollLeft = targetIndex * periodWidth
      }
      lastTimelineShiftRef.current = shiftKey
    })

    return () => cancelAnimationFrame(frame)
  }, [draftProject, draftProjectTimelineShift, periods, viewMode])

  const handleViewModeChange = useCallback((nextMode: AssignmentViewMode) => {
    if (isEditMode || nextMode === viewMode) return

    const currentWidth = getAssignmentsGridPeriodWidth(viewMode)
    const visibleIndex = Math.max(
      0,
      Math.floor((scrollContainerRef.current?.scrollLeft ?? 0) / currentWidth),
    )
    const anchorDate = periods[Math.min(visibleIndex, periods.length - 1)]?.dates[0]

    setViewMode(nextMode)
    updateSettings({ assignmentGrids: { resource: { period: nextMode } } })

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current || !anchorDate) return
      const nextPeriods = buildAssignmentPeriods(dates, nextMode)
      const nextIndex = nextPeriods.findIndex((period) =>
        period.dates.some((date) => date.getTime() === anchorDate.getTime()),
      )
      scrollContainerRef.current.scrollLeft =
        Math.max(0, nextIndex) * getAssignmentsGridPeriodWidth(nextMode)
    })
  }, [dates, isEditMode, periods, updateSettings, viewMode])

  const getStored = (projectId: string, date: Date, type: 'capital' | 'expense'): number => {
    const cell = cellMap.get(`${projectId}::${dateKey(date)}`)
    return cell ? cell[type] : 0
  }

  const getCell = (projectId: string, date: Date, type: 'capital' | 'expense'): number => {
    const key = ck(projectId, dateKey(date), type)
    return editedCells.has(key) ? editedCells.get(key)! : getStored(projectId, date, type)
  }

  const handleEditAssignments = useCallback(() => {
    setViewMode('daily')
    setIsEditMode(true)
  }, [])

  const handleAddProject = useCallback(() => {
    if (!canEdit || !allowAddProject) return
    setViewMode('daily')
    setIsEditMode(true)
    setIsAddingProject(true)
    setDraftProject(null)
    setSaveError(null)
  }, [allowAddProject, canEdit])

  const handleDraftProjectChange = useCallback((project: Project | null) => {
    if (draftProject?.id && draftProject.id !== project?.id) {
      setEditedCells((edits) => new Map(
        Array.from(edits).filter(([key]) => !key.startsWith(`${draftProject.id}:`)),
      ))
      setValidationErrors((errors) => new Map(
        Array.from(errors).filter(([key]) => !key.startsWith(`${draftProject.id}:`)),
      ))
    }
    setDraftProject(project)
  }, [draftProject])

  const handleCellChange = useCallback((projectId: string, dateStr: string, type: 'capital' | 'expense', value: number) => {
    const key = ck(projectId, dateStr, type)
    setEditedCells((prev) => {
      const next = new Map(prev)
      const cell = cellMap.get(`${projectId}::${dateStr}`)
      const old = cell ? cell[type] : 0
      if (Math.round(value) === old) { next.delete(key) } else { next.set(key, value) }
      return next
    })
    setValidationErrors((prev) => { const next = new Map(prev); next.delete(key); return next })
  }, [cellMap])

  const handleCancel = useCallback(() => {
    setEditedCells(new Map())
    setValidationErrors(new Map())
    setIsAddingProject(false)
    setDraftProject(null)
    setIsEditMode(false)
    setSaveError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (editedCells.size === 0) { setIsEditMode(false); return }

    const errors = new Map<string, string>()

    // 1. Basic range validation (0–100 per cell)
    for (const [key, value] of editedCells) {
      const r = validatePercentage(value)
      if (!r.isValid) errors.set(key, r.errorMessage || 'Invalid')
    }

    // 2. Per-project: capital + expense ≤ 100 per project-date
    //    Build effective values (stored + edits) for every project × date we might touch
    const effectiveByProjectDate = new Map<string, { capital: number; expense: number }>()
    for (const date of dates) {
      const dStr = dateKey(date)
      for (const project of projects) {
        const capKey = ck(project.projectId, dStr, 'capital')
        const expKey = ck(project.projectId, dStr, 'expense')
        const stored = cellMap.get(`${project.projectId}::${dStr}`)
        const cap = editedCells.has(capKey) ? editedCells.get(capKey)! : (stored?.capital ?? 0)
        const exp = editedCells.has(expKey) ? editedCells.get(expKey)! : (stored?.expense ?? 0)
        effectiveByProjectDate.set(`${project.projectId}:${dStr}`, { capital: cap, expense: exp })
        if (cap + exp > 100) {
          const msg = `Capital + expense cannot exceed 100% for "${project.projectName}" on this date (would be ${Math.round(cap + exp)}%)`
          if (editedCells.has(capKey)) errors.set(capKey, msg)
          if (editedCells.has(expKey)) errors.set(expKey, msg)
        }
      }
    }

    // 3. Cross-project: total across all projects ≤ 100 per date
    for (const date of dates) {
      const dStr = dateKey(date)
      const total = projects.reduce((sum, p) => {
        const v = effectiveByProjectDate.get(`${p.projectId}:${dStr}`) ?? { capital: 0, expense: 0 }
        return sum + v.capital + v.expense
      }, 0)
      if (total > 100) {
        const msg = `Total allocation across all projects exceeds 100% on this date (would be ${Math.round(total)}%)`
        for (const project of projects) {
          const capKey = ck(project.projectId, dStr, 'capital')
          const expKey = ck(project.projectId, dStr, 'expense')
          if (editedCells.has(capKey) && !errors.has(capKey)) errors.set(capKey, msg)
          if (editedCells.has(expKey) && !errors.has(expKey)) errors.set(expKey, msg)
        }
      }
    }

    if (errors.size > 0) { setValidationErrors(errors); return }

    setIsSaving(true)
    try {
      // Group edits by project:date
      const grouped = new Map<string, { capital?: number; expense?: number }>()
      for (const [key, value] of editedCells) {
        const [projectId, dateStr, type] = key.split(':')
        const gk = `${projectId}:${dateStr}`
        if (!grouped.has(gk)) grouped.set(gk, {})
        grouped.get(gk)![type as 'capital' | 'expense'] = value
      }

      const bulkUpdates: BulkAssignmentUpdate[] = []
      const createPromises: Array<ReturnType<typeof assignmentsApi.create>> = []
      for (const [gk, edits] of grouped) {
        const [projectId, dateStr] = gk.split(':')
        const existing = assignments.find(
          (a) => a.project_id === projectId && a.assignment_date === dateStr
        )
        const cell = cellMap.get(`${projectId}::${dateStr}`)
        const capitalPercentage = Math.round(edits.capital ?? cell?.capital ?? 0)
        const expensePercentage = Math.round(edits.expense ?? cell?.expense ?? 0)
        if (existing) {
          bulkUpdates.push({
            id: existing.id,
            capital_percentage: capitalPercentage,
            expense_percentage: expensePercentage,
            version: existing.version ?? 1,
          })
        } else {
          createPromises.push(assignmentsApi.create({
            resource_id: resourceId,
            project_id: projectId,
            assignment_date: dateStr,
            capital_percentage: capitalPercentage,
            expense_percentage: expensePercentage,
          }))
        }
      }

      let bulkResult: BulkUpdateResult = { succeeded: [], failed: [] }
      if (bulkUpdates.length > 0) {
        bulkResult = await assignmentsApi.bulkUpdate(bulkUpdates)
      }
      const createResults = await Promise.all(createPromises)

      // Refresh so any successful updates (and up-to-date versions for
      // conflicting ones) are reflected before we decide what to keep.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: assignmentKeys.byResource(resourceId) }),
        queryClient.invalidateQueries({ queryKey: ['forecast'] }),
      ])

      if (bulkResult.failed.length > 0) {
        // Partial failure: keep only the conflicting cells in edit mode so
        // the user can review and re-save them; non-conflicting edits are
        // already persisted, so drop them from editedCells.
        const failedIds = new Set(bulkResult.failed.map((f) => f.id))
        const nextEdits = new Map<string, number>()
        const nextErrors = new Map<string, string>()
        for (const [key, value] of editedCells) {
          const [projectId, dateStr] = key.split(':')
          const existing = assignments.find(
            (a) => a.project_id === projectId && a.assignment_date === dateStr
          )
          if (existing && failedIds.has(existing.id)) {
            nextEdits.set(key, value)
            nextErrors.set(key, 'Changed by someone else — review and re-save')
          }
        }
        setEditedCells(nextEdits)
        setValidationErrors(nextErrors)
        setSaveError(
          `${bulkResult.failed.length} change(s) conflicted with edits by another user and were kept for review.`
        )
        if (draftProject && createResults.some(
          (created) => created.project_id === draftProject.id,
        )) {
          setIsAddingProject(false)
          setDraftProject(null)
        }
        // Stay in edit mode — do not clear edits or exit.
      } else {
        setEditedCells(new Map())
        setValidationErrors(new Map())
        setIsAddingProject(false)
        setDraftProject(null)
        setIsEditMode(false)
        setSaveSuccess(true)
      }
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || 'Failed to save assignments')
    } finally {
      setIsSaving(false)
    }
  }, [
    editedCells,
    assignments,
    cellMap,
    dates,
    projects,
    queryClient,
    resourceId,
    draftProject,
  ])

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (error) return <Alert severity="error">Failed to load assignments</Alert>
  const hasEdits = editedCells.size > 0
  const allocationChartValues = periods.map((period) =>
    averageAssignmentPeriod(
      period,
      (date) => projects.reduce(
        (sum, project) =>
          sum
          + getCell(project.projectId, date, 'capital')
          + getCell(project.projectId, date, 'expense'),
        0,
      ),
    ),
  )

  return (
    <Paper sx={{ p: 1 }}>
      {draftProjectTimelineShift && (
        <Alert severity="warning" sx={{ mb: 1 }}>
          {draftProjectTimelineShift.direction === 'past'
            ? 'Dates shifted to show the end of this past project.'
            : 'Dates shifted to show the start of this future project.'}
        </Alert>
      )}
      <AssignmentsGrid
        ariaLabel="Resource assignment calendar"
        periods={periods}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        primaryHeader="Project"
        primaryHeaderAriaLabel="Project name"
        scrollContainerRef={scrollContainerRef}
        isEditMode={effectiveEditMode}
        disableViewModeChange={isEditMode}
        chartConfig={{
          title: 'Allocation over time',
          subtitle: 'Total Allocation %',
          seriesLabel: 'Total allocation',
          values: allocationChartValues,
          valueFormatter: (value) => `${formatAssignmentAverage(value) || '0'}%`,
          capacityLimit: 100,
          availableCapacityLabel: 'Available capacity',
        }}
        chartVisible={chartVisible}
        onChartVisibilityChange={(visible) => {
          setChartVisible(visible)
          updateSettings({
            assignmentGrids: { resource: { chartVisible: visible } },
          })
        }}
        toolbarActions={(canEdit || isEditMode) ? (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
            {!isEditMode ? (
              <>
                {allowAddProject && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddProject}
                  >
                    Add Project
                  </Button>
                )}
                <Button
                  variant="contained"
                  size="small"
                  startIcon={<EditIcon />}
                  onClick={handleEditAssignments}
                >
                  Edit
                </Button>
              </>
            ) : lockState === 'blocked' ? (
              <Button variant="outlined" size="small" onClick={handleCancel}>
                Close
              </Button>
            ) : (
              <>
                {allowAddProject && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddProject}
                    disabled={isSaving || isAddingProject}
                  >
                    Add Project
                  </Button>
                )}
                <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleCancel} disabled={isSaving}>
                  Cancel
                </Button>
                <Button variant="contained" size="small" startIcon={isSaving ? <CircularProgress size={14} /> : <SaveIcon />}
                  onClick={handleSave} disabled={isSaving || !hasEdits || (isAddingProject && !draftProject)}>
                  Save Changes
                </Button>
              </>
            )}
          </Box>
        ) : undefined}
      >
              {/* Total Allocation row */}
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e8f5e9', fontWeight: 'bold', borderRight: '1px solid', borderColor: 'divider', textAlign: 'left !important' }}>
                  Total Allocation
                </TableCell>
                <TableCell sx={{ position: 'sticky', left: ASSIGNMENTS_GRID_PRIMARY_WIDTH, zIndex: 2, backgroundColor: '#e8f5e9', fontWeight: 'bold', borderRight: '1px solid', borderColor: 'divider', textAlign: 'center !important' }}>
                  {viewMode === 'daily' ? '%' : 'Avg %'}
                </TableCell>
                {periods.map((period, index) => {
                  const total = allocationChartValues[index]
                  const formatted = formatAssignmentAverage(total)
                  const color = total > 100
                    ? '#d32f2f'
                    : Math.abs(total - 100) < 0.000_001
                      ? '#000000'
                      : total > 0 ? '#2e7d32' : undefined
                  return (
                    <TableCell key={period.key} align="center" sx={{
                      backgroundColor: period.isWeekend ? ASSIGNMENTS_GRID_TOTAL_WEEKEND_BG : '#e8f5e9',
                      fontWeight: 'bold',
                      ...getAssignmentsGridPeriodSx(period),
                    }}>
                      {formatted && <span style={{ fontSize: '0.875rem', color }}>{formatted}</span>}
                    </TableCell>
                  )
                })}
              </TableRow>

              {isAddingProject && !draftProject && (
                <AssignmentDraftRows
                  periods={periods}
                  selector={
                      <AssignmentEntityAutocomplete
                        value={null}
                        onChange={handleDraftProjectChange}
                        searchOptions={searchProjects}
                        getOptionLabel={(project) =>
                          project.business_id
                            ? `${project.business_id} · ${project.name}`
                            : project.name
                        }
                        ariaLabel="Choose project to add"
                        placeholder="Choose project…"
                        entityPlural="projects"
                        autoFocus
                      />
                  }
                />
              )}

              {/* One pair of rows per project */}
              {projects.map((project) => (
                <React.Fragment key={project.projectId}>
                  <TableRow>
                    <TableCell rowSpan={2} sx={{
                      position: 'sticky', left: 0, zIndex: 2,
                      backgroundColor: 'background.paper', fontWeight: 'medium',
                      borderRight: '1px solid', borderColor: 'divider',
                      verticalAlign: 'middle',
                      textAlign: 'left !important',
                    }}>
                      {isAddingProject && draftProject?.id === project.projectId ? (
                        <AssignmentEntityAutocomplete
                          value={draftProject}
                          onChange={handleDraftProjectChange}
                          searchOptions={searchProjects}
                          getOptionLabel={(option) =>
                            option.business_id
                              ? `${option.business_id} · ${option.name}`
                              : option.name
                          }
                          ariaLabel="Choose project to add"
                          placeholder="Choose project…"
                          entityPlural="projects"
                        />
                      ) : (
                        <Typography variant="body2" fontWeight="medium" component="a"
                          onClick={() => navigate(`/projects/${project.projectId}?tab=1`, {
                            state: resourceBreadcrumbItems ? { fromResourceBreadcrumbs: resourceBreadcrumbItems } : undefined,
                          })}
                          sx={{ color: 'primary.main', textDecoration: 'underline', cursor: 'pointer' }}
                        >
                          {project.projectName}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell sx={{ position: 'sticky', left: ASSIGNMENTS_GRID_PRIMARY_WIDTH, zIndex: 2, backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', textAlign: 'left !important' }}>
                      <Typography variant="caption" color="primary">Cap %</Typography>
                    </TableCell>
                    {periods.map((period) => {
                      const date = period.dates[0]
                      const dStr = dateKey(date)
                      const val = averageAssignmentPeriod(
                        period,
                        (periodDate) => getCell(project.projectId, periodDate, 'capital'),
                      )
                      const key = ck(project.projectId, dStr, 'capital')
                      return (
                        <TableCell key={period.key} align="center" sx={{
                          backgroundColor: period.isWeekend
                            ? ASSIGNMENTS_GRID_WEEKEND_BG
                            : val > 0 ? 'action.hover' : 'background.paper',
                          ...getAssignmentsGridPeriodSx(period),
                        }}>
                          {viewMode === 'daily' ? (
                            <AssignmentPercentageCell
                              value={val}
                              isEditMode={effectiveEditMode}
                              isEdited={editedCells.has(key)}
                              hasError={validationErrors.has(key)}
                              errorMessage={validationErrors.get(key)}
                              onChange={(v) => handleCellChange(project.projectId, dStr, 'capital', v)}
                            />
                          ) : formatAssignmentAverage(val)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ position: 'sticky', left: ASSIGNMENTS_GRID_PRIMARY_WIDTH, zIndex: 2, backgroundColor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', textAlign: 'left !important' }}>
                      <Typography variant="caption" color="secondary">Exp %</Typography>
                    </TableCell>
                    {periods.map((period) => {
                      const date = period.dates[0]
                      const dStr = dateKey(date)
                      const val = averageAssignmentPeriod(
                        period,
                        (periodDate) => getCell(project.projectId, periodDate, 'expense'),
                      )
                      const key = ck(project.projectId, dStr, 'expense')
                      return (
                        <TableCell key={period.key} align="center" sx={{
                          backgroundColor: period.isWeekend
                            ? ASSIGNMENTS_GRID_WEEKEND_BG
                            : val > 0 ? 'action.hover' : 'background.paper',
                          borderColor: 'divider',
                          ...getAssignmentsGridPeriodSx(period),
                        }}>
                          {viewMode === 'daily' ? (
                            <AssignmentPercentageCell
                              value={val}
                              isEditMode={effectiveEditMode}
                              isEdited={editedCells.has(key)}
                              hasError={validationErrors.has(key)}
                              errorMessage={validationErrors.get(key)}
                              onChange={(v) => handleCellChange(project.projectId, dStr, 'expense', v)}
                            />
                          ) : formatAssignmentAverage(val)}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </React.Fragment>
              ))}
              {projects.length === 0 && !isAddingProject && (
                <TableRow>
                  <TableCell
                    colSpan={Math.max(2, periods.length + 2)}
                    sx={{ py: 2, color: 'text.secondary', textAlign: 'center !important' }}
                  >
                    No projects assigned. Use Add Project to create the first assignment.
                  </TableCell>
                </TableRow>
              )}
      </AssignmentsGrid>

      <LockBanner holder={lockHolder} state={lockState} onTakeOver={takeOverLock} />

      {saveError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setSaveError(null)}>{saveError}</Alert>}
      <Snackbar open={saveSuccess} autoHideDuration={3000} onClose={() => setSaveSuccess(false)}
        message="Assignments saved successfully" anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Paper>
  )
}

// ─── Resource Detail Page ────────────────────────────────────────────────────

const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const rawFromProjectBreadcrumbs = (location.state as any)?.fromProjectBreadcrumbs as Array<{ label: string; path?: string; state?: any }> | undefined
  const fromProjectBreadcrumbs = rawFromProjectBreadcrumbs
    ? truncateAtLoop(rawFromProjectBreadcrumbs, location.pathname)
    : undefined
  const { conflictState, handleError, clearConflict } = useConflictHandler()

  const isNew = id === 'new'

  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(isNew)

  const { others: presentOthers } = usePresence('resource', isNew ? undefined : id, isEditing)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    resource_type: 'LABOR' as 'LABOR' | 'NON_LABOR',
    resource_role_id: '',
    version: 1,
  })

  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null)
  const [workerError, setWorkerError] = useState<string | null>(null)
  const [externalReferences, setExternalReferences] = useState<ResourceReferenceDraft[]>([])
  const [referenceTypes, setReferenceTypes] = useState<ExternalReferenceType[]>([])

  const [roles, setRoles] = useState<ResourceRole[]>([])

  useEffect(() => {
    resourceRolesApi
      .list()
      .then(setRoles)
      .catch(() => { /* role select stays empty; not fatal to the page */ })
  }, [])

  useEffect(() => {
    if (formData.resource_type !== 'NON_LABOR') return
    externalReferenceTypesApi
      .list()
      .then(setReferenceTypes)
      .catch(() => { /* reference editor remains empty; not fatal to the page */ })
  }, [formData.resource_type])

  // For a brand-new LABOR resource, default the role to "Default" once roles
  // have loaded (only fires while resource_role_id is still unset).
  useEffect(() => {
    if (!isNew || formData.resource_type !== 'LABOR' || formData.resource_role_id || roles.length === 0) return
    const defaultRole = roles.find((r) => r.name === 'Default') ?? roles[0]
    setFormData((prev) => ({ ...prev, resource_role_id: defaultRole.id }))
  }, [isNew, roles, formData.resource_type, formData.resource_role_id])

  const fetchResource = useCallback(async () => {
    if (!id || isNew) return
    try {
      setLoading(true)
      setError(null)
      const data = await resourcesApi.get(id)
      setResource(data)
      setFormData({
        name: data.name,
        description: data.description || '',
        resource_type: data.resource_type,
        resource_role_id: data.resource_role_id ?? '',
        version: data.version,
      })
      setSelectedWorkerId(data.worker_id ?? null)
      setExternalReferences(
        (data.external_references ?? []).map((item) => ({
          reference_type_id: item.reference_type_id,
          reference_type_name: item.reference_type_name,
          value: item.value,
        })),
      )
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load resource')
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    fetchResource()
  }, [fetchResource])

  const handleSave = async () => {
    // Validate worker selection for LABOR resources
    if (formData.resource_type === 'LABOR' && !selectedWorkerId) {
      setWorkerError('Please select a worker')
      return
    }
    setWorkerError(null)

    let updatePayload: ResourceUpdateInput | undefined
    try {
      setSaving(true)
      setError(null)
      if (isNew) {
        if (formData.resource_type === 'LABOR') {
          await resourcesApi.create({
            name: '_',  // placeholder; server derives name from worker
            resource_type: formData.resource_type,
            description: formData.description || undefined,
            worker_id: selectedWorkerId!,
            resource_role_id: formData.resource_role_id || undefined,
          })
        } else {
          await resourcesApi.create({
            name: formData.name,
            resource_type: formData.resource_type,
            description: formData.description || undefined,
            external_references: externalReferences
              .filter((item) => item.reference_type_id && item.value)
              .map((item) => ({
                reference_type_id: item.reference_type_id,
                value: item.value,
              })),
          })
        }
        navigate('/resources')
      } else {
        updatePayload = {
          description: formData.description || undefined,
          version: formData.version,
        }
        if (formData.resource_type === 'LABOR') {
          updatePayload.worker_id = selectedWorkerId ?? undefined
          updatePayload.resource_role_id = formData.resource_role_id || undefined
        } else {
          updatePayload.name = formData.name
          updatePayload.external_references = externalReferences
            .filter((item) => item.reference_type_id && item.value)
            .map((item) => ({
              reference_type_id: item.reference_type_id,
              value: item.value,
            }))
        }
        const updated = await resourcesApi.update(id!, updatePayload)
        setResource(updated)
        setFormData({ ...formData, name: updated.name, version: updated.version })
        setIsEditing(false)
      }
    } catch (err: any) {
      const isConflict = handleError(err, updatePayload ? { ...updatePayload } : formData)
      if (!isConflict) setError(err.response?.data?.detail || 'Failed to save resource')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (resource) {
      setFormData({
        name: resource.name,
        description: resource.description || '',
        resource_type: resource.resource_type,
        resource_role_id: resource.resource_role_id ?? '',
        version: resource.version,
      })
      setSelectedWorkerId(resource.worker_id ?? null)
      setExternalReferences(
        (resource.external_references ?? []).map((item) => ({
          reference_type_id: item.reference_type_id,
          reference_type_name: item.reference_type_name,
          value: item.value,
        })),
      )
    }
    setIsEditing(false)
    setError(null)
    setWorkerError(null)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  // ── New resource form ──
  if (isNew) {
    return (
      <Box>
        <PageHeader title="New Resource" />
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth label="Type" select SelectProps={{ native: true }}
                  value={formData.resource_type}
                  onChange={(e) => setFormData({ ...formData, resource_type: e.target.value as 'LABOR' | 'NON_LABOR' })}
                >
                  <option value="LABOR">Labor</option>
                  <option value="NON_LABOR">Non-Labor</option>
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                {formData.resource_type === 'LABOR' ? (
                  <WorkerSearchAutocomplete
                    value={selectedWorkerId}
                    onChange={(id) => { setSelectedWorkerId(id); setWorkerError(null) }}
                    label="Worker"
                    required
                    error={!!workerError}
                    helperText={workerError || undefined}
                  />
                ) : (
                  <TextField
                    fullWidth label="Name" required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                )}
              </Grid>
              {formData.resource_type === 'LABOR' && (
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel id="resource-role-label-new">Resource Role</InputLabel>
                    <Select
                      labelId="resource-role-label-new"
                      label="Resource Role"
                      value={formData.resource_role_id}
                      onChange={(e) => setFormData({ ...formData, resource_role_id: e.target.value })}
                    >
                      {roles.map((role) => (
                        <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Description" multiline rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              {formData.resource_type === 'NON_LABOR' && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    External References
                  </Typography>
                  {externalReferences.map((reference, index) => (
                    <Box
                      key={index}
                      sx={{
                        display: 'grid',
                        gridTemplateColumns: '180px minmax(0, 1fr) 36px',
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      <FormControl size="small">
                        <InputLabel id={`new-resource-reference-type-${index}`}>
                          Type
                        </InputLabel>
                        <Select
                          labelId={`new-resource-reference-type-${index}`}
                          label="Type"
                          value={reference.reference_type_id}
                          onChange={(event) => setExternalReferences((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index
                                ? {
                                    ...item,
                                    reference_type_id: event.target.value,
                                    reference_type_name: referenceTypes.find(
                                      (type) => type.id === event.target.value,
                                    )?.name,
                                  }
                                : item
                            )
                          )}
                        >
                          {referenceTypes.filter((item) => item.is_active).map((item) => (
                            <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                      <TextField
                        label="Reference Value"
                        value={reference.value}
                        inputProps={{ maxLength: 32, pattern: '[A-Za-z0-9]+' }}
                        onChange={(event) => {
                          const value = event.target.value.replace(/[^A-Za-z0-9]/g, '')
                          setExternalReferences((current) =>
                            current.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, value } : item
                            )
                          )
                        }}
                      />
                      <IconButton
                        size="small"
                        aria-label="Remove reference"
                        onClick={() => setExternalReferences((current) =>
                          current.filter((_item, itemIndex) => itemIndex !== index)
                        )}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                  <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={() => setExternalReferences((current) => [
                      ...current,
                      { reference_type_id: '', value: '' },
                    ])}
                  >
                    Add Reference
                  </Button>
                </Grid>
              )}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="outlined" onClick={() => navigate('/resources')}>Cancel</Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    )
  }

  // ── Existing resource detail ──
  const isLabor = formData.resource_type === 'LABOR'

  const editControls = !isEditing ? (
    <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
      Edit
    </Button>
  ) : (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" size="small" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
      <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </Button>
    </Box>
  )

  const descriptionField = (
    <>
      <Typography variant="caption" color="text.secondary">Description</Typography>
      {isEditing ? (
        <TextField fullWidth size="small" multiline rows={2} value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })} sx={{ mt: 0.5 }} />
      ) : (
        <Typography variant="body1">{formData.description || '—'}</Typography>
      )}
    </>
  )

  const descriptionCell = (
    <Grid item xs={12}>
      {descriptionField}
    </Grid>
  )

  const externalReferencesField = (
    <>
      <Typography variant="caption" color="text.secondary">
        External References
      </Typography>
      {isEditing ? (
        <Box sx={{ mt: 0.5 }}>
          {externalReferences.map((reference, index) => (
            <Box
              key={index}
              sx={{
                display: 'grid',
                gridTemplateColumns: '180px minmax(0, 1fr) 36px',
                gap: 1,
                mb: 1,
              }}
            >
              <FormControl size="small">
                <InputLabel id={`resource-reference-type-${index}`}>
                  Type
                </InputLabel>
                <Select
                  labelId={`resource-reference-type-${index}`}
                  label="Type"
                  value={reference.reference_type_id}
                  onChange={(event) => setExternalReferences((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index
                        ? {
                            ...item,
                            reference_type_id: event.target.value,
                            reference_type_name: referenceTypes.find(
                              (type) => type.id === event.target.value,
                            )?.name,
                          }
                        : item
                    )
                  )}
                >
                  {reference.reference_type_id
                    && !referenceTypes.some(
                      (item) => item.id === reference.reference_type_id,
                    ) && (
                      <MenuItem value={reference.reference_type_id}>
                        {reference.reference_type_name || 'Existing reference type'}
                      </MenuItem>
                    )}
                  {referenceTypes.filter((item) => item.is_active).map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Reference Value"
                value={reference.value}
                inputProps={{ maxLength: 32, pattern: '[A-Za-z0-9]+' }}
                onChange={(event) => {
                  const value = event.target.value.replace(/[^A-Za-z0-9]/g, '')
                  setExternalReferences((current) =>
                    current.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, value } : item
                    )
                  )
                }}
              />
              <IconButton
                size="small"
                aria-label="Remove reference"
                onClick={() => setExternalReferences((current) =>
                  current.filter((_item, itemIndex) => itemIndex !== index)
                )}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={() => setExternalReferences((current) => [
              ...current,
              { reference_type_id: '', value: '' },
            ])}
          >
            Add Reference
          </Button>
        </Box>
      ) : externalReferences.length ? (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 0.25 }}>
          {externalReferences.map((reference) => (
            <Typography
              key={`${reference.reference_type_id}:${reference.value}`}
              variant="body2"
              sx={{
                px: 1,
                py: 0.35,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
              }}
            >
              {`${reference.reference_type_name || 'Reference'}: ${reference.value}`}
            </Typography>
          ))}
        </Box>
      ) : (
        <Typography variant="body1">—</Typography>
      )}
    </>
  )

  return (
    <Box>
      {/* No breadcrumbs here: this page shows the resource across ALL projects,
          so a project trail would be misleading; the browser back button covers
          returning to wherever you came from. */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">
          Resource ({isLabor ? 'Labor' : 'Non-Labor'})
        </Typography>
        <PresenceBadge others={presentOthers} />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Details panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container rowSpacing={1.5} columnSpacing={2}>
            {isLabor ? (
              <>
                {/* Row 1: Worker | Description | Resource Role | Edit */}
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="text.secondary">Worker</Typography>
                  {isEditing ? (
                    <WorkerSearchAutocomplete
                      size="small"
                      sx={{ mt: 0.5 }}
                      value={selectedWorkerId}
                      onChange={(wid) => { setSelectedWorkerId(wid); setWorkerError(null) }}
                      placeholder="Select worker"
                      error={!!workerError}
                      helperText={workerError || undefined}
                    />
                  ) : selectedWorkerId ? (
                    <Typography
                      variant="body1"
                      component="a"
                      onClick={() => navigate(`/workers/${selectedWorkerId}`, {
                        state: { fromResource: { id: id!, name: resource?.name } },
                      })}
                      sx={{ color: 'primary.main', textDecoration: 'underline', cursor: 'pointer', display: 'block' }}
                    >
                      {formData.name}
                    </Typography>
                  ) : (
                    <Typography variant="body1">{formData.name}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={4}>
                  {descriptionField}
                </Grid>
                <Grid item xs={12} sm={3}>
                  <Typography variant="caption" color="text.secondary">Resource Role</Typography>
                  {isEditing ? (
                    <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                      <Select
                        SelectDisplayProps={{ 'aria-label': 'Resource Role' }}
                        value={formData.resource_role_id}
                        onChange={(e) => setFormData({ ...formData, resource_role_id: e.target.value })}
                      >
                        {roles.map((role) => (
                          <MenuItem key={role.id} value={role.id}>{role.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  ) : (
                    <Typography variant="body1">{resource?.resource_role_name || '—'}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={2} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                  {editControls}
                </Grid>

                {/* Row 2: Worker Type + Rate — read-only reference, one comma-separated line */}
                <Grid item xs={12}>
                  <Typography variant="body2" color="text.secondary">
                    {`Worker Type: ${resource?.worker_type_name || '—'}, Rate: ${
                      resource?.current_rate
                        ? `$${Number(resource.current_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : '—'
                    }`}
                  </Typography>
                </Grid>
              </>
            ) : (
              <>
                <Grid item xs={12} sm={8}>
                  <Typography variant="caption" color="text.secondary">Name</Typography>
                  {isEditing ? (
                    <TextField fullWidth size="small" value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={{ mt: 0.5 }} />
                  ) : (
                    <Typography variant="body1">{formData.name}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                  {editControls}
                </Grid>
                {descriptionCell}
                <Grid item xs={12}>
                  {externalReferencesField}
                </Grid>
              </>
            )}
          </Grid>
        </CardContent>
      </Card>

      {/* Allocation calendar */}
      <Typography variant="h6" sx={{ mb: 1 }}>Assignments</Typography>
      {isLabor ? (
        <ResourceAllocationCalendar
          resourceId={id!}
          allowAddProject
          resourceBreadcrumbItems={
            fromProjectBreadcrumbs
              ? [...fromProjectBreadcrumbs, { label: resource?.name || '…', path: `/resources/${id}`, state: { fromProjectBreadcrumbs } }]
              : [
                  { label: 'Home', path: '/dashboard' },
                  { label: 'Resources', path: '/resources' },
                  { label: resource?.name || '…', path: `/resources/${id}` },
                ]
          }
        />
      ) : (
        <NonLaborAssignmentsGrid
          perspective="resource"
          resource={{
            id: id!,
            name: resource?.name || formData.name,
            external_references: resource?.external_references,
          }}
        />
      )}

      {/* Conflict Dialog */}
      <ConflictDialog
        open={conflictState.isConflict}
        entityType={conflictState.entityType}
        attemptedChanges={conflictState.attemptedChanges}
        currentState={conflictState.currentState}
        onRefreshAndRetry={async () => {
          await fetchResource()
          if (conflictState.attemptedChanges && conflictState.currentState) {
            setFormData({
              name: conflictState.attemptedChanges.name || formData.name,
              description: conflictState.attemptedChanges.description || formData.description,
              resource_type: formData.resource_type,
              resource_role_id: conflictState.attemptedChanges.resource_role_id ?? formData.resource_role_id,
              version: conflictState.currentState.version,
            })
            if ('worker_id' in conflictState.attemptedChanges) {
              setSelectedWorkerId(conflictState.attemptedChanges.worker_id ?? null)
            }
            if ('external_references' in conflictState.attemptedChanges) {
              setExternalReferences(
                (conflictState.attemptedChanges.external_references ?? []).map(
                  (item: { reference_type_id: string; value: string }) => ({
                    ...item,
                    reference_type_name: referenceTypes.find(
                      (type) => type.id === item.reference_type_id,
                    )?.name,
                  }),
                ),
              )
            }
          }
          clearConflict()
        }}
        onCancel={clearConflict}
      />
    </Box>
  )
}

export default ResourceDetailPage
