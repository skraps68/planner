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
    const lastPhaseEnd = new Date(sortedPhases[sortedPhases.length - 1].end_date)
    const projectEnd = new Date(projectEndDate)

    if (lastPhaseEnd.getTime() !== projectEnd.getTime()) {
      errors.push({
        field: 'end_date',
        message: `Last phase must end at project end date (${projectEndDate})`,
        phase_id: sortedPhases[sortedPhases.length - 1].id,
      })
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
  const date = new Date(dateString)
  date.setDate(date.getDate() + 1)
  return date.toISOString().split('T')[0]
}

/**
 * Calculate the previous day before a given date
 */
export const getPreviousDay = (dateString: string): string => {
  const date = new Date(dateString)
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
 * Calculate days between two dates
 */
export const calculateDaysBetween = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
}
