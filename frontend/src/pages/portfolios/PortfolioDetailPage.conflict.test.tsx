import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import PortfolioDetailPage from './PortfolioDetailPage'
import { portfoliosApi } from '../../api/portfolios'

// Mock the API
vi.mock('../../api/portfolios')
vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: () => ({ hasPermission: true }),
  }),
}))

// Mock useParams
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'test-portfolio-id' }),
    useNavigate: () => vi.fn(),
  }
})

describe('PortfolioDetailPage - Conflict Handling', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    vi.clearAllMocks()
  })

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <PortfolioDetailPage />
        </BrowserRouter>
      </QueryClientProvider>
    )
  }

  it('displays ConflictDialog on 409 response', async () => {
    const mockPortfolio = {
      id: 'test-portfolio-id',
      name: 'Original Portfolio',
      description: 'Original description',
      owner: 'John Doe',
      reporting_start_date: '2024-01-01',
      reporting_end_date: '2024-12-31',
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const conflictResponse = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'The portfolio was modified by another user',
            entity_type: 'portfolio',
            entity_id: 'test-portfolio-id',
            current_state: {
              id: 'test-portfolio-id',
              name: 'Updated by Another User',
              description: 'Updated description',
              owner: 'John Doe',
              reporting_start_date: '2024-01-01',
              reporting_end_date: '2024-12-31',
              version: 2,
            },
          },
        },
      },
    }

    vi.mocked(portfoliosApi.get).mockResolvedValue(mockPortfolio)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue([])
    vi.mocked(portfoliosApi.update).mockRejectedValue(conflictResponse)

    renderComponent()

    // Wait for portfolio to load
    await waitFor(() => {
      expect(screen.getByText('Original Portfolio')).toBeInTheDocument()
    })

    // Click edit button
    const editButton = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editButton)

    // Change the name
    const nameInput = screen.getByDisplayValue('Original Portfolio')
    fireEvent.change(nameInput, { target: { value: 'My Updated Portfolio' } })

    // Click save
    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)

    // Wait for conflict dialog to appear
    await waitFor(() => {
      expect(screen.getByText('Update Conflict Detected')).toBeInTheDocument()
    })

    // Verify conflict message
    expect(
      screen.getByText(/The portfolio was modified by another user/i)
    ).toBeInTheDocument()

    // Verify current state is shown
    expect(screen.getByText('Updated by Another User')).toBeInTheDocument()
  })

  it('does not automatically retry on conflict', async () => {
    const mockPortfolio = {
      id: 'test-portfolio-id',
      name: 'Original Portfolio',
      description: 'Original description',
      owner: 'John Doe',
      reporting_start_date: '2024-01-01',
      reporting_end_date: '2024-12-31',
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const conflictResponse = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'Conflict occurred',
            entity_type: 'portfolio',
            entity_id: 'test-portfolio-id',
            current_state: {
              ...mockPortfolio,
              version: 2,
            },
          },
        },
      },
    }

    vi.mocked(portfoliosApi.get).mockResolvedValue(mockPortfolio)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue([])
    vi.mocked(portfoliosApi.update).mockRejectedValue(conflictResponse)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Original Portfolio')).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editButton)

    const nameInput = screen.getByDisplayValue('Original Portfolio')
    fireEvent.change(nameInput, { target: { value: 'My Updated Portfolio' } })

    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Update Conflict Detected')).toBeInTheDocument()
    })

    // Verify update was only called once (no automatic retry)
    expect(portfoliosApi.update).toHaveBeenCalledTimes(1)
  })

  it('refreshes and retries when user clicks Refresh & Retry', async () => {
    const mockPortfolio = {
      id: 'test-portfolio-id',
      name: 'Original Portfolio',
      description: 'Original description',
      owner: 'John Doe',
      reporting_start_date: '2024-01-01',
      reporting_end_date: '2024-12-31',
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const updatedPortfolio = {
      ...mockPortfolio,
      name: 'Updated by Another User',
      version: 2,
    }

    const conflictResponse = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'Conflict occurred',
            entity_type: 'portfolio',
            entity_id: 'test-portfolio-id',
            current_state: updatedPortfolio,
          },
        },
      },
    }

    vi.mocked(portfoliosApi.get)
      .mockResolvedValueOnce(mockPortfolio)
      .mockResolvedValueOnce(updatedPortfolio)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue([])
    vi.mocked(portfoliosApi.update).mockRejectedValue(conflictResponse)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Original Portfolio')).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editButton)

    const nameInput = screen.getByDisplayValue('Original Portfolio')
    fireEvent.change(nameInput, { target: { value: 'My Updated Portfolio' } })

    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Update Conflict Detected')).toBeInTheDocument()
    })

    // Click Refresh & Retry
    const refreshButton = screen.getByRole('button', { name: /Refresh & Retry/i })
    fireEvent.click(refreshButton)

    // Verify portfolio was refetched
    await waitFor(() => {
      expect(portfoliosApi.get).toHaveBeenCalledTimes(2)
    })
  })

  it('cancels edit mode when user clicks Cancel in conflict dialog', async () => {
    const mockPortfolio = {
      id: 'test-portfolio-id',
      name: 'Original Portfolio',
      description: 'Original description',
      owner: 'John Doe',
      reporting_start_date: '2024-01-01',
      reporting_end_date: '2024-12-31',
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }

    const conflictResponse = {
      response: {
        status: 409,
        data: {
          detail: {
            error: 'conflict',
            message: 'Conflict occurred',
            entity_type: 'portfolio',
            entity_id: 'test-portfolio-id',
            current_state: {
              ...mockPortfolio,
              version: 2,
            },
          },
        },
      },
    }

    vi.mocked(portfoliosApi.get).mockResolvedValue(mockPortfolio)
    vi.mocked(portfoliosApi.getPrograms).mockResolvedValue([])
    vi.mocked(portfoliosApi.update).mockRejectedValue(conflictResponse)

    renderComponent()

    await waitFor(() => {
      expect(screen.getByText('Original Portfolio')).toBeInTheDocument()
    })

    const editButton = screen.getByRole('button', { name: /Edit/i })
    fireEvent.click(editButton)

    const nameInput = screen.getByDisplayValue('Original Portfolio')
    fireEvent.change(nameInput, { target: { value: 'My Updated Portfolio' } })

    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(screen.getByText('Update Conflict Detected')).toBeInTheDocument()
    })

    // Click Cancel
    const cancelButton = screen.getAllByRole('button', { name: /Cancel/i })[0]
    fireEvent.click(cancelButton)

    // Verify dialog is closed and edit mode is exited
    await waitFor(() => {
      expect(screen.queryByText('Update Conflict Detected')).not.toBeInTheDocument()
    })
  })
})
