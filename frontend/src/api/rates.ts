import apiClient from './client'
import { Rate, PaginatedResponse } from '../types'

export interface RateCreateInput {
  worker_type_id: string
  rate_amount: number
  start_date: string
  end_date?: string
}

export interface RateHistory {
  id: string
  rate_amount: number
  start_date: string
  end_date?: string
  is_current: boolean
  created_at: string
}

export interface WorkerTypeRateHistory {
  worker_type_id: string
  worker_type_name: string
  current_rate: number | null
  rate_history: RateHistory[]
}

export const ratesApi = {
  list: async (params?: { page?: number; size?: number; worker_type_id?: string }) => {
    const response = await apiClient.get<PaginatedResponse<Rate>>('/rates/', {
      params,
    })
    return response.data
  },

  get: async (id: string) => {
    const response = await apiClient.get<Rate>(`/rates/${id}`)
    return response.data
  },

  create: async (data: RateCreateInput, closePrevious: boolean = true) => {
    const response = await apiClient.post<Rate>('/rates/', data, {
      params: { close_previous: closePrevious },
    })
    return response.data
  },

  getCurrentRate: async (workerTypeId: string) => {
    const response = await apiClient.get<Rate>(`/rates/worker-type/${workerTypeId}/current`)
    return response.data
  },

  getActiveRate: async (workerTypeId: string, asOfDate?: string) => {
    const response = await apiClient.get<Rate>(`/rates/worker-type/${workerTypeId}/active`, {
      params: { as_of_date: asOfDate },
    })
    return response.data
  },

  getRateHistory: async (workerTypeId: string) => {
    const response = await apiClient.get<WorkerTypeRateHistory>(
      `/rates/worker-type/${workerTypeId}/history`
    )
    return response.data
  },

  getRatesInDateRange: async (workerTypeId: string, startDate: string, endDate: string) => {
    const response = await apiClient.get<Rate[]>(`/rates/worker-type/${workerTypeId}/date-range`, {
      params: { start_date: startDate, end_date: endDate },
    })
    return response.data
  },

  updateRate: async (workerTypeId: string, newRateAmount: number, effectiveDate: string) => {
    const response = await apiClient.post<Rate>(`/rates/worker-type/${workerTypeId}/update`, null, {
      params: { new_rate_amount: newRateAmount, effective_date: effectiveDate },
    })
    return response.data
  },

  closeRate: async (workerTypeId: string, endDate: string) => {
    const response = await apiClient.post<Rate>(`/rates/worker-type/${workerTypeId}/close`, null, {
      params: { end_date: endDate },
    })
    return response.data
  },
}
