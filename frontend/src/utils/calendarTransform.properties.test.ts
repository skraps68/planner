/**
 * Property-based tests for calendar transformation utilities
 * Feature: resource-assignment-calendar
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  generateDateRange,
  transformToGrid,
  getCellValue,
  getCellKey,
  type ResourceAssignment
} from './calendarTransform'

describe('Calendar Transform Properties', () => {
  // Feature: resource-assignment-calendar, Property 1: Date Range Generation Completeness
  describe('Property 1: Date Range Generation Completeness', () => {
    it('should generate complete date range from start to end', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date1, date2) => {
            // Filter out invalid dates
            fc.pre(!isNaN(date1.getTime()) && !isNaN(date2.getTime()))
            
            // Ensure start <= end
            const start = date1 <= date2 ? date1 : date2
            const end = date1 <= date2 ? date2 : date1
            
            const dates = generateDateRange(start, end)
            
            // Normalize dates to UTC for comparison using UTC methods
            const normalizeDate = (d: Date) => {
              return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
            }
            
            const normalizedStart = normalizeDate(start)
            const normalizedEnd = normalizeDate(end)
            
            // Check first and last dates
            expect(dates[0].toISOString().split('T')[0]).toBe(normalizedStart.toISOString().split('T')[0])
            expect(dates[dates.length - 1].toISOString().split('T')[0]).toBe(normalizedEnd.toISOString().split('T')[0])
            
            // Check completeness - calculate expected number of days
            const dayCount = Math.floor((normalizedEnd.getTime() - normalizedStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
            expect(dates.length).toBe(dayCount)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should handle same start and end date', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date) => {
            // Filter out invalid dates
            fc.pre(!isNaN(date.getTime()))
            
            const dates = generateDateRange(date, date)
            expect(dates.length).toBe(1)
            
            // Normalize for comparison using UTC methods
            const normalized = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
            expect(dates[0].toISOString().split('T')[0]).toBe(normalized.toISOString().split('T')[0])
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return empty array when start > end', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
          (date1, date2) => {
            // Normalize to compare dates only (not times)
            const normalizeDate = (d: Date) => {
              return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
            }
            
            const norm1 = normalizeDate(date1)
            const norm2 = normalizeDate(date2)
            
            fc.pre(norm1 > norm2) // precondition: start must be after end
            const dates = generateDateRange(date1, date2)
            expect(dates.length).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: resource-assignment-calendar, Property 2: Grid Structure Correctness
  describe('Property 2: Grid Structure Correctness', () => {
    it('should create exactly one resource entry per unique resource_id', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              resource_id: fc.uuid(),
              resource_name: fc.string({ minLength: 1, maxLength: 50 }),
              assignment_date: fc.integer({ min: 1, max: 28 })
                .map(day => `2024-01-${day.toString().padStart(2, '0')}`),
              capital_percentage: fc.integer({ min: 0, max: 100 }),
              expense_percentage: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 0, maxLength: 50 }
          ),
          (assignments) => {
            const grid = transformToGrid(
              assignments,
              new Date('2024-01-01'),
              new Date('2024-12-31')
            )
            
            const uniqueResources = new Set(assignments.map(a => a.resource_id))
            expect(grid.resources.length).toBe(uniqueResources.size)
            
            // Check that all resource IDs are unique
            const resourceIds = grid.resources.map(r => r.resourceId)
            const uniqueResourceIds = new Set(resourceIds)
            expect(resourceIds.length).toBe(uniqueResourceIds.size)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: resource-assignment-calendar, Property 3: Cell Data Mapping Correctness
  describe('Property 3: Cell Data Mapping Correctness', () => {
    it('should correctly map assignment data to grid cells', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              resource_id: fc.uuid(),
              resource_name: fc.string({ minLength: 1, maxLength: 50 }),
              assignment_date: fc.integer({ min: 1, max: 31 })
                .map(day => `2024-01-${day.toString().padStart(2, '0')}`),
              capital_percentage: fc.integer({ min: 0, max: 100 }),
              expense_percentage: fc.integer({ min: 0, max: 100 })
            }),
            { minLength: 1, maxLength: 20 }
          ),
          (assignments) => {
            const grid = transformToGrid(
              assignments,
              new Date('2024-01-01'),
              new Date('2024-01-31')
            )
            
            // For each assignment, verify it can be looked up correctly
            assignments.forEach(assignment => {
              const date = new Date(assignment.assignment_date)
              
              const capitalValue = getCellValue(grid, assignment.resource_id, date, 'capital')
              const expenseValue = getCellValue(grid, assignment.resource_id, date, 'expense')
              
              expect(capitalValue).toBe(assignment.capital_percentage)
              expect(expenseValue).toBe(assignment.expense_percentage)
            })
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should return 0 for cells with no assignment', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 31 }),
          (resourceId, day) => {
            // Create grid with no assignments
            const grid = transformToGrid(
              [],
              new Date('2024-01-01'),
              new Date('2024-01-31')
            )
            
            const date = new Date(`2024-01-${day.toString().padStart(2, '0')}`)
            
            const capitalValue = getCellValue(grid, resourceId, date, 'capital')
            const expenseValue = getCellValue(grid, resourceId, date, 'expense')
            
            expect(capitalValue).toBe(0)
            expect(expenseValue).toBe(0)
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Feature: resource-assignment-calendar, Property 4: Grid Transformation Preserves Data
  describe('Property 4: Grid Transformation Preserves Data', () => {
    it('should preserve all assignment data through transformation', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              id: fc.uuid(),
              resource_id: fc.uuid(),
              resource_name: fc.string({ minLength: 1, maxLength: 50 }),
              assignment_date: fc.integer({ min: 1, max: 30 })
                .map(day => `2024-01-${day.toString().padStart(2, '0')}`),
              capital_percentage: fc.integer({ min: 1, max: 100 }), // Avoid 0 to simplify test
              expense_percentage: fc.integer({ min: 1, max: 100 })
            }),
            { minLength: 0, maxLength: 30 }
          ),
          (assignments) => {
            const grid = transformToGrid(
              assignments,
              new Date('2024-01-01'),
              new Date('2024-01-30')
            )
            
            // For each assignment, verify it exists in the grid
            assignments.forEach(assignment => {
              const capitalValue = getCellValue(
                grid,
                assignment.resource_id,
                assignment.assignment_date, // Use string directly
                'capital'
              )
              const expenseValue = getCellValue(
                grid,
                assignment.resource_id,
                assignment.assignment_date, // Use string directly
                'expense'
              )
              
              expect(capitalValue).toBe(assignment.capital_percentage)
              expect(expenseValue).toBe(assignment.expense_percentage)
            })
          }
        ),
        { numRuns: 100 }
      )
    })
  })

  // Additional property: Cell key generation consistency
  describe('Cell Key Generation Consistency', () => {
    it('should generate consistent keys for same inputs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 31 }),
          fc.constantFrom('capital' as const, 'expense' as const),
          (resourceId, day, costTreatment) => {
            const date = new Date(`2024-01-${day.toString().padStart(2, '0')}`)
            const key1 = getCellKey(resourceId, date, costTreatment)
            const key2 = getCellKey(resourceId, date, costTreatment)
            expect(key1).toBe(key2)
          }
        ),
        { numRuns: 100 }
      )
    })

    it('should generate different keys for different inputs', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          fc.integer({ min: 1, max: 31 }),
          (resourceId1, resourceId2, day) => {
            fc.pre(resourceId1 !== resourceId2)
            
            const date = new Date(`2024-01-${day.toString().padStart(2, '0')}`)
            const key1 = getCellKey(resourceId1, date, 'capital')
            const key2 = getCellKey(resourceId2, date, 'capital')
            expect(key1).not.toBe(key2)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
