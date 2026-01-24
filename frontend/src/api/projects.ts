import apiClient from './client'
import { Project, ProjectPhase, PaginatedResponse } from '../types'

export interface ProjectCreateRequest {
  program_id: string
  name: string
  business_sponsor: string
  project_manager: string
  technical_lead: string
  start_date: string
  end_date: string
  cost_center_code: string
  execution_phase: {
    capital_budget: number
    expense_budget: number
  }
  planning_phase?: {
    capital_budget: number
    expense_budget: number
  }
}

export interface ProjectUpdateRequest extends Partial<Omit<ProjectCreateRequest, 'program_id'>> {}

export interface ProjectListParams {
  skip?: number
  limit?: number
  program_id?: string
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const projectsApi = {
  list: async (params?: ProjectListParams): Promise<PaginatedResponse<Project>> => {
    const response = await apiClient.get('/projects', { params })
    return response.data
  },

  get: async (id: string): Promise<Project> => {
    const response = await apiClient.get(`/projects/${id}`)
    return response.data
  },

  create: async (data: ProjectCreateRequest): Promise<Project> => {
    const response = await apiClient.post('/projects', data)
    return response.data
  },

  update: async (id: string, data: ProjectUpdateRequest): Promise<Project> => {
    const response = await apiClient.put(`/projects/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/projects/${id}`)
  },

  getPhases: async (id: string): Promise<ProjectPhase[]> => {
    const response = await apiClient.get(`/projects/${id}/phases`)
    return response.data
  },
}
