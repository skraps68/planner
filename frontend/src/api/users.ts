import apiClient from './client'

export interface User {
  id: string
  username: string
  email: string
  is_active: boolean
  user_roles: UserRole[]
  version: number
  created_at: string
  updated_at: string
}

export interface UserRole {
  id: string
  user_id: string
  role_type: string
  is_active: boolean
  scope_assignments: ScopeAssignment[]
  version: number
  created_at: string
  updated_at: string
}

export interface ScopeAssignment {
  id: string
  user_role_id: string
  scope_type: 'PROGRAM' | 'PROJECT' | 'GLOBAL'
  program_id?: string
  project_id?: string
  program_name?: string
  project_name?: string
  is_active: boolean
  version: number
  created_at: string
  updated_at: string
}

export interface UserCreate {
  username: string
  email: string
  password: string
  is_active: boolean
}

export interface UserUpdate {
  username?: string
  email?: string
  is_active?: boolean
  version: number
}

export interface UserRoleCreate {
  role_type: string
  is_active: boolean
}

export interface ScopeAssignmentCreate {
  scope_type: 'PROGRAM' | 'PROJECT' | 'GLOBAL'
  program_id?: string
  project_id?: string
  is_active: boolean
}

export interface UserListResponse {
  items: User[]
  total: number
  page: number
  size: number
  pages: number
  has_next: boolean
  has_prev: boolean
}

export const usersApi = {
  // User management
  listUsers: async (params?: {
    skip?: number
    limit?: number
    is_active?: boolean
  }): Promise<UserListResponse> => {
    const response = await apiClient.get('/users', { params })
    return response.data
  },

  getUser: async (userId: string): Promise<User> => {
    const response = await apiClient.get(`/users/${userId}`)
    return response.data
  },

  createUser: async (userData: UserCreate): Promise<User> => {
    const response = await apiClient.post('/users', userData)
    return response.data
  },

  updateUser: async (userId: string, userData: UserUpdate): Promise<User> => {
    const response = await apiClient.put(`/users/${userId}`, userData)
    return response.data
  },

  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}`)
  },

  // Role management
  getUserRoles: async (userId: string, activeOnly: boolean = false): Promise<UserRole[]> => {
    const response = await apiClient.get(`/users/${userId}/roles`, {
      params: { active_only: activeOnly }
    })
    return response.data
  },

  assignRole: async (userId: string, roleData: UserRoleCreate): Promise<UserRole> => {
    const response = await apiClient.post(`/users/${userId}/roles`, roleData)
    return response.data
  },

  removeRole: async (userId: string, roleType: string): Promise<void> => {
    await apiClient.delete(`/users/${userId}/roles/${roleType}`)
  },

  // Scope management
  getRoleScopes: async (userRoleId: string, activeOnly: boolean = false): Promise<ScopeAssignment[]> => {
    const response = await apiClient.get(`/users/roles/${userRoleId}/scopes`, {
      params: { active_only: activeOnly }
    })
    return response.data
  },

  assignScope: async (userRoleId: string, scopeData: ScopeAssignmentCreate): Promise<ScopeAssignment> => {
    const response = await apiClient.post(`/users/roles/${userRoleId}/scopes`, scopeData)
    return response.data
  },

  removeScope: async (scopeAssignmentId: string): Promise<void> => {
    await apiClient.delete(`/users/scopes/${scopeAssignmentId}`)
  },
}
