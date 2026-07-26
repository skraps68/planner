import apiClient from './client'
import type { DeepPartial, UserSettings, UserSettingsResponse } from '../types/userSettings'

export const userSettingsApi = {
  get: async (): Promise<UserSettingsResponse> => {
    const response = await apiClient.get('/users/me/settings')
    return response.data
  },

  patch: async (
    version: number,
    patch: DeepPartial<UserSettings>,
  ): Promise<UserSettingsResponse> => {
    const response = await apiClient.patch('/users/me/settings', { version, patch })
    return response.data
  },

  reset: async (): Promise<UserSettingsResponse> => {
    const response = await apiClient.delete('/users/me/settings')
    return response.data
  },
}
