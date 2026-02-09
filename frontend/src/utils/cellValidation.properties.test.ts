/**
 * Property-based tests for cell validation
 * Feature: resource-assignment-calendar
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { validatePercentage, validateCellInput } from './cellValidation'

describe('Cell Validation Properties', () => {
  /**
   * Property 6: Percentage Range Validation
   * For any value less than 0 or greater than 100, the validation should reject the change.
   * Validates: Requirements 12.4
   */
  it('Property 6: should reject percentages outside 0-100 range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: -1000, max: -0.01, noNaN: true }), // Negative values
          fc.double({ min: 100.01, max: 1000, noNaN: true })  // Values > 100
        ),
        (invalidValue) => {
          const result = validatePercentage(invalidValue)
          
          // Should be invalid
          expect(result.isValid).toBe(false)
          expect(result.errorMessage).toBeDefined()
          expect(result.errorMessage).toContain('between 0 and 100')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6 (complement): Valid Range Acceptance
   * For any value between 0 and 100 (inclusive), the validation should accept the value.
   * Validates: Requirements 12.4
   */
  it('Property 6: should accept percentages within 0-100 range', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 100, noNaN: true }),
        (validValue) => {
          const result = validatePercentage(validValue)
          
          // Should be valid
          expect(result.isValid).toBe(true)
          expect(result.errorMessage).toBeUndefined()
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6 (boundary): Boundary Values
   * The exact boundary values 0 and 100 should be valid.
   * Validates: Requirements 12.4
   */
  it('Property 6: should accept boundary values 0 and 100', () => {
    const result0 = validatePercentage(0)
    expect(result0.isValid).toBe(true)
    expect(result0.errorMessage).toBeUndefined()

    const result100 = validatePercentage(100)
    expect(result100.isValid).toBe(true)
    expect(result100.errorMessage).toBeUndefined()
  })

  /**
   * Property 6 (NaN): Non-numeric Values
   * NaN values should be rejected.
   * Validates: Requirements 12.3
   */
  it('Property 6: should reject NaN values', () => {
    const result = validatePercentage(NaN)
    
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toBeDefined()
    expect(result.errorMessage).toContain('number')
  })

  /**
   * Property: Cell Input Validation
   * For any string input, validateCellInput should return consistent results
   * with validatePercentage for numeric inputs.
   */
  it('should validate cell input consistently with percentage validation', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 1000, noNaN: true }),
        (value) => {
          const inputResult = validateCellInput(value.toString())
          const percentageResult = validatePercentage(value)
          
          // Results should match
          expect(inputResult.isValid).toBe(percentageResult.isValid)
          
          if (!inputResult.isValid) {
            expect(inputResult.errorMessage).toBeDefined()
          }
          
          if (inputResult.isValid && inputResult.value !== undefined) {
            // Use loose equality to handle -0 vs +0
            expect(Math.abs(inputResult.value - value)).toBeLessThan(0.0001)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Empty Input Handling
   * Empty string input should be treated as valid and return 0.
   */
  it('should treat empty input as valid with value 0', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('', '  ', '\t', '\n'),
        (emptyInput) => {
          const result = validateCellInput(emptyInput)
          
          expect(result.isValid).toBe(true)
          expect(result.value).toBe(0)
        }
      ),
      { numRuns: 20 }
    )
  })
})

/**
 * Property-based tests for resource-assignment-refactor
 * Feature: resource-assignment-refactor
 */
