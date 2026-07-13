import { describe, it, expect, vi } from 'vitest'
import apiClient from '../api/client'
import { realtimeApi } from './realtimeApi'

describe('realtimeApi.mintTicket', () => {
  it('POSTs to /realtime/ticket and returns the ticket', async () => {
    const spy = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { ticket: 'T1' } } as any)
    await expect(realtimeApi.mintTicket()).resolves.toBe('T1')
    expect(spy).toHaveBeenCalledWith('/realtime/ticket')
  })
})
