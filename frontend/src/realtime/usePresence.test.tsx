import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { Provider } from 'react-redux'
import React from 'react'
import { createTestStore, createTestQueryClient } from '../test/test-utils'
import { usePresence } from './usePresence'
import { realtimeApi } from './realtimeApi'

beforeEach(() => {
  vi.spyOn(realtimeApi, 'registerPresence').mockReset().mockResolvedValue(undefined)
  vi.spyOn(realtimeApi, 'releasePresence').mockReset().mockResolvedValue(undefined)
  vi.spyOn(realtimeApi, 'getPresence').mockReset().mockResolvedValue([])
})

function wrap(userId = 'me') {
  const store = createTestStore({
    auth: {
      user: { id: userId, username: 'u', email: 'u@e.c', roles: [], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })
  const queryClient = createTestQueryClient()
  return ({ children }: { children: React.ReactNode }) => (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  )
}

describe('usePresence', () => {
  it('registers presence when active becomes true', async () => {
    const { rerender } = renderHook(({ active }) => usePresence('resource', 'r1', active), {
      wrapper: wrap(),
      initialProps: { active: false },
    })

    expect(realtimeApi.registerPresence).not.toHaveBeenCalled()

    rerender({ active: true })

    await waitFor(() => expect(realtimeApi.registerPresence).toHaveBeenCalledWith('resource', 'r1'))
  })

  it('releases presence on unmount', async () => {
    const { unmount } = renderHook(() => usePresence('resource', 'r1', true), {
      wrapper: wrap(),
    })

    await waitFor(() => expect(realtimeApi.registerPresence).toHaveBeenCalled())

    unmount()

    await waitFor(() => expect(realtimeApi.releasePresence).toHaveBeenCalledWith('resource', 'r1'))
  })

  it('releases presence when active flips false without unmounting', async () => {
    const { rerender } = renderHook(({ active }) => usePresence('resource', 'r1', active), {
      wrapper: wrap(),
      initialProps: { active: true },
    })

    await waitFor(() => expect(realtimeApi.registerPresence).toHaveBeenCalled())

    rerender({ active: false })

    await waitFor(() => expect(realtimeApi.releasePresence).toHaveBeenCalledWith('resource', 'r1'))
  })

  it('excludes the current user from others', async () => {
    vi.mocked(realtimeApi.getPresence).mockResolvedValue([
      { user_id: 'me', name: 'Me' },
      { user_id: 'them', name: 'Them' },
    ])

    const { result } = renderHook(() => usePresence('resource', 'r1', false), {
      wrapper: wrap('me'),
    })

    await waitFor(() => expect(result.current.others).toEqual([{ user_id: 'them', name: 'Them' }]))
  })
})
