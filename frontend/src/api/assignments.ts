import apiClient from './client'
import { ResourceAssignment, PaginatedResponse } from '../types'

export interface ResourceAssignmentCreateInput {
  resource_id: string
  project_id: string
  assignment_date: string
  allocation_percentage: number
  capital_percentage: number
  expense_percentage: number
}

export interface ResourceAssignmentUpdateInput {
  allocation_percentage?: number
  capital_percentage?: number
  expense_percentage?: number
}

export interface AssignmentConflict {
  resource_id: string
  resource_name: string
  assignment_date: string
  existing_allocation: number
  new_allocation: number
  total_allocation: number
  conflict_type: string
}

export interface AssignmentConflictResponse {
  has_conflicts: boolean
  conflicts: AssignmentConflict[]
}

export const assignmentsApi = {
  list: async (params?: {
    page?: number
    size?: number
    project_id?: string
    resource_id?: string
  }) => {
    const response = await apiClient.get<PaginatedResponse<ResourceAssignment>>('/assignments/', {
      params,
    })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<ResourceAssignment>(`/assignments/${id}`)
    return response.data
  },

  create: async (data: ResourceAssignmentCreateInput) => {
    const response = await apiClient.post<ResourceAssignment>('/assignments/', data)
    return response.data
  },

  update: async (id: string, data: ResourceAssignmentUpdateInput) => {
    const response = await apiClient.put<ResourceAssignment>(`/assignments/${id}`, data)
    return response.data
  },

  delete: async (id: string) => {
    const response = await apiClient.delete(`/assignments/${id}`)
    return response.data
  },

  getByProject: async (projectId: string) => {
    const response = await apiClient.get<ResourceAssignment[]>(
      `/assignments/project/${projectId}/list`
    )
    return response.data
  },

  getByResource: async (resourceId: string) => {
    const response = await apiClient.get<ResourceAssignment[]>(
      `/assignments/resource/${resourceId}/list`
    )
    return response.data
  },

  getByDate: async (resourceId: string, assignmentDate: string) => {
    const response = await apiClient.get<ResourceAssignment[]>(
      `/assignments/resource/${resourceId}/date/${assignmentDate}`
    )
    return response.data
  },

  getResourceAllocation: async (resourceId: string, assignmentDate: string) => {
    const response = await apiClient.get<{
      resource_id: string
      assignment_date: string
      total_allocation: number
      is_over_allocated: boolean
    }>(`/assignments/resource/${resourceId}/allocation/${assignmentDate}`)
    return response.data
  },

  importAssignments: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await apiClient.post<{
      total: number
      successful: number
      failed: number
      errors: string[]
    }>('/assignments/import', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  checkConflicts: async (resourceId: string, startDate: string, endDate: string) => {
    const response = await apiClient.post<AssignmentConflictResponse>(
      '/assignments/check-conflicts',
      null,
      {
        params: { resource_id: resourceId, start_date: startDate, end_date: endDate },
      }
    )
    return response.data
  },
}
