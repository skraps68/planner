import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import PortfolioDetailPage from './PortfolioDetailPage'
import { portfoliosApi } from '../../api/portfolios'
import * as forecastApi from '../../api/forecast'

// recharts' ResponsiveContainer needs ResizeObserver, absent in jsdom
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ||= ResizeObserverStub as unknown as typeof ResizeObserver

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useParams: () => ({ id: 'pf1' }),
  useNavigate: () => vi.fn(),
}))

vi.mock('../../api/portfolios', () => ({
  portfoliosApi: {
    get: vi.fn(),
    getPrograms: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('../../api/projects', () => ({
  projectsApi: { list: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, size: 1000, pages: 0 }) },
}))
vi.mock('../../api/phases', () => ({
  phasesApi: { list: vi.fn().mockResolvedValue([]) },
}))
vi.mock('../../api/forecast', async () => ({
  ...(await vi.importActual<any>('../../api/forecast')),
  getPortfolioForecast: vi.fn(),
  getProgramForecast: vi.fn(),
  getProjectForecast: vi.fn(),
}))

const portfolio = {
  id: 'pf1',
  name: 'North Star',
  description: 'd',
  owner: 'Owner',
  reporting_start_date: '2024-01-01',
  reporting_end_date: '2024-12-31',
  version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  business_id: '010000001',
}

const portfolioForecast = {
  entity_id: 'pf1',
  entity_name: 'North Star',
  entity_type: 'portfolio' as const,
  budget: { total: 150000, capital: 100000, expense: 50000, labor_capital: 100000, labor_expense: 50000, nonlabor_capital: 0, nonlabor_expense: 0 },
  actual: { total: 2500, capital: 2000, expense: 500, labor_capital: 2000, labor_expense: 500, nonlabor_capital: 0, nonlabor_expense: 0 },
  forecast: { total: 140000, capital: 95000, expense: 45000, labor_capital: 95000, labor_expense: 45000, nonlabor_capital: 0, nonlabor_expense: 0 },
  analysis: { budget_remaining: 10000, forecast_variance: 10000, budget_utilization_percentage: 1.67, forecast_to_budget_percentage: 93.3 },
}

const adminStore = () =>
  createTestStore({
    auth: { user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] }, token: 't', isAuthenticated: true },
  })

describe('PortfolioDetailPage financials', () => {
  beforeEach(() => {
    vi.mocked(portfoliosApi.get).mockResolvedValue(portfolio as any)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue([
      {
        id: 'pg1',
        name: 'Platform',
        portfolio_id: 'pf1',
        business_sponsor: 'Sponsor',
        program_manager: 'PM',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
      } as any,
    ])
    vi.mocked(forecastApi.getPortfolioForecast).mockResolvedValue(portfolioForecast as any)
  })

  it('renders the financials panel from the portfolio forecast', async () => {
    render(<PortfolioDetailPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    // The drill-down "Program" selector renders once the page is up
    await waitFor(() => expect(screen.getByLabelText('Program')).toBeInTheDocument())
    // The portfolio-total forecast endpoint is used when no program is selected
    await waitFor(() => expect(forecastApi.getPortfolioForecast).toHaveBeenCalledWith('pf1', expect.any(String)))
  })
})