describe('Resource Assignment Refactor Validation Properties', () => {
  /**
   * Property: Single Assignment Constraint
   * For any assignment, capital_percentage + expense_percentage must be <= 100.
   * Feature: resource-assignment-refactor, Property 2: Single Assignment Sum Constraint
   * Validates: Requirements 7.2, 7.3
   */
  it('Property 2: should reject single assignment where capital + expense > 100', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.constantFrom('capital', 'expense'),
        async (capital, expense, costTreatment) => {
          // Create an existing assignment with capital and expense
          const existingAssignments = [
            {
              project_id: 'test-project-id',
              capital_percentage: capital,
              expense_percentage: expense
            }
          ]
          
          // Generate a new value that would violate the constraint
          const otherValue = costTreatment === 'capital' ? expense : capital
          const newValue = 101 - otherValue // This will make total > 100
          
          if (newValue > 100 || newValue < 0) {
            return // Skip invalid test cases
          }
          
          const { validateCellEdit } = await import('./cellValidation')
          const result = await validateCellEdit(
            'test-resource-id',
            new Date('2024-01-15'),
            costTreatment as 'capital' | 'expense',
            newValue,
            'test-project-id',
            existingAssignments
          )
          
          // Should be invalid due to single assignment constraint
          expect(result.isValid).toBe(false)
          expect(result.errorMessage).toBeDefined()
          expect(result.errorMessage).toContain('cannot exceed 100%')
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property: Cross-Project Allocation Constraint
   * For any resource and date, the sum of (capital + expense) across all projects
   * must not exceed 100%.
   * Feature: resource-assignment-refactor, Property 3: Cross-Project Allocation Constraint
   * Validates: Requirements 7.2, 7.3
   */
  it('Property 3: should validate cross-project allocation correctly', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            project_id: fc.uuid(),
            capital_percentage: fc.integer({ min: 0, max: 50 }),
            expense_percentage: fc.integer({ min: 0, max: 50 })
          }).filter(a => a.capital_percentage + a.expense_percentage <= 100),
          { minLength: 0, maxLength: 3 }
        ),
        fc.constantFrom('capital', 'expense'),
        fc.integer({ min: 0, max: 100 }),
        async (existingAssignments, costTreatment, newValue) => {
          // Calculate total allocation from existing assignments
          const existingTotal = existingAssignments.reduce(
            (sum, a) => sum + a.capital_percentage + a.expense_percentage,
            0
          )
          
          // Use a new project ID to test cross-project validation
          const currentProjectId = 'new-project-id'
          
          // Calculate what the new total would be
          const newProjectTotal = newValue + (costTreatment === 'capital' ? 0 : 0)
          const newGrandTotal = existingTotal + newValue
          
          const { validateCellEdit } = await import('./cellValidation')
          const result = await validateCellEdit(
            'test-resource-id',
            new Date('2024-01-15'),
            costTreatment as 'capital' | 'expense',
            newValue,
            currentProjectId,
            existingAssignments
          )
          
          // Property: If total > 100, should be invalid
          if (newGrandTotal > 100) {
            expect(result.isValid).toBe(false)
            expect(result.errorMessage).toBeDefined()
            expect(result.errorMessage).toContain('exceed 100%')
          } else {
            // If total <= 100, should be valid
            expect(result.isValid).toBe(true)
            expect(result.totalAllocation).toBeLessThanOrEqual(100)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it('Property 5: should accept allocations at exactly 100%', async () => {
    // Test the boundary case where total is exactly 100%
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 50,
        expense_percentage: 30
      }
    ]
    
    const { validateCellEdit } = await import('./cellValidation')
    
    // Adding 20% to capital should bring total to exactly 100%
    const result = await validateCellEdit(
      'test-resource-id',
      new Date('2024-01-15'),
      'capital',
      70, // Change from 50 to 70, total becomes 100
      'project-1',
      existingAssignments
    )
    
    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(100)
  })

  it('Property 5: should provide project breakdown in error message', async () => {
    // Test that over-allocation provides detailed breakdown
    const existingAssignments = [
      {
        project_id: 'project-1',
        project_name: 'Project Alpha',
        capital_percentage: 60,
        expense_percentage: 20
      },
      {
        project_id: 'project-2',
        project_name: 'Project Beta',
        capital_percentage: 30,
        expense_percentage: 10
      }
    ]
    
    const { validateCellEdit } = await import('./cellValidation')
    
    // Try to add 10% more, which would exceed 100%
    const result = await validateCellEdit(
      'test-resource-id',
      new Date('2024-01-15'),
      'capital',
      40, // Change project-2 capital from 30 to 40
      'project-2',
      existingAssignments
    )
    
    expect(result.isValid).toBe(false)
    expect(result.errorMessage).toContain('exceed 100%')
    expect(result.errorMessage).toContain('130') // Total should be 130%
    expect(result.projectBreakdown).toBeDefined()
    expect(result.projectBreakdown?.length).toBeGreaterThan(0)
  })

  it('Property 5: should handle new project assignments correctly', async () => {
    // Test adding allocation to a project not in existing assignments
    const existingAssignments = [
      {
        project_id: 'project-1',
        capital_percentage: 50,
        expense_percentage: 30
      }
    ]
    
    const { validateCellEdit } = await import('./cellValidation')
    
    // Add allocation to a different project
    const result = await validateCellEdit(
      'test-resource-id',
      new Date('2024-01-15'),
      'capital',
      15, // Add 15% to new project
      'project-2', // Different project
      existingAssignments
    )
    
    // Total should be 80 + 15 = 95%, which is valid
    expect(result.isValid).toBe(true)
    expect(result.totalAllocation).toBe(95)
  })
})
