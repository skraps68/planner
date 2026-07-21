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
import { computeChangedFields, withSyncedTotal, BUDGET_FIELDS, toNumber } from './phaseChangeTracking'

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
  // Creation-time snapshots for new (temp-) phases, so their cells diff against
  // the value they were born with (budgets 0, split dates) — see computeChangedFields.
  const [newPhaseBaselines, setNewPhaseBaselines] = useState<Record<string, Partial<ProjectPhase>>>({})
  const [deletedPhaseIds, setDeletedPhaseIds] = useState<Set<string>>(new Set()) // Track phases marked for deletion
  const [validationErrors, setValidationErrors] = useState<PhaseValidationError[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Baseline (original values) per phase id: saved phases from the API, plus the
  // creation snapshot of any new phase. Drives the derived change highlighting.
  const baselineById = useMemo(() => {
    const map: Record<string, Partial<ProjectPhase>> = {}
    for (const phase of originalPhases) if (phase.id) map[phase.id] = phase
    for (const [id, baseline] of Object.entries(newPhaseBaselines)) map[id] = baseline
    return map
  }, [originalPhases, newPhaseBaselines])

  // Which fields deviate from baseline, derived from current state (immune to the
  // stale-closure / replace-vs-merge bugs of incremental tracking; clears on revert).
  const changedFields = useMemo(
    () => computeChangedFields(phases, baselineById, deletedPhaseIds),
    [phases, baselineById, deletedPhaseIds]
  )

  // There are unsaved changes if a field deviates, a phase is deleted, or a new phase exists.
  const hasChanges =
    deletedPhaseIds.size > 0 ||
    Object.keys(changedFields).length > 0 ||
    phases.some((p) => p.id?.startsWith('temp-'))

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

  const loadPhases = async () => {
    try {
      setIsLoading(true)
      const data = await phasesApi.list(projectId)
      setPhases(data)
      setOriginalPhases(data)
      setNewPhaseBaselines({})
      setDeletedPhaseIds(new Set())
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

        const tempId = `temp-${Date.now()}`
        const newPhase: Partial<ProjectPhase> = {
          id: tempId,
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
        }
        setPhases([...updatedPhases, newPhase])
        setNewPhaseBaselines((prev) => ({ ...prev, [tempId]: { ...newPhase } }))
      }
    } else {
      // First phase - use entire project duration
      const tempId = `temp-${Date.now()}`
      const newPhase: Partial<ProjectPhase> = {
        id: tempId,
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
      }
      setPhases([newPhase])
      setNewPhaseBaselines((prev) => ({ ...prev, [tempId]: { ...newPhase } }))
    }
  }

  const handleUpdatePhase = (phaseId: string, rawUpdates: Partial<ProjectPhase>) => {
    // Apply the edit and, when a budget field is touched, re-sync total_budget from
    // the MERGED phase (not a render-time snapshot) so the total always equals the
    // sum of the four budgets regardless of update batching. Change highlighting is
    // derived from state (see changedFields), so nothing is tracked imperatively here.
    const touchesBudget = BUDGET_FIELDS.some((field) => field in rawUpdates)
    setPhases((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase
        const merged = { ...phase, ...rawUpdates }
        return touchesBudget ? withSyncedTotal(merged) : merged
      })
    )
  }

  const handlePhaseResize = (phaseId: string, newStartDate: string, newEndDate: string) => {
    handleUpdatePhase(phaseId, {
      start_date: newStartDate,
      end_date: newEndDate,
    })
  }

  const handlePhaseReorder = (reorderedPhases: Partial<ProjectPhase>[]) => {
    // Update phases with the reordered list; change highlighting (start_date/end_date
    // deviations) is derived from state, so no imperative tracking is needed here.
    setPhases(reorderedPhases)
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
    setNewPhaseBaselines({})
    setDeletedPhaseIds(new Set())
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
