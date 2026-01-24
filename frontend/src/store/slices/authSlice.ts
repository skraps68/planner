import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface User {
  id: string
  username: string
  email: string
  roles: UserRole[]
  activeRole?: UserRole
}

export interface UserRole {
  id: string
  role_type: string
  is_active: boolean
  scopes: ScopeAssignment[]
}

export interface ScopeAssignment {
  id: string
  scope_type: 'PROGRAM' | 'PROJECT' | 'GLOBAL'
  program_id?: string
  project_id?: string
  program_name?: string
  project_name?: string
}

interface AuthState {
  user: User | null
  token: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('token'),
  refreshToken: localStorage.getItem('refreshToken'),
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: User; token: string; refreshToken: string }>
    ) => {
      state.user = action.payload.user
      state.token = action.payload.token
      state.refreshToken = action.payload.refreshToken
      state.isAuthenticated = true
      localStorage.setItem('token', action.payload.token)
      localStorage.setItem('refreshToken', action.payload.refreshToken)
    },
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload
    },
    setActiveRole: (state, action: PayloadAction<UserRole>) => {
      if (state.user) {
        state.user.activeRole = action.payload
      }
    },
    logout: (state) => {
      state.user = null
      state.token = null
      state.refreshToken = null
      state.isAuthenticated = false
      localStorage.removeItem('token')
      localStorage.removeItem('refreshToken')
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload
    },
  },
})

export const { setCredentials, setUser, setActiveRole, logout, setLoading } = authSlice.actions
export default authSlice.reducer
