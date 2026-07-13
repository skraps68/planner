import apiClient from '../api/client'

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
}
