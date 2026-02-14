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
import BulkConflictDialog from './BulkConflictDialog'

interface EditableCellProps {
  value: number
  isEditMode: boolean
  hasError: boolean
  errorMessage?: string
  isEdited: boolean
  onChange: (newValue: number) => void
  onBlur: () => void
}

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

  const handleBlur = () => {
    setIsFocused(false)
    onBlur()
  }

  const handleFocus = () => {
    setIsFocused(true)
    // Select all text when focusing
    // Use setTimeout to ensure the TextField has rendered and the input is available
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.select()
      }
    }, 0)
  }

  const handleClick = () => {
    if (isEditMode && !isFocused) {
      handleFocus()
    }
  }

  const handleSpanKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    // When user presses any key on the span, activate edit mode
    if (isEditMode && !isFocused) {
      // Don't handle Tab - let it move to next cell naturally
      if (e.key === 'Tab') {
        return
      }
      e.preventDefault()
      handleFocus()
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
      <span
        ref={spanRef}
        tabIndex={0}
        role="button"
        onClick={handleClick}
        onKeyDown={handleSpanKeyDown}
        onFocus={handleFocus}
        style={{
          display: 'inline-block',
          width: '50px',
          textAlign: 'center',
          padding: '2px 4px',
          fontSize: '0.875rem',
          border: displayError ? '1px solid #d32f2f' : '1px solid #e0e0e0',
          backgroundColor: isEdited ? 'rgba(255, 182, 193, 0.3)' : 'transparent',
          cursor: 'text',
          outline: 'none',
          borderRadius: '4px',
          boxShadow: '0 0 0 1px rgba(0, 0, 0, 0.05) inset',
        }}
        aria-label="Allocation percentage"
        aria-invalid={displayError}
        aria-describedby={displayError ? 'cell-error' : undefined}
      >
        {formatPercentage(value)}
      </span>
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
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [editedCells, setEditedCells] = useState<Map<string, CellEdit>>(new Map())
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

  // Memoize fetchAssignments to prevent recreation on every render
  const fetchAssignments = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const data = await assignmentsApi.getByProject(projectId)
      setAssignments(data)
    } catch (err: any) {
      const errorMessage = err.response?.data?.detail || 'Failed to load assignments'
      setError(errorMessage)
      // Note: We intentionally don't include onSaveError in dependencies
      // to prevent unnecessary refetches when parent re-renders
      onSaveError?.(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }, [projectId]) // Removed onSaveError from dependencies

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
    setEditedCells(new Map())
    setValidationErrors(new Map())
    
    // Restore scroll position after state update
    requestAnimationFrame(() => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = scrollLeft
        scrollContainerRef.current.scrollTop = scrollTop
      }
    })
  }, [])

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
        const failedIds = bulkResult.failed.map((f: any) => f.id)
        const failedCount = bulkResult.failed.length
        const successCount = bulkResult.succeeded.length + createResults.length
        
        // Update local state with successful updates
        setAssignments((prevAssignments) => {
          const updatedAssignments = [...prevAssignments]
          
          // Apply successful updates
          for (const success of bulkResult.succeeded) {
            const index = updatedAssignments.findIndex((a) => a.id === success.id)
            if (index >= 0) {
              // Find the edit for this assignment
              const assignment = updatedAssignments[index]
              const dateStr = assignment.assignment_date
              const key = `${assignment.resource_id}:${dateStr}`
              const edits = editsByResourceDate.get(key) || []
              
              let capitalPercentage = assignment.capital_percentage
              let expensePercentage = assignment.expense_percentage
              
              for (const edit of edits) {
                if (edit.costTreatment === 'capital') {
                  capitalPercentage = Math.round(edit.newValue)
                } else {
                  expensePercentage = Math.round(edit.newValue)
                }
              }
              
              updatedAssignments[index] = {
                ...assignment,
                capital_percentage: capitalPercentage,
                expense_percentage: expensePercentage,
                version: success.version,
              }
            }
          }
          
          // Add created assignments
          for (const created of createResults) {
            updatedAssignments.push(created)
          }
          
          return updatedAssignments
        })
        
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
        // All updates succeeded
        setAssignments((prevAssignments) => {
          const updatedAssignments = [...prevAssignments]
          
          // Apply all successful updates
          for (const success of bulkResult.succeeded) {
            const index = updatedAssignments.findIndex((a) => a.id === success.id)
            if (index >= 0) {
              const assignment = updatedAssignments[index]
              const dateStr = assignment.assignment_date
              const key = `${assignment.resource_id}:${dateStr}`
              const edits = editsByResourceDate.get(key) || []
              
              let capitalPercentage = assignment.capital_percentage
              let expensePercentage = assignment.expense_percentage
              
              for (const edit of edits) {
                if (edit.costTreatment === 'capital') {
                  capitalPercentage = Math.round(edit.newValue)
                } else {
                  expensePercentage = Math.round(edit.newValue)
                }
              }
              
              updatedAssignments[index] = {
                ...assignment,
                capital_percentage: capitalPercentage,
                expense_percentage: expensePercentage,
                version: success.version,
              }
            }
          }
          
          // Add created assignments
          for (const created of createResults) {
            updatedAssignments.push(created)
          }
          
          return updatedAssignments
        })
        
        // Clear all edits and exit edit mode
        setEditedCells(new Map())
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
  }, [canEdit, editedCells, assignments, projectId, onSaveSuccess, onSaveError, fetchAssignments])
  
  const handleConflictRefreshAndRetry = useCallback(async () => {
    // Close the dialog
    setConflictDialogOpen(false)
    
    // Refresh assignments to get latest data
    await fetchAssignments()
    
    // The failed edits are still in editedCells, so user can see them highlighted
    // and can click Save again to retry
  }, [fetchAssignments])
  
  const handleConflictCancel = useCallback(() => {
    // Close the dialog
    setConflictDialogOpen(false)
    
    // Clear all edits and exit edit mode
    setEditedCells(new Map())
    setValidationErrors(new Map())
    setIsEditMode(false)
  }, [])
  
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

  // NOT memoized - we want this to always have access to current state
  const handleCellChange = (
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
      // Set validation error
      setValidationErrors((prev) => {
        const newMap = new Map(prev)
        newMap.set(key, validation.errorMessage || 'Invalid value')
        return newMap
      })
      return
    }
    
    // Clear any existing validation error (will be re-set if cross-project validation fails)
    setValidationErrors((prev) => {
      const newMap = new Map(prev)
      newMap.delete(key)
      return newMap
    })
    
    const oldValue = getCellValue(gridData!, resourceId, date, costTreatment)
    
    // If the new value equals the original value, remove from edited cells
    // This handles the case where user changes a value then changes it back
    if (roundedValue === Math.round(oldValue)) {
      setEditedCells((prev) => {
        const newMap = new Map(prev)
        newMap.delete(key)
        return newMap
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
    
    setEditedCells((prev) => {
      const newMap = new Map(prev)
      newMap.set(key, edit)
      return newMap
    })
    
    // Note: Cross-project validation is now deferred to handleCellBlur
    // This improves responsiveness by not blocking on API calls during typing
  }

  const handleCellBlur = useCallback(async (
    resourceId: string,
    date: Date,
    costTreatment: 'capital' | 'expense'
  ) => {
    const key = getCellKey(resourceId, date, costTreatment)
    const edit = editedCells.get(key)
    
    // Only validate if there's an edit - this prevents validation on initial render
    // when entering edit mode
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
        // Set validation error but keep the edited value
        // User can see the error and decide whether to fix it or revert manually
        setValidationErrors((prev) => {
          const newMap = new Map(prev)
          newMap.set(key, validationResult.errorMessage || 'Validation failed')
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
      // Set a generic error but keep the edited value
      setValidationErrors((prev) => {
        const newMap = new Map(prev)
        newMap.set(key, 'Failed to validate allocation')
        return newMap
      })
    }
  }, [editedCells, projectId])

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
                    const value = getDisplayValue(resource.resourceId, date, 'capital')
                    const key = getCellKey(resource.resourceId, date, 'capital')
                    const hasError = validationErrors.has(key)
                    const errorMessage = validationErrors.get(key)
                    const isEdited = editedCells.has(key)
                    const isSaturday = date.getUTCDay() === 6
                    
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
                        <EditableCell
                          value={value}
                          isEditMode={isEditMode}
                          hasError={hasError}
                          errorMessage={errorMessage}
                          isEdited={isEdited}
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
                    const value = getDisplayValue(resource.resourceId, date, 'expense')
                    const key = getCellKey(resource.resourceId, date, 'expense')
                    const hasError = validationErrors.has(key)
                    const errorMessage = validationErrors.get(key)
                    const isEdited = editedCells.has(key)
                    const isSaturday = date.getUTCDay() === 6
                    
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
                        <EditableCell
                          value={value}
                          isEditMode={isEditMode}
                          hasError={hasError}
                          errorMessage={errorMessage}
                          isEdited={isEdited}
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
