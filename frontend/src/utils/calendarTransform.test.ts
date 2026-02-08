/**
 * Unit tests for calendar transformation utilities
 */

import { describe, it, expect } from 'vitest'
import {
  generateDateRange,
  transformToGrid,
  getCellValue,
  getCellKey,
  type ResourceAssignment
} from './calendarTransform'

describe('Calendar Transform Unit Tests', () => {
  describe('generateDateRange', () => {
    it('should handle empty assignments', () => {
      const grid = transformToGrid([], new Date('2024-01-01'), new Date('2024-01-31'))
      expect(grid.resources).toEqual([])
      expect(grid.dates.length).toBe(31)
      expect(grid.cells.size).toBe(0)
    })

    it('should map assignment to correct cell', () => {
      const assignments: ResourceAssignment[] = [{
        id: '1',
        resource_id: 'r1',
        resource_name: 'Resource 1',
        assignment_date: '2024-01-15',
        capital_percentage: 60,
        expense_percentage: 40
      }]

      const grid = transformToGrid(assignments, new Date('2024-01-01'), new Date('2024-01-31'))

      const capitalValue = getCellValue(grid, 'r1', new Date('2024-01-15'), 'capital')
      const expenseValue = getCellValue(grid, 'r1', new Date('2024-01-15'), 'expense')

      expect(capitalValue).toBe(60)
      expect(expenseValue).toBe(40)
    })

    it('should handle date string lookup', () => {
      const assignments: ResourceAssignment[] = [{
        id: '1',
        resource_id: 'r1',
        resource_name: 'Resource 1',
        assignment_date: '2024-01-30',
        capital_percentage: 50,
        expense_percentage: 50
      }]

      const grid = transformToGrid(assignments, new Date('2024-01-01'), new Date('2024-01-30'))

      // Look up using the date string directly
      const key = getCellKey('r1', '2024-01-30', 'expense')
      const cellData = grid.cells.get(key)
      
      expect(cellData).toBeDefined()
      expect(cellData?.expensePercentage).toBe(50)
    })

    it('should handle same day range', () => {
      const dates = generateDateRange(new Date('2024-01-15'), new Date('2024-01-15'))
      expect(dates.length).toBe(1)
    })

    it('should handle invalid range', () => {
      const dates = generateDateRange(new Date('2024-01-15'), new Date('2024-01-10'))
      expect(dates.length).toBe(0)
    })

    it('should handle missing percentage values', () => {
      const assignments: ResourceAssignment[] = [{
        id: '1',
        resource_id: 'r1',
        resource_name: 'Resource 1',
        assignment_date: '2024-01-15',
        capital_percentage: 0,
        expense_percentage: 0
      }]

      const grid = transformToGrid(assignments, new Date('2024-01-01'), new Date('2024-01-31'))

      const capitalValue = getCellValue(grid, 'r1', new Date('2024-01-15'), 'capital')
      const expenseValue = getCellValue(grid, 'r1', new Date('2024-01-15'), 'expense')

      expect(capitalValue).toBe(0)
      expect(expenseValue).toBe(0)
    })
  })
})
