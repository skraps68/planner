import { renderHook, act } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { useConflictHandler } from './useConflictHandler'
import { AxiosError } from 'axios'

describe('useConflictHandler', () => {
  it('initializes with no conflict', () => {
    const { result } = renderHook(() => useConflictHandler())
    
    expect(result.current.conflictState.isConflict).toBe(false)
    expect(result.current.conflictState.entityType).toBe('')
    expect(result.current.conflictState.attemptedChanges).toEqual({})
    expect(result.current.conflictState.currentState).toEqual({})
  })

  it('handles 409 conflict error correctly', () => {
    const { result } = renderHook(() => useConflictHandler())
    
    const conflictError = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'The portfolio was modified by another user',
            entity_type: 'portfolio',
            entity_id: '123',
            current_state: {
              id: '123',
              name: 'Updated Name',
              version: 2,
            },
          },
        },
      },
    } as AxiosError

    const attemptedChanges = {
      name: 'My Name',
      version: 1,
    }

    let isConflict: boolean = false
    act(() => {
      isConflict = result.current.handleError(conflictError, attemptedChanges)
    })

    expect(isConflict).toBe(true)
    expect(result.current.conflictState.isConflict).toBe(true)
    expect(result.current.conflictState.entityType).toBe('portfolio')
    expect(result.current.conflictState.attemptedChanges).toEqual(attemptedChanges)
    expect(result.current.conflictState.currentState).toEqual({
      id: '123',
      name: 'Updated Name',
      version: 2,
    })
  })

  it('returns false for non-409 errors', () => {
    const { result } = renderHook(() => useConflictHandler())
    
    const nonConflictError = {
      response: {
        status: 500,
        data: {
          detail: 'Internal server error',
        },
      },
    } as AxiosError

    const attemptedChanges = {
      name: 'My Name',
      version: 1,
    }

    let isConflict: boolean = true
    act(() => {
      isConflict = result.current.handleError(nonConflictError, attemptedChanges)
    })

    expect(isConflict).toBe(false)
    expect(result.current.conflictState.isConflict).toBe(false)
  })

  it('returns false for errors without response', () => {
    const { result } = renderHook(() => useConflictHandler())
    
    const networkError = {
      message: 'Network error',
    } as AxiosError

    const attemptedChanges = {
      name: 'My Name',
      version: 1,
    }

    let isConflict: boolean = true
    act(() => {
      isConflict = result.current.handleError(networkError, attemptedChanges)
    })

    expect(isConflict).toBe(false)
    expect(result.current.conflictState.isConflict).toBe(false)
  })

  it('clears conflict state', () => {
    const { result } = renderHook(() => useConflictHandler())
    
    // First set a conflict
    const conflictError = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'Conflict occurred',
            entity_type: 'portfolio',
            entity_id: '123',
            current_state: {
              id: '123',
              version: 2,
            },
          },
        },
      },
    } as AxiosError

    act(() => {
      result.current.handleError(conflictError, { name: 'Test', version: 1 })
    })

    expect(result.current.conflictState.isConflict).toBe(true)

    // Now clear it
    act(() => {
      result.current.clearConflict()
    })

    expect(result.current.conflictState.isConflict).toBe(false)
    expect(result.current.conflictState.entityType).toBe('')
    expect(result.current.conflictState.attemptedChanges).toEqual({})
    expect(result.current.conflictState.currentState).toEqual({})
  })

  it('preserves attempted changes in conflict state', () => {
    const { result } = renderHook(() => useConflictHandler())
    
    const conflictError = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'Conflict occurred',
            entity_type: 'program',
            entity_id: '456',
            current_state: {
              id: '456',
              name: 'Current Name',
              description: 'Current Description',
              version: 3,
            },
          },
        },
      },
    } as AxiosError

    const attemptedChanges = {
      name: 'My Name',
      description: 'My Description',
      start_date: '2024-01-01',
      version: 2,
    }

    act(() => {
      result.current.handleError(conflictError, attemptedChanges)
    })

    expect(result.current.conflictState.attemptedChanges).toEqual(attemptedChanges)
  })
})
