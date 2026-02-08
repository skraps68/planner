import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResourceAssignmentCalendar from './ResourceAssignmentCalendar'
import { assignmentsApi } from '../../api/assignments'
import { useAuth } from '../../contexts/AuthContext'

// Mock the API
vi.mock('../../api/assignments')

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock the validation utility
vi.mock('../../utils/cellValidation', () => ({
  validatePercentage: (value: number) => {
    if (value < 0 || value > 100) {
      return { isValid: false, errorMessage: 'Percentage must be between 0 and 100' }
    }
    return { isValid: true }
  },
  validateCellEdit: vi.fn(),
}))

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  isActive: true,
  roles: ['ADMIN'],
  permissions: ['manage_resources'],
}

const mockAssignments = [
  {
    id: 'assignment-1',
    resource_id: 'resource-1',
    resource_name: 'John Doe',
    project_id: 'project-1',
    assignment_date: '2024-01-15',
    allocation_percentage: 80,
    capital_percentage: 50,
    expense_percentage: 30,
  },
  {
    id: 'assignment-2',
    resource_id: 'resource-2',
    resource_name: 'Jane Smith',
    project_id: 'project-1',
    assignment_date: '2024-01-16',
    allocation_percentage: 60,
    capital_percentage: 40,
    expense_percentage: 20,
  },
]

