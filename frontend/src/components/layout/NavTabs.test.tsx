import { describe, it, expect, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from '../../test/test-utils'
import NavTabs from './NavTabs'

const mockNavigate = vi.fn()
let mockLocation = { pathname: '/portfolios' }
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
  useLocation: () => mockLocation,
}))

const storeFor = (roles: string[]) =>
  createTestStore({
    auth: { user: { id: '1', username: 'u', email: 'u@e.c', roles, permissions: [] }, token: 't', isAuthenticated: true },
  })

describe('NavTabs', () => {
  it('renders the hierarchy icon + the five labelled tabs for an admin', () => {
    mockLocation = { pathname: '/portfolios' }
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getByRole('tab', { name: /hierarchy/i })).toBeInTheDocument()
    for (const label of ['Workers', 'Ref Data', 'Users', 'Resources', 'Actuals']) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument()
    }
  })

  it('hides permission-gated tabs for a viewer (Users needs manage_users)', () => {
    mockLocation = { pathname: '/portfolios' }
    render(<NavTabs />, { store: storeFor(['VIEWER']) })
    expect(screen.queryByRole('tab', { name: 'Users' })).toBeNull()
    expect(screen.getByRole('tab', { name: /hierarchy/i })).toBeInTheDocument()
  })

  it('selects the hierarchy tab on program/project detail routes', () => {
    mockLocation = { pathname: '/programs/abc-123' }
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getByRole('tab', { name: /hierarchy/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('selects Workers on /workers/:id and survives unmatched routes', () => {
    mockLocation = { pathname: '/workers/w1' }
    const { unmount } = render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getByRole('tab', { name: 'Workers' })).toHaveAttribute('aria-selected', 'true')
    unmount()
    mockLocation = { pathname: '/demo' } // no tab matches — must not crash
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
  })

  it('navigates on click', async () => {
    mockLocation = { pathname: '/portfolios' }
    const user = userEvent.setup()
    render(<NavTabs />, { store: storeFor(['ADMIN']) })
    await user.click(screen.getByRole('tab', { name: 'Actuals' }))
    expect(mockNavigate).toHaveBeenCalledWith('/actuals')
  })
})
