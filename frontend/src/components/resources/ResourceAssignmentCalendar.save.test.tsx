import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import ResourceAssignmentCalendar from './ResourceAssignmentCalendar'
import { assignmentsApi } from '../../api/assignments'
import { useAuth } from '../../contexts/AuthContext'
import * as cellValidation from '../../utils/cellValidation'

// Mock dependencies
vi.mock('../../api/assignments')
vi.mock('../../contexts/AuthContext')
vi.mock('../../utils/cellValidation')

describe('ResourceAssignmentCalendar - Save Flow Integration Tests', () => {
  const mockUser = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    roles: ['ADMIN'],
    scopes: [{ scope_type: 'global', scope_id: null }],
  }

  const mockAssignments = [
    {
      id: 'assignment-1',
      resource_id: 'resource-1',
      resource_name: 'Resource 1',
      project_id: 'project-1',
      project_phase_id: 'phase-1',
      assignment_date: '2024-01-15',
      allocation_percentage: 80,
      capital_percentage: 50,
      expense_percentage: 50,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock useAuth
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    })

    // Mock assignmentsApi
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
    vi.mocked(assignmentsApi.update).mockResolvedValue(mockAssignments[0])
    vi.mocked(assignmentsApi.create).mockResolvedValue(mockAssignments[0])
    vi.mocked(assignmentsApi.getResourceAllocation).mockResolvedValue({
      resource_id: 'resource-1',
      assignment_date: '2024-01-15',
      total_allocation: 80,
      is_over_allocated: false,
    })

    // Mock validation functions
    vi.mocked(cellValidation.validatePercentage).mockReturnValue({
      isValid: true,
    })
    vi.mocked(cellValidation.validateCellEdit).mockResolvedValue({
      isValid: true,
    })
  })

  it('should successfully save edited cells', async () => {
    const onSaveSuccess = vi.fn()
    const user = userEvent.setup()

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        onSaveSuccess={onSaveSuccess}
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Wait for edit mode to be active
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
    })

    // Find the capital row for Resource 1
    const capitalRow = screen.getAllByText('Capital')[0].closest('tr')!
    const cells = within(capitalRow).getAllByRole('cell')
    
    // Find a cell with an input (should be a date cell with existing assignment on Jan 15)
    let inputFound = false
    let targetInput: HTMLElement | null = null
    
    for (const cell of cells) {
      try {
        const input = within(cell).getByRole('spinbutton')
        if (input && (input as HTMLInputElement).value) {
          targetInput = input
          inputFound = true
          break
        }
      } catch {
        // Cell doesn't have an input, continue
      }
    }

    expect(inputFound).toBe(true)
    expect(targetInput).not.toBeNull()

    // Edit the cell
    await user.clear(targetInput!)
    await user.type(targetInput!, '60')
    
    // Trigger blur to register the edit
    await user.tab()

    // Wait a bit for state updates
    await new Promise(resolve => setTimeout(resolve, 100))

    // Click Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Wait for save to complete
    await waitFor(() => {
      expect(assignmentsApi.update).toHaveBeenCalled()
    }, { timeout: 3000 })

    // Verify the update was called with correct data
    expect(assignmentsApi.update).toHaveBeenCalledWith('assignment-1', expect.objectContaining({
      capital_percentage: 60,
      expense_percentage: 50,
    }))

    // Verify success callback was called
    expect(onSaveSuccess).toHaveBeenCalled()

    // Verify success message is displayed
    expect(screen.getByText('Assignments saved successfully')).toBeInTheDocument()

    // Verify edit mode is exited
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('should handle validation failure during save', async () => {
    const onSaveError = vi.fn()
    const user = userEvent.setup()

    // Mock validation to fail
    vi.mocked(cellValidation.validateCellEdit).mockResolvedValue({
      isValid: false,
      errorMessage: 'Resource is over-allocated (120%)',
    })

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        onSaveError={onSaveError}
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Find and edit a cell
    const capitalRow = screen.getAllByText('Capital')[0].closest('tr')!
    const cells = within(capitalRow).getAllByRole('cell')
    const editableCell = cells[1]
    
    const input = within(editableCell).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '90')
    await user.tab()

    // Wait for validation
    await waitFor(() => {
      expect(cellValidation.validateCellEdit).toHaveBeenCalled()
    })

    // Click Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Wait for error handling
    await waitFor(() => {
      expect(onSaveError).toHaveBeenCalledWith('Please fix validation errors before saving')
    })

    // Verify error message is displayed
    expect(screen.getByText('Please fix validation errors before saving')).toBeInTheDocument()

    // Verify save was not called
    expect(assignmentsApi.update).not.toHaveBeenCalled()

    // Verify still in edit mode
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('should handle API error during save', async () => {
    const onSaveError = vi.fn()
    const user = userEvent.setup()

    // Mock API to fail
    vi.mocked(assignmentsApi.update).mockRejectedValue({
      response: {
        data: {
          detail: 'Database connection failed',
        },
      },
    })

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        onSaveError={onSaveError}
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Find and edit a cell
    const capitalRow = screen.getAllByText('Capital')[0].closest('tr')!
    const cells = within(capitalRow).getAllByRole('cell')
    const editableCell = cells[1]
    
    const input = within(editableCell).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '60')
    await user.tab()

    // Click Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Wait for error handling
    await waitFor(() => {
      expect(onSaveError).toHaveBeenCalledWith('Database connection failed')
    })

    // Verify error message is displayed
    expect(screen.getByText('Database connection failed')).toBeInTheDocument()

    // Verify still in edit mode (edits preserved)
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()
  })

  it('should handle 403 permission error during save', async () => {
    const onSaveError = vi.fn()
    const user = userEvent.setup()

    // Mock API to return 403
    vi.mocked(assignmentsApi.update).mockRejectedValue({
      response: {
        status: 403,
        data: {
          detail: 'Forbidden',
        },
      },
    })

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        onSaveError={onSaveError}
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Find and edit a cell
    const capitalRow = screen.getAllByText('Capital')[0].closest('tr')!
    const cells = within(capitalRow).getAllByRole('cell')
    const editableCell = cells[1]
    
    const input = within(editableCell).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '60')
    await user.tab()

    // Click Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Wait for error handling
    await waitFor(() => {
      expect(onSaveError).toHaveBeenCalledWith(
        'Permission denied: You do not have permission to modify resource assignments'
      )
    })

    // Verify permission error message is displayed
    expect(
      screen.getByText('Permission denied: You do not have permission to modify resource assignments')
    ).toBeInTheDocument()
  })

  it('should show loading indicator during save', async () => {
    const user = userEvent.setup()

    // Mock API to delay
    vi.mocked(assignmentsApi.update).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockAssignments[0]), 1000))
    )

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Find and edit a cell
    const capitalRow = screen.getAllByText('Capital')[0].closest('tr')!
    const cells = within(capitalRow).getAllByRole('cell')
    const editableCell = cells[1]
    
    const input = within(editableCell).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '60')
    await user.tab()

    // Click Save button
    const saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Verify loading indicator is shown
    expect(screen.getByText('Saving...')).toBeInTheDocument()

    // Verify buttons are disabled during save
    expect(saveButton).toBeDisabled()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled()
  })

  it('should preserve edits on save failure and allow retry', async () => {
    const user = userEvent.setup()

    // Mock API to fail first time, succeed second time
    let callCount = 0
    vi.mocked(assignmentsApi.update).mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        return Promise.reject({
          response: {
            data: {
              detail: 'Network error',
            },
          },
        })
      }
      return Promise.resolve(mockAssignments[0])
    })

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Click Edit button
    const editButton = screen.getByRole('button', { name: /edit/i })
    await user.click(editButton)

    // Find and edit a cell
    const capitalRow = screen.getAllByText('Capital')[0].closest('tr')!
    const cells = within(capitalRow).getAllByRole('cell')
    const editableCell = cells[1]
    
    const input = within(editableCell).getByRole('spinbutton')
    await user.clear(input)
    await user.type(input, '60')
    await user.tab()

    // Click Save button (first attempt - will fail)
    let saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Wait for error
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })

    // Verify still in edit mode with edits preserved
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument()

    // Retry save
    saveButton = screen.getByRole('button', { name: /save/i })
    await user.click(saveButton)

    // Wait for success
    await waitFor(() => {
      expect(screen.getByText('Assignments saved successfully')).toBeInTheDocument()
    })

    // Verify edit mode is exited
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument()
  })

  it('should check permissions before save', async () => {
    const onSaveError = vi.fn()

    // Mock user without permissions
    vi.mocked(useAuth).mockReturnValue({
      user: { ...mockUser, roles: ['VIEWER'] },
      login: vi.fn(),
      logout: vi.fn(),
      isAuthenticated: true,
    })

    render(
      <ResourceAssignmentCalendar
        projectId="project-1"
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        onSaveError={onSaveError}
      />
    )

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getAllByText('Resource 1')[0]).toBeInTheDocument()
    })

    // Edit button should not be visible for users without permissions
    expect(screen.queryByRole('button', { name: /edit/i })).not.toBeInTheDocument()
  })
})
