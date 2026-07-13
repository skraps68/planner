import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { useRealtime } from './useRealtime'
import { realtimeApi } from './realtimeApi'

// Minimal EventSource mock
class MockEventSource {
  static instances: MockEventSource[] = []
  url: string
  onopen: ((e: any) => void) | null = null
  onmessage: ((e: any) => void) | null = null
  onerror: ((e: any) => void) | null = null
  closed = false
  constructor(url: string) { this.url = url; MockEventSource.instances.push(this) }
  emitOpen() { this.onopen?.({}) }
  emitMessage(data: any) { this.onmessage?.({ data: JSON.stringify(data) }) }
  emitError() { this.onerror?.({}) }
  close() { this.closed = true }
}

beforeEach(() => {
  MockEventSource.instances = []
  ;(globalThis as any).EventSource = MockEventSource as any
  localStorage.setItem('token', 'tok')
  vi.spyOn(realtimeApi, 'mintTicket').mockReset().mockResolvedValue('T1')
})

function wrap(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useRealtime', () => {
  it('invalidates mapped query keys when a change event arrives', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useRealtime(), { wrapper: wrap(qc) })

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    const es = MockEventSource.instances[0]
    expect(es.url).toContain('ticket=T1')

    await act(async () => {
      es.emitMessage({ type: 'resource', id: 'r1', action: 'created', scope_ids: [] })
      // advance past the coalescing window
      await new Promise((r) => setTimeout(r, 3100))
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['resources'] })
  })

  it('invalidates all queries on open (reconnect self-heal)', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useRealtime(), { wrapper: wrap(qc) })

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    expect(invalidate).not.toHaveBeenCalled()

    act(() => { MockEventSource.instances[0].emitOpen() })

    expect(invalidate).toHaveBeenCalledTimes(1)
    expect(invalidate).toHaveBeenCalledWith()
  })

  it('coalesces events in one window and dedupes repeated prefixes', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    renderHook(() => useRealtime(), { wrapper: wrap(qc) })

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    const es = MockEventSource.instances[0]

    await act(async () => {
      es.emitMessage({ type: 'resource', id: 'r1', action: 'created', scope_ids: [] })
      es.emitMessage({ type: 'resource', id: 'r2', action: 'updated', scope_ids: [] })
      es.emitMessage({ type: 'worker', id: 'w1', action: 'updated', scope_ids: [] })
      // advance past the coalescing window
      await new Promise((r) => setTimeout(r, 3100))
    })

    // resource -> [resources, resource, assignments]; worker -> [workers, worker, resources]
    // Unique prefixes across the window: resources, resource, assignments, workers, worker.
    const keys = invalidate.mock.calls.map((c) => JSON.stringify((c[0] as any)?.queryKey))
    expect(keys.filter((k) => k === JSON.stringify(['resources']))).toHaveLength(1)
    expect(keys.sort()).toEqual(
      [['resources'], ['resource'], ['assignments'], ['workers'], ['worker']]
        .map((k) => JSON.stringify(k))
        .sort(),
    )
  })

  it('reconnects with a freshly minted ticket after an error', async () => {
    vi.mocked(realtimeApi.mintTicket)
      .mockResolvedValueOnce('T1')
      .mockResolvedValueOnce('T2')
    const qc = new QueryClient()
    renderHook(() => useRealtime(), { wrapper: wrap(qc) })

    await waitFor(() => expect(MockEventSource.instances.length).toBe(1))
    const first = MockEventSource.instances[0]
    expect(first.url).toContain('ticket=T1')

    act(() => { first.emitError() })

    // The dead connection is closed immediately; a new one is opened with a
    // fresh ticket after the backoff delay (base 1000ms).
    expect(first.closed).toBe(true)
    await waitFor(
      () => expect(MockEventSource.instances.length).toBe(2),
      { timeout: 3000 },
    )
    expect(realtimeApi.mintTicket).toHaveBeenCalledTimes(2)
    expect(MockEventSource.instances[1].url).toContain('ticket=T2')
  })

  it('retries with backoff when minting the ticket fails', async () => {
    vi.mocked(realtimeApi.mintTicket)
      .mockRejectedValueOnce(new Error('503 backend restarting'))
      .mockResolvedValueOnce('T2')
    const qc = new QueryClient()
    renderHook(() => useRealtime(), { wrapper: wrap(qc) })

    // No connection while the first mint fails; a retry after the backoff
    // (base 1000ms) mints a fresh ticket and opens the first EventSource.
    await waitFor(
      () => expect(MockEventSource.instances.length).toBe(1),
      { timeout: 3000 },
    )
    expect(realtimeApi.mintTicket).toHaveBeenCalledTimes(2)
    expect(MockEventSource.instances[0].url).toContain('ticket=T2')
  })
})
