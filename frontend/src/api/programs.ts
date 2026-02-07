import apiClient from './client'
import { Program, PaginatedResponse } from '../types'

export interface ProgramCreateRequest {
  name: string
  business_sponsor: string
  program_manager: string
  technical_lead: string
  start_date: string
  end_date: string
  portfolio_id: string
}

export interface ProgramUpdateRequest extends Partial<ProgramCreateRequest> {}

export interface ProgramListParams {
  skip?: number
  limit?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const programsApi = {
  list: async (params?: ProgramListParams): Promise<PaginatedResponse<Program>> => {
    const response = await apiClient.get('/programs', { params })
    return response.data
  },

  get: async (id: string): Promise<Program> => {
    const response = await apiClient.get(`/programs/${id}`)
    return response.data
  },

  create: async (data: ProgramCreateRequest): Promise<Program> => {
    const response = await apiClient.post('/programs', data)
    return response.data
  },

  update: async (id: string, data: ProgramUpdateRequest): Promise<Program> => {
    const response = await apiClient.put(`/programs/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/programs/${id}`)
  },
}
