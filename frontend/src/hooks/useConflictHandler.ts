import { useState, useCallback } from 'react'
import { AxiosError } from 'axios'

export interface ConflictError {
  error: string
  message: string
  entity_type: string
  entity_id: string
  current_state: Record<string, any>
}

export interface ConflictState {
  isConflict: boolean
  entityType: string
  attemptedChanges: Record<string, any>
  currentState: Record<string, any>
}

export const useConflictHandler = () => {
  const [conflictState, setConflictState] = useState<ConflictState>({
    isConflict: false,
    entityType: '',
    attemptedChanges: {},
    currentState: {},
  })

  const handleError = useCallback((error: any, attemptedChanges: Record<string, any>) => {
    const axiosError = error as AxiosError<{ detail: ConflictError }>

    // Check if this is a 409 Conflict error
    if (axiosError.response?.status === 409) {
      const conflictData = axiosError.response.data.detail

      setConflictState({
        isConflict: true,
        entityType: conflictData.entity_type,
        attemptedChanges,
        currentState: conflictData.current_state,
      })

      return true // Indicates conflict was handled
    }

    return false // Not a conflict error
  }, [])

  const clearConflict = useCallback(() => {
    setConflictState({
      isConflict: false,
      entityType: '',
      attemptedChanges: {},
      currentState: {},
    })
  }, [])

  return {
    conflictState,
    handleError,
    clearConflict,
  }
}
