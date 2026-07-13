import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { useEntityLock } from './useEntityLock'
import { realtimeApi } from './realtimeApi'

beforeEach(() => {
  vi.spyOn(realtimeApi, 'acquireLock').mockReset()
  vi.spyOn(realtimeApi, 'heartbeatLock').mockReset().mockResolvedValue({ refreshed: true })
  vi.spyOn(realtimeApi, 'releaseLock').mockReset().mockResolvedValue({ ok: true })
  vi.spyOn(realtimeApi, 'forceReleaseLock').mockReset().mockResolvedValue({ ok: true })
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

  it('takeOver force-releases (not the owner-checked release) then re-acquires the lock, even against an active holder', async () => {
    vi.mocked(realtimeApi.acquireLock).mockResolvedValueOnce({
      acquired: false,
      holder: { user_id: 'u2', name: 'Alice' },
    })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await waitFor(() => expect(result.current.state).toBe('blocked'))

    const callOrder: string[] = []
    vi.mocked(realtimeApi.forceReleaseLock).mockImplementationOnce(async () => {
      callOrder.push('force-release')
      return { ok: true }
    })
    vi.mocked(realtimeApi.acquireLock).mockImplementationOnce(async () => {
      callOrder.push('acquire')
      return { acquired: true, holder: { user_id: 'u1', name: 'Me' } }
    })

    await act(async () => {
      await result.current.takeOver()
    })

    expect(callOrder).toEqual(['force-release', 'acquire'])
    // The regular owner-checked release must NOT be used for take-over —
    // it would no-op against Alice's still-active lock.
    expect(realtimeApi.releaseLock).not.toHaveBeenCalled()
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

  it('transitions held -> blocked when a heartbeat comes back refreshed:false and getLock confirms a DIFFERENT holder, and stops heartbeating', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    // We were granted the lock as 'u1'; getLock later confirms someone else
    // ('u3', Bob) now holds it — a genuine, confirmed loss.
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({
      acquired: true,
      holder: { user_id: 'u1', name: 'Me' },
    })
    vi.mocked(realtimeApi.heartbeatLock).mockResolvedValue({ refreshed: false })
    vi.mocked(realtimeApi.getLock).mockResolvedValue({
      holder: { user_id: 'u3', name: 'Bob' },
    })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await vi.waitFor(() => expect(result.current.state).toBe('held'))

    await vi.advanceTimersByTimeAsync(30000)
    await vi.waitFor(() => expect(result.current.state).toBe('blocked'))
    expect(realtimeApi.getLock).toHaveBeenCalledWith('resource', 'r1')
    expect(result.current.holder).toEqual({ user_id: 'u3', name: 'Bob' })

    const callsAfterBlocked = vi.mocked(realtimeApi.heartbeatLock).mock.calls.length
    await vi.advanceTimersByTimeAsync(120000)
    expect(realtimeApi.heartbeatLock).toHaveBeenCalledTimes(callsAfterBlocked)
  })

  it('stays held and keeps heartbeating when refreshed:false but getLock is ambiguous (holder: null, e.g. Redis down)', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({
      acquired: true,
      holder: { user_id: 'u1', name: 'Me' },
    })
    vi.mocked(realtimeApi.heartbeatLock).mockResolvedValue({ refreshed: false })
    vi.mocked(realtimeApi.getLock).mockResolvedValue({ holder: null })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await vi.waitFor(() => expect(result.current.state).toBe('held'))

    await vi.advanceTimersByTimeAsync(30000)
    await vi.waitFor(() => expect(realtimeApi.getLock).toHaveBeenCalledWith('resource', 'r1'))

    // Give any (incorrect) state transition a chance to happen, then assert
    // we're still held.
    expect(result.current.state).toBe('held')

    // Heartbeat must not have stopped: another tick still calls it.
    const callsBefore = vi.mocked(realtimeApi.heartbeatLock).mock.calls.length
    await vi.advanceTimersByTimeAsync(30000)
    expect(vi.mocked(realtimeApi.heartbeatLock).mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('stays held when refreshed:false but getLock confirms the holder is still ourselves', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
    vi.mocked(realtimeApi.acquireLock).mockResolvedValue({
      acquired: true,
      holder: { user_id: 'u1', name: 'Me' },
    })
    vi.mocked(realtimeApi.heartbeatLock).mockResolvedValue({ refreshed: false })
    vi.mocked(realtimeApi.getLock).mockResolvedValue({
      holder: { user_id: 'u1', name: 'Me' },
    })

    const { result } = renderHook(() => useEntityLock('resource', 'r1', true))

    await vi.waitFor(() => expect(result.current.state).toBe('held'))

    await vi.advanceTimersByTimeAsync(30000)
    await vi.waitFor(() => expect(realtimeApi.getLock).toHaveBeenCalledWith('resource', 'r1'))

    expect(result.current.state).toBe('held')

    const callsBefore = vi.mocked(realtimeApi.heartbeatLock).mock.calls.length
    await vi.advanceTimersByTimeAsync(30000)
    expect(vi.mocked(realtimeApi.heartbeatLock).mock.calls.length).toBeGreaterThan(callsBefore)
  })

  it('releases the lock if acquire resolves acquired:true after the component already unmounted', async () => {
    let resolveAcquire: (v: { acquired: boolean; holder: null }) => void = () => {}
    vi.mocked(realtimeApi.acquireLock).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveAcquire = resolve
        }),
    )

    const { unmount } = renderHook(() => useEntityLock('resource', 'r1', true))

    // Unmount while the acquire call is still in flight — mirrors React
    // StrictMode's mount -> cleanup -> remount, and any ordinary fast
    // navigate-away-before-the-request-completes case.
    unmount()

    expect(realtimeApi.releaseLock).not.toHaveBeenCalled()

    resolveAcquire({ acquired: true, holder: null })

    await waitFor(() => expect(realtimeApi.releaseLock).toHaveBeenCalledWith('resource', 'r1'))
  })
})
