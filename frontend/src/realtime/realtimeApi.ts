import apiClient from '../api/client'

export const realtimeApi = {
  mintTicket: async (): Promise<string> => {
    const res = await apiClient.post<{ ticket: string }>('/realtime/ticket')
    return res.data.ticket
  },
}
