/**
 * End-to-End Integration Test: Update Assignment Flow
 * 
 * Tests Requirements:
 * - 3.2: Cross-project validation on update
 * - 6.1: Calendar doesn't calculate allocation_percentage
 * - 6.2: Calendar sends only capital_percentage and expense_percentage
 * - 6.5: Calendar groups edits and sends correct data
 */

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
    capital_percentage: 50,
    expense_percentage: 30,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
  {
    id: 'assignment-2',
    resource_id: 'resource-2',
    resource_name: 'Jane Smith',
    project_id: 'project-1',
    assignment_date: '2024-01-15',
    capital_percentage: 40,
    expense_percentage: 20,
    created_at: '2024-01-15T10:00:00Z',
    updated_at: '2024-01-15T10:00:00Z',
  },
]

describe('E2E: Update Assignment Flow (Task 15.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    })
  })

  it('should update assignment through UI without allocation_percentage', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
    
    const updatedAssignment = {
      ...mockAssignments[0],
      capital_percentage: 60,
      updated_at: '2024-01-15T11:00:00Z',
    }
    vi.mocked(assignmentsApi.update).mockResolvedValue(updatedAssignment)

    const onSaveSuccess = vi.fn()

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-15"
        projectEndDate="2024-01-17"
        onSaveSuccess={onSaveSuccess}
      />
    )

    // Wait for loading
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    // Enable edit mode
    const editButton = screen.getByRole('button', { name: /enable edit mode/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
    })

    // Find and update capital percentage
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    const capitalInput = inputs[0] // John Doe's capital allocation
    
    await user.clear(capitalInput)
    await user.type(capitalInput, '60')
    await user.tab()

    // Wait for validation
    await waitFor(() => {
      expect(validateCellEdit).toHaveBeenCalled()
    })

    // Save
    const saveButton = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton)

    // Verify API call
    await waitFor(() => {
      expect(assignmentsApi.update).toHaveBeenCalled()
    })

    // CRITICAL: Verify allocation_percentage is NOT in the API call
    const updateCall = vi.mocked(assignmentsApi.update).mock.calls[0]
    const [assignmentId, payload] = updateCall
    
    expect(assignmentId).toBe('assignment-1')
    expect(payload).toHaveProperty('capital_percentage', 60)
    expect(payload).toHaveProperty('expense_percentage', 30)
    expect(payload).not.toHaveProperty('allocation_percentage')
    
    // Verify only expected fields are present
    const payloadKeys = Object.keys(payload)
    expect(payloadKeys).toContain('capital_percentage')
    expect(payloadKeys).toContain('expense_percentage')
    expect(payloadKeys).not.toContain('allocation_percentage')

    // Verify success
    expect(onSaveSuccess).toHaveBeenCalled()
  })

  it('should validate cross-project allocation when updating assignment', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    
    // Mock validation failure due to cross-project constraint
    vi.mocked(validateCellEdit).mockResolvedValue({
      isValid: false,
      errorMessage: 'Assignment would exceed 100% allocation for resource on 2024-01-15. Current total across other projects: 40%, This assignment: 70%, Would result in: 110%',
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

    // Enable edit mode
    await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

    // Try to update to a value that would cause over-allocation
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '50')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '20')
    await user.tab()

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/would exceed 100% allocation/i)).toBeInTheDocument()
    })

    // Verify update was NOT called
    expect(assignmentsApi.update).not.toHaveBeenCalled()
  })

  it('should update data correctly when validation passes', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
    
    const updatedAssignment = {
      ...mockAssignments[0],
      capital_percentage: 45,
      expense_percentage: 35,
      updated_at: '2024-01-15T11:00:00Z',
    }
    vi.mocked(assignmentsApi.update).mockResolvedValue(updatedAssignment)

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

    // Enable edit mode and update both percentages
    await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    
    // Update capital
    await user.clear(inputs[0])
    await user.type(inputs[0], '45')
    await user.tab()

    // Update expense
    await user.clear(inputs[1])
    await user.type(inputs[1], '35')
    await user.tab()

    // Save
    await user.click(screen.getByRole('button', { name: /save all changes/i }))

    // Verify data was updated correctly
    await waitFor(() => {
      expect(assignmentsApi.update).toHaveBeenCalledWith(
        'assignment-1',
        expect.objectContaining({
          capital_percentage: 45,
          expense_percentage: 35,
        })
      )
    })

    // Verify the saved data matches what was entered
    const updateCall = vi.mocked(assignmentsApi.update).mock.calls[0][1]
    expect(updateCall.capital_percentage).toBe(45)
    expect(updateCall.expense_percentage).toBe(35)
  })

  it('should handle single assignment constraint (capital + expense <= 100)', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    
    // Mock validation failure for single assignment constraint
    vi.mocked(validateCellEdit).mockResolvedValue({
      isValid: false,
      errorMessage: 'Capital + expense cannot exceed 100% for this project (would be 110%)',
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

    // Enable edit mode
    await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

    // Enter values that exceed 100% for single assignment
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '70')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '40')
    await user.tab()

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/capital \+ expense cannot exceed 100%/i)).toBeInTheDocument()
    })

    // Verify update was NOT called
    expect(assignmentsApi.update).not.toHaveBeenCalled()
  })

  it('should display clear error messages when validation fails', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    
    const errorMessage = 'Assignment would exceed 100% allocation for resource on 2024-01-15. Current total across other projects: 30%, This assignment: 80%, Would result in: 110%'
    
    vi.mocked(validateCellEdit).mockResolvedValue({
      isValid: false,
      errorMessage,
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

    // Enable edit mode and trigger validation error
    await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '60')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '20')
    await user.tab()

    // Verify the exact error message is displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('should update multiple assignments in a single save operation', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
    
    // Mock multiple successful updates
    vi.mocked(assignmentsApi.update)
      .mockResolvedValueOnce({
        ...mockAssignments[0],
        capital_percentage: 55,
        updated_at: '2024-01-15T11:00:00Z',
      })
      .mockResolvedValueOnce({
        ...mockAssignments[1],
        expense_percentage: 25,
        updated_at: '2024-01-15T11:00:00Z',
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

    // Enable edit mode
    await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

    // Update first assignment
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '55')
    await user.tab()

    // Update second assignment (assuming it's at index 3 - capital for second resource)
    if (inputs.length >= 4) {
      await user.clear(inputs[3])
      await user.type(inputs[3], '25')
      await user.tab()
    }

    // Save all
    await user.click(screen.getByRole('button', { name: /save all changes/i }))

    // Verify both updates were called
    await waitFor(() => {
      expect(assignmentsApi.update).toHaveBeenCalledTimes(2)
    })

    // Verify neither call includes allocation_percentage
    const calls = vi.mocked(assignmentsApi.update).mock.calls
    calls.forEach(call => {
      const payload = call[1]
      expect(payload).not.toHaveProperty('allocation_percentage')
      expect(payload).toHaveProperty('capital_percentage')
      expect(payload).toHaveProperty('expense_percentage')
    })
  })

  it('should preserve original values when update is cancelled', async () => {
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
    const originalValue = inputs[0].value
    
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

    // Verify update was never called
    expect(assignmentsApi.update).not.toHaveBeenCalled()
  })
})
