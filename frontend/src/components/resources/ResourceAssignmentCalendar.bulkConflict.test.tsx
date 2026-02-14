/**
 * Integration tests for ResourceAssignmentCalendar bulk conflict handling
 * 
 * Tests:
 * - Bulk update with mixed success/failure
 * - UI displays partial success correctly
 * - Retry of failed assignments
 * 
 * Validates: Requirements 7.3, 7.5
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, within, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import ResourceAssignmentCalendar from './ResourceAssignmentCalendar'
import { assignmentsApi } from '../../api/assignments'
import { useAuth } from '../../contexts/AuthContext'
import { User } from '../../store/slices/authSlice'
import { ResourceAssignment } from '../../types'

// Mock the assignments API
vi.mock('../../api/assignments', () => ({
  assignmentsApi: {
    getByProject: vi.fn(),
    bulkUpdate: vi.fn(),
    create: vi.fn(),
  },
}))

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

// Mock cell validation
vi.mock('../../utils/cellValidation', () => ({
  validatePercentage: vi.fn((value: number) => {
    if (value < 0 || value > 100) {
      return { isValid: false, errorMessage: 'Value must be between 0 and 100' }
    }
    return { isValid: true }
  }),
  validateCellEdit: vi.fn(() => Promise.resolve({ isValid: true })),
}))

describe('ResourceAssignmentCalendar - Bulk Conflict Handling', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  const mockProjectId = 'project-123'
  const mockStartDate = '2024-01-15'
  const mockEndDate = '2024-01-16'

  // Mock user with permissions
  const mockUser: User = {
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    isActive: true,
    roles: ['ADMIN'],
    permissions: ['manage_resources'],
  }

  // Mock assignments data
  const mockAssignments: ResourceAssignment[] = [
    {
      id: 'assignment-1',
      resource_id: 'resource-1',
      resource_name: 'John Doe',
      project_id: 'project-1',
      project_phase_id: 'phase-1',
      assignment_date: '2024-01-15',
      capital_percentage: 50,
      expense_percentage: 50,
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'assignment-2',
      resource_id: 'resource-2',
      resource_name: 'Jane Smith',
      project_id: 'project-1',
      project_phase_id: 'phase-1',
      assignment_date: '2024-01-15',
      capital_percentage: 30,
      expense_percentage: 70,
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
    {
      id: 'assignment-3',
      resource_id: 'resource-3',
      resource_name: 'Bob Johnson',
      project_id: 'project-1',
      project_phase_id: 'phase-1',
      assignment_date: '2024-01-15',
      capital_percentage: 40,
      expense_percentage: 60,
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    },
  ]

  beforeEach(() => {
    // Mock useAuth to return a user with edit permissions
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    })

    // Mock getByProject to return assignments
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue(mockAssignments)
  })

  it('handles bulk update with mixed success and failure', async () => {
    const user = userEvent.setup()
    
    // Mock bulk update with partial success
    vi.mocked(assignmentsApi.bulkUpdate).mockResolvedValue({
      succeeded: [
        { id: 'assignment-1', version: 2 },
      ],
      failed: [
        {
          id: 'assignment-2',
          error: 'conflict',
          message: 'Version mismatch - assignment was modified by another user',
          current_state: {
            id: 'assignment-2',
            resource_id: 'resource-2',
            resource_name: 'Jane Smith',
            assignment_date: '2024-01-15',
            capital_percentage: 40,
            expense_percentage: 60,
            version: 2,
          },
        },
        {
          id: 'assignment-3',
          error: 'conflict',
          message: 'Version mismatch - assignment was modified by another user',
          current_state: {
            id: 'assignment-3',
            resource_id: 'resource-3',
            resource_name: 'Bob Johnson',
            assignment_date: '2024-01-15',
            capital_percentage: 50,
            expense_percentage: 50,
            version: 2,
          },
        },
      ],
    })
    
    render(
      <ResourceAssignmentCalendar
        projectId={mockProjectId}
        projectStartDate={mockStartDate}
        projectEndDate={mockEndDate}
      />
    )
    
    // Wait for assignments to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Enter edit mode
    const editButton = screen.getByRole('button', { name: /enable edit mode/i })
    await user.click(editButton)
    
    // Wait for edit mode to be active
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
    })
    
    // Edit multiple assignments by clicking on cells
    const cells = screen.getAllByRole('gridcell')
    
    // Find John Doe's capital cell
    const johnCapitalCell = cells.find((cell) => {
      return cell.textContent === '50' && cell.getAttribute('aria-label')?.includes('John Doe') && cell.getAttribute('aria-label')?.includes('capital')
    })
    expect(johnCapitalCell).toBeDefined()
    
    // Click to activate edit
    await user.click(johnCapitalCell!)
    await waitFor(() => {
      const input = within(johnCapitalCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input1 = within(johnCapitalCell!).getByRole('textbox')
    await user.clear(input1)
    await user.type(input1, '60')
    await user.tab()
    
    // Find Jane Smith's capital cell
    const janeCapitalCell = cells.find((cell) => {
      return cell.textContent === '30' && cell.getAttribute('aria-label')?.includes('Jane Smith') && cell.getAttribute('aria-label')?.includes('capital')
    })
    expect(janeCapitalCell).toBeDefined()
    
    await user.click(janeCapitalCell!)
    await waitFor(() => {
      const input = within(janeCapitalCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input2 = within(janeCapitalCell!).getByRole('textbox')
    await user.clear(input2)
    await user.type(input2, '40')
    await user.tab()
    
    // Find Bob Johnson's capital cell
    const bobCapitalCell = cells.find((cell) => {
      return cell.textContent === '40' && cell.getAttribute('aria-label')?.includes('Bob Johnson') && cell.getAttribute('aria-label')?.includes('capital')
    })
    expect(bobCapitalCell).toBeDefined()
    
    await user.click(bobCapitalCell!)
    await waitFor(() => {
      const input = within(bobCapitalCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input3 = within(bobCapitalCell!).getByRole('textbox')
    await user.clear(input3)
    await user.type(input3, '50')
    await user.tab()
    
    // Save changes
    const saveButton = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton)
    
    // Wait for conflict dialog to appear
    await waitFor(() => {
      expect(screen.getByText(/Partial Save - Some Assignments Failed/i)).toBeInTheDocument()
    }, { timeout: 3000 })
    
    // Verify dialog shows correct information
    expect(screen.getByText(/1 assignment saved successfully/i)).toBeInTheDocument()
    expect(screen.getByText(/2 assignments failed due to conflicts/i)).toBeInTheDocument()
    
    // Verify failed assignments are listed
    expect(screen.getByText('Jane Smith - 2024-01-15')).toBeInTheDocument()
    expect(screen.getByText('Bob Johnson - 2024-01-15')).toBeInTheDocument()
  })
  
  it('displays partial success correctly in UI', async () => {
    const user = userEvent.setup()
    
    // Mock bulk update with one success, one failure
    vi.mocked(assignmentsApi.bulkUpdate).mockResolvedValue({
      succeeded: [
        { id: 'assignment-1', version: 2 },
      ],
      failed: [
        {
          id: 'assignment-2',
          error: 'conflict',
          message: 'Version mismatch',
          current_state: {
            id: 'assignment-2',
            resource_id: 'resource-2',
            resource_name: 'Jane Smith',
            assignment_date: '2024-01-15',
            capital_percentage: 40,
            expense_percentage: 60,
            version: 2,
          },
        },
      ],
    })
    
    render(
      <ResourceAssignmentCalendar
        projectId={mockProjectId}
        projectStartDate={mockStartDate}
        projectEndDate={mockEndDate}
      />
    )
    
    // Wait for assignments to load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Enter edit mode and make edits
    const editButton = screen.getByRole('button', { name: /enable edit mode/i })
    await user.click(editButton)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
    })
    
    const cells = screen.getAllByRole('gridcell')
    
    // Edit John Doe (will succeed)
    const johnCell = cells.find((cell) => {
      return cell.textContent === '50' && cell.getAttribute('aria-label')?.includes('John Doe') && cell.getAttribute('aria-label')?.includes('capital')
    })
    await user.click(johnCell!)
    await waitFor(() => {
      const input = within(johnCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input1 = within(johnCell!).getByRole('textbox')
    await user.clear(input1)
    await user.type(input1, '60')
    await user.tab()
    
    // Edit Jane Smith (will fail)
    const janeCell = cells.find((cell) => {
      return cell.textContent === '30' && cell.getAttribute('aria-label')?.includes('Jane Smith') && cell.getAttribute('aria-label')?.includes('capital')
    })
    await user.click(janeCell!)
    await waitFor(() => {
      const input = within(janeCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input2 = within(janeCell!).getByRole('textbox')
    await user.clear(input2)
    await user.type(input2, '40')
    await user.tab()
    
    // Save
    const saveButton = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton)
    
    // Wait for dialog
    await waitFor(() => {
      expect(screen.getByText(/Partial Save/i)).toBeInTheDocument()
    }, { timeout: 3000 })
    
    // Verify success count
    expect(screen.getByText(/1 assignment saved successfully/i)).toBeInTheDocument()
    
    // Verify failure count
    expect(screen.getByText(/1 assignment failed/i)).toBeInTheDocument()
    
    // Verify current version is shown
    expect(screen.getByText(/Current version: 2/i)).toBeInTheDocument()
  })
  
  it('allows retry of only failed assignments', async () => {
    const user = userEvent.setup()
    
    let bulkUpdateCallCount = 0
    
    // First call: partial success
    // Second call: all succeed
    vi.mocked(assignmentsApi.bulkUpdate).mockImplementation(async () => {
      bulkUpdateCallCount++
      
      if (bulkUpdateCallCount === 1) {
        // First attempt: one succeeds, one fails
        return {
          succeeded: [
            { id: 'assignment-1', version: 2 },
          ],
          failed: [
            {
              id: 'assignment-2',
              error: 'conflict',
              message: 'Version mismatch',
              current_state: {
                id: 'assignment-2',
                resource_id: 'resource-2',
                resource_name: 'Jane Smith',
                assignment_date: '2024-01-15',
                capital_percentage: 40,
                expense_percentage: 60,
                version: 2,
              },
            },
          ],
        }
      } else {
        // Second attempt: all succeed
        return {
          succeeded: [
            { id: 'assignment-2', version: 3 },
          ],
          failed: [],
        }
      }
    })
    
    // Mock refreshed assignments after first save
    vi.mocked(assignmentsApi.getByProject).mockImplementation(async () => {
      if (bulkUpdateCallCount >= 1) {
        return [
          {
            ...mockAssignments[0],
            capital_percentage: 60,
            version: 2,
          },
          {
            ...mockAssignments[1],
            capital_percentage: 40,
            version: 2,
          },
          mockAssignments[2],
        ]
      }
      return mockAssignments
    })
    
    render(
      <ResourceAssignmentCalendar
        projectId={mockProjectId}
        projectStartDate={mockStartDate}
        projectEndDate={mockEndDate}
      />
    )
    
    // Wait for load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Enter edit mode and make edits
    const editButton = screen.getByRole('button', { name: /enable edit mode/i })
    await user.click(editButton)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
    })
    
    const cells = screen.getAllByRole('gridcell')
    
    // Edit both assignments
    const johnCell = cells.find((cell) => {
      return cell.textContent === '50' && cell.getAttribute('aria-label')?.includes('John Doe') && cell.getAttribute('aria-label')?.includes('capital')
    })
    await user.click(johnCell!)
    await waitFor(() => {
      const input = within(johnCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input1 = within(johnCell!).getByRole('textbox')
    await user.clear(input1)
    await user.type(input1, '60')
    await user.tab()
    
    const janeCell = cells.find((cell) => {
      return cell.textContent === '30' && cell.getAttribute('aria-label')?.includes('Jane Smith') && cell.getAttribute('aria-label')?.includes('capital')
    })
    await user.click(janeCell!)
    await waitFor(() => {
      const input = within(janeCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input2 = within(janeCell!).getByRole('textbox')
    await user.clear(input2)
    await user.type(input2, '40')
    await user.tab()
    
    // First save - partial success
    const saveButton = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton)
    
    // Wait for conflict dialog
    await waitFor(() => {
      expect(screen.getByText(/Partial Save/i)).toBeInTheDocument()
    }, { timeout: 3000 })
    
    // Click "Refresh & Retry Failed"
    const retryButton = screen.getByRole('button', { name: /Refresh & Retry Failed/i })
    await user.click(retryButton)
    
    // Wait for dialog to close and data to refresh
    await waitFor(() => {
      expect(screen.queryByText(/Partial Save/i)).not.toBeInTheDocument()
    })
    
    // The failed edit should still be highlighted (in editedCells)
    // User can now click Save again to retry
    const saveButton2 = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton2)
    
    // This time all should succeed
    await waitFor(() => {
      expect(screen.queryByText(/Partial Save/i)).not.toBeInTheDocument()
    })
    
    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/Assignments saved successfully/i)).toBeInTheDocument()
    })
  })
  
  it('handles cancel in conflict dialog', async () => {
    const user = userEvent.setup()
    
    // Mock bulk update with failure
    vi.mocked(assignmentsApi.bulkUpdate).mockResolvedValue({
      succeeded: [],
      failed: [
        {
          id: 'assignment-1',
          error: 'conflict',
          message: 'Version mismatch',
          current_state: {
            id: 'assignment-1',
            resource_id: 'resource-1',
            resource_name: 'John Doe',
            assignment_date: '2024-01-15',
            capital_percentage: 60,
            expense_percentage: 40,
            version: 2,
          },
        },
      ],
    })
    
    render(
      <ResourceAssignmentCalendar
        projectId={mockProjectId}
        projectStartDate={mockStartDate}
        projectEndDate={mockEndDate}
      />
    )
    
    // Wait for load
    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument()
    })
    
    // Enter edit mode and make edit
    const editButton = screen.getByRole('button', { name: /enable edit mode/i })
    await user.click(editButton)
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save all changes/i })).toBeInTheDocument()
    })
    
    const cells = screen.getAllByRole('gridcell')
    const johnCell = cells.find((cell) => {
      return cell.textContent === '50' && cell.getAttribute('aria-label')?.includes('John Doe') && cell.getAttribute('aria-label')?.includes('capital')
    })
    await user.click(johnCell!)
    await waitFor(() => {
      const input = within(johnCell!).queryByRole('textbox')
      expect(input).toBeInTheDocument()
    })
    const input = within(johnCell!).getByRole('textbox')
    await user.clear(input)
    await user.type(input, '60')
    await user.tab()
    
    // Save
    const saveButton = screen.getByRole('button', { name: /save all changes/i })
    await user.click(saveButton)
    
    // Wait for conflict dialog
    await waitFor(() => {
      expect(screen.getByText(/Partial Save/i)).toBeInTheDocument()
    }, { timeout: 3000 })
    
    // Click Cancel
    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    await user.click(cancelButton)
    
    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByText(/Partial Save/i)).not.toBeInTheDocument()
    })
    
    // Edit mode should be exited
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /enable edit mode/i })).toBeInTheDocument()
    })
  })
})
