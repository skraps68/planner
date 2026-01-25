import apiClient from './client'
import { User } from '../store/slices/authSlice'

export interface LoginRequest {
  username: string
  password: string
}

export interface TokenData {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
}

export interface LoginResponse {
  user_id: string
  username: string
  email: string
  is_active: boolean
  active_roles: string[]
  available_scopes: any[]
  tokens: TokenData
}

export interface RefreshTokenRequest {
  refresh_token: string
}

export interface RefreshTokenResponse {
  tokens: TokenData
}

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post('/auth/login', credentials)
    return response.data
  },

  logout: async (): Promise<void> => {
    await apiClient.post('/auth/logout')
  },

  refreshToken: async (refreshToken: string): Promise<RefreshTokenResponse> => {
    const response = await apiClient.post('/auth/refresh', { refresh_token: refreshToken })
    return response.data
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await apiClient.get('/auth/me')
    return response.data
  },

  switchRole: async (roleId: string): Promise<User> => {
    const response = await apiClient.post('/auth/switch-role', { role_id: roleId })
    return response.data
  },
}
