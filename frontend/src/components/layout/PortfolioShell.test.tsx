import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, render as rtlRender } from '@testing-library/react'
import { createTestStore, createTestQueryClient } from '../../test/test-utils'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { Provider } from 'react-redux'
import { QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import theme from '../../theme'
import PortfolioShell from './PortfolioShell'

let mockNarrow = false

vi.mock('../portfolio/HierarchyTree', () => ({
  default: ({ activeType, activeId }: any) => (
    <div data-testid="hierarchy-tree">{activeType}:{activeId}</div>
  ),
}))

vi.mock('@mui/material', async () => ({
  ...(await vi.importActual<any>('@mui/material')),
  useMediaQuery: vi.fn(() => mockNarrow),
}))

const makeStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'admin', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

// Compose providers manually (without BrowserRouter) so we can wrap with our
// own MemoryRouter. test-utils's render always injects a BrowserRouter, which
// would conflict with the MemoryRouter the tests need.
const renderAt = (path: string) => {
  const store = makeStore()
  const queryClient = createTestQueryClient()
  return rtlRender(
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route element={<PortfolioShell />}>
                <Route path="/portfolios" element={<div data-testid="rich-list" />} />
                <Route path="/projects/:id" element={<div data-testid="project-detail" />} />
                <Route path="/portfolios/:id" element={<div data-testid="portfolio-detail" />} />
                <Route path="/programs/:id" element={<div data-testid="program-detail" />} />
              </Route>
            </Routes>
          </MemoryRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </Provider>
  )
}

describe('PortfolioShell', () => {
  beforeEach(() => {
    mockNarrow = false
  })

  it('renders the outlet full-width with no tree on /portfolios (State 1)', () => {
    renderAt('/portfolios')
    expect(screen.getByTestId('rich-list')).toBeInTheDocument()
    expect(screen.queryByTestId('hierarchy-tree')).not.toBeInTheDocument()
  })

  it('renders tree + detail when a project detail route is active (State 2)', () => {
    renderAt('/projects/pj1')
    expect(screen.getByTestId('project-detail')).toBeInTheDocument()
    expect(screen.getByTestId('hierarchy-tree')).toHaveTextContent('project:pj1')
  })

  it('renders tree + detail when a portfolio detail route is active (State 2)', () => {
    renderAt('/portfolios/pf1')
    expect(screen.getByTestId('portfolio-detail')).toBeInTheDocument()
    expect(screen.getByTestId('hierarchy-tree')).toHaveTextContent('portfolio:pf1')
  })

  it('renders tree + detail when a program detail route is active (State 2)', () => {
    renderAt('/programs/pg1')
    expect(screen.getByTestId('program-detail')).toBeInTheDocument()
    expect(screen.getByTestId('hierarchy-tree')).toHaveTextContent('program:pg1')
  })
})

describe('PortfolioShell narrow screens', () => {
  beforeEach(() => {
    mockNarrow = false
  })

  it('shows content + "List" button instead of the side tree when narrow', () => {
    mockNarrow = true
    renderAt('/projects/pj1')
    expect(screen.getByTestId('project-detail')).toBeInTheDocument()
    expect(screen.queryByTestId('hierarchy-tree')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /list/i })).toBeInTheDocument()
  })

  it('pressing the List button swaps to the tree', async () => {
    mockNarrow = true
    const user = (await import('@testing-library/user-event')).default.setup()
    renderAt('/projects/pj1')
    await user.click(screen.getByRole('button', { name: /list/i }))
    expect(screen.getByTestId('hierarchy-tree')).toBeInTheDocument()
    expect(screen.queryByTestId('project-detail')).not.toBeInTheDocument()
  })
})
