import { useState, useEffect, useMemo, useCallback } from 'react'
import * as React from 'react'
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Button,
  Stack,
} from '@mui/material'
import { assignmentsApi } from '../../api/assignments'
import { ResourceAssignment } from '../../types'
import {
  transformToGrid,
  getCellValue,
  getCellKey,
  type GridData,
} from '../../utils/calendarTransform'
import { validatePercentage, validateCellEdit } from '../../utils/cellValidation'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission } from '../../utils/permissions'

interface EditableCellProps {
  value: number
  isEditMode: boolean
  hasError: boolean
  errorMessage?: string
  onChange: (newValue: number) => void
  onBlur: () => void
}

const EditableCell: React.FC<EditableCellProps> = React.memo(({
  value,
  isEditMode,
  hasError,
  errorMessage,
  onChange,
  onBlur,
}) => {
  const [inputValue, setInputValue] = useState(value.toString())
  const [localError, setLocalError] = useState<string | undefined>()

  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    
    // Clear local error on change
    setLocalError(undefined)
    
    // Parse and validate numeric input
    const numericValue = parseFloat(newValue)
    if (!isNaN(numericValue)) {
      // Validate range
      const validation = validatePercentage(numericValue)
      if (!validation.isValid) {
        setLocalError(validation.errorMessage)
      } else {
        onChange(numericValue)
      }
    } else if (newValue === '') {
      // Empty input is valid (0%)
      onChange(0)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onBlur()
    } else if (e.key === 'Escape') {
      // Escape key reverts to original value and exits edit
      e.preventDefault()
      setInputValue(value.toString())
      setLocalError(undefined)
      onBlur()
    } else if (e.key === 'Tab') {
      // Tab will naturally trigger blur, so we just let it happen
      // onBlur will be called automatically
    }
  }

  const formatPercentage = (val: number): string => {
    if (val === 0) return ''
    // Round to whole number and display without % symbol
    return `${Math.round(val)}`
  }

  if (!isEditMode) {
    return <>{formatPercentage(value)}</>
  }

  const displayError = hasError || !!localError
  const displayErrorMessage = errorMessage || localError

  const cellContent = (
    <TextField
      value={inputValue}
      onChange={handleChange}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      size="small"
      type="number"
      inputProps={{
        min: 0,
        max: 100,
        step: 1,
        'aria-label': 'Allocation percentage',
        'aria-invalid': displayError,
        'aria-describedby': displayError ? 'cell-error' : undefined,
      }}
      error={displayError}
      sx={{
        width: '50px',
        '& .MuiInputBase-input': {
          textAlign: 'center',
          padding: '2px 4px',
        },
      }}
    />
  )

  if (displayError && displayErrorMessage) {
    return (
      <Tooltip title={displayErrorMessage} arrow>
        {cellContent}
      </Tooltip>
    )
  }

  return cellContent
})

// Memoize EditableCell to prevent unnecessary re-renders
// Only re-render when value, isEditMode, hasError, or errorMessage changes

