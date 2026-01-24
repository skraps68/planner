import apiClient from './client'

export interface AuditLog {
  id: string
  user_id: string
  username?: string
  entity_type: string
  entity_id: string
  operation: string
  before_values?: Record<string, any>
  after_values?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface AuditLogListResponse {
  items: AuditLog[]
  total: number
  page: number
  size: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

export interface UserActivitySummary {
  user_id: string
  username: string
  total_actions: number
  first_action: string
  last_action: string
  operations: Record<string, number>
  entities_modified: Record<string, number>
}

export const auditApi = {
  listAuditLogs: async (params?: {
    skip?: number
    limit?: number
    user_id?: string
    entity_type?: string
    entity_id?: string
    operation?: string
    start_date?: string
    end_date?: string
  }): Promise<AuditLogListResponse> => {
    const response = await apiClient.get('/audit', { params })
    return response.data
  },

  getEntityHistory: async (entityType: string, entityId: string): Promise<AuditLog[]> => {
    const response = await apiClient.get(`/audit/entity/${entityType}/${entityId}`)
    return response.data
  },

  getUserActivity: async (userId: string, limit: number = 100): Promise<AuditLog[]> => {
    const response = await apiClient.get(`/audit/user/${userId}`, {
      params: { limit }
    })
    return response.data
  },

  getPermissionChanges: async (userId?: string, limit: number = 100): Promise<AuditLog[]> => {
    const response = await apiClient.get('/audit/permissions', {
      params: { user_id: userId, limit }
    })
    return response.data
  },

  getUserActivitySummary: async (userId: string): Promise<UserActivitySummary> => {
    const response = await apiClient.get(`/audit/user/${userId}/summary`)
    return response.data
  },

  getRecentChanges: async (limit: number = 50, entityType?: string): Promise<AuditLog[]> => {
    const response = await apiClient.get('/audit/recent', {
      params: { limit, entity_type: entityType }
    })
    return response.data
  },
}
