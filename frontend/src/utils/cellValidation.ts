/**
 * Cell validation utilities for resource assignment calendar
 */

import { assignmentsApi } from '../api/assignments'

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean
  errorMessage?: string
}

/**
 * Cross-project allocation validation result
 */
export interface AllocationValidationResult extends ValidationResult {
  totalAllocation?: number
  projectBreakdown?: Array<{
    projectId: string
    projectName?: string
    capitalPercentage: number
    expensePercentage: number
  }>
}

/**
 * Validates a percentage value for a cell
 * @param value - The value to validate
 * @returns ValidationResult indicating if the value is valid
 */
export function validatePercentage(value: number): ValidationResult {
  // Check if numeric
  if (isNaN(value)) {
    return {
      isValid: false,
      errorMessage: 'Value must be a number'
    }
  }
  
  // Check range (0-100)
  if (value < 0 || value > 100) {
    return {
      isValid: false,
      errorMessage: 'Percentage must be between 0 and 100'
    }
  }
  
  return {
    isValid: true
  }
}

/**
 * Validates cell input and returns sanitized value
 * @param input - The input string from the user
 * @returns ValidationResult with parsed value or error
 */
export function validateCellInput(input: string): ValidationResult & { value?: number } {
  // Empty input is valid (represents 0%)
  if (input.trim() === '') {
    return {
      isValid: true,
      value: 0
    }
  }
  
  // Parse numeric value
  const numericValue = parseFloat(input)
  
  // Validate the parsed value
  const result = validatePercentage(numericValue)
  
  if (result.isValid) {
    return {
      ...result,
      value: numericValue
    }
  }
  
  return result
}

/**
 * Validates a cell edit against cross-project allocation limits
 * @param resourceId - The resource ID
 * @param date - The assignment date
 * @param costTreatment - 'capital' or 'expense'
 * @param newValue - The new percentage value
 * @param currentProjectId - The current project ID (to exclude from total)
 * @param existingAssignments - Existing assignments for this resource/date (optional, for testing)
 * @returns AllocationValidationResult with details about allocation
 */
export async function validateCellEdit(
  resourceId: string,
  date: Date,
  costTreatment: 'capital' | 'expense',
  newValue: number,
  currentProjectId: string,
  existingAssignments?: any[]
): Promise<AllocationValidationResult> {
  // First validate the percentage range (0-100)
  const rangeValidation = validatePercentage(newValue)
  if (!rangeValidation.isValid) {
    return rangeValidation
  }

  try {
    // Format date as YYYY-MM-DD
    const dateStr = date.toISOString().split('T')[0]
    
    // Get all assignments for this resource on this date across all projects
    let assignments = existingAssignments
    if (!assignments) {
      assignments = await assignmentsApi.getByDate(resourceId, dateStr)
    }
    
    // Group assignments by project
    const projectMap = new Map<string, { capital: number; expense: number; name?: string }>()
    
    assignments.forEach((assignment: any) => {
      const projectId = assignment.project_id
      
      if (!projectMap.has(projectId)) {
        projectMap.set(projectId, {
          capital: 0,
          expense: 0,
          name: assignment.project_name
        })
      }
      
      const project = projectMap.get(projectId)!
      // Ensure values are numbers, not strings
      project.capital += Number(assignment.capital_percentage) || 0
      project.expense += Number(assignment.expense_percentage) || 0
    })
    
    // Get current project's other value (the one not being edited)
    const currentProject = projectMap.get(currentProjectId)
    const otherValue = costTreatment === 'capital'
      ? (currentProject?.expense || 0)
      : (currentProject?.capital || 0)
    
    // Calculate new project total (single assignment constraint)
    const newProjectTotal = newValue + otherValue
    
    // Validate single assignment constraint: capital + expense <= 100 for this project
    if (newProjectTotal > 100) {
      return {
        isValid: false,
        errorMessage: `Capital + expense cannot exceed 100% for this project (would be ${newProjectTotal}%)`,
        totalAllocation: newProjectTotal,
        projectBreakdown: [{
          projectId: currentProjectId,
          capitalPercentage: costTreatment === 'capital' ? newValue : otherValue,
          expensePercentage: costTreatment === 'expense' ? newValue : otherValue
        }]
      }
    }
    
    // Calculate total allocation across all projects (cross-project constraint)
    let totalAllocation = 0
    const projectBreakdown: Array<{
      projectId: string
      projectName?: string
      capitalPercentage: number
      expensePercentage: number
    }> = []
    
    // Calculate total and build breakdown
    projectMap.forEach((data, projectId) => {
      // If this is the current project, replace with new values
      if (projectId === currentProjectId) {
        if (costTreatment === 'capital') {
          data.capital = newValue
        } else {
          data.expense = newValue
        }
      }
      
      const projectTotal = data.capital + data.expense
      totalAllocation += projectTotal
      
      projectBreakdown.push({
        projectId,
        projectName: data.name,
        capitalPercentage: data.capital,
        expensePercentage: data.expense
      })
    })
    
    // If current project is not in the map, add it
    if (!projectMap.has(currentProjectId)) {
      const capital = costTreatment === 'capital' ? newValue : 0
      const expense = costTreatment === 'expense' ? newValue : 0
      
      totalAllocation += capital + expense
      
      projectBreakdown.push({
        projectId: currentProjectId,
        capitalPercentage: capital,
        expensePercentage: expense
      })
    }
    
    // Validate cross-project constraint: total allocation across all projects <= 100
    if (totalAllocation > 100) {
      // Calculate current total (excluding this project)
      const currentTotalOtherProjects = totalAllocation - newProjectTotal
      
      const breakdownText = projectBreakdown
        .map(p => {
          const projectLabel = p.projectName || p.projectId
          const total = p.capitalPercentage + p.expensePercentage
          return `${projectLabel}: ${total}% (Capital: ${p.capitalPercentage}%, Expense: ${p.expensePercentage}%)`
        })
        .join(', ')
      
      return {
        isValid: false,
        errorMessage: `Total allocation across all projects would exceed 100% (current: ${currentTotalOtherProjects.toFixed(1)}%, this project: ${newProjectTotal.toFixed(1)}%, total: ${totalAllocation.toFixed(1)}%). Breakdown: ${breakdownText}`,
        totalAllocation,
        projectBreakdown
      }
    }
    
    return {
      isValid: true,
      totalAllocation,
      projectBreakdown
    }
  } catch (error: any) {
    console.error('Error validating cell edit:', error)
    return {
      isValid: false,
      errorMessage: 'Failed to validate allocation. Please try again.'
    }
  }
}
