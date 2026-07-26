import { useState, useEffect, useMemo, useCallback } from 'react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  TableRow,
  Button,
  Stack,
  Snackbar,
} from '@mui/material'
import { assignmentsApi, BulkUpdateFailure } from '../../api/assignments'
import {
  transformToGrid,
  getCellValue,
  getCellKey,
  type GridData,
} from '../../utils/calendarTransform'
import { validatePercentage, validateCellEdit } from '../../utils/cellValidation'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission } from '../../utils/permissions'
import BulkConflictDialog from './BulkConflictDialog'
import { useProjectAssignments, useInvalidateAssignments } from '../../hooks/useAssignments'
import { usePersistedEdits } from '../../hooks/usePersistedEdits'
import {
  AssignmentsGrid,
  AssignmentPercentageCell,
  AssignmentsGridCell as TableCell,
  ASSIGNMENTS_GRID_AGGREGATE_TYPE_WIDTH,
  ASSIGNMENTS_GRID_PRIMARY_WIDTH,
  ASSIGNMENTS_GRID_TYPE_WIDTH,
  ASSIGNMENTS_GRID_TOTAL_WEEKEND_BG,
  ASSIGNMENTS_GRID_WEEKEND_BG,
  getAssignmentsGridPeriodSx,
  getAssignmentsGridPeriodWidth,
} from './AssignmentsGrid'
import {
  averageAssignmentPeriod,
  buildAssignmentPeriods,
  formatAssignmentAverage,
  type AssignmentViewMode,
} from './assignmentPeriods'
import {
  loadProjectAssignmentView,
  saveProjectAssignmentView,
} from './projectAssignmentViewSession'
import { useUserSettings } from '../../contexts/UserSettingsContext'

// Memoized cell wrapper to prevent unnecessary re-renders
interface CellWrapperProps {
  resourceId: string
  resourceName: string
  date: Date
  costTreatment: 'capital' | 'expense'
  isEditMode: boolean
  gridData: GridData
  editedCells: Map<string, CellEdit>
  validationErrors: Map<string, string>
  onCellChange: (resourceId: string, date: Date, costTreatment: 'capital' | 'expense', newValue: number) => void
  onCellBlur: (resourceId: string, date: Date, costTreatment: 'capital' | 'expense') => void
}

const CellWrapper: React.FC<CellWrapperProps> = React.memo(({
  resourceId,
  date,
  costTreatment,
  isEditMode,
  gridData,
  editedCells,
  validationErrors,
  onCellChange,
  onCellBlur,
}) => {
  const key = getCellKey(resourceId, date, costTreatment)
  const edit = editedCells.get(key)
  const value = edit ? edit.newValue : Math.round(getCellValue(gridData, resourceId, date, costTreatment))
  const hasError = validationErrors.has(key)
  const errorMessage = validationErrors.get(key)
  const isEdited = editedCells.has(key)

  return (
    <AssignmentPercentageCell
      value={value}
      isEditMode={isEditMode}
      hasError={hasError}
      errorMessage={errorMessage}
      isEdited={isEdited}
      onChange={(newValue) => onCellChange(resourceId, date, costTreatment, newValue)}
      onBlur={() => onCellBlur(resourceId, date, costTreatment)}
    />
  )
}, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  if (prevProps.isEditMode !== nextProps.isEditMode) return false
  if (prevProps.date !== nextProps.date) return false
  if (prevProps.resourceId !== nextProps.resourceId) return false
  if (prevProps.costTreatment !== nextProps.costTreatment) return false
  
  // Check if this specific cell's edit status changed
  const key = getCellKey(prevProps.resourceId, prevProps.date, prevProps.costTreatment)
  const prevEdit = prevProps.editedCells.get(key)
  const nextEdit = nextProps.editedCells.get(key)
  if (prevEdit?.newValue !== nextEdit?.newValue) return false
  
  // Check if this specific cell's validation error changed
  const prevError = prevProps.validationErrors.get(key)
  const nextError = nextProps.validationErrors.get(key)
  if (prevError !== nextError) return false
  
  // Check if the underlying data changed
  const prevValue = getCellValue(prevProps.gridData, prevProps.resourceId, prevProps.date, prevProps.costTreatment)
  const nextValue = getCellValue(nextProps.gridData, nextProps.resourceId, nextProps.date, nextProps.costTreatment)
  if (prevValue !== nextValue) return false
  
  return true // Props are equal, skip re-render
})

