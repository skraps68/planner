import { ProjectPhase, PhaseValidationError, PhaseValidationResult } from '../types'

/**
 * Validates phases for timeline continuity and constraints
 */
export const validatePhases = (
  phases: Partial<ProjectPhase>[],
  projectStartDate: string,
  projectEndDate: string
): PhaseValidationResult => {
  const errors: PhaseValidationError[] = []

  if (!phases || phases.length === 0) {
    errors.push({
      field: 'phases',
      message: 'Project must have at least one phase',
    })
    return { is_valid: false, errors }
  }

  // Sort phases by start_date
  const sortedPhases = [...phases].sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })

  // Validate each phase
  for (const phase of sortedPhases) {
    // Required fields
    if (!phase.name || phase.name.trim() === '') {
      errors.push({
        field: 'name',
        message: 'Phase name is required',
        phase_id: phase.id,
      })
    }

    if (phase.name && phase.name.length > 100) {
      errors.push({
        field: 'name',
        message: 'Phase name must not exceed 100 characters',
        phase_id: phase.id,
      })
    }

    if (!phase.start_date) {
      errors.push({
        field: 'start_date',
        message: 'Phase start date is required',
        phase_id: phase.id,
      })
    }

    if (!phase.end_date) {
      errors.push({
        field: 'end_date',
        message: 'Phase end date is required',
        phase_id: phase.id,
      })
    }

    // Date ordering
    if (phase.start_date && phase.end_date) {
      const startDate = new Date(phase.start_date)
      const endDate = new Date(phase.end_date)

      if (startDate > endDate) {
        errors.push({
          field: 'dates',
          message: `Phase "${phase.name}": start date must be on or before end date`,
          phase_id: phase.id,
        })
      }

      // Project boundary constraints
      const projectStart = new Date(projectStartDate)
      const projectEnd = new Date(projectEndDate)

      if (startDate < projectStart) {
        errors.push({
          field: 'start_date',
          message: `Phase "${phase.name}": start date must be on or after project start date`,
          phase_id: phase.id,
        })
      }

      if (endDate > projectEnd) {
        errors.push({
          field: 'end_date',
          message: `Phase "${phase.name}": end date must be on or before project end date`,
          phase_id: phase.id,
        })
      }
    }

    // Budget validation
    if (phase.capital_budget !== undefined && phase.capital_budget < 0) {
      errors.push({
        field: 'capital_budget',
        message: `Phase "${phase.name}": capital budget must be non-negative`,
        phase_id: phase.id,
      })
    }

    if (phase.expense_budget !== undefined && phase.expense_budget < 0) {
      errors.push({
        field: 'expense_budget',
        message: `Phase "${phase.name}": expense budget must be non-negative`,
        phase_id: phase.id,
      })
    }

    if (
      phase.capital_budget !== undefined &&
      phase.expense_budget !== undefined &&
      phase.total_budget !== undefined
    ) {
      const expectedTotal = phase.capital_budget + phase.expense_budget
      if (Math.abs(phase.total_budget - expectedTotal) > 0.01) {
        errors.push({
          field: 'total_budget',
          message: `Phase "${phase.name}": total budget must equal capital + expense`,
          phase_id: phase.id,
        })
      }
    }
  }

  // Check timeline continuity
  if (sortedPhases.length > 0 && sortedPhases[0].start_date) {
    const firstPhaseStart = new Date(sortedPhases[0].start_date)
    const projectStart = new Date(projectStartDate)

    if (firstPhaseStart.getTime() !== projectStart.getTime()) {
      errors.push({
        field: 'start_date',
        message: `First phase must start at project start date (${projectStartDate})`,
        phase_id: sortedPhases[0].id,
      })
    }
  }

  if (sortedPhases.length > 0 && sortedPhases[sortedPhases.length - 1].end_date) {
    const lastPhaseEndDate = sortedPhases[sortedPhases.length - 1].end_date
    if (lastPhaseEndDate) {
      const lastPhaseEnd = new Date(lastPhaseEndDate)
      const projectEnd = new Date(projectEndDate)

      if (lastPhaseEnd.getTime() !== projectEnd.getTime()) {
        errors.push({
          field: 'end_date',
          message: `Last phase must end at project end date (${projectEndDate})`,
          phase_id: sortedPhases[sortedPhases.length - 1].id,
        })
      }
    }
  }

  // Check for gaps and overlaps
  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const current = sortedPhases[i]
    const next = sortedPhases[i + 1]

    if (!current.end_date || !next.start_date) continue

    const currentEnd = new Date(current.end_date)
    const nextStart = new Date(next.start_date)

    // Expected next start is the day after current ends
    const expectedNextStart = new Date(currentEnd)
    expectedNextStart.setDate(expectedNextStart.getDate() + 1)

    // Check for gap
    if (nextStart.getTime() > expectedNextStart.getTime()) {
      errors.push({
        field: 'timeline',
        message: `Gap detected between "${current.name}" and "${next.name}"`,
        phase_id: current.id,
      })
    }

    // Check for overlap
    if (nextStart.getTime() <= currentEnd.getTime()) {
      errors.push({
        field: 'timeline',
        message: `Overlap detected between "${current.name}" and "${next.name}"`,
        phase_id: current.id,
      })
    }
  }

  return {
    is_valid: errors.length === 0,
    errors,
  }
}

