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

interface EditableCellProps {
  value: number
  isEditMode: boolean
  hasError: boolean
  errorMessage?: string
  isEdited: boolean
  onChange: (newValue: number) => void
  onBlur: () => void
}

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
    <EditableCell
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

const EditableCell: React.FC<EditableCellProps> = React.memo(({
  value,
  isEditMode,
  hasError,
  errorMessage,
  isEdited,
  onChange,
  onBlur,
}) => {
  const [inputValue, setInputValue] = useState(value.toString())
  const [localError, setLocalError] = useState<string | undefined>()
  const [isFocused, setIsFocused] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const spanRef = React.useRef<HTMLSpanElement>(null)

  useEffect(() => {
    setInputValue(value.toString())
  }, [value])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    setLocalError(undefined)
    // Don't validate on every keystroke - wait for blur for instant typing
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Commit the value before blurring
      commitValue()
      setIsFocused(false)
      onBlur()
    } else if (e.key === 'Escape') {
      // Escape key reverts to original value and exits edit
      e.preventDefault()
      setInputValue(value.toString())
      setLocalError(undefined)
      setIsFocused(false)
      onBlur()
    }
    // Tab key will naturally trigger blur and move to next cell
  }

  const commitValue = () => {
    const numericValue = parseFloat(inputValue)
    if (!isNaN(numericValue)) {
      const validation = validatePercentage(numericValue)
      if (validation.isValid) {
        // Only call onChange if the value actually changed
        if (numericValue !== value) {
          onChange(numericValue)
        }
        setLocalError(undefined)
      } else {
        setLocalError(validation.errorMessage)
      }
    } else if (inputValue === '') {
      // Only call onChange if the value actually changed
      if (value !== 0) {
        onChange(0)
      }
      setLocalError(undefined)
    } else {
      setLocalError('Value must be a number')
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    // Commit immediately - no setTimeout to avoid queuing delays during rapid tabbing
    commitValue()
    onBlur()
  }

  const handleFocus = () => {
    // Do NOT automatically show TextField on focus
    // This allows instant tab navigation without re-render blocking
    // TextField will only show when user clicks or starts typing
  }

  const handleClick = () => {
    if (isEditMode && !isFocused) {
      // Show TextField on click
      setIsFocused(true)
      // Select all text when focusing (after TextField renders)
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.select()
        }
      }, 0)
    }
  }

  const handleSpanKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    // When user presses any key on the span, activate edit mode
    if (isEditMode && !isFocused) {
      // Don't handle Tab - let it move to next cell naturally
      if (e.key === 'Tab') {
        return
      }
      // For any other key, show the TextField
      e.preventDefault()
      setIsFocused(true)
      // The TextField will render and receive focus
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.select()
        }
      }, 0)
    }
  }

  const formatPercentage = (val: number): string => {
    if (val === 0) return ''
    // Round to whole number and display without % symbol
    return `${Math.round(val)}`
  }

  const displayError = hasError || !!localError
  const displayErrorMessage = errorMessage || localError

  // Not in edit mode: show plain text with consistent border styling
  if (!isEditMode) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: '50px',
          textAlign: 'center',
          padding: '2px 4px',
          fontSize: '0.875rem',
          border: '1px solid transparent',
          backgroundColor: 'transparent',
          borderRadius: '4px',
          boxShadow: '0 0 0 1px transparent inset',
        }}
      >
        {formatPercentage(value)}
      </span>
    )
  }

  // In edit mode but not focused: show as clickable/tabbable span
  // This prevents rendering thousands of input/TextField components at once
  if (!isFocused) {
    const cellContent = (
      <Box
        component="span"
        ref={spanRef}
        tabIndex={0}
        role="button"
        onClick={handleClick}
        onKeyDown={handleSpanKeyDown}
        onFocus={handleFocus}
        sx={{
          display: 'inline-block',
          width: '50px',
          textAlign: 'center',
          padding: '2px 4px',
          fontSize: '0.875rem',
          border: displayError ? '1px solid #d32f2f' : '1px solid #e0e0e0',
          backgroundColor: isEdited ? 'rgba(255, 182, 193, 0.3)' : 'transparent',
          cursor: 'text',
          borderRadius: '4px',
          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.05) inset',
          // Focus styling - visible outline when tabbing
          '&:focus': {
            outline: '2px solid #1976d2',
            outlineOffset: '1px',
            boxShadow: '0 0 0 3px rgba(25, 118, 210, 0.2)',
          },
        }}
        aria-label="Allocation percentage"
        aria-invalid={displayError}
        aria-describedby={displayError ? 'cell-error' : undefined}
      >
        {formatPercentage(value)}
      </Box>
    )

    if (displayError && displayErrorMessage) {
      return (
        <Tooltip title={displayErrorMessage} arrow>
          {cellContent}
        </Tooltip>
      )
    }

    return cellContent
  }

  // When focused, show full TextField
  const cellContent = (
    <TextField
      inputRef={inputRef}
      value={inputValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      autoFocus
      size="small"
      type="text"
      inputProps={{
        inputMode: 'numeric',
        pattern: '[0-9]*',
        'aria-label': 'Allocation percentage',
        'aria-invalid': displayError,
        'aria-describedby': displayError ? 'cell-error' : undefined,
      }}
      error={displayError}
      sx={{
        width: '50px',
        '& .MuiInputBase-root': {
          backgroundColor: isEdited ? 'rgba(255, 182, 193, 0.3)' : 'transparent',
        },
        '& .MuiInputBase-input': {
          textAlign: 'center',
          padding: '2px 4px',
          fontSize: '0.875rem',
        },
        // Remove spinner arrows
        '& input[type=number]': {
          MozAppearance: 'textfield',
        },
        '& input[type=number]::-webkit-outer-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
        },
        '& input[type=number]::-webkit-inner-spin-button': {
          WebkitAppearance: 'none',
          margin: 0,
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
}, (prevProps, nextProps) => {
  // Custom comparison function for React.memo
  // Return true if props are equal (skip re-render), false if different (re-render)
  return (
    prevProps.value === nextProps.value &&
    prevProps.isEditMode === nextProps.isEditMode &&
    prevProps.hasError === nextProps.hasError &&
    prevProps.errorMessage === nextProps.errorMessage &&
    prevProps.isEdited === nextProps.isEdited
    // Note: We intentionally don't compare onChange and onBlur functions
    // as they are recreated on every render but their behavior is the same
  )
})

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
  
  // Use React Query hook for assignments data
  const { data: assignments = [], isLoading, error: queryError, refetch } = useProjectAssignments(projectId)
  const { invalidateProject } = useInvalidateAssignments()
  
  // Use persisted edits hook to maintain unsaved changes across navigation
  const { editedCells, setEditedCells, clearEdits } = usePersistedEdits(projectId)
  
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false)
  const [bulkConflictFailures, setBulkConflictFailures] = useState<BulkUpdateFailure[]>([])
  const [bulkConflictSuccessCount, setBulkConflictSuccessCount] = useState(0)
  
  // Ref to track scroll position
  const scrollContainerRef = React.useRef<HTMLDivElement>(null)

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
      setIsEditMode(true)
    }
  }, [editedCells.size, isEditMode, canEdit])

  const handleEditClick = useCallback(() => {
    if (!canEdit) {
      return
    }
    // Save scroll position before entering edit mode
    const scrollLeft = scrollContainerRef.current?.scrollLeft || 0
    const scrollTop = scrollContainerRef.current?.scrollTop || 0
    
    setIsEditMode(true)
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollLeft
        scrollContainerRef.current.scrollTop = scrollTop
      }
    })
  }, [canEdit])

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
            version: existingAssignment.version,
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
                type="button"
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
          )}
        </Box>
      )}

      {/* Calendar Table */}
      {/* 
        Performance Note: For very large date ranges (>365 days), consider implementing
        virtualization using react-window or react-virtualized to render only visible columns.
        Current implementation handles up to ~365 days efficiently with memoization.
      */}
      <Box ref={scrollContainerRef} sx={{ overflowX: 'auto', width: '100%', maxHeight: 'calc(100vh - 300px)' }}>
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
                aria-label="Resource name"
              >
                Resource
              </TableCell>
              <TableCell
                sx={{
                  position: 'sticky',
                  left: 200, // Adjust based on resource name column width
                  backgroundColor: '#A5C1D8',
                  fontWeight: 'bold',
                  zIndex: 4,
                  minWidth: 60,
                }}
                role="columnheader"
                aria-label="Cost treatment type"
              >
                Type
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
                  {/* Resource Name Cell - spans 2 rows */}
                  <TableCell
                    rowSpan={2}
                    sx={{
                      position: 'sticky',
                      left: 0,
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '2px solid',
                      borderColor: 'divider',
                      borderBottom: '2px solid',
                      verticalAlign: 'middle',
                    }}
                    role="rowheader"
                    aria-label={`${resource.resourceName} - Capital and Expense allocations`}
                  >
                    <Typography variant="body2" fontWeight="medium">
                      {resource.resourceName}
                    </Typography>
                  </TableCell>
                  {/* Cost Treatment Label Cell - Capital */}
                  <TableCell
                    sx={{
                      position: 'sticky',
                      left: 200, // Adjust based on resource name column width
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '2px solid',
                      borderColor: 'divider',
                      minWidth: 60,
                      padding: '6px 8px',
                    }}
                    role="rowheader"
                    aria-label="Capital"
                  >
                    <Typography variant="caption" color="primary">
                      Cap
                    </Typography>
                  </TableCell>
                  {gridData.dates.map((date, dateIndex) => {
                    const key = getCellKey(resource.resourceId, date, 'capital')
                    const isSaturday = date.getUTCDay() === 6
                    const isEdited = editedCells.has(key)
                    const value = getDisplayValue(resource.resourceId, date, 'capital')
                    
                    return (
                      <TableCell
                        key={dateIndex}
                        align="center"
                        sx={{
                          backgroundColor: isEdited 
                            ? 'rgba(255, 182, 193, 0.3)' 
                            : value > 0 
                              ? 'action.hover' 
                              : 'background.paper',
                          padding: '6px 4px',
                          ...(isSaturday && {
                            borderRight: '2px solid #bdbdbd',
                          }),
                        }}
                        role="gridcell"
                        aria-label={`${resource.resourceName} capital allocation on ${formatDate(date)}: ${value}%`}
                      >
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
                      left: 200, // Adjust based on resource name column width
                      backgroundColor: 'background.paper',
                      fontWeight: 'medium',
                      zIndex: 2,
                      borderRight: '2px solid',
                      borderColor: 'divider',
                      borderBottom: '2px solid',
                      minWidth: 60,
                      padding: '6px 8px',
                    }}
                    role="rowheader"
                    aria-label="Expense"
                  >
                    <Typography variant="caption" color="secondary">
                      Exp
                    </Typography>
                  </TableCell>
                  {gridData.dates.map((date, dateIndex) => {
                    const key = getCellKey(resource.resourceId, date, 'expense')
                    const isSaturday = date.getUTCDay() === 6
                    const isEdited = editedCells.has(key)
                    const value = getDisplayValue(resource.resourceId, date, 'expense')
                    
                    return (
                      <TableCell
                        key={dateIndex}
                        align="center"
                        sx={{
                          backgroundColor: isEdited 
                            ? 'rgba(255, 182, 193, 0.3)' 
                            : value > 0 
                              ? 'action.hover' 
                              : 'background.paper',
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
