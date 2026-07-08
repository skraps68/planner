import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from '../../test/test-utils'
import WaffleLauncher from './WaffleLauncher'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

const adminStore = () =>
  createTestStore({
    auth: {
      user: {
        id: '1',
        username: 'admin',
        email: 'a@example.com',
        roles: ['ADMIN'],
        permissions: [],
      },
      token: 't',
      isAuthenticated: true,
    },
  })

const viewerStore = () =>
  createTestStore({
    auth: {
      user: {
        id: '2',
        username: 'viewer',
        email: 'v@example.com',
        roles: ['VIEWER'],
        permissions: [],
      },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('WaffleLauncher', () => {
  beforeEach(() => mockNavigate.mockClear())

  it('opens the menu and shows all destinations for an admin', async () => {
    const user = userEvent.setup()
    render(<WaffleLauncher />, { store: adminStore() })

    await user.click(screen.getByRole('button', { name: /apps/i }))

    for (const label of ['Workers', 'User Management', 'Dashboard', 'Reports', 'Resources', 'Actuals']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('navigates and closes when a destination is clicked', async () => {
    const user = userEvent.setup()
    render(<WaffleLauncher />, { store: adminStore() })

    await user.click(screen.getByRole('button', { name: /apps/i }))
    await user.click(screen.getByText('Workers'))

    expect(mockNavigate).toHaveBeenCalledWith('/workers')
    await waitFor(() => {
      expect(screen.queryByText('Dashboard')).not.toBeInTheDocument()
    })
  })

  it('hides destinations the user lacks permission for', async () => {
    const user = userEvent.setup()
    render(<WaffleLauncher />, { store: viewerStore() })

    await user.click(screen.getByRole('button', { name: /apps/i }))

    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('User Management')).not.toBeInTheDocument()
  })
})