/**
 * Calculate the next day after a given date
 */
export const getNextDay = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00')
  date.setDate(date.getDate() + 1)
  return date.toISOString().split('T')[0]
}

/**
 * Calculate the previous day before a given date
 */
export const getPreviousDay = (dateString: string): string => {
  const date = new Date(dateString + 'T00:00:00')
  date.setDate(date.getDate() - 1)
  return date.toISOString().split('T')[0]
}

/**
 * Format date for display
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Calculate days between two dates (inclusive)
 */
export const calculateDaysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}

/**
 * Calculate the duration of a phase in days (inclusive)
 */
export const calculatePhaseDuration = (phase: Partial<ProjectPhase>): number => {
  if (!phase.start_date || !phase.end_date) return 0
  const start = new Date(phase.start_date + 'T00:00:00')
  const end = new Date(phase.end_date + 'T00:00:00')
  const diffTime = end.getTime() - start.getTime()
  const days = diffTime / (1000 * 60 * 60 * 24)
  return Math.round(days) + 1 // +1 for inclusive
}

/**
 * Add days to a date string
 */
export const addDays = (dateString: string, days: number): string => {
  const date = new Date(dateString + 'T00:00:00')
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Reorders phases by moving a phase from one index to another
 * @param phases - Current phase array
 * @param fromIndex - Current index of phase to move
 * @param toIndex - Target index for insertion
 * @returns Reordered phase array
 */
export const reorderPhases = (
  phases: Partial<ProjectPhase>[],
  fromIndex: number,
  toIndex: number
): Partial<ProjectPhase>[] => {
  // Validate indices
  if (fromIndex < 0 || fromIndex >= phases.length || toIndex < 0 || toIndex >= phases.length) {
    return phases
  }

  // No-op if same position
  if (fromIndex === toIndex) {
    return phases
  }

  const result = [...phases]
  const [movedPhase] = result.splice(fromIndex, 1)
  result.splice(toIndex, 0, movedPhase)

  return result
}

/**
 * Recalculates phase dates after reordering to maintain continuity
 * @param phases - Reordered phase array
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Phases with recalculated dates
 */
export const recalculatePhaseDates = (
  phases: Partial<ProjectPhase>[],
  projectStartDate: string,
  projectEndDate: string
): Partial<ProjectPhase>[] => {
  if (phases.length === 0) return phases

  // Step 1: Preserve durations
  const durations = phases.map(phase => calculatePhaseDuration(phase))

  // Step 2: Create new phases array with recalculated dates
  const result = phases.map(phase => ({ ...phase }))

  // Step 3: Set first phase
  result[0].start_date = projectStartDate
  result[0].end_date = addDays(projectStartDate, durations[0] - 1)

  // Step 4: Calculate subsequent phases
  for (let i = 1; i < result.length; i++) {
    const prevEndDate = result[i - 1].end_date
    if (!prevEndDate) continue
    
    const startDate = getNextDay(prevEndDate)
    result[i].start_date = startDate
    result[i].end_date = addDays(startDate, durations[i] - 1)
  }

  // Step 5: Only adjust last phase if there's a mismatch with project end date
  // This handles edge cases where durations don't perfectly fit due to rounding
  const lastIndex = result.length - 1
  if (result[lastIndex].end_date !== projectEndDate) {
    result[lastIndex].end_date = projectEndDate
  }

  return result
}

/**
 * Validates that a reordering operation is valid
 * @param phases - Phases after reordering and date recalculation
 * @param projectStartDate - Project start date
 * @param projectEndDate - Project end date
 * @returns Validation result
 */
export const validateReordering = (
  phases: Partial<ProjectPhase>[],
  projectStartDate: string,
  projectEndDate: string
): { isValid: boolean; error?: string } => {
  if (phases.length === 0) {
    return { isValid: false, error: 'No phases to validate' }
  }

  // Check that all phases have required date fields
  for (const phase of phases) {
    if (!phase.start_date || !phase.end_date) {
      return { isValid: false, error: 'All phases must have start and end dates' }
    }
  }

  // Check first phase starts at project start
  if (phases[0].start_date !== projectStartDate) {
    return { isValid: false, error: 'First phase must start at project start date' }
  }

  // Check last phase ends at project end
  if (phases[phases.length - 1].end_date !== projectEndDate) {
    return { isValid: false, error: 'Last phase must end at project end date' }
  }

  // Check contiguity
  for (let i = 0; i < phases.length - 1; i++) {
    const current = phases[i]
    const next = phases[i + 1]
    
    const expectedNextStart = getNextDay(current.end_date!)
    if (next.start_date !== expectedNextStart) {
      return { isValid: false, error: 'Phases must be contiguous with no gaps or overlaps' }
    }
  }

  // Check that all phases are within project boundaries
  const projectStart = new Date(projectStartDate)
  const projectEnd = new Date(projectEndDate)

  for (const phase of phases) {
    const phaseStart = new Date(phase.start_date!)
    const phaseEnd = new Date(phase.end_date!)

    if (phaseStart < projectStart || phaseEnd > projectEnd) {
      return { isValid: false, error: 'All phases must be within project boundaries' }
    }

    if (phaseStart > phaseEnd) {
      return { isValid: false, error: 'Phase start date must be on or before end date' }
    }
  }

  return { isValid: true }
}