describe('ResourceAssignmentCalendar - End-to-End Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock useAuth to return a user with edit permissions
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    })
  })

  describe('Complete Flow: Load → Edit → Validate → Save', () => {
    it('should complete full workflow successfully', async () => {
      const user = userEvent.setup()
      const { validateCellEdit } = await import('../../utils/cellValidation')
      
      // Mock API responses
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
      vi.mocked(assignmentsApi.update).mockResolvedValue({
        ...mockAssignments[0],
        capital_percentage: 60,
        allocation_percentage: 90,
      })
      vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })

      const onSaveSuccess = vi.fn()
      const onSaveError = vi.fn()

      // 1. LOAD: Render calendar and wait for data to load
      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
          onSaveSuccess={onSaveSuccess}
          onSaveError={onSaveError}
        />
      )

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Verify data is displayed
      expect(screen.getByText('John Doe')).toBeInTheDocument()
      expect(screen.getByText('Jane Smith')).toBeInTheDocument()

      // 2. EDIT: Enable edit mode
      const editButton = screen.getByRole('button', { name: /enable edit mode/i })
      await user.click(editButton)

      // Verify edit mode is enabled
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
        expect(screen.getByRole('button', { name: /cancel editing/i })).toBeInTheDocument()
      })

      // 3. EDIT: Modify a cell value
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      const firstCapitalInput = inputs[0] // John Doe's capital allocation on Jan 15
      
      await user.clear(firstCapitalInput)
      await user.type(firstCapitalInput, '60')

      // 4. VALIDATE: Trigger validation by tabbing out
      await user.tab()

      // Wait for validation to complete
      await waitFor(() => {
        expect(validateCellEdit).toHaveBeenCalledWith(
          'resource-1',
          expect.any(Date),
          'capital',
          60,
          'project-1'
        )
      })

      // 5. SAVE: Click save button
      const saveButton = screen.getByRole('button', { name: /save all changes/i })
      await user.click(saveButton)

      // Wait for save to complete
      await waitFor(() => {
        expect(assignmentsApi.update).toHaveBeenCalledWith('assignment-1', {
          allocation_percentage: 90, // 60 capital + 30 expense
          capital_percentage: 60,
          expense_percentage: 30,
        })
      })

      // Verify success callback was called
      expect(onSaveSuccess).toHaveBeenCalled()
      expect(onSaveError).not.toHaveBeenCalled()

      // Verify success message is displayed
      await waitFor(() => {
        expect(screen.getByText(/assignments saved successfully/i)).toBeInTheDocument()
      })

      // Verify edit mode is exited
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /save all changes/i })).not.toBeInTheDocument()
        expect(screen.getByRole('button', { name: /enable edit mode/i })).toBeInTheDocument()
      })
    })

    it('should handle validation failure during edit', async () => {
      const user = userEvent.setup()
      const { validateCellEdit } = await import('../../utils/cellValidation')
      
      // Mock API responses
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
      vi.mocked(validateCellEdit).mockResolvedValue({
        isValid: false,
        errorMessage: 'Resource is over-allocated: Total allocation is 120% across Project A (60%), Project B (40%), and this project (60%)',
      })

      const onSaveError = vi.fn()

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
          onSaveError={onSaveError}
        />
      )

      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Enable edit mode
      const editButton = screen.getByRole('button', { name: /enable edit mode/i })
      await user.click(editButton)

      // Modify a cell to trigger over-allocation
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      await user.clear(inputs[0])
      await user.type(inputs[0], '60')

      // Trigger validation
      await user.tab()

      // Wait for validation error
      await waitFor(() => {
        expect(screen.getByText(/resource is over-allocated/i)).toBeInTheDocument()
      })

      // Verify the cell value was reverted (edit was removed)
      // The input should no longer show 60
      await waitFor(() => {
        expect(inputs[0]).toHaveValue(50) // Original value
      })
    })

    it('should handle save failure and preserve edits', async () => {
      const user = userEvent.setup()
      const { validateCellEdit } = await import('../../utils/cellValidation')
      
      // Mock API responses
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
      vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
      vi.mocked(assignmentsApi.update).mockRejectedValue({
        response: { data: { detail: 'Database connection failed' } },
      })

      const onSaveError = vi.fn()

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
          onSaveError={onSaveError}
        />
      )

      // Wait for loading
      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Enable edit mode and make a change
      await user.click(screen.getByRole('button', { name: /enable edit mode/i }))
      
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      await user.clear(inputs[0])
      await user.type(inputs[0], '60')
      await user.tab()

      // Wait for validation
      await waitFor(() => {
        expect(validateCellEdit).toHaveBeenCalled()
      })

      // Try to save
      await user.click(screen.getByRole('button', { name: /save all changes/i }))

      // Wait for error
      await waitFor(() => {
        expect(screen.getByText(/database connection failed/i)).toBeInTheDocument()
      })

      // Verify error callback was called
      expect(onSaveError).toHaveBeenCalledWith('Database connection failed')

      // Verify edit mode is still active (edits preserved)
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
      
      // Verify the edited value is still in the input
      expect(inputs[0]).toHaveValue(60)
    })
  })

  describe('Error Recovery Scenarios', () => {
    it('should recover from network error during load', async () => {
      const user = userEvent.setup()
      
      // First call fails, second succeeds
      vi.mocked(assignmentsApi.getByProject)
        .mockRejectedValueOnce({ response: { data: { detail: 'Network error' } } })
        .mockResolvedValueOnce(mockAssignments)

      const { rerender } = render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
        />
      )

      // Wait for error to display
      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })

      // Trigger a re-fetch by changing projectId
      rerender(
        <ResourceAssignmentCalendar
          projectId="project-2"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
        />
      )

      // Wait for successful load
      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('should handle cancel after making edits', async () => {
      const user = userEvent.setup()
      
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
        />
      )

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Enable edit mode
      await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

      // Make changes
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      await user.clear(inputs[0])
      await user.type(inputs[0], '75')

      // Cancel
      await user.click(screen.getByRole('button', { name: /cancel editing/i }))

      // Verify edit mode is exited
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /enable edit mode/i })).toBeInTheDocument()
      })

      // Re-enter edit mode and verify changes were discarded
      await user.click(screen.getByRole('button', { name: /enable edit mode/i }))
      
      await waitFor(() => {
        const newInputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
        expect(newInputs[0]).toHaveValue(50) // Original value
      })
    })
  })

  describe('Permission-Based Access', () => {
    it('should hide edit button for users without permissions', async () => {
      const userWithoutPermissions = {
        ...mockUser,
        roles: ['VIEWER'],
        permissions: [],
      }

      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
      vi.mocked(useAuth).mockReturnValue({
        user: userWithoutPermissions,
        isAuthenticated: true,
        isLoading: false,
        login: vi.fn(),
        logout: vi.fn(),
        switchRole: vi.fn(),
      })

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
        />
      )

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Verify edit button is not present
      expect(screen.queryByRole('button', { name: /enable edit mode/i })).not.toBeInTheDocument()
    })

    it('should handle 403 error during save', async () => {
      const user = userEvent.setup()
      const { validateCellEdit } = await import('../../utils/cellValidation')
      
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
      vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
      vi.mocked(assignmentsApi.update).mockRejectedValue({
        response: { status: 403, data: { detail: 'Permission denied' } },
      })

      const onSaveError = vi.fn()

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
          onSaveError={onSaveError}
        />
      )

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Enable edit mode and make a change
      await user.click(screen.getByRole('button', { name: /enable edit mode/i }))
      
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      await user.clear(inputs[0])
      await user.type(inputs[0], '60')
      await user.tab()

      // Try to save
      await user.click(screen.getByRole('button', { name: /save all changes/i }))

      // Wait for permission error
      await waitFor(() => {
        expect(screen.getByText(/permission denied/i)).toBeInTheDocument()
      })

      expect(onSaveError).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied')
      )
    })
  })

  describe('Keyboard Navigation', () => {
    it('should support Escape key to cancel cell edit', async () => {
      const user = userEvent.setup()
      
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
        />
      )

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Enable edit mode
      await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

      // Focus on a cell and type
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      await user.clear(inputs[0])
      await user.type(inputs[0], '75')

      // Press Escape
      await user.keyboard('{Escape}')

      // Verify value was reverted
      await waitFor(() => {
        expect(inputs[0]).toHaveValue(50) // Original value
      })
    })

    it('should support Enter key to validate cell', async () => {
      const user = userEvent.setup()
      const { validateCellEdit } = await import('../../utils/cellValidation')
      
      vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
      vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })

      render(
        <ResourceAssignmentCalendar
          projectId="project-1"
          projectStartDate="2024-01-15"
          projectEndDate="2024-01-17"
        />
      )

      await waitFor(() => {
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
      })

      // Enable edit mode
      await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

      // Focus on a cell and type
      const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
      await user.clear(inputs[0])
      await user.type(inputs[0], '60')

      // Press Enter
      await user.keyboard('{Enter}')

      // Verify validation was triggered
      await waitFor(() => {
        expect(validateCellEdit).toHaveBeenCalled()
      })
    })
  })
})
