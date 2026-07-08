import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore } from './test/test-utils'
import App from './App'

// Mock the child components to simplify testing
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

describe('Root Routing', () => {
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
    })
  })

  it('should redirect from "/" to Portfolios', async () => {
    window.history.pushState({}, 'Test page', '/')
    render(<App />, { store })
    await waitFor(() => {
      expect(screen.getByTestId('portfolios-list')).toBeInTheDocument()
    })
    expect(window.location.pathname).toBe('/portfolios')
  })

  it('should display the Dashboard when navigating to /dashboard', async () => {
    window.history.pushState({}, 'Test page', '/dashboard')
    render(<App />, { store })
    await waitFor(() => {
      expect(screen.getByTestId('dashboard')).toBeInTheDocument()
    })
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
