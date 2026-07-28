import apiClient from './client'
import type {
  NonLaborCostTreatment,
  NonLaborFrequency,
  NonLaborPeriodPlacement,
  NonLaborPlanLine,
  NonLaborPlanMethod,
} from '../types'

export interface ManualCashFlowInput {
  occurrence_date: string
  amount: number
}

export interface ExternalReferenceInput {
  reference_type_id: string
  value: string
}

export interface NonLaborPlanDefinitionInput {
  method: NonLaborPlanMethod
  total_amount?: number
  schedule_start?: string
  schedule_end?: string
  frequency?: NonLaborFrequency
  period_placement?: NonLaborPeriodPlacement
  manual_occurrences: ManualCashFlowInput[]
}

export interface NonLaborPlanCreateInput extends NonLaborPlanDefinitionInput {
  project_id: string
  resource_id: string
  name: string
  description?: string
  cost_treatment: NonLaborCostTreatment
  references: ExternalReferenceInput[]
}

export interface NonLaborPlanPreview {
  occurrences: ManualCashFlowInput[]
  occurrence_count: number
  exact_total: number
  warnings: string[]
}

export const nonlaborPlansApi = {
  list: async (params: {
    project_id?: string
    resource_id?: string
    include_cancelled?: boolean
  }): Promise<NonLaborPlanLine[]> => {
    const response = await apiClient.get('/nonlabor-plans/', { params })
    return response.data
  },

  preview: async (
    data: NonLaborPlanDefinitionInput & { project_id?: string },
  ): Promise<NonLaborPlanPreview> => {
    const response = await apiClient.post('/nonlabor-plans/preview', data)
    return response.data
  },

  create: async (data: NonLaborPlanCreateInput): Promise<NonLaborPlanLine> => {
    const response = await apiClient.post('/nonlabor-plans/', data)
    return response.data
  },

  update: async (
    id: string,
    data: NonLaborPlanDefinitionInput & {
      version: number
      name?: string
      description?: string
      cost_treatment?: NonLaborCostTreatment
      references?: ExternalReferenceInput[]
    },
  ): Promise<NonLaborPlanLine> => {
    const response = await apiClient.put(`/nonlabor-plans/${id}`, data)
    return response.data
  },

  setOverride: async (
    planId: string,
    occurrenceId: string,
    amount: number | null,
    version: number,
  ): Promise<NonLaborPlanLine> => {
    const response = await apiClient.put(
      `/nonlabor-plans/${planId}/occurrences/${occurrenceId}/override`,
      { amount, version },
    )
    return response.data
  },

  cancel: async (planId: string, version: number): Promise<NonLaborPlanLine> => {
    const response = await apiClient.post(`/nonlabor-plans/${planId}/cancel`, undefined, {
      params: { version },
    })
    return response.data
  },
}
