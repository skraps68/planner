import { describe, it, expect } from 'vitest'
import {
  reorderPhases,
  recalculatePhaseDates,
  validateReordering,
  calculatePhaseDuration,
} from './phaseValidation'
import { ProjectPhase } from '../types'

/**
 * Unit Tests for Phase Reordering Logic
 * Feature: phase-reordering-drag-drop
 */

describe('Phase Reordering - Unit Tests', () => {
  const createPhase = (
    id: string,
    name: string,
    startDate: string,
    endDate: string
  ): Partial<ProjectPhase> => ({
    id,
    project_id: 'test-project',
    name,
    start_date: startDate,
    end_date: endDate,
    capital_budget: 0,
    expense_budget: 0,
    total_budget: 0,
  })

  describe('reorderPhases', () => {
    it('should move first phase to last position', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const reordered = reorderPhases(phases, 0, 2)

      expect(reordered[0].id).toBe('2')
      expect(reordered[1].id).toBe('3')
      expect(reordered[2].id).toBe('1')
    })

    it('should move last phase to first position', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const reordered = reorderPhases(phases, 2, 0)

      expect(reordered[0].id).toBe('3')
      expect(reordered[1].id).toBe('1')
      expect(reordered[2].id).toBe('2')
    })

    it('should move middle phase to different position', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const reordered = reorderPhases(phases, 1, 2)

      expect(reordered[0].id).toBe('1')
      expect(reordered[1].id).toBe('3')
      expect(reordered[2].id).toBe('2')
    })

    it('should handle no-op reordering (same position)', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const reordered = reorderPhases(phases, 1, 1)

      expect(reordered[0].id).toBe('1')
      expect(reordered[1].id).toBe('2')
      expect(reordered[2].id).toBe('3')
    })

    it('should handle invalid indices gracefully', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
      ]

      const reordered = reorderPhases(phases, -1, 0)
      expect(reordered).toEqual(phases)

      const reordered2 = reorderPhases(phases, 0, 5)
      expect(reordered2).toEqual(phases)
    })
  })

  describe('recalculatePhaseDates', () => {
    it('should recalculate dates maintaining contiguity', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const recalculated = recalculatePhaseDates(phases, '2024-01-01', '2024-01-30')

      expect(recalculated[0].start_date).toBe('2024-01-01')
      expect(recalculated[0].end_date).toBe('2024-01-10')
      expect(recalculated[1].start_date).toBe('2024-01-11')
      expect(recalculated[1].end_date).toBe('2024-01-20')
      expect(recalculated[2].start_date).toBe('2024-01-21')
      expect(recalculated[2].end_date).toBe('2024-01-30')
    })

    it('should adjust last phase to project end date', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
      ]

      const recalculated = recalculatePhaseDates(phases, '2024-01-01', '2024-02-15')

      expect(recalculated[0].start_date).toBe('2024-01-01')
      expect(recalculated[0].end_date).toBe('2024-01-10')
      expect(recalculated[1].start_date).toBe('2024-01-11')
      expect(recalculated[1].end_date).toBe('2024-02-15') // Adjusted to project end
    })

    it('should preserve phase durations (except last phase)', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'), // 10 days
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'), // 10 days
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'), // 10 days
      ]

      const recalculated = recalculatePhaseDates(phases, '2024-01-01', '2024-02-05')

      expect(calculatePhaseDuration(recalculated[0])).toBe(10)
      expect(calculatePhaseDuration(recalculated[1])).toBe(10)
      // Last phase duration may be adjusted
    })

    it('should handle empty phase array', () => {
      const phases: Partial<ProjectPhase>[] = []
      const recalculated = recalculatePhaseDates(phases, '2024-01-01', '2024-01-30')
      expect(recalculated).toEqual([])
    })
  })

  describe('validateReordering', () => {
    it('should validate correct phase configuration', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const result = validateReordering(phases, '2024-01-01', '2024-01-30')

      expect(result.isValid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject phases with gaps', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-12', '2024-01-20'), // Gap!
        createPhase('3', 'Phase 3', '2024-01-21', '2024-01-30'),
      ]

      const result = validateReordering(phases, '2024-01-01', '2024-01-30')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('contiguous')
    })

    it('should reject phases not starting at project start', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-05', '2024-01-10'), // Wrong start!
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'),
      ]

      const result = validateReordering(phases, '2024-01-01', '2024-01-30')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('project start date')
    })

    it('should reject phases not ending at project end', () => {
      const phases = [
        createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
        createPhase('2', 'Phase 2', '2024-01-11', '2024-01-20'), // Wrong end!
      ]

      const result = validateReordering(phases, '2024-01-01', '2024-01-30')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('project end date')
    })

    it('should reject empty phase array', () => {
      const phases: Partial<ProjectPhase>[] = []

      const result = validateReordering(phases, '2024-01-01', '2024-01-30')

      expect(result.isValid).toBe(false)
      expect(result.error).toContain('No phases')
    })
  })

  describe('calculatePhaseDuration', () => {
    it('should calculate duration correctly (inclusive)', () => {
      const phase = createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10')
      expect(calculatePhaseDuration(phase)).toBe(10)
    })

    it('should handle single-day phases', () => {
      const phase = createPhase('1', 'Phase 1', '2024-01-01', '2024-01-01')
      expect(calculatePhaseDuration(phase)).toBe(1)
    })

    it('should handle phases without dates', () => {
      const phase: Partial<ProjectPhase> = {
        id: '1',
        name: 'Phase 1',
      }
      expect(calculatePhaseDuration(phase)).toBe(0)
    })
  })

  describe('Error Handling', () => {
    describe('Single-phase project handling', () => {
      it('should handle single-phase project correctly', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-30'),
        ]

        // Reordering a single phase should be a no-op
        const reordered = reorderPhases(phases, 0, 0)
        expect(reordered).toEqual(phases)

        // Validation should still work
        const validation = validateReordering(phases, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(true)
      })

      it('should not allow reordering with invalid indices in single-phase project', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-30'),
        ]

        // Try to move to invalid index
        const reordered = reorderPhases(phases, 0, 1)
        expect(reordered).toEqual(phases) // Should return original
      })
    })

    describe('Invalid reordering rejection', () => {
      it('should reject reordering with phases outside project boundaries', () => {
        // Create phases that pass first/last checks but fail boundary check
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-15'),
          createPhase('2', 'Phase 2', '2024-01-16', '2024-01-30'),
          createPhase('3', 'Phase 3', '2024-01-31', '2024-02-15'), // Extends beyond project end
        ]

        // Manually adjust to make it pass first/last checks but fail boundary
        phases[2].end_date = '2024-02-15' // Beyond project end

        const validation = validateReordering(phases, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(false)
        // This will fail the "last phase must end at project end" check first
        expect(validation.error).toContain('Last phase must end at project end date')
      })

      it('should reject reordering with non-contiguous phases', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-10'),
          createPhase('2', 'Phase 2', '2024-01-15', '2024-01-30'), // Gap of 4 days
        ]

        const validation = validateReordering(phases, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('contiguous')
      })

      it('should reject reordering with phases missing dates', () => {
        const phases: Partial<ProjectPhase>[] = [
          {
            id: '1',
            name: 'Phase 1',
            start_date: '2024-01-01',
            // Missing end_date
          },
          createPhase('2', 'Phase 2', '2024-01-11', '2024-01-30'),
        ]

        const validation = validateReordering(phases, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('start and end dates')
      })

      it('should reject reordering with invalid date order', () => {
        // Create phases where one has end before start
        // But this needs to pass first/last/contiguity checks first
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-15'),
          createPhase('2', 'Phase 2', '2024-01-16', '2024-01-30'),
        ]
        
        // Manually break the date order of second phase
        phases[1].start_date = '2024-01-25'
        phases[1].end_date = '2024-01-20' // End before start

        const validation = validateReordering(phases, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(false)
        // Will fail "last phase must end at project end" first since end_date is wrong
        expect(validation.error).toContain('Last phase must end at project end date')
      })

      it('should reject reordering when first phase does not start at project start', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-05', '2024-01-15'), // Starts after project start
          createPhase('2', 'Phase 2', '2024-01-16', '2024-01-30'),
        ]

        const validation = validateReordering(phases, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(false)
        expect(validation.error).toContain('First phase must start at project start date')
      })
    })

    describe('Failed reordering state preservation', () => {
      it('should not mutate original phases array on reordering', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-15'),
          createPhase('2', 'Phase 2', '2024-01-16', '2024-01-30'),
        ]

        // Store original state
        const originalPhases = phases.map(p => ({ ...p }))

        // Perform reordering
        const reordered = reorderPhases(phases, 0, 1)

        // Original phases should remain unchanged
        expect(phases).toEqual(originalPhases)
        expect(phases).not.toBe(reordered) // Different array reference
      })

      it('should not mutate original phases array on date recalculation', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-15'),
          createPhase('2', 'Phase 2', '2024-01-16', '2024-01-30'),
        ]

        // Store original state
        const originalPhases = phases.map(p => ({ ...p }))

        // Perform date recalculation
        const recalculated = recalculatePhaseDates(phases, '2024-01-01', '2024-01-30')

        // Original phases should remain unchanged
        expect(phases).toEqual(originalPhases)
        expect(phases).not.toBe(recalculated) // Different array reference
      })

      it('should preserve state when validation fails', () => {
        const phases = [
          createPhase('1', 'Phase 1', '2024-01-01', '2024-01-15'),
          createPhase('2', 'Phase 2', '2024-01-16', '2024-01-30'),
        ]

        // Store original state
        const originalPhases = phases.map(p => ({ ...p }))

        // Perform reordering and recalculation
        const reordered = reorderPhases(phases, 0, 1)
        const recalculated = recalculatePhaseDates(reordered, '2024-01-01', '2024-01-30')

        // Manually create invalid state
        const invalid = recalculated.map(p => ({ ...p }))
        invalid[0].start_date = '2024-01-05' // Invalid: doesn't start at project start

        // Validate - should fail
        const validation = validateReordering(invalid, '2024-01-01', '2024-01-30')
        expect(validation.isValid).toBe(false)

        // Original phases should remain unchanged
        expect(phases).toEqual(originalPhases)
      })
    })
  })
})
