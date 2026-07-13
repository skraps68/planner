import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEntityLock } from './useEntityLock'
import { realtimeApi } from './realtimeApi'

beforeEach(() => {
  vi.spyOn(realtimeApi, 'acquireLock').mockReset()
  vi.spyOn(realtimeApi, 'heartbeatLock').mockReset().mockResolvedValue({ refreshed: true })
  vi.spyOn(realtimeApi, 'releaseLock').mockReset().mockResolvedValue({ ok: true })
  vi.spyOn(realtimeApi, 'getLock').mockReset().mockResolvedValue({ holder: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('useEntityLock', () => {
  it('acquires and sets state held, then heartbeats on an interval', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({ acquired: true, holder: null })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await vi.waitFor(() => expect(result.current.state).toBe('held'))
    expect(realtimeApi.acquireLock).toHaveBeenCalledWith('resource', 'r1')

    expect(realtimeApi.heartbeatLock).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(30000)
    expect(realtimeApi.heartbeatLock).toHaveBeenCalledWith('resource', 'r1')
  })

  it('sets state blocked with holder when acquire is denied', async () => {
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({
      acquired: false,
      holder: { user_id: 'u2', name: 'Alice' },
    })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await waitFor(() => expect(result.current.state).toBe('blocked'))
    expect(result.current.holder).toEqual({ user_id: 'u2', name: 'Alice' })
  })

  it('releases the lock on unmount', async () => {
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({ acquired: true, holder: null })

    const { result, unmount } = renderHook(() => useEntityLock('resource', 'r1', true))

    await waitFor(() => expect(result.current.state).toBe('held'))

    unmount()

    await waitFor(() => expect(realtimeApi.releaseLock).toHaveBeenCalledWith('resource', 'r1'))
  })

  it('releases the lock when wantLock flips false without unmounting', async () => {
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({ acquired: true, holder: null })

    const { result, rerender } = renderHook(({ want }) => useEntityLock('resource', 'r1', want), {
      initialProps: { want: true },
    })

    await waitFor(() => expect(result.current.state).toBe('held'))

    rerender({ want: false })

    await waitFor(() => expect(realtimeApi.releaseLock).toHaveBeenCalledWith('resource', 'r1'))
    expect(result.current.state).toBe('idle')
  })

  it('takeOver releases then re-acquires the lock', async () => {
    vi.mocked(realtimeApi.acquireLock).mockResolvedValueOnce({
      acquired: false,
      holder: { user_id: 'u2', name: 'Alice' },
    })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await waitFor(() => expect(result.current.state).toBe('blocked'))

    const callOrder: string[] = []
    vi.mocked(realtimeApi.releaseLock).mockImplementationOnce(async () => {
      callOrder.push('release')
      return { ok: true }
    })
    vi.mocked(realtimeApi.acquireLock).mockImplementationOnce(async () => {
      callOrder.push('acquire')
      return { acquired: true, holder: null }
    })

    await act(async () => {
      await result.current.takeOver()
    })

    expect(callOrder).toEqual(['release', 'acquire'])
    await waitFor(() => expect(result.current.state).toBe('held'))
  })

  it('does not attempt to acquire a lock for an undefined or "new" entity id', async () => {
    renderHook(() => useEntityLock('resource', undefined, true))
    renderHook(() => useEntityLock('resource', 'new', true))

    await new Promise((r) => setTimeout(r, 0))
    expect(realtimeApi.acquireLock).not.toHaveBeenCalled()
  })

  it('stops heartbeating after release on unmount', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({ acquired: true, holder: null })

    const { result, unmount } = renderHook(() => useEntityLock('resource', 'r1', true))

    await vi.waitFor(() => expect(result.current.state).toBe('held'))

    unmount()
    const callsAfterUnmount = vi.mocked(realtimeApi.heartbeatLock).mock.calls.length
    await vi.advanceTimersByTimeAsync(120000)
    expect(realtimeApi.heartbeatLock).toHaveBeenCalledTimes(callsAfterUnmount)
  })
})