interface BreadcrumbItem {
  label: string
  path?: string
  state?: Record<string, unknown>
}

interface ResourceAssignmentCalendarProps {
  projectId: string
  projectStartDate: string
  projectEndDate: string
  onSaveSuccess?: () => void
  onSaveError?: (error: string) => void
  projectBreadcrumbItems?: BreadcrumbItem[]
}

interface CellEdit {
  resourceId: string
  date: Date
  costTreatment: 'capital' | 'expense'
  oldValue: number
  newValue: number
}

const ResourceAssignmentCalendar = ({
  projectId,
  projectStartDate,
  projectEndDate,
  onSaveSuccess,
  onSaveError,
  projectBreadcrumbItems,
}: ResourceAssignmentCalendarProps) => {
  const { user } = useAuth()
  const { settings, updateSettings } = useUserSettings()
  const navigate = useNavigate()
  
  // Use React Query hook for assignments data
  const { data: assignments = [], isLoading, error: queryError, refetch } = useProjectAssignments(projectId)
  const { invalidateProject } = useInvalidateAssignments()
  
  // Use persisted edits hook to maintain unsaved changes across navigation
  const { editedCells, setEditedCells, clearEdits } = usePersistedEdits(projectId)
  
  const [isEditMode, setIsEditMode] = useState(false)
  const preferredAssignmentView = useMemo(() => ({
    viewMode: settings.assignmentGrids?.project?.period ?? 'daily',
    chartVisible: settings.assignmentGrids?.project?.chartVisible ?? true,
  }), [
    settings.assignmentGrids?.project?.period,
    settings.assignmentGrids?.project?.chartVisible,
  ])
  const [assignmentView, setAssignmentView] = useState(
    () => loadProjectAssignmentView(projectId, preferredAssignmentView),
  )
  const { viewMode, chartVisible } = assignmentView
  const updateAssignmentView = useCallback((
    update: Partial<{ viewMode: AssignmentViewMode; chartVisible: boolean }>,
    persistPreference = true,
  ) => {
    setAssignmentView((current) => {
      const next = { ...current, ...update }
      saveProjectAssignmentView(projectId, next)
      if (persistPreference) {
        updateSettings({
          assignmentGrids: {
            project: {
              ...(update.viewMode ? { period: update.viewMode } : {}),
              ...(typeof update.chartVisible === 'boolean'
                ? { chartVisible: update.chartVisible }
                : {}),
            },
          },
        })
      }
      return next
    })
  }, [projectId, updateSettings])
  const setViewMode = useCallback(
    (nextMode: AssignmentViewMode) =>
      updateAssignmentView({ viewMode: nextMode }, false),
    [updateAssignmentView],
  )
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [bulkConflictFailures, setBulkConflictFailures] = useState<BulkUpdateFailure[]>([])
  const [bulkConflictSuccessCount, setBulkConflictSuccessCount] = useState(0)
  
  // Ref to track scroll position
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

  useEffect(() => {
    setAssignmentView(loadProjectAssignmentView(projectId, preferredAssignmentView))
  }, [preferredAssignmentView, projectId])

  // Check if user has permission to edit resources
  const canEdit = useMemo(() => {
    return hasPermission(user, 'manage_resources').hasPermission
  }, [user])

  // Handle query errors
  useEffect(() => {
    if (queryError) {
      const errorMessage = (queryError as any).response?.data?.detail || 'Failed to load assignments'
      onSaveError?.(errorMessage)
    }
  }, [queryError, onSaveError])

  // Auto-restore edit mode if there are persisted edits
  useEffect(() => {
    if (editedCells.size > 0 && !isEditMode && canEdit) {
      setViewMode('daily')
      setIsEditMode(true)
    }
  }, [editedCells.size, isEditMode, canEdit, setViewMode])

  const handleEditClick = useCallback(() => {
    if (!canEdit) {
      return
    }
    // Save scroll position before entering edit mode
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    
    setViewMode('daily')
    setIsEditMode(true)
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollLeft
        scrollContainerRef.current.scrollTop = scrollTop
      }
    })
  }, [canEdit, setViewMode])

  const handleCancelClick = useCallback(() => {
    // Save scroll position before exiting edit mode
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    
    setIsEditMode(false)
    clearEdits() // Clear persisted edits
    setValidationErrors(new Map())
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollLeft
        scrollContainerRef.current.scrollTop = scrollTop
      }
    })
  }, [clearEdits])

  const handleSaveClick = useCallback(async () => {
    // Check permissions before save
    if (!canEdit) {
      const errorMsg = 'You do not have permission to edit resource assignments'
      setSaveError(errorMsg)
      onSaveError?.(errorMsg)
      return
    }
    
    // Save scroll position before saving
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    
    // Clear previous save messages
    setSaveSuccess(false)
    setSaveError(null)
    
    // Validate all edited cells before save
    const editsArray = Array.from(editedCells.values())
    
    if (editsArray.length === 0) {
      // No edits to save
      setIsEditMode(false)
      return
    }
    
    // Set saving state
    setIsSaving(true)
    
    try {
      // Validate all edits
      for (const edit of editsArray) {
        const validation = validatePercentage(edit.newValue)
        if (!validation.isValid) {
          const key = getCellKey(edit.resourceId, edit.date, edit.costTreatment)
          setValidationErrors((prev) => {
            const newMap = new Map(prev)
            newMap.set(key, validation.errorMessage || 'Invalid value')
            return newMap
          })
          const errorMsg = 'Please fix validation errors before saving'
          setSaveError(errorMsg)
          onSaveError?.(errorMsg)
          return
        }
        
        // Perform cross-project allocation validation
        try {
          const resourceName = gridData?.resources.find(r => r.resourceId === edit.resourceId)?.resourceName
          const validationResult = await validateCellEdit(
            edit.resourceId,
            edit.date,
            edit.costTreatment,
            edit.newValue,
            projectId,
            undefined,
            resourceName
          )
          
          if (!validationResult.isValid) {
            const key = getCellKey(edit.resourceId, edit.date, edit.costTreatment)
            setValidationErrors((prev) => {
              const newMap = new Map(prev)
              newMap.set(key, validationResult.errorMessage || 'Validation failed')
              return newMap
            })
            const errorMsg = 'Please fix validation errors before saving'
            setSaveError(errorMsg)
            onSaveError?.(errorMsg)
            return
          }
        } catch (error) {
          console.error('Error validating cell:', error)
          const errorMsg = 'Failed to validate allocations'
          setSaveError(errorMsg)
          onSaveError?.(errorMsg)
          return
        }
      }
      
      // Group edits by resource and date to determine update vs create
      const editsByResourceDate = new Map<string, CellEdit[]>()
      
      for (const edit of editsArray) {
        const dateStr = edit.date.toISOString().split('T')[0]
        const key = `${edit.resourceId}:${dateStr}`
        
        if (!editsByResourceDate.has(key)) {
          editsByResourceDate.set(key, [])
        }
        editsByResourceDate.get(key)!.push(edit)
      }
      
      // Process each resource-date combination
      const bulkUpdates: any[] = []
      const createPromises: Promise<any>[] = []
      
      for (const [key, edits] of editsByResourceDate.entries()) {
        const [resourceId, dateStr] = key.split(':')
        
        // Find existing assignment for this resource and date
        const existingAssignment = assignments.find(
          (a) =>
            a.resource_id === resourceId &&
            a.assignment_date === dateStr
        )
        
        // Calculate new capital and expense percentages
        let capitalPercentage = existingAssignment?.capital_percentage || 0
        let expensePercentage = existingAssignment?.expense_percentage || 0
        
        for (const edit of edits) {
          if (edit.costTreatment === 'capital') {
            capitalPercentage = Math.round(edit.newValue)
          } else {
            expensePercentage = Math.round(edit.newValue)
          }
        }
        
        if (existingAssignment) {
          // Add to bulk update
          bulkUpdates.push({
            id: existingAssignment.id,
            capital_percentage: capitalPercentage,
            expense_percentage: expensePercentage,
            version: existingAssignment.version ?? 1,
          })
        } else {
          // Create new assignment
          createPromises.push(
            assignmentsApi.create({
              resource_id: resourceId,
              project_id: projectId,
              assignment_date: dateStr,
              capital_percentage: capitalPercentage,
              expense_percentage: expensePercentage,
            })
          )
        }
      }
      
      // Execute bulk updates and creates
      let bulkResult: any = { succeeded: [], failed: [] }
      if (bulkUpdates.length > 0) {
        bulkResult = await assignmentsApi.bulkUpdate(bulkUpdates)
      }
      
      const createResults = await Promise.all(createPromises)
      
      // Check if there were any conflicts
      if (bulkResult.failed && bulkResult.failed.length > 0) {
        // Handle conflicts - show which assignments failed
        const successCount = bulkResult.succeeded.length + createResults.length
        
        // Invalidate cache to refresh with latest data
        await invalidateProject(projectId)
        
        // Remove successful edits from editedCells
        setEditedCells((prev) => {
          const newMap = new Map(prev)
          
          // Remove edits for successful updates
          for (const success of bulkResult.succeeded) {
            const assignment = assignments.find((a) => a.id === success.id)
            if (assignment) {
              const dateStr = assignment.assignment_date
              const date = new Date(dateStr + 'T00:00:00Z')
              const capitalKey = getCellKey(assignment.resource_id, date, 'capital')
              const expenseKey = getCellKey(assignment.resource_id, date, 'expense')
              newMap.delete(capitalKey)
              newMap.delete(expenseKey)
            }
          }
          
          // Remove edits for created assignments
          for (const created of createResults) {
            const dateStr = created.assignment_date
            const date = new Date(dateStr + 'T00:00:00Z')
            const capitalKey = getCellKey(created.resource_id, date, 'capital')
            const expenseKey = getCellKey(created.resource_id, date, 'expense')
            newMap.delete(capitalKey)
            newMap.delete(expenseKey)
          }
          
          return newMap
        })
        
        // Show conflict dialog
        setBulkConflictFailures(bulkResult.failed)
        setBulkConflictSuccessCount(successCount)
        setConflictDialogOpen(true)
        
        // Don't exit edit mode - keep failed edits visible
      } else {
        // All updates succeeded - invalidate cache to refresh
        await invalidateProject(projectId)
        
        // Clear all edits and exit edit mode
        clearEdits() // Clear persisted edits
        setValidationErrors(new Map())
        setIsEditMode(false)
        setSaveSuccess(true)
        onSaveSuccess?.()
      }
      
      // Restore scroll position
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollLeft = scrollLeft
          scrollContainerRef.current.scrollTop = scrollTop
        }
      })
    } catch (error: any) {
      console.error('Error saving assignments:', error)
      
      // Handle 403 permission errors specifically
      if (error.response?.status === 403) {
        const errorMsg = 'Permission denied: You do not have permission to modify resource assignments'
        setSaveError(errorMsg)
        onSaveError?.(errorMsg)
      } else {
        const errorMessage = error.response?.data?.detail || 'Failed to save assignments'
        setSaveError(errorMessage)
        onSaveError?.(errorMessage)
      }
      // Preserve edits on error - don't clear editedCells
    } finally {
      setIsSaving(false)
    }
  }, [canEdit, editedCells, assignments, projectId, onSaveSuccess, onSaveError, invalidateProject, clearEdits])
  
  const handleConflictRefreshAndRetry = useCallback(async () => {
    // Close the dialog
    setConflictDialogOpen(false)
    
    // Refresh assignments to get latest data
    await refetch()
    
    // The failed edits are still in editedCells, so user can see them highlighted
    // and can click Save again to retry
  }, [refetch])
  
  const handleConflictCancel = useCallback(() => {
    // Close the dialog
    setConflictDialogOpen(false)
    
    // Clear all edits and exit edit mode
    clearEdits() // Clear persisted edits
    setValidationErrors(new Map())
    setIsEditMode(false)
  }, [clearEdits])
  
  // Transform data to grid structure
  // Memoized to avoid recalculation on every render
  const gridData: GridData | null = useMemo(() => {
    if (!projectStartDate || !projectEndDate) {
      return null
    }

    try {
      // Parse dates as UTC to avoid timezone issues
      // Date strings from API are in YYYY-MM-DD format
      const parseUTCDate = (dateStr: string): Date => {
        const [year, month, day] = dateStr.split('-').map(Number)
        return new Date(Date.UTC(year, month - 1, day))
      }
      
      const result = transformToGrid(
        assignments,
        parseUTCDate(projectStartDate),
        parseUTCDate(projectEndDate)
      )
      
      return result
    } catch (err) {
      console.error('Error transforming grid data:', err)
      return null
    }
  }, [assignments, projectStartDate, projectEndDate])

  const periods = useMemo(
    () => buildAssignmentPeriods(gridData?.dates ?? [], viewMode),
    [gridData?.dates, viewMode],
  )

  const handleViewModeChange = useCallback((nextMode: AssignmentViewMode) => {
    if (isEditMode || nextMode === viewMode || !gridData) return

    const currentWidth = getAssignmentsGridPeriodWidth(viewMode)
    const visibleIndex = Math.max(
      0,
      Math.floor((scrollContainerRef.current?.scrollLeft ?? 0) / currentWidth),
    )
    const anchorDate = periods[Math.min(visibleIndex, periods.length - 1)]?.dates[0]

    updateAssignmentView({ viewMode: nextMode })

    requestAnimationFrame(() => {
      if (!scrollContainerRef.current || !anchorDate) return
      const nextPeriods = buildAssignmentPeriods(gridData.dates, nextMode)
      const nextIndex = nextPeriods.findIndex((period) =>
        period.dates.some((date) => date.getTime() === anchorDate.getTime()),
      )
      scrollContainerRef.current.scrollLeft =
        Math.max(0, nextIndex) * getAssignmentsGridPeriodWidth(nextMode)
    })
  }, [gridData, isEditMode, periods, updateAssignmentView, viewMode])

  // Memoized to prevent recreation on every render
  const handleCellChange = useCallback((
    resourceId: string,
    date: Date,
    costTreatment: 'capital' | 'expense',
    newValue: number
  ) => {
    const key = getCellKey(resourceId, date, costTreatment)
    
    // Round to whole number to prevent fractional values
    const roundedValue = Math.round(newValue)
    
    // Validate the rounded value
    const validation = validatePercentage(roundedValue)
    
    if (!validation.isValid) {
      // Set validation error - use queueMicrotask for even faster response
      queueMicrotask(() => {
        setValidationErrors((prev) => {
          const newMap = new Map(prev)
          newMap.set(key, validation.errorMessage || 'Invalid value')
          return newMap
        })
      })
      return
    }
    
    // Clear any existing validation error
    queueMicrotask(() => {
      setValidationErrors((prev) => {
        const newMap = new Map(prev)
        newMap.delete(key)
        return newMap
      })
    })
    
    const oldValue = getCellValue(gridData!, resourceId, date, costTreatment)
    
    // If the new value equals the original value, remove from edited cells
    // This handles the case where user changes a value then changes it back
    if (roundedValue === Math.round(oldValue)) {
      queueMicrotask(() => {
        setEditedCells((prev) => {
          const newMap = new Map(prev)
          newMap.delete(key)
          return newMap
        })
      })
      return
    }
    
    const edit: CellEdit = {
      resourceId,
      date,
      costTreatment,
      oldValue,
      newValue: roundedValue,
    }
    
    queueMicrotask(() => {
      setEditedCells((prev) => {
        const newMap = new Map(prev)
        newMap.set(key, edit)
        return newMap
      })
    })
    
    // Note: Cross-project validation is deferred to save time
    // This ensures instant typing and tabbing without API call delays
  }, [gridData])

  const handleCellBlur = useCallback(() => {
    // Blur handler is now a no-op for performance
    // Cross-project validation is deferred to save time to avoid blocking tabbing
    // This ensures instant tabbing between cells without API call delays
  }, [])

  // NOT memoized - we want this to run on every render to pick up state changes
  const getDisplayValue = (
    resourceId: string,
    date: Date,
    costTreatment: 'capital' | 'expense'
  ): number => {
    const key = getCellKey(resourceId, date, costTreatment)
    const edit = editedCells.get(key)
    
    if (edit) {
      return edit.newValue
    }
    
    // Round values from API to whole numbers
    const value = getCellValue(gridData!, resourceId, date, costTreatment)
    return Math.round(value)
  }

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Error state
  if (queryError) {
    const errorMessage = (queryError as any).response?.data?.detail || 'Failed to load assignments'
    return <Alert severity="error">{errorMessage}</Alert>
  }

  // Empty state: missing project dates
  if (!projectStartDate || !projectEndDate) {
    return (
      <Alert severity="info">
        Project start date and end date are required to display the resource assignment calendar.
        Please set the project dates to view assignments.
      </Alert>
    )
  }

  // Empty state: no grid data
  if (!gridData) {
    return (
      <Alert severity="error">
        Unable to generate calendar view. Please check the project dates.
      </Alert>
    )
  }

  // Empty state: no resources
  if (gridData.resources.length === 0) {
    return (
      <Alert severity="info">
        No resources are currently assigned to this project. Add resource assignments to see them in the calendar view.
      </Alert>
    )
  }

  const laborChartValues = periods.map((period) =>
    averageAssignmentPeriod(period, (date) =>
      gridData.resources.reduce((sum, resource) => (
        sum
        + getDisplayValue(resource.resourceId, date, 'capital')
        + getDisplayValue(resource.resourceId, date, 'expense')
      ), 0) / 100,
    ),
  )

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Bulk Conflict Dialog */}
      <BulkConflictDialog
        open={conflictDialogOpen}
        successCount={bulkConflictSuccessCount}
        failures={bulkConflictFailures}
        onRefreshAndRetry={handleConflictRefreshAndRetry}
        onCancel={handleConflictCancel}
      />
      
      {/* Screen reader announcements for mode changes */}
      <Box
        role="status"
        aria-live="polite"
        aria-atomic="true"
        sx={{
          position: 'absolute',
          left: '-10000px',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
        }}
      >
        {isEditMode && 'Edit mode enabled. You can now modify resource allocations.'}
        {!isEditMode && saveSuccess && 'Changes saved successfully. Edit mode disabled.'}
      </Box>

      {/* Success/Error Messages - Fixed at bottom of screen */}
      <Snackbar
        open={saveSuccess}
        autoHideDuration={6000}
        onClose={() => setSaveSuccess(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setSaveSuccess(false)} sx={{ width: '100%' }}>
          Assignments saved successfully
        </Alert>
      </Snackbar>
      
      <Snackbar
        open={!!saveError}
        autoHideDuration={6000}
        onClose={() => setSaveError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity="error" onClose={() => setSaveError(null)} sx={{ width: '100%' }}>
          {saveError}
        </Alert>
      </Snackbar>
      
      {/* Calendar Table */}
      {/* 
        Performance Note: For very large date ranges (>365 days), consider implementing
        virtualization using react-window or react-virtualized to render only visible columns.
        Current implementation handles up to ~365 days efficiently with memoization.
      */}
      <Paper sx={{ p: 1 }}>
        <AssignmentsGrid
          ariaLabel="Resource assignment calendar"
          periods={periods}
          viewMode={viewMode}
          onViewModeChange={handleViewModeChange}
          primaryHeader="Resource"
          primaryHeaderAriaLabel="Resource name"
          typeColumnWidth={
            viewMode === 'daily'
              ? ASSIGNMENTS_GRID_TYPE_WIDTH
              : ASSIGNMENTS_GRID_AGGREGATE_TYPE_WIDTH
          }
          scrollContainerRef={scrollContainerRef}
          isEditMode={isEditMode}
          chartConfig={{
            title: 'Labor usage over time',
            subtitle: viewMode === 'daily' ? 'Assigned labor heads' : 'Average Heads/Day',
            seriesLabel: 'Assigned labor',
            values: laborChartValues,
            valueFormatter: (value) =>
              `${value.toFixed(1)} ${viewMode === 'daily' ? 'heads' : 'heads/day'}`,
          }}
          chartVisible={chartVisible}
          onChartVisibilityChange={(visible) =>
            updateAssignmentView({ chartVisible: visible })
          }
          toolbarActions={canEdit ? (
            !isEditMode ? (
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleEditClick}
                aria-label="Enable edit mode for resource assignments"
              >
                Edit
              </Button>
            ) : (
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="small"
                  onClick={handleCancelClick}
                  disabled={isSaving}
                  aria-label="Cancel editing and discard changes"
                  type="button"
                >
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  size="small"
                  onClick={handleSaveClick}
                  disabled={isSaving}
                  aria-label="Save all changes to resource assignments"
                  aria-busy={isSaving}
                  type="button"
                >
                  {isSaving ? (
                    <>
                      <CircularProgress size={20} sx={{ mr: 1 }} aria-hidden="true" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </Stack>
            )
          ) : undefined}
        >
            {/* Labor Totals Row */}
            <TableRow role="row">
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#e8f5e9',
                  fontWeight: 'bold',
                  zIndex: 2,
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'left !important',
                }}
                role="rowheader"
              >
                Labor Totals
              </TableCell>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                  backgroundColor: '#e8f5e9',
                  fontWeight: 'bold',
                  zIndex: 2,
                  borderRight: '1px solid',
                  borderColor: 'divider',
                  textAlign: 'left !important',
                }}
              >
                {viewMode === 'daily' ? 'Heads' : 'Heads/Day'}
              </TableCell>
              {periods.map((period, index) => {
                const total = laborChartValues[index]
                return (
                  <TableCell
                    key={period.key}
                    align="center"
                    sx={{
                      backgroundColor: period.isWeekend ? ASSIGNMENTS_GRID_TOTAL_WEEKEND_BG : '#e8f5e9',
                      fontWeight: 'bold',
                      ...getAssignmentsGridPeriodSx(period),
                    }}
                    role="gridcell"
                  >
                    {total > 0 ? total.toFixed(1) : ''}
                  </TableCell>
                )
              })}
            </TableRow>
            {gridData.resources.map((resource) => (
              <React.Fragment key={resource.resourceId}>
                {/* Capital Row */}
                <TableRow role="row">
                  {/* Resource Name Cell - spans 2 rows */}
                  <TableCell
                    rowSpan={2}
                    sx={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      verticalAlign: 'middle',
                      textAlign: 'left !important',
                    }}
                    role="rowheader"
                    aria-label={`${resource.resourceName} - Capital and Expense allocations`}
                  >
                    <Typography
                      variant="body2"
                      fontWeight="medium"
                      component="a"
                      onClick={() => navigate(`/resources/${resource.resourceId}`, {
                        state: { fromProjectBreadcrumbs: projectBreadcrumbItems },
                      })}
                      sx={{
                        cursor: 'pointer',
                        color: 'primary.main',
                        textDecoration: 'underline',
                        '&:hover': { color: 'primary.dark' },
                      }}
                    >
                      {resource.resourceName}
                    </Typography>
                  </TableCell>
                  {/* Cost Treatment Label Cell - Capital */}
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      textAlign: 'left !important',
                    }}
                    role="rowheader"
                    aria-label="Capital"
                  >
                    <Typography variant="caption" color="primary">
                      Cap %
                    </Typography>
                  </TableCell>
                  {periods.map((period) => {
                    const value = averageAssignmentPeriod(
                      period,
                      (date) => getDisplayValue(resource.resourceId, date, 'capital'),
                    )
                    const date = period.dates[0]
                    
                    return (
                      <TableCell
                        key={period.key}
                        align="center"
                        sx={{
                          backgroundColor: period.isWeekend
                            ? ASSIGNMENTS_GRID_WEEKEND_BG
                            : value > 0 ? 'action.hover' : 'background.paper',
                          ...getAssignmentsGridPeriodSx(period),
                        }}
                        role="gridcell"
                        aria-label={`${resource.resourceName} capital allocation for ${period.ariaLabel}: ${formatAssignmentAverage(value)}%`}
                      >
                        {viewMode === 'daily' ? (
                          <CellWrapper
                            resourceId={resource.resourceId}
                            resourceName={resource.resourceName}
                            date={date}
                            costTreatment="capital"
                            isEditMode={isEditMode}
                            gridData={gridData}
                            editedCells={editedCells}
                            validationErrors={validationErrors}
                            onCellChange={handleCellChange}
                            onCellBlur={handleCellBlur}
                          />
                        ) : formatAssignmentAverage(value)}
                      </TableCell>
                    )
                  })}
                </TableRow>

                {/* Expense Row */}
                <TableRow role="row">
                  {/* Cost Treatment Label Cell - Expense */}
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: ASSIGNMENTS_GRID_PRIMARY_WIDTH,
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '1px solid',
                      borderColor: 'divider',
                      textAlign: 'left !important',
                    }}
                    role="rowheader"
                    aria-label="Expense"
                  >
                    <Typography variant="caption" color="secondary">
                      Exp %
                    </Typography>
                  </TableCell>
                  {periods.map((period) => {
                    const value = averageAssignmentPeriod(
                      period,
                      (date) => getDisplayValue(resource.resourceId, date, 'expense'),
                    )
                    const date = period.dates[0]
                    
                    return (
                      <TableCell
                        key={period.key}
                        align="center"
                        sx={{
                          backgroundColor: period.isWeekend
                            ? ASSIGNMENTS_GRID_WEEKEND_BG
                            : value > 0 ? 'action.hover' : 'background.paper',
                          borderColor: 'divider',
                          ...getAssignmentsGridPeriodSx(period),
                        }}
                        role="gridcell"
                        aria-label={`${resource.resourceName} expense allocation for ${period.ariaLabel}: ${formatAssignmentAverage(value)}%`}
                      >
                        {viewMode === 'daily' ? (
                          <CellWrapper
                            resourceId={resource.resourceId}
                            resourceName={resource.resourceName}
                            date={date}
                            costTreatment="expense"
                            isEditMode={isEditMode}
                            gridData={gridData}
                            editedCells={editedCells}
                            validationErrors={validationErrors}
                            onCellChange={handleCellChange}
                            onCellBlur={handleCellBlur}
                          />
                        ) : formatAssignmentAverage(value)}
                      </TableCell>
                    )
                  })}
                </TableRow>
              </React.Fragment>
            ))}
        </AssignmentsGrid>
      </Paper>
    </Box>
  )
}

export default ResourceAssignmentCalendar
