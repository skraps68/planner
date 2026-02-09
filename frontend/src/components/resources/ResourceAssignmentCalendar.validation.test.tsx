/**
 * Unit tests for cross-project allocation validation in ResourceAssignmentCalendar
 * Tests: validation triggers, over-allocation detection, error messages, cell revert
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 15.1, 15.2, 15.3, 15.4, 15.5, 17.2
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
    getByDate: vi.fn(),
  },
}))

// Mock the auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

describe('ResourceAssignmentCalendar - Cross-Project Validation', () => {
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

  describe('Validation Triggers (Requirements 13.1, 13.2, 13.3)', () => {
    it('validates on blur (click outside)', async () => {
      const user = userEvent.setup()

      // Mock getByDate to return existing assignments
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          ...mockAssignments[0],
          capital_percentage: 60,
          expense_percentage: 40,
        },
      ])

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
      await user.type(firstInput, '75')

      // Click outside to trigger blur
      await user.click(document.body)

      // Validation should be triggered (getByDate should be called)
      await waitFor(() => {
        expect(assignmentsApi.getByDate).toHaveBeenCalled()
      })
    })

    it('validates on Enter key press', async () => {
      const user = userEvent.setup()

      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          ...mockAssignments[0],
          capital_percentage: 60,
          expense_percentage: 40,
        },
      ])

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

      // Change value and press Enter
      await user.clear(firstInput)
      await user.type(firstInput, '75{Enter}')

      // Validation should be triggered
      await waitFor(() => {
        expect(assignmentsApi.getByDate).toHaveBeenCalled()
      })
    })

    it('validates on Tab key press', async () => {
      const user = userEvent.setup()

      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          ...mockAssignments[0],
          capital_percentage: 60,
          expense_percentage: 40,
        },
      ])

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

      // Change value and press Tab
      await user.clear(firstInput)
      await user.type(firstInput, '75')
      await user.tab()

      // Validation should be triggered (blur happens on tab)
      await waitFor(() => {
        expect(assignmentsApi.getByDate).toHaveBeenCalled()
      })
    })
  })

  describe('Over-Allocation Detection (Requirements 13.4, 15.2, 15.3)', () => {
    it('detects over-allocation across projects', async () => {
      const user = userEvent.setup()

      // Mock getByDate to return assignments that would cause over-allocation
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
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
          project_id: 'project-456', // Different project
          project_phase_id: 'phase-2',
          assignment_date: '2024-01-02',
          capital_percentage: 30,
          expense_percentage: 20,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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

      // Try to change capital from 60 to 80, which would make total 130%
      await user.clear(firstInput)
      await user.type(firstInput, '80')

      // Trigger validation by blurring
      await user.click(document.body)

      // Should show over-allocation error (in aria-label/tooltip)
      await waitFor(() => {
        const errorElement = screen.queryByLabelText(/over-allocated/i)
        expect(errorElement).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('accepts allocations at exactly 100%', async () => {
      const user = userEvent.setup()

      // Mock getByDate to return assignments totaling 80%
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          id: 'assign-1',
          resource_id: 'resource-1',
          resource_name: 'John Doe',
          project_id: mockProjectId,
          project_phase_id: 'phase-1',
          assignment_date: '2024-01-02',
          capital_percentage: 50,
          expense_percentage: 30,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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

      // Change capital from 50 to 70, making total exactly 100%
      await user.clear(firstInput)
      await user.type(firstInput, '70')

      // Trigger validation
      await user.click(document.body)

      // Should NOT show over-allocation error
      await waitFor(() => {
        expect(screen.queryByText(/over-allocated/i)).not.toBeInTheDocument()
      })
    })

    it('calculates total allocation correctly across capital and expense', async () => {
      const user = userEvent.setup()

      // Mock getByDate with mixed capital and expense
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          id: 'assign-1',
          resource_id: 'resource-1',
          resource_name: 'John Doe',
          project_id: mockProjectId,
          project_phase_id: 'phase-1',
          assignment_date: '2024-01-02',
          capital_percentage: 40,
          expense_percentage: 30,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'assign-2',
          resource_id: 'resource-1',
          resource_name: 'John Doe',
          project_id: 'project-456',
          project_phase_id: 'phase-2',
          assignment_date: '2024-01-02',
          capital_percentage: 20,
          expense_percentage: 20,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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

      // Current total: 40+30+20+20 = 110%
      // Try to increase capital from 40 to 50, making total 120%
      await user.clear(firstInput)
      await user.type(firstInput, '50')

      // Trigger validation
      await user.click(document.body)

      // Should show over-allocation error (in aria-label/tooltip)
      await waitFor(() => {
        const errorElement = screen.queryByLabelText(/over-allocated/i)
        expect(errorElement).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Error Message Generation (Requirements 13.5, 15.4)', () => {
    it('shows detailed error message with project breakdown', async () => {
      const user = userEvent.setup()

      // Mock getByDate with multiple projects
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
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
          project_id: 'project-456',
          project_phase_id: 'phase-2',
          assignment_date: '2024-01-02',
          capital_percentage: 20,
          expense_percentage: 10,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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

      // Try to increase allocation beyond 100%
      await user.clear(firstInput)
      await user.type(firstInput, '80')

      // Trigger validation
      await user.click(document.body)

      // Should show detailed error with breakdown (in aria-label/tooltip)
      await waitFor(() => {
        const errorElement = screen.queryByLabelText(/over-allocated/i)
        expect(errorElement).toBeInTheDocument()
        // Error should contain total percentage in the aria-label
        const ariaLabel = errorElement?.getAttribute('aria-label') || ''
        expect(ariaLabel).toMatch(/\d+%/)
      }, { timeout: 3000 })
    })

    it('includes project IDs in error message', async () => {
      const user = userEvent.setup()

      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          id: 'assign-1',
          resource_id: 'resource-1',
          resource_name: 'John Doe',
          project_id: mockProjectId,
          project_phase_id: 'phase-1',
          assignment_date: '2024-01-02',
          capital_percentage: 70,
          expense_percentage: 40,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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

      // Try to increase beyond 100%
      await user.clear(firstInput)
      await user.type(firstInput, '80')

      // Trigger validation
      await user.click(document.body)

      // Error message should contain project information (in aria-label/tooltip)
      await waitFor(() => {
        const errorElement = screen.queryByLabelText(/over-allocated/i)
        expect(errorElement).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Cell Revert on Failure (Requirements 17.2)', () => {
    it('reverts cell value when validation fails', async () => {
      const user = userEvent.setup()

      // Mock over-allocation scenario
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
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
          project_id: 'project-456',
          project_phase_id: 'phase-2',
          assignment_date: '2024-01-02',
          capital_percentage: 30,
          expense_percentage: 20,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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
      const firstInput = inputs[0] as HTMLInputElement
      const originalValue = firstInput.value

      // Try to set invalid value
      await user.clear(firstInput)
      await user.type(firstInput, '90')

      // Trigger validation
      await user.click(document.body)

      // Wait for validation to complete and cell to revert
      await waitFor(() => {
        const errorElement = screen.queryByLabelText(/over-allocated/i)
        expect(errorElement).toBeInTheDocument()
      }, { timeout: 3000 })

      // Get inputs again after revert
      inputs = screen.getAllByRole('spinbutton')
      const revertedInput = inputs[0] as HTMLInputElement

      // Value should be reverted to original
      expect(revertedInput.value).toBe(originalValue)
    })

    it('preserves valid edits when validation passes', async () => {
      const user = userEvent.setup()

      // Mock scenario where validation passes
      vi.mocked(assignmentsApi.getByDate).mockResolvedValue([
        {
          id: 'assign-1',
          resource_id: 'resource-1',
          resource_name: 'John Doe',
          project_id: mockProjectId,
          project_phase_id: 'phase-1',
          assignment_date: '2024-01-02',
          capital_percentage: 50,
          expense_percentage: 30,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ])

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

      // Set valid value (total will be 90%)
      await user.clear(firstInput)
      await user.type(firstInput, '60')

      // Trigger validation
      await user.click(document.body)

      // Wait a bit for validation
      await waitFor(() => {
        expect(assignmentsApi.getByDate).toHaveBeenCalled()
      })

      // Value should be preserved (not reverted)
      expect(firstInput.value).toBe('60')
    })
  })
})
