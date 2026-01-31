import apiClient from './client'
import { ProjectPhase, PhaseValidationResult } from '../types'

export interface PhaseCreateRequest {
  project_id: string
  name: string
  start_date: string
  end_date: string
  description?: string
  capital_budget: number
  expense_budget: number
  total_budget: number
}

export interface PhaseUpdateRequest {
  name?: string
  start_date?: string
  end_date?: string
  description?: string
  capital_budget?: number
  expense_budget?: number
  total_budget?: number
}

export interface PhaseBatchItem {
  id?: string | null
  name: string
  start_date: string
  end_date: string
  description?: string
  capital_budget: number
  expense_budget: number
  total_budget: number
}

export interface PhaseBatchUpdateRequest {
  phases: PhaseBatchItem[]
}

export interface PhaseValidationRequest {
  id?: string
  name: string
  start_date: string
  end_date: string
}

export const phasesApi = {
  list: async (projectId: string): Promise<ProjectPhase[]> => {
    const response = await apiClient.get(`/projects/${projectId}/phases`)
    return response.data
  },

  get: async (phaseId: string): Promise<ProjectPhase> => {
    const response = await apiClient.get(`/phases/${phaseId}`)
    return response.data
  },

  create: async (data: PhaseCreateRequest): Promise<ProjectPhase> => {
    const response = await apiClient.post(`/projects/${data.project_id}/phases`, data)
    return response.data
  },

  update: async (phaseId: string, data: PhaseUpdateRequest): Promise<ProjectPhase> => {
    const response = await apiClient.put(`/phases/${phaseId}`, data)
    return response.data
  },

  delete: async (phaseId: string): Promise<void> => {
    await apiClient.delete(`/phases/${phaseId}`)
  },

  batchUpdate: async (projectId: string, data: PhaseBatchUpdateRequest): Promise<ProjectPhase[]> => {
    const response = await apiClient.post(`/projects/${projectId}/phases/batch`, data)
    return response.data
  },

  validate: async (projectId: string, phases: PhaseValidationRequest[]): Promise<PhaseValidationResult> => {
    const response = await apiClient.post(`/projects/${projectId}/phases/validate`, phases)
    return response.data
  },
}
