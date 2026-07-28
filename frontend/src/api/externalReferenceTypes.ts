import apiClient from './client'
import type { ExternalReferenceType } from '../types'

export interface ExternalReferenceTypeInput {
  name: string
  description: string
}

export const externalReferenceTypesApi = {
  list: async (): Promise<ExternalReferenceType[]> => {
    const response = await apiClient.get('/external-reference-types/')
    return response.data
  },

  create: async (data: ExternalReferenceTypeInput): Promise<ExternalReferenceType> => {
    const response = await apiClient.post('/external-reference-types/', data)
    return response.data
  },

  update: async (
    id: string,
    data: Partial<ExternalReferenceTypeInput> & { is_active?: boolean; version: number },
  ): Promise<ExternalReferenceType> => {
    const response = await apiClient.put(`/external-reference-types/${id}`, data)
    return response.data
  },
}
