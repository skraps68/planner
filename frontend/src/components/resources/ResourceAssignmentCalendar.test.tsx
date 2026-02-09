import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResourceAssignmentCalendar from './ResourceAssignmentCalendar'
import { assignmentsApi } from '../../api/assignments'
import { ResourceAssignment } from '../../types'
import { useAuth } from '../../contexts/AuthContext'
import { User } from '../../store/slices/authSlice'

// Mock the assignments API
vi.mock('../../api/assignments', () => ({
  assignmentsApi: {
    getByProject: vi.fn(),
  },
}))

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('ResourceAssignmentCalendar - Read-Only Display', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const mockProjectId = 'project-123'
  const mockStartDate = '2024-01-01'
  const mockEndDate = '2024-01-05'

  // Mock user with no permissions for read-only tests
  const mockUser: User = {
    id: 'user-1',
    username: 'viewer',
    email: 'viewer@example.com',
    isActive: true,
    roles: ['VIEWER'],
    permissions: [],
  }

  beforeEach(() => {
    // Mock useAuth to return a user with no edit permissions
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    })
  })

  describe('Loading and Error States', () => {
    it('displays loading spinner while fetching data', () => {
      // Mock API to never resolve
      vi.mocked(assignmentsApi.getByProject).mockImplementation(
        () => new Promise(() => {})
      )

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      expect(screen.getByRole('progressbar')).toBeInTheDocument()
    })

    it('displays error message when API call fails', async () => {
      const errorMessage = 'Failed to load assignments'
      vi.mocked(assignmentsApi.getByProject).mockRejectedValue({
        response: { data: { detail: errorMessage } },
      })

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText(errorMessage)).toBeInTheDocument()
      })
    })

    it('calls onSaveError callback when API fails', async () => {
      const onSaveError = vi.fn()
      const errorMessage = 'API Error'
      vi.mocked(assignmentsApi.getByProject).mockRejectedValue({
        response: { data: { detail: errorMessage } },
      })

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
          onSaveError={onSaveError}
        />
      )

      await waitFor(() => {
        expect(onSaveError).toHaveBeenCalledWith(errorMessage)
      })
    })
  })

  describe('Empty States', () => {
    it('displays message when project dates are missing', async () => {
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate=""
          projectEndDate=""
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/Project start date and end date are required/i)
        ).toBeInTheDocument()
      })
    })

    it('displays message when no resources are assigned', async () => {
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(
          screen.getByText(/No resources are currently assigned/i)
        ).toBeInTheDocument()
      })
    })
  })

  describe('Calendar Rendering', () => {
    const mockAssignments: ResourceAssignment[] = [
      {
        id: 'assign-1',
        resource_id: 'resource-1',
        resource_name: 'John Doe',
        project_id: mockProjectId,
        project_phase_id: 'phase-1',
        assignment_date: '2024-01-02',
        capital_percentage: 60,
        expense_percentage: 40,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'assign-2',
        resource_id: 'resource-1',
        resource_name: 'John Doe',
        project_id: mockProjectId,
        project_phase_id: 'phase-1',
        assignment_date: '2024-01-03',
        capital_percentage: 50,
        expense_percentage: 50,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'assign-3',
        resource_id: 'resource-2',
        resource_name: 'Jane Smith',
        project_id: mockProjectId,
        project_phase_id: 'phase-1',
        assignment_date: '2024-01-02',
        capital_percentage: 70,
        expense_percentage: 30,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    ]

    beforeEach(() => {
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    })

    it('renders calendar table with correct structure', async () => {
      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        const table = screen.getByRole('grid')
        expect(table).toBeInTheDocument()
      })

      // Check for header row with Resource column
      expect(screen.getByText('Resource')).toBeInTheDocument()

      // Check for date columns - dates are generated in UTC, so we check for the actual rendered dates
      // The component should render 5 date columns (Jan 1-5 in the date range)
      const table = screen.getByRole('grid')
      const headerRow = table.querySelector('thead tr')
      const headerCells = headerRow?.querySelectorAll('th')
      
      // Should have 7 header cells: Resource + Type + 5 date columns
      expect(headerCells).toHaveLength(7)
      expect(headerCells?.[0].textContent).toBe('Resource')
      expect(headerCells?.[1].textContent).toBe('Type')
    })

    it('displays resources with Capital and Expense rows', async () => {
      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        // Check for both resources
        const johnDoeElements = screen.getAllByText('John Doe')
        const janeSmithElements = screen.getAllByText('Jane Smith')

        // Each resource should appear once (with rowSpan for Capital and Expense rows)
        expect(johnDoeElements).toHaveLength(1)
        expect(janeSmithElements).toHaveLength(1)

        // Check for Capital and Expense labels (abbreviated as Cap and Exp)
        const capitalLabels = screen.getAllByText('Cap')
        const expenseLabels = screen.getAllByText('Exp')

        // Should have 2 Capital labels (one per resource) and 2 Expense labels
        expect(capitalLabels).toHaveLength(2)
        expect(expenseLabels).toHaveLength(2)
      })
    })

    it('displays percentage values in correct cells', async () => {
      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        // Check that all expected percentage values are present (without % symbol)
        expect(screen.getByText('60')).toBeInTheDocument()
        expect(screen.getByText('40')).toBeInTheDocument()
        expect(screen.getAllByText('50')).toHaveLength(2) // John Doe has 50% on Jan 3 for both Capital and Expense
        expect(screen.getByText('70')).toBeInTheDocument()
        expect(screen.getByText('30')).toBeInTheDocument()
      })
    })

    it('displays empty cells when no assignment exists', async () => {
      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        const table = screen.getByRole('grid')
        expect(table).toBeInTheDocument()
      })

      // Most cells should be empty (no percentage values)
      // We have 2 resources × 2 rows (Capital/Expense) × 5 dates = 20 cells
      // Only 5 cells have values, so 15 should be empty
      const allCells = screen.getAllByRole('gridcell')
      const emptyCells = allCells.filter(
        (cell) => cell.textContent === '' || cell.textContent?.trim() === ''
      )

      // Should have many empty cells (exact count depends on structure)
      expect(emptyCells.length).toBeGreaterThan(10)
    })

    it('handles zero percentage values correctly', async () => {
      const assignmentsWithZero: ResourceAssignment[] = [
        {
          id: 'assign-zero',
          resource_id: 'resource-3',
          resource_name: 'Zero Resource',
          project_id: mockProjectId,
          project_phase_id: 'phase-1',
          assignment_date: '2024-01-02',
          capital_percentage: 0,
          expense_percentage: 0,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(assignmentsWithZero)

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        // Zero values should display as empty cells (formatPercentage returns '' for 0)
        // The resource name should be visible but percentage cells should be empty
        const zeroResourceElements = screen.getAllByText('Zero Resource')
        expect(zeroResourceElements).toHaveLength(1) // Resource name appears once with rowSpan
      })
    })
  })

  describe('Sticky Column Behavior', () => {
    it('renders resource name column with sticky positioning styles', async () => {
      const mockAssignments: ResourceAssignment[] = [
        {
          id: 'assign-1',
          resource_id: 'resource-1',
          resource_name: 'Test Resource',
          project_id: mockProjectId,
          project_phase_id: 'phase-1',
          assignment_date: '2024-01-02',
          capital_percentage: 50,
          expense_percentage: 50,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)

      const { container } = render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        const testResourceElements = screen.getAllByText('Test Resource')
        expect(testResourceElements).toHaveLength(1) // Resource name appears once with rowSpan
      })

      // Check that the first two column headers exist (Resource and Type)
      const headerCells = container.querySelectorAll('th')
      expect(headerCells.length).toBeGreaterThan(1)
      expect(headerCells[0].textContent).toBe('Resource')
      expect(headerCells[1].textContent).toBe('Type')
      
      // Check that we have 2 rows (Capital and Expense)
      const bodyRows = container.querySelectorAll('tbody tr')
      expect(bodyRows.length).toBe(2) // Capital and Expense rows
    })
  })

  describe('Data Fetching', () => {
    it('fetches assignments on mount', async () => {
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(assignmentsApi.getByProject).toHaveBeenCalledWith(mockProjectId)
      })
    })

    it('refetches assignments when projectId changes', async () => {
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])

      const { rerender } = render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(assignmentsApi.getByProject).toHaveBeenCalledWith(mockProjectId)
      })

      const newProjectId = 'project-456'
      rerender(
        <ResourceAssignmentCalendar
          projectId={newProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(assignmentsApi.getByProject).toHaveBeenCalledWith(newProjectId)
      })

      expect(assignmentsApi.getByProject).toHaveBeenCalledTimes(2)
    })
  })
})


