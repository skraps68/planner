import apiClient from './client'
import { Worker, WorkerType, PaginatedResponse } from '../types'

export interface WorkerCreateInput {
  external_id: string
  name: string
  worker_type_id: string
}

export interface WorkerUpdateInput {
  external_id?: string
  name?: string
  worker_type_id?: string
  version: number
}

export interface WorkerTypeCreateInput {
  type: string
  description: string
}

export interface WorkerTypeUpdateInput {
  type?: string
  description?: string
  version: number
}

export const workersApi = {
  list: async (params?: {
    page?: number
    size?: number
    worker_type_id?: string
    search?: string
  }) => {
    const response = await apiClient.get<PaginatedResponse<Worker>>('/workers/', {
      params,
    })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Worker>(`/workers/${id}`)
    return response.data
  },

  getByExternalId: async (externalId: string) => {
    const response = await apiClient.get<Worker>(`/workers/external/${externalId}`)
    return response.data
  },

  create: async (data: WorkerCreateInput) => {
    const response = await apiClient.post<Worker>('/workers/', data)
    return response.data
  },

  update: async (id: string, data: WorkerUpdateInput) => {
    const response = await apiClient.put<Worker>(`/workers/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/workers/${id}`)
    return response.data
  },
}

export const workerTypesApi = {
  list: async (params?: { page?: number; size?: number; search?: string }) => {
    const response = await apiClient.get<WorkerType[]>('/workers/types', {
      params,
    })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<WorkerType>(`/workers/types/${id}`)
    return response.data
  },

  getByName: async (name: string) => {
    const response = await apiClient.get<WorkerType>(`/workers/types/name/${name}`)
    return response.data
  },

  create: async (data: WorkerTypeCreateInput) => {
    const response = await apiClient.post<WorkerType>('/workers/types', data)
    return response.data
  },

  update: async (id: string, data: WorkerTypeUpdateInput) => {
    const response = await apiClient.put<WorkerType>(`/workers/types/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/workers/types/${id}`)
    return response.data
  },
}
