import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../test/test-utils'
import PortfolioDashboardPage from './PortfolioDashboardPage'

// Mock the API modules
vi.mock('../api/programs', () => ({
  programsApi: {
    list: vi.fn()
  }
}))

vi.mock('../api/projects', () => ({
  projectsApi: {
    list: vi.fn()
  }
}))

vi.mock('../api/forecast', () => ({
  getProgramForecast: vi.fn(),
  getProjectForecast: vi.fn()
}))

describe('PortfolioDashboardPage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /**
   * Integration Test 1: Selecting program updates project dropdown
   * Validates: Requirements 2.5, 2.8
   */
  it('should update project dropdown when a program is selected', async () => {
    const { programsApi } = await import('../api/programs')
    const { projectsApi } = await import('../api/projects')

    // Mock programs API
    vi.mocked(programsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'prog-1',
          name: 'Infrastructure Program',
          business_sponsor: 'John Doe',
          program_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'prog-2',
          name: 'Digital Transformation',
          business_sponsor: 'Alice Brown',
          program_manager: 'Charlie Davis',
          technical_lead: 'Diana Evans',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 2,
      page: 1,
      size: 10,
      pages: 1
    })

    const user = userEvent.setup()
    render(<PortfolioDashboardPage />)

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByLabelText('Program')).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Initially, project dropdown should be disabled
    const projectDropdown = screen.getByLabelText('Project')
    expect(projectDropdown).toHaveAttribute('aria-disabled', 'true')

    // Mock projects API to return projects for the selected program
    vi.mocked(projectsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'proj-1',
          program_id: 'prog-1',
          name: 'Cloud Migration',
          business_sponsor: 'John Doe',
          project_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-06-30',
          cost_center_code: 'CC-001',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        },
        {
          id: 'proj-2',
          program_id: 'prog-1',
          name: 'Network Upgrade',
          business_sponsor: 'John Doe',
          project_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-07-01',
          end_date: '2024-12-31',
          cost_center_code: 'CC-002',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 2,
      page: 1,
      size: 10,
      pages: 1
    })

    // Select a program
    const programDropdown = screen.getByLabelText('Program')
    await user.click(programDropdown)

    // Wait for dropdown to open and select the first program
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Infrastructure Program' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Infrastructure Program' }))

    // Wait for projects to load and project dropdown to be enabled
    await waitFor(() => {
      const projectDropdownAfter = screen.getByLabelText('Project')
      expect(projectDropdownAfter).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Verify that projects API was called with the correct program ID
    expect(projectsApi.list).toHaveBeenCalledWith(
      expect.objectContaining({
        program_id: 'prog-1'
      })
    )

    // Open project dropdown to verify projects are available
    const enabledProjectDropdown = screen.getByLabelText('Project')
    await user.click(enabledProjectDropdown)

    // Verify that projects from the selected program are displayed
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cloud Migration' })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'Network Upgrade' })).toBeInTheDocument()
    })
  })

  /**
   * Integration Test 2: Selecting program displays program-level data
   * Validates: Requirements 2.6, 4.7, 6.1
   */
  it('should display program-level financial data when only program is selected', async () => {
    const { programsApi } = await import('../api/programs')
    const { projectsApi } = await import('../api/projects')
    const { getProgramForecast } = await import('../api/forecast')

    // Mock programs API
    vi.mocked(programsApi.list).mockResolvedValue({
      items: [
        {
          id: 'prog-1',
          name: 'Infrastructure Program',
          business_sponsor: 'John Doe',
          program_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1
    })

    // Mock projects API to return empty list
    vi.mocked(projectsApi.list).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      size: 10,
      pages: 0
    })

    // Mock program forecast API
    vi.mocked(getProgramForecast).mockResolvedValue({
      entity_id: 'prog-1',
      entity_name: 'Infrastructure Program',
      entity_type: 'program',
      budget: { total: 5000000, capital: 3000000, expense: 2000000 },
      actual: { total: 2000000, capital: 1200000, expense: 800000 },
      forecast: { total: 2500000, capital: 1500000, expense: 1000000 },
      analysis: {
        budget_remaining: 500000,
        forecast_variance: 0,
        budget_utilization_percentage: 90,
        forecast_to_budget_percentage: 90
      }
    })

    const user = userEvent.setup()
    render(<PortfolioDashboardPage />)

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByLabelText('Program')).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Select a program
    const programDropdown = screen.getByLabelText('Program')
    await user.click(programDropdown)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Infrastructure Program' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Infrastructure Program' }))

    // Wait for the table to appear (this means the forecast was loaded)
    await waitFor(() => {
      expect(screen.getByText('Budget')).toBeInTheDocument()
      expect(screen.getByText('Actuals')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify that getProgramForecast was called
    await waitFor(() => {
      expect(getProgramForecast).toHaveBeenCalledWith(
        'prog-1',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      )
    })

    // Verify that financial data is displayed
    await waitFor(() => {
      expect(screen.getByText('$5,000,000.00')).toBeInTheDocument()
      expect(screen.getByText('$2,000,000.00')).toBeInTheDocument()
      expect(screen.getByText('$2,500,000.00')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify that the chart section is also displayed
    expect(screen.getByText('Chart Visualization')).toBeInTheDocument()
  }, 30000)

  /**
   * Integration Test 3: Selecting project displays project-level data
   * Validates: Requirements 2.7, 4.8, 6.2
   */
  it('should display project-level financial data when both program and project are selected', async () => {
    const { programsApi } = await import('../api/programs')
    const { projectsApi } = await import('../api/projects')
    const { getProgramForecast, getProjectForecast } = await import('../api/forecast')

    // Mock programs API
    vi.mocked(programsApi.list).mockResolvedValue({
      items: [
        {
          id: 'prog-1',
          name: 'Infrastructure Program',
          business_sponsor: 'John Doe',
          program_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1
    })

    // Mock projects API
    vi.mocked(projectsApi.list).mockResolvedValue({
      items: [
        {
          id: 'proj-1',
          program_id: 'prog-1',
          name: 'Cloud Migration',
          business_sponsor: 'John Doe',
          project_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-06-30',
          cost_center_code: 'CC-001',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1
    })

    // Mock program forecast API
    vi.mocked(getProgramForecast).mockResolvedValue({
      entity_id: 'prog-1',
      entity_name: 'Infrastructure Program',
      entity_type: 'program',
      budget: { total: 5000000, capital: 3000000, expense: 2000000 },
      actual: { total: 2000000, capital: 1200000, expense: 800000 },
      forecast: { total: 2500000, capital: 1500000, expense: 1000000 },
      analysis: {
        budget_remaining: 500000,
        forecast_variance: 0,
        budget_utilization_percentage: 90,
        forecast_to_budget_percentage: 90
      }
    })

    // Mock project forecast API
    vi.mocked(getProjectForecast).mockResolvedValue({
      entity_id: 'proj-1',
      entity_name: 'Cloud Migration',
      entity_type: 'project',
      budget: { total: 1500000, capital: 900000, expense: 600000 },
      actual: { total: 750000, capital: 450000, expense: 300000 },
      forecast: { total: 600000, capital: 360000, expense: 240000 },
      analysis: {
        budget_remaining: 150000,
        forecast_variance: 0,
        budget_utilization_percentage: 90,
        forecast_to_budget_percentage: 90
      }
    })

    const user = userEvent.setup()
    render(<PortfolioDashboardPage />)

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByLabelText('Program')).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Select a program
    const programDropdown = screen.getByLabelText('Program')
    await user.click(programDropdown)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Infrastructure Program' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Infrastructure Program' }))

    // Wait for program-level data to load
    await waitFor(() => {
      expect(screen.getByText('$5,000,000.00')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Wait for project dropdown to be enabled
    await waitFor(() => {
      const projectDropdown = screen.getByLabelText('Project')
      expect(projectDropdown).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Select a project
    const projectDropdown = screen.getByLabelText('Project')
    await user.click(projectDropdown)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Cloud Migration' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Cloud Migration' }))

    // Wait for project-level data to load
    await waitFor(() => {
      expect(screen.getByText('$1,500,000.00')).toBeInTheDocument()
      expect(screen.getByText('$750,000.00')).toBeInTheDocument()
      expect(screen.getByText('$600,000.00')).toBeInTheDocument()
    }, { timeout: 10000 })

    // Verify that getProjectForecast was called
    await waitFor(() => {
      expect(getProjectForecast).toHaveBeenCalledWith(
        'proj-1',
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
      )
    })

    // Verify that program-level data is no longer displayed
    expect(screen.queryByText('$5,000,000.00')).not.toBeInTheDocument()
  }, 30000)

  /**
   * Integration Test 4: Error states display correctly
   * Validates: Requirements 6.5
   */
  it('should display error messages correctly for different error scenarios', async () => {
    const { programsApi } = await import('../api/programs')
    const { projectsApi } = await import('../api/projects')
    const { getProgramForecast } = await import('../api/forecast')

    // Test 1: Programs API error
    vi.mocked(programsApi.list).mockRejectedValueOnce({
      response: {
        status: 500,
        data: { detail: 'Internal server error' }
      },
      message: 'Internal server error',
      isAxiosError: true
    })

    const { unmount } = render(<PortfolioDashboardPage />)

    // Wait for error message to appear
    await waitFor(() => {
      const errorAlert = screen.getByRole('alert')
      expect(errorAlert).toBeInTheDocument()
      expect(errorAlert.textContent).toContain('error occurred')
    })

    // Verify page didn't crash
    expect(screen.getByText('Portfolio Dashboard')).toBeInTheDocument()

    unmount()

    // Test 2: Projects API error
    vi.mocked(programsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'prog-1',
          name: 'Infrastructure Program',
          business_sponsor: 'John Doe',
          program_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1
    })

    vi.mocked(projectsApi.list).mockRejectedValueOnce({
      response: {
        status: 403,
        data: { detail: 'Forbidden' }
      },
      message: 'Forbidden',
      isAxiosError: true
    })

    const user = userEvent.setup()
    const { unmount: unmount2 } = render(<PortfolioDashboardPage />)

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByLabelText('Program')).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Select a program
    const programDropdown = screen.getByLabelText('Program')
    await user.click(programDropdown)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Infrastructure Program' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Infrastructure Program' }))

    // Wait for projects error to appear
    await waitFor(() => {
      const errorAlerts = screen.getAllByRole('alert')
      const projectsError = errorAlerts.find(alert => 
        alert.textContent?.includes('Failed to load projects')
      )
      expect(projectsError).toBeInTheDocument()
      expect(projectsError?.textContent).toContain('permission')
    })

    unmount2()

    // Test 3: Forecast API error
    vi.mocked(programsApi.list).mockResolvedValueOnce({
      items: [
        {
          id: 'prog-1',
          name: 'Infrastructure Program',
          business_sponsor: 'John Doe',
          program_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1
    })

    vi.mocked(projectsApi.list).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      size: 10,
      pages: 0
    })

    vi.mocked(getProgramForecast).mockRejectedValueOnce({
      response: {
        status: 404,
        data: { detail: 'Not found' }
      },
      message: 'Not found',
      isAxiosError: true
    })

    const user2 = userEvent.setup()
    render(<PortfolioDashboardPage />)

    // Wait for programs to load
    await waitFor(() => {
      expect(screen.getByLabelText('Program')).not.toHaveAttribute('aria-disabled', 'true')
    })

    // Select a program
    const programDropdown2 = screen.getByLabelText('Program')
    await user2.click(programDropdown2)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Infrastructure Program' })).toBeInTheDocument()
    })

    await user2.click(screen.getByRole('option', { name: 'Infrastructure Program' }))

    // Wait for forecast error to appear in the table
    await waitFor(() => {
      // The error should be displayed in the financial table
      const errorText = screen.getByText(/not found/i)
      expect(errorText).toBeInTheDocument()
    })
  })

  /**
   * Integration Test 5: Loading states display correctly
   * Validates: Requirements 6.5
   */
  it('should display loading states correctly during data fetching', async () => {
    const { programsApi } = await import('../api/programs')
    const { projectsApi } = await import('../api/projects')
    const { getProgramForecast } = await import('../api/forecast')

    // Create a promise that we can control
    let resolveProgramsPromise: (value: any) => void
    const programsPromise = new Promise((resolve) => {
      resolveProgramsPromise = resolve
    })

    vi.mocked(programsApi.list).mockReturnValueOnce(programsPromise as any)

    render(<PortfolioDashboardPage />)

    // Verify initial loading state is displayed
    expect(screen.getByRole('progressbar')).toBeInTheDocument()

    // Resolve the programs promise
    resolveProgramsPromise!({
      items: [
        {
          id: 'prog-1',
          name: 'Infrastructure Program',
          business_sponsor: 'John Doe',
          program_manager: 'Jane Smith',
          technical_lead: 'Bob Johnson',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ],
      total: 1,
      page: 1,
      size: 10,
      pages: 1
    })

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    // Verify filter section is now visible
    expect(screen.getByLabelText('Program')).toBeInTheDocument()

    // Test loading state for forecast data
    let resolveForecastPromise: (value: any) => void
    const forecastPromise = new Promise((resolve) => {
      resolveForecastPromise = resolve
    })

    vi.mocked(projectsApi.list).mockResolvedValueOnce({
      items: [],
      total: 0,
      page: 1,
      size: 10,
      pages: 0
    })

    vi.mocked(getProgramForecast).mockReturnValueOnce(forecastPromise as any)

    const user = userEvent.setup()

    // Select a program
    const programDropdown = screen.getByLabelText('Program')
    await user.click(programDropdown)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Infrastructure Program' })).toBeInTheDocument()
    })

    await user.click(screen.getByRole('option', { name: 'Infrastructure Program' }))

    // Wait for the financial table to appear with loading state
    await waitFor(() => {
      // The table should show a loading spinner
      const loadingIndicators = screen.getAllByRole('progressbar')
      expect(loadingIndicators.length).toBeGreaterThan(0)
    })

    // Resolve the forecast promise
    resolveForecastPromise!({
      entity_id: 'prog-1',
      entity_name: 'Infrastructure Program',
      entity_type: 'program',
      budget: { total: 5000000, capital: 3000000, expense: 2000000 },
      actual: { total: 2000000, capital: 1200000, expense: 800000 },
      forecast: { total: 2500000, capital: 1500000, expense: 1000000 },
      analysis: {
        budget_remaining: 500000,
        forecast_variance: 0,
        budget_utilization_percentage: 90,
        forecast_to_budget_percentage: 90
      }
    })

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('$5,000,000.00')).toBeInTheDocument()
    }, { timeout: 10000 })
  }, 30000)
})
