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
  close() { this.closed = true }
}

beforeEach(() => {
  MockEventSource.instances = []
  ;(globalThis as any).EventSource = MockEventSource as any
  localStorage.setItem('token', 'tok')
  vi.spyOn(realtimeApi, 'mintTicket').mockResolvedValue('T1')
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
})
