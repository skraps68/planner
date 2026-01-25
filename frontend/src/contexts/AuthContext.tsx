import React, { createContext, useContext, useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { setCredentials, logout as logoutAction, setUser, setLoading } from '../store/slices/authSlice'
import { authApi, LoginRequest } from '../api/auth'
import { RootState } from '../store'
import { User } from '../store/slices/authSlice'

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (credentials: LoginRequest) => Promise<void>
  logout: () => Promise<void>
  switchRole: (roleId: string) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: React.ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const { user, isAuthenticated, isLoading } = useSelector((state: RootState) => state.auth)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token')
      if (token && !user) {
        try {
          dispatch(setLoading(true))
          const currentUser = await authApi.getCurrentUser()
          dispatch(setUser(currentUser))
        } catch (error) {
          console.error('Failed to fetch current user:', error)
          dispatch(logoutAction())
        } finally {
          dispatch(setLoading(false))
          setInitialized(true)
        }
      } else {
        setInitialized(true)
      }
    }

    initAuth()
  }, [dispatch, user])

  const login = async (credentials: LoginRequest) => {
    try {
      dispatch(setLoading(true))
      const response = await authApi.login(credentials)
      
      // Map the backend response to the frontend User structure
      const user: User = {
        id: response.user_id,
        username: response.username,
        email: response.email,
        isActive: response.is_active,
        roles: response.active_roles,
        permissions: [],
      }
      
      dispatch(
        setCredentials({
          user: user,
          token: response.tokens.access_token,
          refreshToken: response.tokens.refresh_token,
        })
      )
      navigate('/dashboard')
    } catch (error) {
      console.error('Login failed:', error)
      throw error
    } finally {
      dispatch(setLoading(false))
    }
  }

  const logout = async () => {
    try {
      await authApi.logout()
    } catch (error) {
      console.error('Logout failed:', error)
    } finally {
      dispatch(logoutAction())
      navigate('/login')
    }
  }

  const switchRole = async (roleId: string) => {
    try {
      dispatch(setLoading(true))
      const updatedUser = await authApi.switchRole(roleId)
      dispatch(setUser(updatedUser))
    } catch (error) {
      console.error('Role switch failed:', error)
      throw error
    } finally {
      dispatch(setLoading(false))
    }
  }

  if (!initialized) {
    return null // Or a loading spinner
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        login,
        logout,
        switchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
