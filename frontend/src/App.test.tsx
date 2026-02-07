import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from './test/test-utils'
import App from './App'

// Mock the child components to simplify testing
vi.mock('./pages/PortfolioDashboardPage', () => ({
  default: () => <div data-testid="portfolio-dashboard">Portfolio Dashboard Page</div>
}))

vi.mock('./pages/DashboardPage', () => ({
  default: () => <div data-testid="dashboard">Dashboard Page</div>
}))

vi.mock('./pages/auth/LoginPage', () => ({
  default: () => <div data-testid="login-page">Login Page</div>
}))

vi.mock('./components/layout/Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  )
}))

vi.mock('./pages/portfolios/PortfoliosListPage', () => ({
  default: () => <div data-testid="portfolios-list">Portfolios List Page</div>
}))

vi.mock('./pages/portfolios/PortfolioDetailPage', () => ({
  default: () => <div data-testid="portfolio-detail">Portfolio Detail Page</div>
}))

vi.mock('./pages/portfolios/PortfolioFormPage', () => ({
  default: () => <div data-testid="portfolio-form">Portfolio Form Page</div>
}))

describe('Portfolio Dashboard Routing', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    // Create a store with authenticated user
    store = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['USER'],
          permissions: [],
        },
        token: 'test-token',
        isAuthenticated: true,
      },
      ui: {
        sidebarOpen: true,
      },
    })
  })

  it('should redirect from "/" to Portfolio Dashboard', async () => {
    // Render the app at the root path
    window.history.pushState({}, 'Test page', '/')
    
    render(<App />, { store })

    // Wait for the redirect and component to render
    await waitFor(() => {
      expect(screen.getByTestId('portfolio-dashboard')).toBeInTheDocument()
    })

    // Verify the URL changed to /portfolio
    expect(window.location.pathname).toBe('/portfolio')
  })

  it('should display Portfolio Dashboard when navigating to /portfolio', async () => {
    // Navigate directly to /portfolio
    window.history.pushState({}, 'Test page', '/portfolio')
    
    render(<App />, { store })

    // Verify Portfolio Dashboard is rendered
    await waitFor(() => {
      expect(screen.getByTestId('portfolio-dashboard')).toBeInTheDocument()
    })
  })

  it('should not redirect to Portfolio Dashboard when on other routes', async () => {
    // Navigate to /dashboard
    window.history.pushState({}, 'Test page', '/dashboard')
    
    render(<App />, { store })

    // Verify Dashboard page is rendered, not Portfolio
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('portfolio-dashboard')).not.toBeInTheDocument()
  })
})

describe('Portfolio Entity Routing', () => {
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    // Create a store with authenticated user
    store = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['USER'],
          permissions: ['view_portfolios', 'create_portfolios'],
        },
        token: 'test-token',
        isAuthenticated: true,
      },
      ui: {
        sidebarOpen: true,
      },
    })
  })

  it('should display Portfolios List page at /portfolios', async () => {
    window.history.pushState({}, 'Test page', '/portfolios')
    
    render(<App />, { store })

    await waitFor(() => {
      expect(screen.getByTestId('portfolios-list')).toBeInTheDocument()
    })
  })

  it('should display Portfolio Form page at /portfolios/new', async () => {
    window.history.pushState({}, 'Test page', '/portfolios/new')
    
    render(<App />, { store })

    await waitFor(() => {
      expect(screen.getByTestId('portfolio-form')).toBeInTheDocument()
    })
  })

  it('should display Portfolio Detail page at /portfolios/:id', async () => {
    window.history.pushState({}, 'Test page', '/portfolios/123')
    
    render(<App />, { store })

    await waitFor(() => {
      expect(screen.getByTestId('portfolio-detail')).toBeInTheDocument()
    })
  })
})
