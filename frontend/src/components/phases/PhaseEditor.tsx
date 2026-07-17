import React, { useState, useEffect, useMemo } from 'react'
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { ProjectPhase, PhaseValidationError } from '../../types'
import { phasesApi } from '../../api/phases'
import { validatePhases, getNextDay, getPreviousDay } from '../../utils/phaseValidation'
import PhaseTimeline from './PhaseTimeline'
import PhaseList from './PhaseList'
import ValidationErrorDisplay from './ValidationErrorDisplay'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission } from '../../utils/permissions'

interface PhaseEditorProps {
  projectId: string
  projectStartDate: string
  projectEndDate: string
  onSave?: () => void
  onCancel?: () => void
  onSaveSuccess?: () => void
  onSaveError?: (error: string) => void
}

const PhaseEditor: React.FC<PhaseEditorProps> = ({
  projectId,
  projectStartDate,
  projectEndDate,
  onSave,
  onCancel,
  onSaveSuccess,
  onSaveError,
}) => {
  const { user } = useAuth()
  const canEdit = useMemo(() => hasPermission(user, 'edit_projects').hasPermission, [user])
  const [isEditMode, setIsEditMode] = useState(false)
  const [phases, setPhases] = useState<Partial<ProjectPhase>[]>([])
  const [originalPhases, setOriginalPhases] = useState<Partial<ProjectPhase>[]>([])
  const [changedFields, setChangedFields] = useState<Record<string, Set<string>>>({}) // Track which fields changed per phase
  const [deletedPhaseIds, setDeletedPhaseIds] = useState<Set<string>>(new Set()) // Track phases marked for deletion
  const [validationErrors, setValidationErrors] = useState<PhaseValidationError[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Helper function to safely convert budget values to numbers
  const toNumber = (value: string | number | undefined): number => {
    if (value === undefined || value === null) return 0
    if (typeof value === 'string') return parseFloat(value) || 0
    return value
  }

  // Load phases on mount
  useEffect(() => {
    loadPhases()
  }, [projectId])

  // Validate phases whenever they change
  useEffect(() => {
    if (phases.length > 0) {
      // Filter out deleted phases for validation
      const activePhases = phases.filter(p => !deletedPhaseIds.has(p.id || ''))
      const result = validatePhases(activePhases, projectStartDate, projectEndDate)
      setValidationErrors(result.errors)
    }
  }, [phases, deletedPhaseIds, projectStartDate, projectEndDate])

  // Detect changes automatically
  useEffect(() => {
    // Check if there are any deleted phases
    const hasDeletions = deletedPhaseIds.size > 0
    
    // Check if there are any field changes
    const hasFieldChanges = Object.keys(changedFields).length > 0
    
    // Check if phases array length changed (new phases added)
    const hasNewPhases = phases.some(p => p.id?.startsWith('temp-'))
    
    setHasChanges(hasDeletions || hasFieldChanges || hasNewPhases)
  }, [phases, changedFields, deletedPhaseIds])

  const loadPhases = async () => {
    try {
      setIsLoading(true)
      const data = await phasesApi.list(projectId)
      setPhases(data)
      setOriginalPhases(data)
      setChangedFields({})
      setDeletedPhaseIds(new Set())
      setHasChanges(false)
    } catch (error) {
      console.error('Error loading phases:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddPhase = () => {
    // Find the last phase
    const sortedPhases = [...phases].sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })

    let newPhaseStartDate = projectStartDate
    let newPhaseEndDate = projectEndDate

    if (sortedPhases.length > 0) {
      const lastPhase = sortedPhases[sortedPhases.length - 1]
      if (lastPhase.end_date) {
        // Split the last phase in half
        const lastPhaseStart = new Date(lastPhase.start_date!)
        const lastPhaseEnd = new Date(lastPhase.end_date)
        const midpoint = new Date(
          lastPhaseStart.getTime() + (lastPhaseEnd.getTime() - lastPhaseStart.getTime()) / 2
        )

        // Update last phase to end at midpoint
        const updatedPhases = phases.map((p) =>
          p.id === lastPhase.id
            ? { ...p, end_date: midpoint.toISOString().split('T')[0] }
            : p
        )

        // New phase starts the day after midpoint
        newPhaseStartDate = getNextDay(midpoint.toISOString().split('T')[0])
        newPhaseEndDate = lastPhase.end_date

        setPhases([
          ...updatedPhases,
          {
            id: `temp-${Date.now()}`,
            project_id: projectId,
            name: `Phase ${phases.length + 1}`,
            start_date: newPhaseStartDate,
            end_date: newPhaseEndDate,
            description: '',
            labor_capital_budget: 0,
            labor_expense_budget: 0,
            nonlabor_capital_budget: 0,
            nonlabor_expense_budget: 0,
            total_budget: 0,
          },
        ])
      }
    } else {
      // First phase - use entire project duration
      setPhases([
        {
          id: `temp-${Date.now()}`,
          project_id: projectId,
          name: 'Phase 1',
          start_date: projectStartDate,
          end_date: projectEndDate,
          description: '',
          labor_capital_budget: 0,
          labor_expense_budget: 0,
          nonlabor_capital_budget: 0,
          nonlabor_expense_budget: 0,
          total_budget: 0,
        },
      ])
    }
  }

  const handleUpdatePhase = (phaseId: string, rawUpdates: Partial<ProjectPhase>) => {
    // The table now pushes a single changed field per keystroke (no more
    // per-row save buffer), so total_budget must be kept in sync here
    // whenever one of the four budget fields changes - otherwise the
    // total_budget-matches-sum validation fires spuriously while typing.
    const budgetFields: (keyof ProjectPhase)[] = [
      'labor_capital_budget',
      'labor_expense_budget',
      'nonlabor_capital_budget',
      'nonlabor_expense_budget',
    ]
    const touchesBudget = budgetFields.some((field) => field in rawUpdates)
    const currentPhase = phases.find((p) => p.id === phaseId)
    const updates: Partial<ProjectPhase> = touchesBudget && currentPhase
      ? {
          ...rawUpdates,
          total_budget: budgetFields.reduce(
            (sum, field) => sum + toNumber(field in rawUpdates ? rawUpdates[field] : currentPhase[field]),
            0
          ),
        }
      : rawUpdates

    setPhases((prev) =>
      prev.map((phase) => (phase.id === phaseId ? { ...phase, ...updates } : phase))
    )
    
    // Track which fields changed
    setChangedFields((prev) => {
      const newChangedFields = { ...prev }
      const originalPhase = originalPhases.find(p => p.id === phaseId)
      const updatedPhase = phases.find(p => p.id === phaseId)
      
      if (!originalPhase || !updatedPhase) {
        // New phase - mark all fields as changed
        newChangedFields[phaseId] = new Set(Object.keys(updates))
      } else {
        // Existing phase - check which fields actually changed
        const changedFieldsSet = new Set<string>()
        Object.keys(updates).forEach(key => {
          const originalValue = originalPhase[key as keyof ProjectPhase]
          const newValue = { ...updatedPhase, ...updates }[key as keyof ProjectPhase]
          if (originalValue !== newValue) {
            changedFieldsSet.add(key)
          }
        })
        
        // Merge with existing changed fields
        if (prev[phaseId]) {
          prev[phaseId].forEach(field => changedFieldsSet.add(field))
        }
        
        // Remove fields that match original value
        Object.keys(updates).forEach(key => {
          const originalValue = originalPhase[key as keyof ProjectPhase]
          const newValue = { ...updatedPhase, ...updates }[key as keyof ProjectPhase]
          if (originalValue === newValue) {
            changedFieldsSet.delete(key)
          }
        })
        
        if (changedFieldsSet.size > 0) {
          newChangedFields[phaseId] = changedFieldsSet
        } else {
          delete newChangedFields[phaseId]
        }
      }
      
      return newChangedFields
    })
  }

  const handlePhaseResize = (phaseId: string, newStartDate: string, newEndDate: string) => {
    handleUpdatePhase(phaseId, {
      start_date: newStartDate,
      end_date: newEndDate,
    })
  }

  const handlePhaseReorder = (reorderedPhases: Partial<ProjectPhase>[]) => {
    // Update phases with the reordered list
    setPhases(reorderedPhases)
    
    // Track which fields changed for each phase
    setChangedFields((prev) => {
      const newChangedFields = { ...prev }
      
      reorderedPhases.forEach((reorderedPhase) => {
        const originalPhase = originalPhases.find(p => p.id === reorderedPhase.id)
        
        if (!originalPhase || !reorderedPhase.id) return
        
        // Check which fields actually changed
        const changedFieldsSet = new Set<string>(prev[reorderedPhase.id] || [])
        
        // Check if dates changed
        if (originalPhase.start_date !== reorderedPhase.start_date) {
          changedFieldsSet.add('start_date')
        }
        if (originalPhase.end_date !== reorderedPhase.end_date) {
          changedFieldsSet.add('end_date')
        }
        
        // Remove fields that match original value
        if (originalPhase.start_date === reorderedPhase.start_date) {
          changedFieldsSet.delete('start_date')
        }
        if (originalPhase.end_date === reorderedPhase.end_date) {
          changedFieldsSet.delete('end_date')
        }
        
        if (changedFieldsSet.size > 0) {
          newChangedFields[reorderedPhase.id] = changedFieldsSet
        } else {
          delete newChangedFields[reorderedPhase.id]
        }
      })
      
      return newChangedFields
    })
  }

  const handleDeletePhase = (phaseId: string) => {
    // Count active (non-deleted) phases
    const activePhases = phases.filter(p => !deletedPhaseIds.has(p.id || ''))
    if (activePhases.length === 1) {
      return // Cannot delete last active phase
    }

    // Find the phase to delete and its neighbors
    const sortedPhases = [...phases].sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })

    const phaseIndex = sortedPhases.findIndex((p) => p.id === phaseId)
    if (phaseIndex === -1) return

    const phaseToDelete = sortedPhases[phaseIndex]
    const previousPhase = phaseIndex > 0 ? sortedPhases[phaseIndex - 1] : null
    const nextPhase = phaseIndex < sortedPhases.length - 1 ? sortedPhases[phaseIndex + 1] : null

    // Mark phase for deletion
    setDeletedPhaseIds(prev => new Set([...prev, phaseId]))

    // Adjust adjacent phases to cover the deleted phase's date range
    // Also shrink the deleted phase to a single day to avoid overlap errors during pending state
    if (previousPhase && nextPhase && !deletedPhaseIds.has(previousPhase.id || '') && !deletedPhaseIds.has(nextPhase.id || '')) {
      // Phase is between two other phases - split the difference
      const deletedStart = new Date(phaseToDelete.start_date!)
      const deletedEnd = new Date(phaseToDelete.end_date!)
      const midpoint = new Date(
        deletedStart.getTime() + (deletedEnd.getTime() - deletedStart.getTime()) / 2
      )
      
      // Extend previous phase to midpoint
      const prevEnd = midpoint.toISOString().split('T')[0]
      handleUpdatePhase(previousPhase.id!, { 
        end_date: prevEnd
      })
      
      // Extend next phase from day after midpoint
      const nextStart = getNextDay(midpoint.toISOString().split('T')[0])
      handleUpdatePhase(nextPhase.id!, { 
        start_date: nextStart
      })
      
      // Shrink deleted phase to avoid overlap - make it the day before next phase starts
      const deletedDay = getPreviousDay(nextStart)
      handleUpdatePhase(phaseId, {
        start_date: deletedDay,
        end_date: deletedDay
      })
    } else if (previousPhase && !deletedPhaseIds.has(previousPhase.id || '')) {
      // Extend previous phase to cover deleted phase (last phase being deleted)
      handleUpdatePhase(previousPhase.id!, { 
        end_date: phaseToDelete.end_date 
      })
      
      // Shrink deleted phase to a single day after the previous phase
      const deletedDay = getNextDay(phaseToDelete.end_date!)
      handleUpdatePhase(phaseId, {
        start_date: deletedDay,
        end_date: deletedDay
      })
    } else if (nextPhase && !deletedPhaseIds.has(nextPhase.id || '')) {
      // Extend next phase to cover deleted phase (first phase being deleted)
      handleUpdatePhase(nextPhase.id!, { 
        start_date: phaseToDelete.start_date 
      })
      
      // Shrink deleted phase to a single day before the next phase
      const deletedDay = getPreviousDay(phaseToDelete.start_date!)
      handleUpdatePhase(phaseId, {
        start_date: deletedDay,
        end_date: deletedDay
      })
    }
  }

  const handleSave = async () => {
    // Filter out deleted phases for validation
    const activePhases = phases.filter(p => !deletedPhaseIds.has(p.id || ''))
    
    // Validate before saving
    const result = validatePhases(activePhases, projectStartDate, projectEndDate)
    if (!result.is_valid) {
      setValidationErrors(result.errors)
      return
    }

    try {
      setIsSaving(true)

      // Use batch update endpoint - send only active (non-deleted) phases
      // Convert string budgets to numbers and calculate total_budget
      const phasesData = activePhases.map((phase) => {
        const laborCapital = toNumber(phase.labor_capital_budget)
        const laborExpense = toNumber(phase.labor_expense_budget)
        const nonlaborCapital = toNumber(phase.nonlabor_capital_budget)
        const nonlaborExpense = toNumber(phase.nonlabor_expense_budget)
        return {
          id: phase.id?.startsWith('temp-') ? null : phase.id,
          name: phase.name!,
          start_date: phase.start_date!,
          end_date: phase.end_date!,
          description: phase.description || '',
          labor_capital_budget: laborCapital,
          labor_expense_budget: laborExpense,
          nonlabor_capital_budget: nonlaborCapital,
          nonlabor_expense_budget: nonlaborExpense,
          total_budget: laborCapital + laborExpense + nonlaborCapital + nonlaborExpense,
        }
      })

      await phasesApi.batchUpdate(projectId, { phases: phasesData })

      // Reload phases
      await loadPhases()
      setHasChanges(false)
      setIsEditMode(false)

      if (onSave) {
        onSave()
      }
      if (onSaveSuccess) {
        onSaveSuccess()
      }
    } catch (error) {
      console.error('Error saving phases:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      if (onSaveError) {
        onSaveError(errorMessage)
      }
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setPhases(originalPhases)
    setChangedFields({})
    setDeletedPhaseIds(new Set())
    setHasChanges(false)
    setValidationErrors([])
    setIsEditMode(false)

    if (onCancel) {
      onCancel()
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    )
  }

  const hasValidationErrors = validationErrors.length > 0

  // Filter out deleted phases for timeline display
  const activePhases = phases.filter(p => !deletedPhaseIds.has(p.id || ''))

  const headerActions = !isEditMode ? (
    canEdit ? (
      <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => setIsEditMode(true)}>
        Edit
      </Button>
    ) : null
  ) : (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <Button variant="outlined" size="small" startIcon={<AddIcon />} onClick={handleAddPhase}>
        Add Phase
      </Button>
      <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleCancel} disabled={isSaving}>
        Cancel
      </Button>
      <Button variant="contained" size="small"
        startIcon={isSaving ? <CircularProgress size={16} /> : <SaveIcon />}
        onClick={handleSave} disabled={isSaving || hasValidationErrors || !hasChanges}>
        Save Changes
      </Button>
    </Box>
  )

  return (
    <Paper sx={{ p: 2 }}>
      <ValidationErrorDisplay errors={validationErrors} />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Phases &amp; Budget</Typography>
        {headerActions}
      </Box>

      <PhaseTimeline
        embedded
        phases={activePhases}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        validationErrors={validationErrors}
        onPhaseResize={handlePhaseResize}
        enableResize={isEditMode}
        onPhaseReorder={handlePhaseReorder}
        enableReorder={isEditMode}
      />

      <PhaseList
        editMode={isEditMode}
        phases={phases}
        onUpdate={handleUpdatePhase}
        onDelete={handleDeletePhase}
        changedFields={changedFields}
        deletedPhaseIds={deletedPhaseIds}
      />
    </Paper>
  )
}

export default PhaseEditor
