import { useState, useEffect, useCallback, useRef } from 'react'
import { getCellKey } from '../utils/calendarTransform'

interface CellEdit {
  resourceId: string
  date: Date
  costTreatment: 'capital' | 'expense'
  oldValue: number
  newValue: number
}

interface SerializedCellEdit {
  resourceId: string
  date: string // ISO string for serialization
  costTreatment: 'capital' | 'expense'
  oldValue: number
  newValue: number
}

interface PersistedEditsState {
  [projectId: string]: SerializedCellEdit[]
}

const STORAGE_KEY = 'assignment-calendar-edits'
const SAVE_DEBOUNCE_MS = 500 // Debounce saves to reduce sessionStorage writes

/**
 * Custom hook to persist unsaved assignment edits across navigation
 * 
 * Stores edits in sessionStorage so they survive tab switches but are
 * cleared when the browser tab is closed.
 * 
 * Performance: Saves are debounced by 500ms to avoid blocking the UI on every keystroke.
 */
export function usePersistedEdits(projectId: string) {
  const [editedCells, setEditedCells] = useState<Map<string, CellEdit>>(new Map())
  const [isInitialized, setIsInitialized] = useState(false)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load edits from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      if (stored) {
        const allEdits: PersistedEditsState = JSON.parse(stored)
        const projectEdits = allEdits[projectId] || []
        
        // Convert array back to Map, deserializing dates
        const editsMap = new Map<string, CellEdit>()
        projectEdits.forEach((edit) => {
          const date = new Date(edit.date)
          const key = getCellKey(edit.resourceId, date, edit.costTreatment)
          editsMap.set(key, {
            ...edit,
            date, // Convert string back to Date
          })
        })
        
        setEditedCells(editsMap)
      }
    } catch (error) {
      console.error('Failed to load persisted edits:', error)
    } finally {
      // Mark as initialized after loading
      setIsInitialized(true)
    }
  }, [projectId])

  // Save edits to sessionStorage whenever they change (debounced)
  useEffect(() => {
    // Skip saving during initial load
    if (!isInitialized) {
      return
    }
    
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }
    
    // Debounce the save operation to avoid blocking UI on every keystroke
    saveTimeoutRef.current = setTimeout(() => {
      try {
        // Load existing state
        const stored = sessionStorage.getItem(STORAGE_KEY)
        const allEdits: PersistedEditsState = stored ? JSON.parse(stored) : {}
        
        // Convert Map to array for serialization, converting dates to strings
        const projectEdits: SerializedCellEdit[] = Array.from(editedCells.values()).map((edit) => ({
          ...edit,
          date: edit.date.toISOString(), // Convert Date to string
        }))
        
        // Update state for this project
        if (projectEdits.length > 0) {
          allEdits[projectId] = projectEdits
        } else {
          // Remove project if no edits
          delete allEdits[projectId]
        }
        
        // Save back to sessionStorage
        if (Object.keys(allEdits).length > 0) {
          sessionStorage.setItem(STORAGE_KEY, JSON.stringify(allEdits))
        } else {
          sessionStorage.removeItem(STORAGE_KEY)
        }
      } catch (error) {
        console.error('Failed to persist edits:', error)
      }
    }, SAVE_DEBOUNCE_MS)
    
    // Cleanup timeout on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [projectId, editedCells, isInitialized])

  // Clear edits for this project
  const clearEdits = useCallback(() => {
    setEditedCells(new Map())
  }, [])

  // Clear all edits across all projects
  const clearAllEdits = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY)
    setEditedCells(new Map())
  }, [])

  return {
    editedCells,
    setEditedCells,
    clearEdits,
    clearAllEdits,
  }
}
