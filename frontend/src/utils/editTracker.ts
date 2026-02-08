/**
 * Edit tracking utility for resource assignment calendar
 * Tracks cell edits before persisting to the database
 */

import { getCellKey } from './calendarTransform'

/**
 * Represents a single cell edit
 */
export interface CellEdit {
  resourceId: string
  date: Date
  costTreatment: 'capital' | 'expense'
  oldValue: number
  newValue: number
}

/**
 * Edit tracker for managing cell edits
 */
export interface EditTracker {
  edits: Map<string, CellEdit>
  
  addEdit(edit: CellEdit): void
  removeEdit(key: string): void
  hasEdits(): boolean
  getEdits(): CellEdit[]
  clear(): void
}

/**
 * Creates a new EditTracker instance
 * @returns EditTracker with methods for managing edits
 */
export function createEditTracker(): EditTracker {
  const edits = new Map<string, CellEdit>()
  
  return {
    edits,
    
    /**
     * Adds or updates an edit in the tracker
     * @param edit - The cell edit to add
     */
    addEdit(edit: CellEdit) {
      const key = getCellKey(edit.resourceId, edit.date, edit.costTreatment)
      edits.set(key, edit)
    },
    
    /**
     * Removes an edit from the tracker
     * @param key - The composite key of the edit to remove
     */
    removeEdit(key: string) {
      edits.delete(key)
    },
    
    /**
     * Checks if there are any edits
     * @returns true if there are edits, false otherwise
     */
    hasEdits() {
      return edits.size > 0
    },
    
    /**
     * Gets all edits as an array
     * @returns Array of all cell edits
     */
    getEdits() {
      return Array.from(edits.values())
    },
    
    /**
     * Clears all edits
     */
    clear() {
      edits.clear()
    }
  }
}
