import { describe, test, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { AdminRoute } from './AdminRoute'
import { render, createTestStore } from '../../test/test-utils'

describe('AdminRoute', () => {
  test('renders children when user has ADMIN role', () => {
    const store = createTestStore({
      auth: {
        user: {
          id: 'admin-user',
          username: 'admin',
          email: 'admin@example.com',
          isActive: true,
          roles: ['ADMIN'],
        },
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        isAuthenticated: true,
        isLoading: false,
      },
    })

    render(
      <AdminRoute permission="manage_reference_data">
        <div>secret</div>
      </AdminRoute>,
      { store }
    )

    expect(screen.getByText('secret')).toBeInTheDocument()
  })

  test('does not render children when user has VIEWER role', () => {
    const store = createTestStore({
      auth: {
        user: {
          id: 'viewer-user',
          username: 'viewer',
          email: 'viewer@example.com',
          isActive: true,
          roles: ['VIEWER'],
        },
        token: 'test-token',
        refreshToken: 'test-refresh-token',
        isAuthenticated: true,
        isLoading: false,
      },
    })

    render(
      <AdminRoute permission="manage_reference_data">
        <div>secret</div>
      </AdminRoute>,
      { store }
    )

    expect(screen.queryByText('secret')).toBeNull()
  })
})
