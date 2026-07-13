import apiClient from '../api/client'

export interface LockHolder {
  user_id: string
  name: string
}

export const realtimeApi = {
  mintTicket: async (): Promise<string> => {
    const res = await apiClient.post<{ ticket: string }>('/realtime/ticket')
    return res.data.ticket
  },
  registerPresence: (type: string, id: string): Promise<void> =>
    apiClient.post(`/realtime/presence/${type}/${id}`).then(() => undefined),
  releasePresence: (type: string, id: string): Promise<void> =>
    apiClient.delete(`/realtime/presence/${type}/${id}`).then(() => undefined),
  getPresence: (type: string, id: string): Promise<Array<{ user_id: string; name: string }>> =>
    apiClient
      .get<{ present: Array<{ user_id: string; name: string }> }>(`/realtime/presence/${type}/${id}`)
      .then((r) => r.data.present),
  acquireLock: (type: string, id: string): Promise<{ acquired: boolean; holder: LockHolder | null }> =>
    apiClient
      .post<{ acquired: boolean; holder: LockHolder | null }>(`/realtime/locks/${type}/${id}/acquire`)
      .then((r) => r.data),
  heartbeatLock: (type: string, id: string): Promise<{ refreshed: boolean }> =>
    apiClient
      .post<{ refreshed: boolean }>(`/realtime/locks/${type}/${id}/heartbeat`)
      .then((r) => r.data),
  releaseLock: (type: string, id: string): Promise<{ ok: boolean }> =>
    apiClient.post<{ ok: boolean }>(`/realtime/locks/${type}/${id}/release`).then((r) => r.data),
  forceReleaseLock: (type: string, id: string): Promise<{ ok: boolean }> =>
    apiClient
      .post<{ ok: boolean }>(`/realtime/locks/${type}/${id}/force-release`)
      .then((r) => r.data),
  getLock: (type: string, id: string): Promise<{ holder: LockHolder | null }> =>
    apiClient.get<{ holder: LockHolder | null }>(`/realtime/locks/${type}/${id}`).then((r) => r.data),
}
