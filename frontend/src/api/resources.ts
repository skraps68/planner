import apiClient from './client'
import { Resource, PaginatedResponse } from '../types'

export interface ResourceCreateInput {
  name: string
  resource_type: 'LABOR' | 'NON_LABOR'
  description?: string
}

export interface ResourceUpdateInput {
  name?: string
  description?: string
  version: number
}

export const resourcesApi = {
  list: async (params?: {
    page?: number
    size?: number
    resource_type?: 'LABOR' | 'NON_LABOR'
    search?: string
  }) => {
    const response = await apiClient.get<PaginatedResponse<Resource>>('/resources/', {
      params,
    })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Resource>(`/resources/${id}`)
    return response.data
  },

  create: async (data: ResourceCreateInput) => {
    const response = await apiClient.post<Resource>('/resources/', data)
    return response.data
  },

  update: async (id: string, data: ResourceUpdateInput) => {
    const response = await apiClient.put<Resource>(`/resources/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/resources/${id}`)
    return response.data
  },

  listLabor: async (params?: { page?: number; size?: number }) => {
    const response = await apiClient.get<PaginatedResponse<Resource>>('/resources/labor/list', {
      params,
    })
    return response.data
  },

  listNonLabor: async (params?: { page?: number; size?: number }) => {
    const response = await apiClient.get<PaginatedResponse<Resource>>('/resources/non-labor/list', {
      params,
    })
    return response.data
  },
}
