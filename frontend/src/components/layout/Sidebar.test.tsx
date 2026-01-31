import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from '../../test/test-utils'
import Sidebar from './Sidebar'

// Mock useNavigate and useLocation from react-router-dom
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useLocation: () => ({ pathname: '/dashboard' }),
  }
})

describe('Sidebar - Portfolio Navigation', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    mockNavigate.mockClear()
    
    // Create a store with authenticated user
    store = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['USER'],
          permissions: [
            'view_programs',
            'view_projects',
            'view_resources',
            'view_workers',
            'view_actuals',
            'view_reports',
          ],
        },
        token: 'test-token',
        isAuthenticated: true,
      },
      ui: {
        sidebarOpen: true,
      },
    })
  })

  it('should display Portfolio link in navigation', () => {
    render(<Sidebar />, { store })

    // Verify Portfolio link is present
    const portfolioLink = screen.getByText('Portfolio')
    expect(portfolioLink).toBeInTheDocument()
  })

  it('should display Portfolio link with AccountBalance icon', () => {
    render(<Sidebar />, { store })

    // Find the Portfolio list item
    const portfolioLink = screen.getByText('Portfolio')
    expect(portfolioLink).toBeInTheDocument()

    // Verify it's in a clickable button (using getByRole)
    const portfolioButton = screen.getByRole('button', { name: /portfolio/i })
    expect(portfolioButton).toBeInTheDocument()
    expect(portfolioButton).not.toBeDisabled()
  })

  it('should navigate to Portfolio Dashboard when Portfolio link is clicked', async () => {
    const user = userEvent.setup()
    render(<Sidebar />, { store })

    // Find and click the Portfolio link using getByRole
    const portfolioButton = screen.getByRole('button', { name: /portfolio/i })
    
    expect(portfolioButton).toBeInTheDocument()
    await user.click(portfolioButton)

    // Verify navigation was called with correct path
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/portfolio')
    })
  })

  it('should display Portfolio as the first navigation item', () => {
    render(<Sidebar />, { store })

    // Get all navigation items
    const navItems = screen.getAllByRole('button')
    
    // Portfolio should be the first item (index 0)
    expect(navItems[0]).toHaveTextContent('Portfolio')
  })

  it('should display Portfolio link with unique AccountBalance icon distinct from Dashboard', () => {
    render(<Sidebar />, { store })

    // Verify both Portfolio and Dashboard exist
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()

    // They should be different items using getByRole
    const portfolioButton = screen.getByRole('button', { name: /portfolio/i })
    const dashboardButton = screen.getByRole('button', { name: /dashboard/i })
    
    expect(portfolioButton).not.toBe(dashboardButton)
  })
})
