/**
 * End-to-End Integration Test: Create Assignment Flow
 * 
 * Tests Requirements:
 * - 3.1: Cross-project validation on create
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

describe('E2E: Create Assignment Flow (Task 15.1)', () => {
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

  it('should create assignment through UI without allocation_percentage', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    // Mock empty project (no existing assignments)
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    
    // Mock successful create
    const createdAssignment = {
      id: 'new-assignment-1',
      resource_id: 'resource-1',
      resource_name: 'John Doe',
      project_id: 'project-1',
      assignment_date: '2024-01-15',
      capital_percentage: 40,
      expense_percentage: 30,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    }
    vi.mocked(assignmentsApi.create).mockResolvedValue(createdAssignment)
    vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })

    const onSaveSuccess = vi.fn()

    // Render calendar
    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-15"
        projectEndDate="2024-01-17"
        onSaveSuccess={onSaveSuccess}
      />
    )

    // Wait for loading to complete
    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
    })

    // Enable edit mode
    const editButton = screen.getByRole('button', { name: /enable edit mode/i })
    await user.click(editButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
    })

    // Find input fields for a new assignment
    // Note: The actual implementation may vary, but we're looking for capital/expense inputs
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    
    // Enter capital percentage
    const capitalInput = inputs[0]
    await user.clear(capitalInput)
    await user.type(capitalInput, '40')
    await user.tab()

    // Enter expense percentage
    const expenseInput = inputs[1]
    await user.clear(expenseInput)
    await user.type(expenseInput, '30')
    await user.tab()

    // Wait for validation
    await waitFor(() => {
      expect(validateCellEdit).toHaveBeenCalled()
    })

    // Save the assignment
    const saveButton = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton)

    // Verify API call was made with correct data structure
    await waitFor(() => {
      expect(assignmentsApi.create).toHaveBeenCalled()
    })

    // CRITICAL: Verify allocation_percentage is NOT in the API call
    const createCall = vi.mocked(assignmentsApi.create).mock.calls[0]
    const payload = createCall[0]
    
    expect(payload).toHaveProperty('capital_percentage', 40)
    expect(payload).toHaveProperty('expense_percentage', 30)
    expect(payload).not.toHaveProperty('allocation_percentage')
    
    // Verify only expected fields are present
    const payloadKeys = Object.keys(payload)
    expect(payloadKeys).toContain('resource_id')
    expect(payloadKeys).toContain('project_id')
    expect(payloadKeys).toContain('assignment_date')
    expect(payloadKeys).toContain('capital_percentage')
    expect(payloadKeys).toContain('expense_percentage')
    expect(payloadKeys).not.toContain('allocation_percentage')

    // Verify success callback
    expect(onSaveSuccess).toHaveBeenCalled()

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/assignments saved successfully/i)).toBeInTheDocument()
    })
  })

  it('should validate cross-project allocation when creating assignment', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    // Mock empty project
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    
    // Mock validation failure due to cross-project constraint
    vi.mocked(validateCellEdit).mockResolvedValue({
      isValid: false,
      errorMessage: 'Total allocation across all projects would exceed 100% (current: 60%, this project: 50%, total: 110%)',
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

    // Enter values that would cause over-allocation
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '30')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '20')
    await user.tab()

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/total allocation across all projects would exceed 100%/i)).toBeInTheDocument()
    })

    // Verify create was NOT called
    expect(assignmentsApi.create).not.toHaveBeenCalled()
  })

  it('should save data correctly when validation passes', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
    
    const createdAssignment = {
      id: 'new-assignment-1',
      resource_id: 'resource-1',
      project_id: 'project-1',
      assignment_date: '2024-01-15',
      capital_percentage: 25,
      expense_percentage: 25,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    }
    vi.mocked(assignmentsApi.create).mockResolvedValue(createdAssignment)

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

    // Enable edit mode and create assignment
    await user.click(screen.getByRole('button', { name: /enable edit mode/i }))

    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '25')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '25')
    await user.tab()

    // Save
    await user.click(screen.getByRole('button', { name: /save all changes/i }))

    // Verify data was saved correctly
    await waitFor(() => {
      expect(assignmentsApi.create).toHaveBeenCalledWith(
        expect.objectContaining({
          capital_percentage: 25,
          expense_percentage: 25,
        })
      )
    })

    // Verify the saved data matches what was entered
    const createCall = vi.mocked(assignmentsApi.create).mock.calls[0][0]
    expect(createCall.capital_percentage).toBe(25)
    expect(createCall.expense_percentage).toBe(25)
  })

  it('should handle single assignment constraint (capital + expense <= 100)', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    
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
    await user.type(inputs[0], '60')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '50')
    await user.tab()

    // Wait for validation error
    await waitFor(() => {
      expect(screen.getByText(/capital \+ expense cannot exceed 100%/i)).toBeInTheDocument()
    })

    // Verify create was NOT called
    expect(assignmentsApi.create).not.toHaveBeenCalled()
  })

  it('should display clear error messages when validation fails', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    
    const errorMessage = 'Assignment would exceed 100% allocation for resource on 2024-01-15. Current total across other projects: 70%, This assignment: 40%, Would result in: 110%'
    
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
    await user.type(inputs[0], '25')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '15')
    await user.tab()

    // Verify the exact error message is displayed
    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument()
    })
  })

  it('should create multiple assignments in a single save operation', async () => {
    const user = userEvent.setup()
    const { validateCellEdit } = await import('../../utils/cellValidation')
    
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    vi.mocked(validateCellEdit).mockResolvedValue({ isValid: true })
    
    // Mock multiple successful creates
    vi.mocked(assignmentsApi.create)
      .mockResolvedValueOnce({
        id: 'assignment-1',
        resource_id: 'resource-1',
        project_id: 'project-1',
        assignment_date: '2024-01-15',
        capital_percentage: 30,
        expense_percentage: 20,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      })
      .mockResolvedValueOnce({
        id: 'assignment-2',
        resource_id: 'resource-2',
        project_id: 'project-1',
        assignment_date: '2024-01-15',
        capital_percentage: 25,
        expense_percentage: 15,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
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

    // Create first assignment
    const inputs = screen.getAllByRole('spinbutton', { name: /allocation percentage/i })
    await user.clear(inputs[0])
    await user.type(inputs[0], '30')
    await user.tab()

    await user.clear(inputs[1])
    await user.type(inputs[1], '20')
    await user.tab()

    // Create second assignment (assuming multiple resources)
    if (inputs.length >= 4) {
      await user.clear(inputs[2])
      await user.type(inputs[2], '25')
      await user.tab()

      await user.clear(inputs[3])
      await user.type(inputs[3], '15')
      await user.tab()
    }

    // Save all
    await user.click(screen.getByRole('button', { name: /save all changes/i }))

    // Verify both creates were called
    await waitFor(() => {
      expect(assignmentsApi.create).toHaveBeenCalledTimes(2)
    })

    // Verify neither call includes allocation_percentage
    const calls = vi.mocked(assignmentsApi.create).mock.calls
    calls.forEach(call => {
      expect(call[0]).not.toHaveProperty('allocation_percentage')
      expect(call[0]).toHaveProperty('capital_percentage')
      expect(call[0]).toHaveProperty('expense_percentage')
    })
  })
})
