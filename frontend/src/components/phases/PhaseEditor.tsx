import React, { useState, useEffect } from 'react'
import { Box, Button, CircularProgress, Paper, Typography } from '@mui/material'
import { Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { ProjectPhase, PhaseValidationError } from '../../types'
import { phasesApi } from '../../api/phases'
import { validatePhases, getNextDay, getPreviousDay } from '../../utils/phaseValidation'
import PhaseTimeline from './PhaseTimeline'
import PhaseList from './PhaseList'
import ValidationErrorDisplay from './ValidationErrorDisplay'

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
  const [phases, setPhases] = useState<Partial<ProjectPhase>[]>([])
  const [originalPhases, setOriginalPhases] = useState<Partial<ProjectPhase>[]>([])
  const [validationErrors, setValidationErrors] = useState<PhaseValidationError[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  // Load phases on mount
  useEffect(() => {
    loadPhases()
  }, [projectId])

  // Validate phases whenever they change
  useEffect(() => {
    if (phases.length > 0) {
      const result = validatePhases(phases, projectStartDate, projectEndDate)
      setValidationErrors(result.errors)
    }
  }, [phases, projectStartDate, projectEndDate])

  const loadPhases = async () => {
    try {
      setIsLoading(true)
      const data = await phasesApi.list(projectId)
      setPhases(data)
      setOriginalPhases(data)
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
            capital_budget: 0,
            expense_budget: 0,
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
          capital_budget: 0,
          expense_budget: 0,
          total_budget: 0,
        },
      ])
    }

    setHasChanges(true)
  }

  const handleUpdatePhase = (phaseId: string, updates: Partial<ProjectPhase>) => {
    setPhases((prev) =>
      prev.map((phase) => (phase.id === phaseId ? { ...phase, ...updates } : phase))
    )
    setHasChanges(true)
  }

  const handlePhaseResize = (phaseId: string, newStartDate: string, newEndDate: string) => {
    handleUpdatePhase(phaseId, {
      start_date: newStartDate,
      end_date: newEndDate,
    })
  }

  const handleDeletePhase = (phaseId: string) => {
    if (phases.length === 1) {
      return // Cannot delete last phase
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

    // Extend adjacent phase to cover the deleted phase's range
    let updatedPhases = phases.filter((p) => p.id !== phaseId)

    if (previousPhase && phaseToDelete.end_date) {
      // Extend previous phase to cover deleted phase
      updatedPhases = updatedPhases.map((p) =>
        p.id === previousPhase.id ? { ...p, end_date: phaseToDelete.end_date } : p
      )
    } else if (nextPhase && phaseToDelete.start_date) {
      // Extend next phase to cover deleted phase
      updatedPhases = updatedPhases.map((p) =>
        p.id === nextPhase.id ? { ...p, start_date: phaseToDelete.start_date } : p
      )
    }

    setPhases(updatedPhases)
    setHasChanges(true)
  }

  const handleSave = async () => {
    // Validate before saving
    const result = validatePhases(phases, projectStartDate, projectEndDate)
    if (!result.is_valid) {
      setValidationErrors(result.errors)
      return
    }

    try {
      setIsSaving(true)

      // Use batch update endpoint - send all phases at once
      const phasesData = phases.map((phase) => ({
        id: phase.id?.startsWith('temp-') ? null : phase.id,
        name: phase.name!,
        start_date: phase.start_date!,
        end_date: phase.end_date!,
        description: phase.description || '',
        capital_budget: phase.capital_budget || 0,
        expense_budget: phase.expense_budget || 0,
        total_budget: phase.total_budget || 0,
      }))

      await phasesApi.batchUpdate(projectId, { phases: phasesData })

      // Reload phases
      await loadPhases()
      setHasChanges(false)

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
    setHasChanges(false)
    setValidationErrors([])

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

  return (
    <Box>
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Phase Editor
        </Typography>
        <Typography variant="body2" color="text.secondary" paragraph>
          Manage project phases to organize your timeline. Phases must form a continuous timeline from
          project start to end with no gaps or overlaps.
        </Typography>
      </Paper>

      <ValidationErrorDisplay errors={validationErrors} />

      <PhaseTimeline
        phases={phases}
        projectStartDate={projectStartDate}
        projectEndDate={projectEndDate}
        validationErrors={validationErrors}
        onPhaseResize={handlePhaseResize}
        enableResize={true}
      />

      <PhaseList
        phases={phases}
        onAdd={handleAddPhase}
        onUpdate={handleUpdatePhase}
        onDelete={handleDeletePhase}
      />

      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', mt: 3 }}>
        <Button variant="outlined" onClick={handleCancel} disabled={isSaving || !hasChanges}>
          <CancelIcon sx={{ mr: 1 }} />
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving || hasValidationErrors || !hasChanges}
        >
          {isSaving ? (
            <CircularProgress size={20} sx={{ mr: 1 }} />
          ) : (
            <SaveIcon sx={{ mr: 1 }} />
          )}
          Save Changes
        </Button>
      </Box>
    </Box>
  )
}

export default PhaseEditor
