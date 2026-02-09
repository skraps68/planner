/**
 * Unit tests for cell validation utilities
 * Feature: resource-assignment-refactor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { validatePercentage, validateCellInput, validateCellEdit } from './cellValidation'
import { assignmentsApi } from '../api/assignments'

// Mock the assignments API
vi.mock('../api/assignments', () => ({
  assignmentsApi: {
    getByDate: vi.fn()
  }
}))

describe('validatePercentage', () => {
  it('should accept valid percentages', () => {
    expect(validatePercentage(0).isValid).toBe(true)
    expect(validatePercentage(50).isValid).toBe(true)
    expect(validatePercentage(100).isValid).toBe(true)
  })

  it('should reject negative percentages', () => {
    const result = validatePercentage(-1)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('between 0 and 100')
  })

  it('should reject percentages over 100', () => {
    const result = validatePercentage(101)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('between 0 and 100')
  })

  it('should reject NaN values', () => {
    const result = validatePercentage(NaN)
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('number')
  })
})

describe('validateCellInput', () => {
  it('should parse valid numeric input', () => {
    const result = validateCellInput('50')
    expect(result.isValid).toBe(true)
    expect(result.value).toBe(50)
  })

  it('should treat empty input as 0', () => {
    const result = validateCellInput('')
    expect(result.isValid).toBe(true)
    expect(result.value).toBe(0)
  })

  it('should reject invalid numeric input', () => {
    const result = validateCellInput('abc')
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBeDefined()
  })
})

describe('validateCellEdit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Test: validateCellEdit queries all projects
   * Validates: Requirements 7.1
   */
  it('should query all assignments for resource and date across all projects', async () => {
    const mockAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 30,
        expense_percentage: 20
      },
      {
        project_id: 'project-2',
        capital_percentage: 25,
        expense_percentage: 15
      }
    ]

    vi.mocked(assignmentsApi.getByDate).mockResolvedValue(mockAssignments)

    await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      10,
      'project-3'
    )

    expect(assignmentsApi.getByDate).toHaveBeenCalledWith('resource-1', '2024-01-15')
  })

  /**
   * Test: validateCellEdit excludes current project correctly
   * Validates: Requirements 7.4
   */
  it('should correctly replace current project values when calculating totals', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 30,
        expense_percentage: 20
      },
      {
        project_id: 'project-2',
        capital_percentage: 25,
        expense_percentage: 15
      }
    ]

    // Update project-1 capital from 30 to 40
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      40,
      'project-1',
      existingAssignments
    )

    // Total should be: (40 + 20) + (25 + 15) = 100
    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(100)
  })

  /**
   * Test: Single assignment constraint validation
   * Validates: Requirements 7.2
   */
  it('should reject when capital + expense > 100 for single assignment', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 60,
        expense_percentage: 30
      }
    ]

    // Try to change capital to 80, which would make total 110
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      80,
      'project-1',
      existingAssignments
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('cannot exceed 100%')
    expect(result.errorMessage).toContain('project')
  })

  /**
   * Test: Cross-project constraint validation
   * Validates: Requirements 7.3
   */
  it('should reject when total allocation across projects > 100', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 50,
        expense_percentage: 30
      }
    ]

    // Try to add 25% to a new project, which would make total 105
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      25,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('exceed 100%')
    expect(result.totalAllocation).toBeGreaterThan(100)
  })

  /**
   * Test: Error messages are descriptive
   * Validates: Requirements 7.5
   */
  it('should provide descriptive error message with current and attempted allocation', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        project_name: 'Project Alpha',
        capital_percentage: 60,
        expense_percentage: 20
      }
    ]

    // Try to add 30% to a new project
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      30,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('80') // Current total
    expect(result.errorMessage).toContain('30') // This project
    expect(result.errorMessage).toContain('110') // Total
  })

  /**
   * Test: Error message includes project breakdown
   * Validates: Requirements 7.5
   */
  it('should include project breakdown in error message', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        project_name: 'Project Alpha',
        capital_percentage: 50,
        expense_percentage: 30
      },
      {
        project_id: 'project-2',
        project_name: 'Project Beta',
        capital_percentage: 20,
        expense_percentage: 10
      }
    ]

    // Try to add 15% to project-2, which would exceed 100%
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      35,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('Project Alpha')
    expect(result.errorMessage).toContain('Project Beta')
    expect(result.projectBreakdown).toBeDefined()
    expect(result.projectBreakdown?.length).toBe(2)
  })

  /**
   * Test: Valid allocation at exactly 100%
   */
  it('should accept allocation at exactly 100%', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 50,
        expense_percentage: 30
      }
    ]

    // Add 20% to bring total to exactly 100%
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      20,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(100)
  })

  /**
   * Test: Valid allocation under 100%
   */
  it('should accept allocation under 100%', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 30,
        expense_percentage: 20
      }
    ]

    // Add 15% to bring total to 65%
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'expense',
      15,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(65)
  })

  /**
   * Test: Handles new project assignments
   */
  it('should handle assignments to new projects correctly', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 40,
        expense_percentage: 30
      }
    ]

    // Add allocation to a new project
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      20,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(90)
    expect(result.projectBreakdown?.length).toBe(2)
  })

  /**
   * Test: Handles empty existing assignments
   */
  it('should handle empty existing assignments', async () => {
    const existingAssignments: any[] = []

    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      50,
      'project-1',
      existingAssignments
    )

    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(50)
  })

  /**
   * Test: Validates both capital and expense updates
   */
  it('should validate expense percentage updates correctly', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 40,
        expense_percentage: 30
      }
    ]

    // Update expense to 50, which would make project total 90
    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'expense',
      50,
      'project-1',
      existingAssignments
    )

    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(90)
  })

  /**
   * Test: Returns project breakdown on success
   */
  it('should return project breakdown even on successful validation', async () => {
    const existingAssignments = [
      {
        project_id: 'project-1',
        project_name: 'Project Alpha',
        capital_percentage: 30,
        expense_percentage: 20
      }
    ]

    const result = await validateCellEdit(
      'resource-1',
      new Date('2024-01-15'),
      'capital',
      10,
      'project-2',
      existingAssignments
    )

    expect(result.isValid).toBe(true)
    expect(result.projectBreakdown).toBeDefined()
    expect(result.projectBreakdown?.length).toBe(2)
    expect(result.totalAllocation).toBe(60)
  })
})
