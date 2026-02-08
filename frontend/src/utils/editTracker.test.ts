/**
 * Unit tests for EditTracker utility
 * Tests: addEdit, removeEdit, hasEdits, getEdits, clear methods
 * Requirement: 14.3
 */

import { describe, it, expect } from 'vitest'
import { createEditTracker, CellEdit } from './editTracker'

describe('EditTracker', () => {
  describe('addEdit', () => {
    it('adds a new edit to the tracker', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      
      expect(tracker.hasEdits()).toBe(true)
      expect(tracker.getEdits()).toHaveLength(1)
      expect(tracker.getEdits()[0]).toEqual(edit)
    })

    it('updates existing edit when same cell is edited again', () => {
      const tracker = createEditTracker()
      
      const firstEdit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const secondEdit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 85,
      }
      
      tracker.addEdit(firstEdit)
      tracker.addEdit(secondEdit)
      
      // Should only have one edit (the second one replaces the first)
      expect(tracker.getEdits()).toHaveLength(1)
      expect(tracker.getEdits()[0].newValue).toBe(85)
    })

    it('tracks multiple edits for different cells', () => {
      const tracker = createEditTracker()
      
      const edit1: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const edit2: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'expense',
        oldValue: 30,
        newValue: 40,
      }
      
      const edit3: CellEdit = {
        resourceId: 'resource-2',
        date: new Date('2024-01-16'),
        costTreatment: 'capital',
        oldValue: 60,
        newValue: 80,
      }
      
      tracker.addEdit(edit1)
      tracker.addEdit(edit2)
      tracker.addEdit(edit3)
      
      expect(tracker.getEdits()).toHaveLength(3)
    })
  })

  describe('removeEdit', () => {
    it('removes an edit by key', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      expect(tracker.hasEdits()).toBe(true)
      
      // Remove using the composite key format
      const key = `resource-1:2024-01-15:capital`
      tracker.removeEdit(key)
      
      expect(tracker.hasEdits()).toBe(false)
      expect(tracker.getEdits()).toHaveLength(0)
    })

    it('does not affect other edits when removing one', () => {
      const tracker = createEditTracker()
      
      const edit1: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const edit2: CellEdit = {
        resourceId: 'resource-2',
        date: new Date('2024-01-16'),
        costTreatment: 'expense',
        oldValue: 30,
        newValue: 40,
      }
      
      tracker.addEdit(edit1)
      tracker.addEdit(edit2)
      
      const key1 = `resource-1:2024-01-15:capital`
      tracker.removeEdit(key1)
      
      expect(tracker.getEdits()).toHaveLength(1)
      expect(tracker.getEdits()[0]).toEqual(edit2)
    })

    it('handles removing non-existent key gracefully', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      
      // Try to remove a key that doesn't exist
      tracker.removeEdit('non-existent-key')
      
      // Original edit should still be there
      expect(tracker.getEdits()).toHaveLength(1)
    })
  })

  describe('hasEdits', () => {
    it('returns false when no edits exist', () => {
      const tracker = createEditTracker()
      expect(tracker.hasEdits()).toBe(false)
    })

    it('returns true when edits exist', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      expect(tracker.hasEdits()).toBe(true)
    })

    it('returns false after all edits are removed', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      expect(tracker.hasEdits()).toBe(true)
      
      const key = `resource-1:2024-01-15:capital`
      tracker.removeEdit(key)
      expect(tracker.hasEdits()).toBe(false)
    })

    it('returns false after clear is called', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      expect(tracker.hasEdits()).toBe(true)
      
      tracker.clear()
      expect(tracker.hasEdits()).toBe(false)
    })
  })

  describe('getEdits', () => {
    it('returns empty array when no edits exist', () => {
      const tracker = createEditTracker()
      expect(tracker.getEdits()).toEqual([])
    })

    it('returns all edits as an array', () => {
      const tracker = createEditTracker()
      
      const edit1: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const edit2: CellEdit = {
        resourceId: 'resource-2',
        date: new Date('2024-01-16'),
        costTreatment: 'expense',
        oldValue: 30,
        newValue: 40,
      }
      
      tracker.addEdit(edit1)
      tracker.addEdit(edit2)
      
      const edits = tracker.getEdits()
      expect(edits).toHaveLength(2)
      expect(edits).toContainEqual(edit1)
      expect(edits).toContainEqual(edit2)
    })

    it('returns a new array each time (not a reference)', () => {
      const tracker = createEditTracker()
      
      const edit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit)
      
      const edits1 = tracker.getEdits()
      const edits2 = tracker.getEdits()
      
      // Should be different array instances
      expect(edits1).not.toBe(edits2)
      // But with the same content
      expect(edits1).toEqual(edits2)
    })
  })

  describe('clear', () => {
    it('removes all edits', () => {
      const tracker = createEditTracker()
      
      const edit1: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const edit2: CellEdit = {
        resourceId: 'resource-2',
        date: new Date('2024-01-16'),
        costTreatment: 'expense',
        oldValue: 30,
        newValue: 40,
      }
      
      tracker.addEdit(edit1)
      tracker.addEdit(edit2)
      
      expect(tracker.hasEdits()).toBe(true)
      expect(tracker.getEdits()).toHaveLength(2)
      
      tracker.clear()
      
      expect(tracker.hasEdits()).toBe(false)
      expect(tracker.getEdits()).toHaveLength(0)
    })

    it('allows adding new edits after clear', () => {
      const tracker = createEditTracker()
      
      const edit1: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      tracker.addEdit(edit1)
      tracker.clear()
      
      const edit2: CellEdit = {
        resourceId: 'resource-2',
        date: new Date('2024-01-16'),
        costTreatment: 'expense',
        oldValue: 30,
        newValue: 40,
      }
      
      tracker.addEdit(edit2)
      
      expect(tracker.hasEdits()).toBe(true)
      expect(tracker.getEdits()).toHaveLength(1)
      expect(tracker.getEdits()[0]).toEqual(edit2)
    })
  })

  describe('Composite Key Usage', () => {
    it('uses composite keys to distinguish between capital and expense for same resource/date', () => {
      const tracker = createEditTracker()
      
      const capitalEdit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const expenseEdit: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'expense',
        oldValue: 30,
        newValue: 40,
      }
      
      tracker.addEdit(capitalEdit)
      tracker.addEdit(expenseEdit)
      
      // Should track both edits separately
      expect(tracker.getEdits()).toHaveLength(2)
    })

    it('uses composite keys to distinguish between different dates for same resource', () => {
      const tracker = createEditTracker()
      
      const edit1: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-15'),
        costTreatment: 'capital',
        oldValue: 50,
        newValue: 75,
      }
      
      const edit2: CellEdit = {
        resourceId: 'resource-1',
        date: new Date('2024-01-16'),
        costTreatment: 'capital',
        oldValue: 60,
        newValue: 80,
      }
      
      tracker.addEdit(edit1)
      tracker.addEdit(edit2)
      
      // Should track both edits separately
      expect(tracker.getEdits()).toHaveLength(2)
    })
  })
})
