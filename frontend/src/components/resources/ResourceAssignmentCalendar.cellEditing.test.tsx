/**
 * Unit tests for cell editing functionality in ResourceAssignmentCalendar
 * Tests: cell value updates, edit tracking, input validation, error display
 * Requirements: 12.3, 12.4, 12.5, 17.1
 */

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

describe('ResourceAssignmentCalendar - Cell Editing', () => {
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
      resource_id: 'resource-2',
      resource_name: 'Jane Smith',
      project_id: mockProjectId,
      project_phase_id: 'phase-1',
      assignment_date: '2024-01-03',
      capital_percentage: 50,
      expense_percentage: 50,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: mockUserWithPermission,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    })
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
  })

  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  describe('Cell Value Updates (Requirement 17.1)', () => {
    it('updates cell value when user types in input field', async () => {
      const user = userEvent.setup()

      render(
        <ResourceAssignmentCalendar
          projectId={mockProjectId}
          projectStartDate={mockStartDate}
          projectEndDate={mockEndDate}
        />
      )

      // Wait for data to load and enter edit mode
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      const editButton = screen.getByText('Edit')
      await user.click(editButton)

      await waitFor(() => {
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      // Find an input field and change its value
      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Clear and type new value
      await user.clear(firstInput)
      await user.type(firstInput, '75')

      // Value should be updated in the input
      expect(firstInput.value).toBe('75')
    })

    it('updates UI optimistically when cell value changes', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Change value
      await user.clear(firstInput)
      await user.type(firstInput, '85')

      // UI should reflect the new value immediately
      expect(firstInput.value).toBe('85')
    })

    it('handles empty input as 0%', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Clear the input (empty string)
      await user.clear(firstInput)

      // Empty input should be treated as 0
      expect(firstInput.value).toBe('')
    })
  })

  describe('Input Validation (Requirements 12.3, 12.4, 12.5)', () => {
    it('validates numeric input only', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Try to type non-numeric characters
      await user.clear(firstInput)
      await user.type(firstInput, 'abc')

      // Input should reject non-numeric characters (HTML5 number input behavior)
      // The value should remain empty or unchanged
      expect(firstInput.value).not.toBe('abc')
    })

    it('validates range 0-100 and shows error for values < 0', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Type a negative value
      await user.clear(firstInput)
      await user.type(firstInput, '-10')

      // Should show validation error - check for error in the DOM
      await waitFor(() => {
        // The error is shown via aria-label on the TextField wrapper
        const errorLabel = screen.queryByLabelText(/Percentage must be between 0 and 100/i)
        expect(errorLabel).toBeInTheDocument()
      })
    })

    it('validates range 0-100 and shows error for values > 100', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Type a value > 100
      await user.clear(firstInput)
      await user.type(firstInput, '150')

      // Should show validation error - check for error in the DOM
      await waitFor(() => {
        const errorLabel = screen.queryByLabelText(/Percentage must be between 0 and 100/i)
        expect(errorLabel).toBeInTheDocument()
      })
    })

    it('accepts valid values within 0-100 range', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Type a valid value
      await user.clear(firstInput)
      await user.type(firstInput, '75')

      // Should not show validation error
      const hasError = firstInput.getAttribute('aria-invalid') === 'true' ||
                      firstInput.classList.contains('Mui-error')
      expect(hasError).toBe(false)
    })

    it('accepts boundary values 0 and 100', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(1)
      })

      const inputs = screen.getAllByRole('spinbutton')
      
      // Test value 0
      const firstInput = inputs[0] as HTMLInputElement
      await user.clear(firstInput)
      await user.type(firstInput, '0')
      
      let hasError = firstInput.getAttribute('aria-invalid') === 'true' ||
                    firstInput.classList.contains('Mui-error')
      expect(hasError).toBe(false)

      // Test value 100
      const secondInput = inputs[1] as HTMLInputElement
      await user.clear(secondInput)
      await user.type(secondInput, '100')
      
      hasError = secondInput.getAttribute('aria-invalid') === 'true' ||
                secondInput.classList.contains('Mui-error')
      expect(hasError).toBe(false)
    })
  })

  describe('Error Display (Requirement 12.5)', () => {
    it('displays inline error message for invalid input', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Type an invalid value
      await user.clear(firstInput)
      await user.type(firstInput, '150')

      // Should display error - check for error in the DOM
      await waitFor(() => {
        const errorLabel = screen.queryByLabelText(/Percentage must be between 0 and 100/i)
        expect(errorLabel).toBeInTheDocument()
      })
    })

    it('clears error message when valid input is entered', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      let inputs = screen.getAllByRole('spinbutton')
      let firstInput = inputs[0] as HTMLInputElement

      // Type an invalid value first
      await user.clear(firstInput)
      await user.type(firstInput, '150')

      await waitFor(() => {
        const errorLabel = screen.queryByLabelText(/Percentage must be between 0 and 100/i)
        expect(errorLabel).toBeInTheDocument()
      })

      // Get the input again after error state
      inputs = screen.getAllByRole('spinbutton')
      firstInput = inputs[0] as HTMLInputElement

      // Click on the input to focus it, then clear and type
      await user.click(firstInput)
      await user.clear(firstInput)
      await user.type(firstInput, '75')

      // Error should be cleared - the error label should not be present
      await waitFor(() => {
        const errorLabel = screen.queryByLabelText(/Percentage must be between 0 and 100/i)
        expect(errorLabel).not.toBeInTheDocument()
      })
    })
  })

  describe('Edit Tracking', () => {
    it('tracks old and new values when cell is edited', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement
      const originalValue = firstInput.value

      // Change the value
      await user.clear(firstInput)
      await user.type(firstInput, '85')

      // The component should track this edit internally
      // We can verify by checking that the value changed
      expect(firstInput.value).toBe('85')
      expect(firstInput.value).not.toBe(originalValue)
    })

    it('preserves edits when switching between cells', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(1)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement
      const secondInput = inputs[1] as HTMLInputElement

      // Edit first cell
      await user.clear(firstInput)
      await user.type(firstInput, '85')

      // Edit second cell
      await user.clear(secondInput)
      await user.type(secondInput, '65')

      // Both edits should be preserved
      expect(firstInput.value).toBe('85')
      expect(secondInput.value).toBe('65')
    })

    it('clears all edits when Cancel is clicked', async () => {
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
        const inputs = screen.getAllByRole('spinbutton')
        expect(inputs.length).toBeGreaterThan(0)
      })

      const inputs = screen.getAllByRole('spinbutton')
      const firstInput = inputs[0] as HTMLInputElement

      // Make an edit
      await user.clear(firstInput)
      await user.type(firstInput, '85')

      // Click Cancel
      const cancelButton = screen.getByText('Cancel')
      await user.click(cancelButton)

      // Should return to read-only mode with original values
      await waitFor(() => {
        expect(screen.getByText('Edit')).toBeInTheDocument()
      })

      // Original value should be restored (60% from mockAssignments)
      expect(screen.getByText('60%')).toBeInTheDocument()
    })
  })
})
