import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import PortfolioFormPage from './PortfolioFormPage'
import { portfoliosApi } from '../../api/portfolios'

// Mock the portfolios API
vi.mock('../../api/portfolios', () => ({
  portfoliosApi: {
    create: vi.fn(),
  },
}))

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('PortfolioFormPage', () => {
  let store: ReturnType<typeof createTestStore>
  let queryClient: ReturnType<typeof createTestQueryClient>

  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(portfoliosApi.create).mockClear()

    queryClient = createTestQueryClient()

    store = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['ADMIN'],
          permissions: ['create_portfolios'],
        },
        token: 'test-token',
        isAuthenticated: true,
      },
    })
  })

  it('should render form with all fields', () => {
    render(<PortfolioFormPage />, { store, queryClient })

    expect(screen.getByLabelText(/portfolio name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/owner/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reporting start date/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/reporting end date/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /create portfolio/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
  })

  it('should validate required fields', async () => {
    const user = userEvent.setup()
    render(<PortfolioFormPage />, { store, queryClient })

    // Clear all fields
    const nameInput = screen.getByLabelText(/portfolio name/i)
    const descriptionInput = screen.getByLabelText(/description/i)
    const ownerInput = screen.getByLabelText(/owner/i)

    await user.clear(nameInput)
    await user.clear(descriptionInput)
    await user.clear(ownerInput)

    // Try to submit
    const submitButton = screen.getByRole('button', { name: /create portfolio/i })
    await user.click(submitButton)

    // Check for validation errors
    await waitFor(() => {
      expect(screen.getByText(/portfolio name is required/i)).toBeInTheDocument()
      expect(screen.getByText(/description is required/i)).toBeInTheDocument()
      expect(screen.getByText(/owner is required/i)).toBeInTheDocument()
    })

    // API should not be called
    expect(portfoliosApi.create).not.toHaveBeenCalled()
  })

  it('should validate date range', async () => {
    const user = userEvent.setup()
    render(<PortfolioFormPage />, { store, queryClient })

    // Fill in required fields
    await user.type(screen.getByLabelText(/portfolio name/i), 'Test Portfolio')
    await user.type(screen.getByLabelText(/description/i), 'Test Description')
    await user.type(screen.getByLabelText(/owner/i), 'Test Owner')

    // Set end date before start date
    const startDateInput = screen.getByLabelText(/reporting start date/i)
    const endDateInput = screen.getByLabelText(/reporting end date/i)

    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-12-31')

    await user.clear(endDateInput)
    await user.type(endDateInput, '2024-01-01')

    // Try to submit
    const submitButton = screen.getByRole('button', { name: /create portfolio/i })
    await user.click(submitButton)

    // Check for date validation error
    await waitFor(() => {
      expect(
        screen.getByText(/reporting end date must be after reporting start date/i)
      ).toBeInTheDocument()
    })

    // API should not be called
    expect(portfoliosApi.create).not.toHaveBeenCalled()
  })

  it('should submit valid form', async () => {
    const user = userEvent.setup()
    const mockPortfolio = {
      id: '123',
      name: 'Test Portfolio',
      description: 'Test Description',
      owner: 'Test Owner',
      reporting_start_date: '2024-01-01',
      reporting_end_date: '2024-12-31',
      program_count: 0,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    vi.mocked(portfoliosApi.create).mockResolvedValue(mockPortfolio)

    render(<PortfolioFormPage />, { store, queryClient })

    // Fill in all fields
    await user.clear(screen.getByLabelText(/portfolio name/i))
    await user.type(screen.getByLabelText(/portfolio name/i), 'Test Portfolio')

    await user.clear(screen.getByLabelText(/description/i))
    await user.type(screen.getByLabelText(/description/i), 'Test Description')

    await user.clear(screen.getByLabelText(/owner/i))
    await user.type(screen.getByLabelText(/owner/i), 'Test Owner')

    const startDateInput = screen.getByLabelText(/reporting start date/i)
    const endDateInput = screen.getByLabelText(/reporting end date/i)

    await user.clear(startDateInput)
    await user.type(startDateInput, '2024-01-01')

    await user.clear(endDateInput)
    await user.type(endDateInput, '2024-12-31')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create portfolio/i })
    await user.click(submitButton)

    // Check API was called (React Query passes additional context parameters)
    await waitFor(() => {
      expect(portfoliosApi.create).toHaveBeenCalled()
      const callArgs = vi.mocked(portfoliosApi.create).mock.calls[0]
      expect(callArgs[0]).toEqual({
        name: 'Test Portfolio',
        description: 'Test Description',
        owner: 'Test Owner',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
      })
    })

    // Check navigation to detail page
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/portfolios/123')
    })
  })

  it('should display validation errors for field length', async () => {
    const user = userEvent.setup()
    render(<PortfolioFormPage />, { store, queryClient })

    // Enter a name that's too long (more than 255 characters)
    const nameInput = screen.getByLabelText(/portfolio name/i)
    await user.clear(nameInput)
    
    // Type a very long string
    const longString = 'a'.repeat(300)
    await user.type(nameInput, longString)

    // The input should be limited to 255 characters by maxLength attribute
    expect(nameInput).toHaveValue(longString.substring(0, 255))
  })

  it('should display API errors', async () => {
    const user = userEvent.setup()
    const errorMessage = 'Failed to create portfolio'

    vi.mocked(portfoliosApi.create).mockRejectedValue(new Error('API Error'))

    render(<PortfolioFormPage />, { store, queryClient })

    // Fill in valid data
    await user.clear(screen.getByLabelText(/portfolio name/i))
    await user.type(screen.getByLabelText(/portfolio name/i), 'Test')

    await user.clear(screen.getByLabelText(/description/i))
    await user.type(screen.getByLabelText(/description/i), 'Test')

    await user.clear(screen.getByLabelText(/owner/i))
    await user.type(screen.getByLabelText(/owner/i), 'Test')

    // Submit form
    const submitButton = screen.getByRole('button', { name: /create portfolio/i })
    await user.click(submitButton)

    // Check for API error message (default error message)
    await waitFor(
      () => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      },
      { timeout: 3000 }
    )
  })

  it('should navigate on cancel', async () => {
    const user = userEvent.setup()
    render(<PortfolioFormPage />, { store, queryClient })

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    expect(mockNavigate).toHaveBeenCalledWith('/portfolios')
  })
})
