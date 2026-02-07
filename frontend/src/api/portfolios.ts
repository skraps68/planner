import apiClient from './client'
import { Portfolio, PortfolioCreate, PortfolioUpdate } from '../types/portfolio'
import { PaginatedResponse, Program } from '../types'

export interface PortfolioListParams {
  skip?: number
  limit?: number
  search?: string
  sort_by?: string
  sort_order?: 'asc' | 'desc'
}

export const portfoliosApi = {
  list: async (params?: PortfolioListParams): Promise<PaginatedResponse<Portfolio>> => {
    const response = await apiClient.get('/portfolios', { params })
    return response.data
  },

  get: async (id: string): Promise<Portfolio> => {
    const response = await apiClient.get(`/portfolios/${id}`)
    return response.data
  },

  create: async (data: PortfolioCreate): Promise<Portfolio> => {
    const response = await apiClient.post('/portfolios', data)
    return response.data
  },

  update: async (id: string, data: PortfolioUpdate): Promise<Portfolio> => {
    const response = await apiClient.put(`/portfolios/${id}`, data)
    return response.data
  },

  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/portfolios/${id}`)
  },

  getPrograms: async (id: string): Promise<Program[]> => {
    const response = await apiClient.get(`/portfolios/${id}/programs`)
    return response.data
  },
}
