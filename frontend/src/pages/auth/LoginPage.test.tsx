import { describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { render } from '../../test/test-utils'
import LoginPage from './LoginPage'

const { mockNavigate, mockLogin } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockLogin: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    login: mockLogin,
    isAuthenticated: true,
  }),
}))

describe('LoginPage', () => {
  it('lands an authenticated user on the expanded hierarchy view', async () => {
    render(<LoginPage />)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard')
  })
})
