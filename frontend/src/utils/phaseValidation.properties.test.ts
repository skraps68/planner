import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'
import {
  reorderPhases,
  recalculatePhaseDates,
  validateReordering,
  calculatePhaseDuration,
  getNextDay,
} from './phaseValidation'
import { ProjectPhase } from '../types'

/**
 * Property-Based Tests for Phase Reordering Logic
 * Feature: phase-reordering-drag-drop
 * Using fast-check for property-based testing
 */

describe('Phase Reordering - Property-Based Tests', () => {
  /**
   * Generator for valid phases with contiguous dates
   * Generates phases that perfectly fill the project duration
   */
  const contiguousPhasesGenerator = fc
    .tuple(
      fc.constant('2024-01-01'), // Fixed project start for simplicity
      fc.integer({ min: 30, max: 180 }), // Project duration in days
      fc.integer({ min: 2, max: 5 }) // Number of phases
    )
    .chain(([projectStartStr, projectDuration, numPhases]) => {
      // Generate phase durations that sum to exactly projectDuration
      return fc.array(fc.integer({ min: 1, max: 20 }), { minLength: numPhases - 1, maxLength: numPhases - 1 })
        .map(durations => {
          const projectStart = new Date(projectStartStr + 'T00:00:00')
          const projectEnd = new Date(projectStart.getTime())
          projectEnd.setDate(projectEnd.getDate() + projectDuration)

          const phases: Partial<ProjectPhase>[] = []
          let currentDate = new Date(projectStart.getTime())

          // Calculate total duration of non-last phases
          const nonLastDuration = durations.reduce((sum, d) => sum + d, 0)
          const lastPhaseDuration = projectDuration - nonLastDuration

          // Skip if last phase would be too short or negative
          if (lastPhaseDuration < 1) {
            return {
              projectStart: projectStartStr,
              projectEnd: projectEnd.toISOString().split('T')[0],
              phases: [],
            }
          }

          // Create non-last phases
          for (let i = 0; i < numPhases - 1; i++) {
            const phaseStartDate = new Date(currentDate.getTime())
            const phaseEndDate = new Date(currentDate.getTime())
            phaseEndDate.setDate(phaseEndDate.getDate() + durations[i] - 1)

            const phase: Partial<ProjectPhase> = {
              id: `phase-${i}`,
              project_id: 'test-project',
              name: `Phase ${i + 1}`,
              start_date: phaseStartDate.toISOString().split('T')[0],
              end_date: phaseEndDate.toISOString().split('T')[0],
              capital_budget: 0,
              expense_budget: 0,
              total_budget: 0,
            }

            phases.push(phase)
            currentDate.setDate(currentDate.getDate() + durations[i])
          }

          // Create last phase
          const lastPhaseStart = new Date(currentDate.getTime())
          const lastPhase: Partial<ProjectPhase> = {
            id: `phase-${numPhases - 1}`,
            project_id: 'test-project',
            name: `Phase ${numPhases}`,
            start_date: lastPhaseStart.toISOString().split('T')[0],
            end_date: projectEnd.toISOString().split('T')[0],
            capital_budget: 0,
            expense_budget: 0,
            total_budget: 0,
          }
          phases.push(lastPhase)

          return {
            projectStart: projectStartStr,
            projectEnd: projectEnd.toISOString().split('T')[0],
            phases: phases,
          }
        })
        .filter(data => data.phases.length > 0) // Filter out invalid cases
    })

  /**
   * Property 1: Phase Reordering Produces Correct Order
   * Feature: phase-reordering-drag-drop, Property 1: Phase Reordering Produces Correct Order
   * Validates: Requirements 1.4
   *
   * For any list of phases and any valid insertion position, when a phase is moved
   * from its current position to the insertion position, the resulting phase order
   * should have the moved phase at the target position with all other phases
   * maintaining their relative order.
   */
  it('Property 1: phase reordering produces correct order', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Get the phase being moved
          const movedPhase = phases[fromIndex]

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)

          // Verify the moved phase is at the target position
          expect(reordered[toIndex].id).toBe(movedPhase.id)

          // Verify all other phases maintain their relative order
          const otherPhasesOriginal = phases.filter((_, i) => i !== fromIndex)
          const otherPhasesReordered = reordered.filter((_, i) => i !== toIndex)

          expect(otherPhasesReordered.length).toBe(otherPhasesOriginal.length)

          for (let i = 0; i < otherPhasesOriginal.length; i++) {
            expect(otherPhasesReordered[i].id).toBe(otherPhasesOriginal[i].id)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 2: Invalid Drops Preserve Original Order
   * Feature: phase-reordering-drag-drop, Property 2: Invalid Drops Preserve Original Order
   * Validates: Requirements 1.5
   *
   * For any phase order, when a drop operation is performed at an invalid position
   * (outside valid drop zones), the phase order should remain unchanged.
   */
  it('Property 2: invalid drops preserve original order', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: -5, max: -1 }), // Invalid negative index
        (phaseData, invalidIndex) => {
          const { phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          const fromIndex = 0 // Try to move first phase

          // Attempt reordering with invalid index
          const reordered = reorderPhases(phases, fromIndex, invalidIndex)

          // Should return original phases unchanged
          expect(reordered.length).toBe(phases.length)
          for (let i = 0; i < phases.length; i++) {
            expect(reordered[i].id).toBe(phases[i].id)
          }
        }
      ),
      { numRuns: 100 }
    )

    // Also test with out-of-bounds positive indices
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 10, max: 20 }), // Invalid large index
        (phaseData, invalidIndex) => {
          const { phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          const fromIndex = 0 // Try to move first phase

          // Attempt reordering with invalid index
          const reordered = reorderPhases(phases, fromIndex, invalidIndex)

          // Should return original phases unchanged
          expect(reordered.length).toBe(phases.length)
          for (let i = 0; i < phases.length; i++) {
            expect(reordered[i].id).toBe(phases[i].id)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 3: All Phase Durations Are Preserved
   * Feature: phase-reordering-drag-drop, Property 3: All Phase Durations Are Preserved
   * Validates: Requirements 2.1, 2.2, 2.3
   *
   * For any reordering operation, the duration of every phase (moved or not)
   * before reordering should equal its duration after reordering and date recalculation.
   * Note: The last phase's duration may be adjusted to fit project boundaries.
   */
  it('Property 3: all phase durations are preserved after reordering', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Calculate durations before reordering
          const durationsBefore = phases.map((phase) => calculatePhaseDuration(phase))

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)

          // Recalculate dates
          const recalculated = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // Calculate durations after reordering
          const durationsAfter = recalculated.map((phase) => calculatePhaseDuration(phase))

          // All durations should be preserved except the last phase
          // The last phase may be adjusted to fit project boundaries
          for (let i = 0; i < recalculated.length - 1; i++) {
            // Find the original phase by ID
            const originalPhase = phases.find(p => p.id === recalculated[i].id)
            if (!originalPhase) continue

            const originalDuration = calculatePhaseDuration(originalPhase)
            const newDuration = calculatePhaseDuration(recalculated[i])

            expect(newDuration).toBe(originalDuration)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 4: Phases Remain Contiguous After Reordering
   * Feature: phase-reordering-drag-drop, Property 4: Phases Remain Contiguous After Reordering
   * Validates: Requirements 3.1, 3.4
   *
   * For any reordered phase list, each phase's start date should equal the
   * previous phase's end date plus one day, ensuring no gaps or overlaps exist
   * between consecutive phases.
   */
  it('Property 4: phases remain contiguous after reordering', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)

          // Recalculate dates
          const recalculated = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // Check contiguity: each phase's start date should equal previous phase's end date + 1 day
          for (let i = 1; i < recalculated.length; i++) {
            const prevPhase = recalculated[i - 1]
            const currentPhase = recalculated[i]

            if (!prevPhase.end_date || !currentPhase.start_date) continue

            const prevEnd = new Date(prevPhase.end_date)
            const currentStart = new Date(currentPhase.start_date)

            // Expected start is the day after previous end
            const expectedStart = new Date(prevEnd)
            expectedStart.setDate(expectedStart.getDate() + 1)

            expect(currentStart.getTime()).toBe(expectedStart.getTime())
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 5: First Phase Starts at Project Start Date
   * Feature: phase-reordering-drag-drop, Property 5: First Phase Starts at Project Start Date
   * Validates: Requirements 3.2
   *
   * For any reordering operation, after date recalculation, the first phase's
   * start date should equal the project start date.
   */
  it('Property 5: first phase starts at project start date', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)

          // Recalculate dates
          const recalculated = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // Check first phase starts at project start
          expect(recalculated[0].start_date).toBe(projectStart)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 6: Last Phase Ends at Project End Date
   * Feature: phase-reordering-drag-drop, Property 6: Last Phase Ends at Project End Date
   * Validates: Requirements 3.3
   *
   * For any reordering operation, after date recalculation, the last phase's
   * end date should equal the project end date.
   */
  it('Property 6: last phase ends at project end date', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)

          // Recalculate dates
          const recalculated = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // Check last phase ends at project end
          const lastIndex = recalculated.length - 1
          expect(recalculated[lastIndex].end_date).toBe(projectEnd)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 7: Last Phase Duration Adjusts to Fit Project Boundaries
   * Feature: phase-reordering-drag-drop, Property 7: Last Phase Duration Adjusts to Fit Project Boundaries
   * Validates: Requirements 3.5
   *
   * For any reordering operation where the sum of phase durations doesn't perfectly
   * match the project duration, the last phase's duration should be adjusted to ensure
   * the last phase ends exactly at the project end date.
   */
  it('Property 7: last phase duration adjusts to fit project boundaries', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)

          // Recalculate dates
          const recalculated = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // The last phase should end exactly at project end date
          const lastIndex = recalculated.length - 1
          expect(recalculated[lastIndex].end_date).toBe(projectEnd)

          // Calculate what the last phase's end date would be without adjustment
          const lastPhaseStartDate = recalculated[lastIndex].start_date
          if (!lastPhaseStartDate) return

          const lastPhaseStart = new Date(lastPhaseStartDate)
          const projectEndDate = new Date(projectEnd)

          // The last phase's duration should be adjusted to reach project end
          const actualDuration = calculatePhaseDuration(recalculated[lastIndex])
          const expectedDuration = Math.round(
            (projectEndDate.getTime() - lastPhaseStart.getTime()) / (1000 * 60 * 60 * 24)
          ) + 1

          expect(actualDuration).toBe(expectedDuration)
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 8: Preview Dates Are Correctly Calculated
   * Feature: phase-reordering-drag-drop, Property 8: Preview Dates Are Correctly Calculated
   * Validates: Requirements 4.5
   *
   * For any drag position over the timeline, the preview dates calculated for all phases
   * should satisfy the same constraints as final dates (contiguous, within project boundaries,
   * durations preserved).
   */
  it('Property 8: preview dates are correctly calculated', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Calculate preview phases (same as what would be shown during drag)
          const reordered = reorderPhases(phases, fromIndex, toIndex)
          const preview = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // Preview dates should satisfy all the same constraints as final dates:

          // 1. First phase starts at project start
          expect(preview[0].start_date).toBe(projectStart)

          // 2. Last phase ends at project end
          const lastIndex = preview.length - 1
          expect(preview[lastIndex].end_date).toBe(projectEnd)

          // 3. Phases are contiguous (no gaps or overlaps)
          for (let i = 1; i < preview.length; i++) {
            const prevPhase = preview[i - 1]
            const currentPhase = preview[i]

            if (!prevPhase.end_date || !currentPhase.start_date) continue

            // Calculate expected next day
            const expectedStart = getNextDay(prevPhase.end_date)

            // Compare date strings instead of timestamps to avoid timezone issues
            expect(currentPhase.start_date).toBe(expectedStart)
          }

          // 4. All phases are within project boundaries
          const projectStartDate = new Date(projectStart)
          const projectEndDate = new Date(projectEnd)

          for (const phase of preview) {
            if (!phase.start_date || !phase.end_date) continue

            const phaseStart = new Date(phase.start_date)
            const phaseEnd = new Date(phase.end_date)

            expect(phaseStart.getTime()).toBeGreaterThanOrEqual(projectStartDate.getTime())
            expect(phaseEnd.getTime()).toBeLessThanOrEqual(projectEndDate.getTime())
            expect(phaseStart.getTime()).toBeLessThanOrEqual(phaseEnd.getTime())
          }

          // 5. Durations are preserved (except last phase which may be adjusted)
          for (let i = 0; i < preview.length - 1; i++) {
            const originalPhase = phases.find(p => p.id === preview[i].id)
            if (!originalPhase) continue

            const originalDuration = calculatePhaseDuration(originalPhase)
            const previewDuration = calculatePhaseDuration(preview[i])

            expect(previewDuration).toBe(originalDuration)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  /**
   * Property 9: Invalid Reorderings Are Rejected
   * Feature: phase-reordering-drag-drop, Property 9: Invalid Reorderings Are Rejected
   * Validates: Requirements 6.1
   *
   * For any reordering operation that would result in invalid dates (phases outside
   * project boundaries, negative durations, etc.), the validation function should
   * return false and prevent the reordering.
   */
  it('Property 9: invalid reorderings are rejected', () => {
    // Test 1: Phases with missing dates should be rejected
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        (phaseData) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Create invalid phases by removing dates
          const invalidPhases = phases.map((phase, i) => {
            if (i === 0) {
              // Remove start_date from first phase
              return { ...phase, start_date: undefined }
            }
            return phase
          })

          // Validation should fail
          const validation = validateReordering(invalidPhases, projectStart, projectEnd)
          expect(validation.isValid).toBe(false)
          expect(validation.error).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )

    // Test 2: Phases outside project boundaries should be rejected
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        (phaseData) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Create invalid phases by setting first phase before project start
          const invalidPhases = [...phases]
          const projectStartDate = new Date(projectStart)
          const beforeProjectStart = new Date(projectStartDate)
          beforeProjectStart.setDate(beforeProjectStart.getDate() - 10)
          
          invalidPhases[0] = {
            ...invalidPhases[0],
            start_date: beforeProjectStart.toISOString().split('T')[0],
          }

          // Validation should fail
          const validation = validateReordering(invalidPhases, projectStart, projectEnd)
          expect(validation.isValid).toBe(false)
          expect(validation.error).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )

    // Test 3: Non-contiguous phases should be rejected
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        (phaseData) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Create invalid phases by introducing a gap
          const invalidPhases = [...phases]
          if (invalidPhases[1] && invalidPhases[1].start_date) {
            const secondPhaseStart = new Date(invalidPhases[1].start_date)
            secondPhaseStart.setDate(secondPhaseStart.getDate() + 5) // Create a gap
            invalidPhases[1] = {
              ...invalidPhases[1],
              start_date: secondPhaseStart.toISOString().split('T')[0],
            }
          }

          // Validation should fail
          const validation = validateReordering(invalidPhases, projectStart, projectEnd)
          expect(validation.isValid).toBe(false)
          expect(validation.error).toBeDefined()
        }
      ),
      { numRuns: 100 }
    )

    // Test 4: Empty phase array should be rejected
    const validation = validateReordering([], '2024-01-01', '2024-12-31')
    expect(validation.isValid).toBe(false)
    expect(validation.error).toBe('No phases to validate')
  })

  /**
   * Property 10: Failed Reorderings Preserve Previous State
   * Feature: phase-reordering-drag-drop, Property 10: Failed Reorderings Preserve Previous State
   * Validates: Requirements 6.3
   *
   * For any reordering operation that fails validation, the phase order and dates
   * should remain exactly as they were before the operation was attempted.
   */
  it('Property 10: failed reorderings preserve previous state', () => {
    fc.assert(
      fc.property(
        contiguousPhasesGenerator,
        fc.integer({ min: 0, max: 9 }),
        fc.integer({ min: 0, max: 9 }),
        (phaseData, fromIndexRaw, toIndexRaw) => {
          const { projectStart, projectEnd, phases } = phaseData

          // Skip if not enough phases
          if (phases.length < 2) return

          // Constrain indices to valid range
          const fromIndex = fromIndexRaw % phases.length
          const toIndex = toIndexRaw % phases.length

          // Store original state
          const originalPhases = phases.map(p => ({ ...p }))

          // Perform reordering
          const reordered = reorderPhases(phases, fromIndex, toIndex)
          const recalculated = recalculatePhaseDates(reordered, projectStart, projectEnd)

          // Validate the reordering
          const validation = validateReordering(recalculated, projectStart, projectEnd)

          if (!validation.isValid) {
            // If validation fails, the original phases should remain unchanged
            // (In the actual implementation, we don't call onPhaseReorder)
            // Here we verify that the original phases array is not mutated
            expect(phases.length).toBe(originalPhases.length)
            for (let i = 0; i < phases.length; i++) {
              expect(phases[i].id).toBe(originalPhases[i].id)
              expect(phases[i].start_date).toBe(originalPhases[i].start_date)
              expect(phases[i].end_date).toBe(originalPhases[i].end_date)
            }
          }
        }
      ),
      { numRuns: 100 }
    )

    // Test with deliberately invalid reordering scenario
    // Create phases that will fail validation after reordering
    const projectStart = '2024-01-01'
    const projectEnd = '2024-01-31'
    
    const testPhases: Partial<ProjectPhase>[] = [
      {
        id: 'phase-1',
        project_id: 'test',
        name: 'Phase 1',
        start_date: '2024-01-01',
        end_date: '2024-01-15',
        capital_budget: 0,
        expense_budget: 0,
        total_budget: 0,
      },
      {
        id: 'phase-2',
        project_id: 'test',
        name: 'Phase 2',
        start_date: '2024-01-16',
        end_date: '2024-01-31',
        capital_budget: 0,
        expense_budget: 0,
        total_budget: 0,
      },
    ]

    // Store original state
    const originalPhases = testPhases.map(p => ({ ...p }))

    // Perform reordering (swap phases)
    const reordered = reorderPhases(testPhases, 0, 1)
    
    // Manually create invalid recalculated phases (simulate a bug)
    const invalidRecalculated = reordered.map(p => ({ ...p }))
    // Make it invalid by setting first phase to start after project start
    invalidRecalculated[0].start_date = '2024-01-05'

    // Validate - should fail
    const validation = validateReordering(invalidRecalculated, projectStart, projectEnd)
    expect(validation.isValid).toBe(false)

    // Original phases should remain unchanged
    expect(testPhases.length).toBe(originalPhases.length)
    for (let i = 0; i < testPhases.length; i++) {
      expect(testPhases[i].id).toBe(originalPhases[i].id)
      expect(testPhases[i].start_date).toBe(originalPhases[i].start_date)
      expect(testPhases[i].end_date).toBe(originalPhases[i].end_date)
    }
  })
})