interface ResourceAssignmentCalendarProps {
  projectId: string
  projectStartDate: string
  projectEndDate: string
  onSaveSuccess?: () => void
  onSaveError?: (error: string) => void
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
}: ResourceAssignmentCalendarProps) => {
  const { user } = useAuth()
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedCells, setEditedCells] = useState<Map<string, CellEdit>>(new Map())
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Check if user has permission to edit resources
  const canEdit = useMemo(() => {
    return hasPermission(user, 'manage_resources').hasPermission
  }, [user])

  // Memoize fetchAssignments to prevent recreation on every render
  const fetchAssignments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      console.log('📡 Fetching assignments for project:', projectId)
      const data = await assignmentsApi.getByProject(projectId)
      console.log('✅ Assignments fetched:', data.length)
      console.log('  - Sample data:', data.slice(0, 3))
      setAssignments(data)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to load assignments'
      console.error('❌ Error fetching assignments:', errorMessage)
      setError(errorMessage)
      onSaveError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, onSaveError])

  const handleEditClick = useCallback(() => {
    if (!canEdit) {
      return
    }
    setIsEditMode(true)
  }, [canEdit])

  const handleCancelClick = useCallback(() => {
    setIsEditMode(false)
    setEditedCells(new Map())
    setValidationErrors(new Map())
  }, [])

  const handleSaveClick = useCallback(async () => {
    // Check permissions before save
    if (!canEdit) {
      const errorMsg = 'You do not have permission to edit resource assignments'
      setSaveError(errorMsg)
      onSaveError?.(errorMsg)
      return
    }
    
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
          const validationResult = await validateCellEdit(
            edit.resourceId,
            edit.date,
            edit.costTreatment,
            edit.newValue,
            projectId
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
      const updatePromises: Promise<any>[] = []
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
        
        const allocationPercentage = capitalPercentage + expensePercentage
        
        if (existingAssignment) {
          // Update existing assignment
          updatePromises.push(
            assignmentsApi.update(existingAssignment.id, {
              allocation_percentage: allocationPercentage,
              capital_percentage: capitalPercentage,
              expense_percentage: expensePercentage,
            })
          )
        } else {
          // Create new assignment
          createPromises.push(
            assignmentsApi.create({
              resource_id: resourceId,
              project_id: projectId,
              assignment_date: dateStr,
              allocation_percentage: allocationPercentage,
              capital_percentage: capitalPercentage,
              expense_percentage: expensePercentage,
            })
          )
        }
      }
      
      // Execute all updates and creates
      await Promise.all([...updatePromises, ...createPromises])
      
      // Success - refetch data, clear edits, exit edit mode
      await fetchAssignments()
      setEditedCells(new Map())
      setValidationErrors(new Map())
      setIsEditMode(false)
      setSaveSuccess(true)
      onSaveSuccess?.()
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
  }, [canEdit, editedCells, assignments, projectId, onSaveSuccess, onSaveError, fetchAssignments])
  
  // Transform data to grid structure
  // Memoized to avoid recalculation on every render
  const gridData: GridData | null = useMemo(() => {
    console.log('🎯 Grid data transformation starting')
    console.log('  - Project start date:', projectStartDate)
    console.log('  - Project end date:', projectEndDate)
    console.log('  - Assignments count:', assignments.length)
    
    if (!projectStartDate || !projectEndDate) {
      console.log('⚠️ Missing project dates')
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
      
      console.log('✅ Grid data created:')
      console.log('  - Resources:', result.resources.length)
      console.log('  - Dates:', result.dates.length)
      console.log('  - Cells:', result.cells.size)
      
      return result
    } catch (err) {
      console.error('❌ Error transforming grid data:', err)
      return null
    }
  }, [assignments, projectStartDate, projectEndDate])

  const handleCellChange = useCallback((
    resourceId: string,
    date: Date,
    costTreatment: 'capital' | 'expense',
    newValue: number
  ) => {
    const key = `${resourceId}:${date.toISOString()}:${costTreatment}`
    
    // Round to whole number to prevent fractional values
    const roundedValue = Math.round(newValue)
    
    // Validate the rounded value
    const validation = validatePercentage(roundedValue)
    
    if (!validation.isValid) {
      // Set validation error
      setValidationErrors((prev) => {
        const newMap = new Map(prev)
        newMap.set(key, validation.errorMessage || 'Invalid value')
        return newMap
      })
      return
    }
    
    // Clear any existing validation error
    setValidationErrors((prev) => {
      const newMap = new Map(prev)
      newMap.delete(key)
      return newMap
    })
    
    const oldValue = getCellValue(gridData!, resourceId, date, costTreatment)
    
    const edit: CellEdit = {
      resourceId,
      date,
      costTreatment,
      oldValue,
      newValue: roundedValue,
    }
    
    setEditedCells((prev) => {
      const newMap = new Map(prev)
      newMap.set(key, edit)
      return newMap
    })
  }, [gridData]) // FIXED: Include gridData in dependencies to prevent stale closure

  const handleCellBlur = useCallback(async (
    resourceId: string,
    date: Date,
    costTreatment: 'capital' | 'expense'
  ) => {
    const key = getCellKey(resourceId, date, costTreatment)
    const edit = editedCells.get(key)
    
    // Only validate if there's an edit
    if (!edit) {
      return
    }
    
    // Perform cross-project allocation validation
    try {
      const validationResult = await validateCellEdit(
        resourceId,
        date,
        costTreatment,
        edit.newValue,
        projectId
      )
      
      if (!validationResult.isValid) {
        // Set validation error
        setValidationErrors((prev) => {
          const newMap = new Map(prev)
          newMap.set(key, validationResult.errorMessage || 'Validation failed')
          return newMap
        })
        
        // Revert the cell to its old value
        setEditedCells((prev) => {
          const newMap = new Map(prev)
          newMap.delete(key)
          return newMap
        })
      } else {
        // Clear any existing validation error
        setValidationErrors((prev) => {
          const newMap = new Map(prev)
          newMap.delete(key)
          return newMap
        })
      }
    } catch (error) {
      console.error('Error validating cell:', error)
      // Set a generic error
      setValidationErrors((prev) => {
        const newMap = new Map(prev)
        newMap.set(key, 'Failed to validate allocation')
        return newMap
      })
    }
  }, [editedCells, projectId])

  const getDisplayValue = useCallback((
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
  }, [editedCells, gridData]) // FIXED: Include gridData in dependencies to prevent stale closure

  useEffect(() => {
    fetchAssignments()
  }, [fetchAssignments])

  // Format date for column headers
  // Memoized to prevent recreation on every render
  const formatDate = useCallback((date: Date): string => {
    // Use UTC methods to avoid timezone issues - format as M/D
    const month = date.getUTCMonth() + 1 // getUTCMonth() returns 0-11
    const day = date.getUTCDate()
    return `${month}/${day}`
  }, [])

  // Loading state
  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  // Error state
  if (error) {
    return <Alert severity="error">{error}</Alert>
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

  return (
    <Box sx={{ width: '100%', overflow: 'hidden' }}>
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

      {/* Success Message */}
      {saveSuccess && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>
          Assignments saved successfully
        </Alert>
      )}
      
      {/* Error Message */}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}
      
      {/* Edit Controls */}
      {canEdit && (
        <Box 
          sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}
          role="toolbar"
          aria-label="Calendar edit controls"
        >
          {!isEditMode ? (
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleEditClick}
              aria-label="Enable edit mode for resource assignments"
            >
              Edit
            </Button>
          ) : (
            <Stack direction="row" spacing={2}>
              <Button 
                variant="outlined" 
                color="secondary" 
                onClick={handleCancelClick}
                disabled={isSaving}
                aria-label="Cancel editing and discard changes"
              >
                Cancel
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleSaveClick}
                disabled={isSaving}
                aria-label="Save all changes to resource assignments"
                aria-busy={isSaving}
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
          )}
        </Box>
      )}

      {/* Calendar Table */}
      {/* 
        Performance Note: For very large date ranges (>365 days), consider implementing
        virtualization using react-window or react-virtualized to render only visible columns.
        Current implementation handles up to ~365 days efficiently with memoization.
      */}
      <Box sx={{ overflowX: 'auto', width: '100%', maxHeight: 'calc(100vh - 300px)' }}>
        <TableContainer component={Paper} sx={{ maxHeight: 'calc(100vh - 300px)' }}>
        <Table 
          sx={{ width: '100%', tableLayout: 'auto' }} 
          size="small"
          stickyHeader
          aria-label="Resource assignment calendar"
          role="grid"
        >
          <TableHead>
            <TableRow role="row">
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 0,
                  backgroundColor: '#A5C1D8',
                  fontWeight: 'bold',
                  zIndex: 4,
                  minWidth: 200,
                }}
                role="columnheader"
                aria-label="Resource name and cost treatment"
              >
                Resource
              </TableCell>
              {gridData.dates.map((date, index) => {
                // Check if this is Saturday (day 6) to add week boundary border
                const isSaturday = date.getUTCDay() === 6
                
                return (
                  <TableCell
                    key={index}
                    align="center"
                    sx={{
                      backgroundColor: '#A5C1D8',
                      fontWeight: 'bold',
                      minWidth: 50,
                      padding: '6px 4px',
                      ...(isSaturday && {
                        borderRight: '2px solid #bdbdbd',
                      }),
                    }}
                    role="columnheader"
                    aria-label={`Date: ${formatDate(date)}`}
                  >
                    {formatDate(date)}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {gridData.resources.map((resource) => (
              <React.Fragment key={resource.resourceId}>
                {/* Capital Row */}
                <TableRow role="row">
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '2px solid',
                      borderColor: 'divider',
                    }}
                    role="rowheader"
                    aria-label={`${resource.resourceName} - Capital allocations`}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {resource.resourceName}
                      </Typography>
                      <Typography variant="caption" color="primary">
                        Capital
                      </Typography>
                    </Box>
                  </TableCell>
                  {gridData.dates.map((date, dateIndex) => {
                    const value = getDisplayValue(resource.resourceId, date, 'capital')
                    const key = getCellKey(resource.resourceId, date, 'capital')
                    const hasError = validationErrors.has(key)
                    const errorMessage = validationErrors.get(key)
                    const isSaturday = date.getUTCDay() === 6
                    
                    return (
                      <TableCell
                        key={dateIndex}
                        align="center"
                        sx={{
                          backgroundColor: value > 0 ? 'action.hover' : 'background.paper',
                          padding: '6px 4px',
                          ...(isSaturday && {
                            borderRight: '2px solid #bdbdbd',
                          }),
                        }}
                        role="gridcell"
                        aria-label={`${resource.resourceName} capital allocation on ${formatDate(date)}: ${value}%`}
                      >
                        <EditableCell
                          value={value}
                          isEditMode={isEditMode}
                          hasError={hasError}
                          errorMessage={errorMessage}
                          onChange={(newValue) =>
                            handleCellChange(resource.resourceId, date, 'capital', newValue)
                          }
                          onBlur={() => handleCellBlur(resource.resourceId, date, 'capital')}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>

                {/* Expense Row */}
                <TableRow role="row">
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '2px solid',
                      borderColor: 'divider',
                      borderBottom: '2px solid',
                    }}
                    role="rowheader"
                    aria-label={`${resource.resourceName} - Expense allocations`}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight="medium">
                        {resource.resourceName}
                      </Typography>
                      <Typography variant="caption" color="secondary">
                        Expense
                      </Typography>
                    </Box>
                  </TableCell>
                  {gridData.dates.map((date, dateIndex) => {
                    const value = getDisplayValue(resource.resourceId, date, 'expense')
                    const key = getCellKey(resource.resourceId, date, 'expense')
                    const hasError = validationErrors.has(key)
                    const errorMessage = validationErrors.get(key)
                    const isSaturday = date.getUTCDay() === 6
                    
                    return (
                      <TableCell
                        key={dateIndex}
                        align="center"
                        sx={{
                          backgroundColor: value > 0 ? 'action.hover' : 'background.paper',
                          borderBottom: '2px solid',
                          borderColor: 'divider',
                          padding: '6px 4px',
                          ...(isSaturday && {
                            borderRight: '2px solid #bdbdbd',
                          }),
                        }}
                        role="gridcell"
                        aria-label={`${resource.resourceName} expense allocation on ${formatDate(date)}: ${value}%`}
                      >
                        <EditableCell
                          value={value}
                          isEditMode={isEditMode}
                          hasError={hasError}
                          errorMessage={errorMessage}
                          onChange={(newValue) =>
                            handleCellChange(resource.resourceId, date, 'expense', newValue)
                          }
                          onBlur={() => handleCellBlur(resource.resourceId, date, 'expense')}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      </Box>
    </Box>
  )
}

export default ResourceAssignmentCalendar
