import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import ProgramFormPage from './ProgramFormPage'
import { programsApi } from '../../api/programs'
import { portfoliosApi } from '../../api/portfolios'

// Mock the APIs
vi.mock('../../api/programs', () => ({
  programsApi: {
    create: vi.fn(),
    update: vi.fn(),
    get: vi.fn(),
  },
}))

vi.mock('../../api/portfolios', () => ({
  portfoliosApi: {
    list: vi.fn(),
  },
}))

// Mock useNavigate and useParams
const mockNavigate = vi.fn()
const mockParams = { id: 'new' }

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  }
})

describe('ProgramFormPage', () => {
  let store: ReturnType<typeof createTestStore>
  let queryClient: ReturnType<typeof createTestQueryClient>

  const mockPortfolios = {
    items: [
      {
        id: 'portfolio-1',
        name: 'Portfolio 1',
        description: 'Test Portfolio 1',
        owner: 'Owner 1',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
        program_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'portfolio-2',
        name: 'Portfolio 2',
        description: 'Test Portfolio 2',
        owner: 'Owner 2',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
        program_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ],
    total: 2,
    page: 1,
    size: 1000,
    pages: 1,
  }

  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(programsApi.create).mockClear()
    vi.mocked(programsApi.update).mockClear()
    vi.mocked(programsApi.get).mockClear()
    vi.mocked(portfoliosApi.list).mockClear()

    // Mock portfolios list by default
    vi.mocked(portfoliosApi.list).mockResolvedValue(mockPortfolios)

    queryClient = createTestQueryClient()

    store = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['ADMIN'],
          permissions: ['create_programs', 'update_programs'],
        },
        token: 'test-token',
        isAuthenticated: true,
      },
    })
  })

  it('should render portfolio dropdown', async () => {
    render(<ProgramFormPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByLabelText(/portfolio/i)).toBeInTheDocument()
    })
  })

  it('should populate dropdown with portfolios', async () => {
    const user = userEvent.setup()
    render(<ProgramFormPage />, { store, queryClient })

    // Wait for portfolios to load
    await waitFor(() => {
      expect(portfoliosApi.list).toHaveBeenCalled()
    })

    // Open the dropdown
    const portfolioSelect = screen.getByLabelText(/portfolio/i)
    await user.click(portfolioSelect)

    // Check that portfolio options are displayed
    await waitFor(() => {
      expect(screen.getByText('Portfolio 1')).toBeInTheDocument()
      expect(screen.getByText('Portfolio 2')).toBeInTheDocument()
    })
  })

  it('should validate portfolio selection required', async () => {
    const user = userEvent.setup()
    render(<ProgramFormPage />, { store, queryClient })

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/program name/i)).toBeInTheDocument()
    })

    // Fill in ALL required fields except portfolio
    const nameInput = screen.getByLabelText(/program name/i)
    const sponsorInput = screen.getByLabelText(/business sponsor/i)
    const managerInput = screen.getByLabelText(/program manager/i)
    const leadInput = screen.getByLabelText(/technical lead/i)

    await user.clear(nameInput)
    await user.type(nameInput, 'Test Program')
    await user.clear(sponsorInput)
    await user.type(sponsorInput, 'Test Sponsor')
    await user.clear(managerInput)
    await user.type(managerInput, 'Test Manager')
    await user.clear(leadInput)
    await user.type(leadInput, 'Test Lead')

    // Get the form element and remove HTML5 validation to test our custom validation
    const form = screen.getByRole('button', { name: /save program/i }).closest('form')
    if (form) {
      form.setAttribute('novalidate', 'true')
    }

    // Try to submit without selecting portfolio
    const submitButton = screen.getByRole('button', { name: /save program/i })
    await user.click(submitButton)

    // Check for validation error
    await waitFor(
      () => {
        expect(screen.getByText(/portfolio selection is required/i)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )

    // API should not be called
    expect(programsApi.create).not.toHaveBeenCalled()
  })

  it('should submit with portfolio_id', async () => {
    const user = userEvent.setup()
    const mockProgram = {
      id: '123',
      name: 'Test Program',
      business_sponsor: 'Test Sponsor',
      program_manager: 'Test Manager',
      technical_lead: 'Test Lead',
      start_date: '2024-01-01',
      end_date: '2024-12-31',
      portfolio_id: 'portfolio-1',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    vi.mocked(programsApi.create).mockResolvedValue(mockProgram)

    render(<ProgramFormPage />, { store, queryClient })

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/program name/i)).toBeInTheDocument()
    })

    // Fill in all fields including portfolio
    await user.type(screen.getByLabelText(/program name/i), 'Test Program')
    await user.type(screen.getByLabelText(/business sponsor/i), 'Test Sponsor')
    await user.type(screen.getByLabelText(/program manager/i), 'Test Manager')
    await user.type(screen.getByLabelText(/technical lead/i), 'Test Lead')

    // Select portfolio
    const portfolioSelect = screen.getByLabelText(/portfolio/i)
    await user.click(portfolioSelect)
    await waitFor(() => {
      expect(screen.getByText('Portfolio 1')).toBeInTheDocument()
    })
    await user.click(screen.getByText('Portfolio 1'))

    // Set dates
    const startDateInput = screen.getByLabelText(/start date/i)
    const endDateInput = screen.getByLabelText(/end date/i)
    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01')
    await user.clear(endDateInput)
    await user.type(endDateInput, '2024-12-31')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /save program/i })
    await user.click(submitButton)

    // Check API was called with portfolio_id
    await waitFor(() => {
      expect(programsApi.create).toHaveBeenCalled()
      const callArgs = vi.mocked(programsApi.create).mock.calls[0]
      expect(callArgs[0]).toEqual({
        name: 'Test Program',
        business_sponsor: 'Test Sponsor',
        program_manager: 'Test Manager',
        technical_lead: 'Test Lead',
        start_date: '2024-01-01',
        end_date: '2024-12-31',
        portfolio_id: 'portfolio-1',
      })
    })

    // Check navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/programs')
    })
  })
})