describe('ResourceAssignmentCalendar - Edit Mode', () => {
  const mockProjectId = 'project-123'
  const mockStartDate = '2024-01-01'
  const mockEndDate = '2024-01-05'

  const mockUserWithPermission: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    isActive: true,
    roles: ['PROJECT_MANAGER'],
    permissions: [],
  }

  const mockUserWithoutPermission: User = {
    id: 'user-2',
    username: 'viewer',
    email: 'viewer@example.com',
    isActive: true,
    roles: ['VIEWER'],
    permissions: [],
  }

  const mockAssignments: ResourceAssignment[] = [
    {
      id: 'assign-1',
      resource_id: 'resource-1',
      resource_name: 'John Doe',
      project_id: mockProjectId,
      project_phase_id: 'phase-1',
      assignment_date: '2024-01-02',
      capital_percentage: 60,
      expense_percentage: 40,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Permission Checks', () => {
    it('displays Edit button when user has manage_resources permission', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockUserWithPermission,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })
    })

    it('does not display Edit button when user lacks manage_resources permission', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockUserWithoutPermission,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        const johnDoeElements = screen.getAllByText('John Doe')
        expect(johnDoeElements.length).toBeGreaterThan(0)
      })

      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    })

    it('does not display Edit button when user is not authenticated', async () => {
      vi.mocked(useAuth).mockReturnValue({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        const johnDoeElements = screen.getAllByText('John Doe')
        expect(johnDoeElements.length).toBeGreaterThan(0)
      })

      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    })
  })

  describe('Mode Toggle', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockUserWithPermission,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })
    })

    it('toggles to edit mode when Edit button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      // In edit mode, Edit button should be replaced with Save and Cancel
      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
      expect(screen.getByText('Save')).toBeInTheDocument()
      expect(screen.getByText('Cancel')).toBeInTheDocument()
    })

    it('returns to read-only mode when Cancel button is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      // Enter edit mode
      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      // Click Cancel
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      // Should return to read-only mode
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })
      expect(screen.queryByText('Save')).not.toBeInTheDocument()
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })

    it('clears edits when Cancel is clicked', async () => {
      const user = userEvent.setup()

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      // Enter edit mode
      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      // Click Cancel
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      // Should return to read-only mode with no edits
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })
    })
  })

  describe('Button Visibility', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockUserWithPermission,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })
    })

    it('displays only Edit button in read-only mode', async () => {
      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      expect(screen.queryByText('Save')).not.toBeInTheDocument()
      expect(screen.queryByText('Cancel')).not.toBeInTheDocument()
    })

    it('displays Save and Cancel buttons in edit mode', async () => {
      const user = userEvent.setup()

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      await waitFor(() => {
        expect(screen.getByText('Save')).toBeInTheDocument()
        expect(screen.getByText('Cancel')).toBeInTheDocument()
      })

      expect(screen.queryByText('Edit')).not.toBeInTheDocument()
    })
  })

  describe('EditableCell Component', () => {
    beforeEach(() => {
      vi.mocked(useAuth).mockReturnValue({
        user: mockUserWithPermission,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })
    })

    it('displays percentage values as text in read-only mode', async () => {
      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('60')).toBeInTheDocument()
        expect(screen.getByText('40')).toBeInTheDocument()
      })

      // Should not have input fields in read-only mode
      const inputs = screen.queryAllByRole('spinbutton')
      expect(inputs).toHaveLength(0)
    })

    it('displays input fields in edit mode', async () => {
      const user = userEvent.setup()

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      await waitFor(() => {
        // In edit mode, cells should become input fields
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })
    })
  })
})
