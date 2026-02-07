import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import PortfolioDetailPage from './PortfolioDetailPage'
import { portfoliosApi } from '../../api/portfolios'

// Mock the portfolios API
vi.mock('../../api/portfolios', () => ({
  portfoliosApi: {
    get: vi.fn(),
    update: vi.fn(),
    getPrograms: vi.fn(),
  },
}))

// Mock useParams and useNavigate
const mockNavigate = vi.fn()
const mockParams = { id: '1' }

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => mockParams,
    useNavigate: () => mockNavigate,
  }
})

describe('PortfolioDetailPage', () => {
  let store: ReturnType<typeof createTestStore>
  let queryClient: ReturnType<typeof createTestQueryClient>

  const mockPortfolio = {
    id: '1',
    name: 'Digital Transformation',
    description: 'Digital transformation initiatives',
    owner: 'John Doe',
    reporting_start_date: '2024-01-01',
    reporting_end_date: '2024-12-31',
    program_count: 2,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-15T14:30:00Z',
  }

  const mockPrograms = [
    {
      id: 'p1',
      name: 'Program Alpha',
      business_sponsor: 'Alice Johnson',
      program_manager: 'Bob Smith',
      technical_lead: 'Charlie Brown',
      start_date: '2024-02-01',
      end_date: '2024-08-31',
      created_at: '2024-01-10T00:00:00Z',
      updated_at: '2024-01-10T00:00:00Z',
    },
    {
      id: 'p2',
      name: 'Program Beta',
      business_sponsor: 'David Lee',
      program_manager: 'Eve Wilson',
      technical_lead: 'Frank Miller',
      start_date: '2024-03-01',
      end_date: '2024-09-30',
      created_at: '2024-01-11T00:00:00Z',
      updated_at: '2024-01-11T00:00:00Z',
    },
  ]

  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(portfoliosApi.get).mockClear()
    vi.mocked(portfoliosApi.update).mockClear()
    vi.mocked(portfoliosApi.getPrograms).mockClear()

    queryClient = createTestQueryClient()

    store = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['ADMIN'],
          permissions: ['view_portfolios', 'update_portfolios'],
        },
        token: 'test-token',
        isAuthenticated: true,
      },
    })

    // Default mock implementations
    vi.mocked(portfoliosApi.get).mockResolvedValue(mockPortfolio)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue(mockPrograms)
  })

  it('should render portfolio details in read-only mode', async () => {
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
      expect(screen.getByText('Digital transformation initiatives')).toBeInTheDocument()
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })

    // Check that fields are displayed as text, not inputs
    expect(screen.queryByRole('textbox', { name: /portfolio name/i })).not.toBeInTheDocument()
  })

  it('should show Edit button with permission', async () => {
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit/i })
    expect(editButton).toBeInTheDocument()
    expect(editButton).not.toBeDisabled()
  })

  it('should hide Edit button without permission', async () => {
    const storeWithoutPermission = createTestStore({
      auth: {
        user: {
          id: '1',
          username: 'testuser',
          email: 'test@example.com',
          roles: ['USER'],
          permissions: ['view_portfolios'], // No update permission
        },
        token: 'test-token',
        isAuthenticated: true,
      },
    })

    render(<PortfolioDetailPage />, { store: storeWithoutPermission, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    // Edit button should not be visible
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })

  it('should switch to edit mode on Edit click', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Check that input fields are now visible
    await waitFor(() => {
      expect(screen.getByDisplayValue('Digital Transformation')).toBeInTheDocument()
      expect(screen.getByDisplayValue('Digital transformation initiatives')).toBeInTheDocument()
      expect(screen.getByDisplayValue('John Doe')).toBeInTheDocument()
    })
  })

  it('should show Save/Cancel buttons in edit mode', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
    })

    // Edit button should no longer be visible
    expect(screen.queryByRole('button', { name: /^edit$/i })).not.toBeInTheDocument()
  })

  it('should validate form on save', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Clear the name field
    const nameInput = screen.getByDisplayValue('Digital Transformation')
    await user.clear(nameInput)

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Name is required')).toBeInTheDocument()
    })

    // API should not be called
    expect(portfoliosApi.update).not.toHaveBeenCalled()
  })

  it('should revert changes on cancel', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Modify the name
    const nameInput = screen.getByDisplayValue('Digital Transformation')
    await user.clear(nameInput)
    await user.type(nameInput, 'Modified Name')

    const cancelButton = screen.getByRole('button', { name: /cancel/i })
    await user.click(cancelButton)

    // Should return to read-only mode with original value
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
      expect(screen.queryByDisplayValue('Modified Name')).not.toBeInTheDocument()
    })
  })

  it('should display programs tab', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    // Click on Programs tab
    const programsTab = screen.getByRole('tab', { name: /programs/i })
    await user.click(programsTab)

    // Should display programs
    await waitFor(() => {
      expect(screen.getByText('Program Alpha')).toBeInTheDocument()
      expect(screen.getByText('Program Beta')).toBeInTheDocument()
    })
  })

  it('should save portfolio updates successfully', async () => {
    const user = userEvent.setup()
    const updatedPortfolio = { ...mockPortfolio, name: 'Updated Portfolio' }
    vi.mocked(portfoliosApi.update).mockResolvedValue(updatedPortfolio)

    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = await screen.findByRole('button', { name: /edit/i })
    await user.click(editButton)

    const nameInput = screen.getByDisplayValue('Digital Transformation')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Portfolio')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(portfoliosApi.update).toHaveBeenCalledWith('1', {
        name: 'Updated Portfolio',
        description: 'Digital transformation initiatives',
        owner: 'John Doe',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
      })
    })

    // Should show success message
    await waitFor(() => {
      expect(screen.getByText('Portfolio updated successfully')).toBeInTheDocument()
    })
  })

  it('should display error message on save failure', async () => {
    const user = userEvent.setup()
    vi.mocked(portfoliosApi.update).mockRejectedValue({
      response: { data: { detail: 'Update failed' } },
    })

    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = await screen.findByRole('button', { name: /edit/i })
    await user.click(editButton)

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Update failed')).toBeInTheDocument()
    })
  })

  it('should validate date range', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    const editButton = await screen.findByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Set end date before start date
    const endDateInput = screen.getByDisplayValue('2024-12-31')
    await user.clear(endDateInput)
    await user.type(endDateInput, '2023-12-31')

    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Should show validation error
    await waitFor(() => {
      expect(screen.getByText('Reporting end date must be after start date')).toBeInTheDocument()
    })
  })

  it('should navigate to program detail on row click', async () => {
    const user = userEvent.setup()
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    // Click on Programs tab
    const programsTab = screen.getByRole('tab', { name: /programs/i })
    await user.click(programsTab)

    await waitFor(() => {
      expect(screen.getByText('Program Alpha')).toBeInTheDocument()
    })

    // Click on a program row
    const programRow = screen.getByText('Program Alpha')
    await user.click(programRow)

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/programs/p1')
    })
  })

  it('should display breadcrumbs navigation', async () => {
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    // Check for breadcrumbs
    const breadcrumbLinks = screen.getAllByRole('button')
    const portfoliosBreadcrumb = breadcrumbLinks.find((link) =>
      link.textContent?.includes('Portfolios')
    )
    expect(portfoliosBreadcrumb).toBeInTheDocument()
  })

  it('should display formatted dates', async () => {
    render(<PortfolioDetailPage />, { store, queryClient })

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Digital Transformation' })).toBeInTheDocument()
    })

    // Check for formatted dates (format: "MMMM dd, yyyy")
    // Note: dates are in UTC, so they may be off by timezone
    expect(screen.getByText(/January 01, 2024/)).toBeInTheDocument()
    expect(screen.getByText(/December 3[01], 2024/)).toBeInTheDocument()
  })
})
