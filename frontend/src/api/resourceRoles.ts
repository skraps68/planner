import apiClient from './client'
import { ResourceRole } from '../types'

export interface ResourceRoleCreateInput {
  name: string
  description?: string
}

export interface ResourceRoleUpdateInput {
  name?: string
  description?: string
  version: number
}

export const resourceRolesApi = {
  list: async () => {
    const response = await apiClient.get<ResourceRole[]>('/resource-roles/')
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<ResourceRole>(`/resource-roles/${id}`)
    return response.data
  },

  create: async (data: ResourceRoleCreateInput) => {
    const response = await apiClient.post<ResourceRole>('/resource-roles/', data)
    return response.data
  },

  update: async (id: string, data: ResourceRoleUpdateInput) => {
    const response = await apiClient.put<ResourceRole>(`/resource-roles/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/resource-roles/${id}`)
    return response.data
  },
}
