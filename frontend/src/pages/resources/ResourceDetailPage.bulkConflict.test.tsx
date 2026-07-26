/**
 * Bulk conflict handling for the inline resource allocation calendar on
 * ResourceDetailPage (the calendar rendered on the /resources/:id route —
 * distinct from the ResourceAssignmentCalendar component used on
 * /projects/:id).
 *
 * Contract under test: after assignmentsApi.bulkUpdate() returns a
 * partial-failure BulkUpdateResult, the calendar must:
 *  - keep only the failed cells in editedCells (clear the succeeded ones)
 *  - flag the failed cells with a validation error
 *  - surface a summary saveError with the conflict count
 *  - invalidate the assignments query so versions refresh
 *  - stay in edit mode
 *
 * Mock patterns follow ResourceAssignmentCalendar.bulkConflict.test.tsx and
 * ProjectDetailPage.calendar.test.tsx (react-router-dom / AuthContext mocks),
 * since this page's tests would otherwise hit the same provider-drift issue
 * documented in the test-repair backlog.
 */
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, createTestStore } from '../../test/test-utils'
import ResourceDetailPage from './ResourceDetailPage'
import { resourcesApi } from '../../api/resources'
import { projectsApi } from '../../api/projects'
import { assignmentsApi } from '../../api/assignments'
import { COLOR_HEADER_BG, COLOR_HEADER_FG } from '../../theme'

vi.mock('../../api/resources')
vi.mock('../../api/projects')
vi.mock('../../api/assignments')

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'resource-1' }),
    useLocation: () => ({ state: null, search: '', pathname: '/resources/resource-1' }),
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: ['manage_resources'],
    },
  }),
}))

const mockResource = {
  id: 'resource-1',
  name: 'John Doe',
  resource_type: 'LABOR' as const,
  description: '',
  worker_id: 'worker-1',
  version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const initialAssignments = [
  {
    id: 'assignment-a',
    resource_id: 'resource-1',
    project_id: 'project-a',
    project_name: 'Project Alpha',
    assignment_date: '2024-01-15',
    capital_percentage: 50,
    expense_percentage: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'assignment-b',
    resource_id: 'resource-1',
    project_id: 'project-b',
    project_name: 'Project Beta',
    assignment_date: '2024-01-15',
    capital_percentage: 30,
    expense_percentage: 0,
    version: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

// After the first (partial-failure) save, the server truth for A reflects
// the successful update; B is untouched because it conflicted.
const refreshedAssignments = [
  { ...initialAssignments[0], capital_percentage: 60, version: 2 },
  initialAssignments[1],
]

describe('ResourceDetailPage - bulk conflict handling', () => {
  let queryClient: QueryClient
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    vi.clearAllMocks()
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    store = createTestStore({
      auth: {
        user: { id: 'user-1', username: 'admin', email: 'admin@example.com', roles: ['ADMIN'], permissions: [] },
        isAuthenticated: true,
        loading: false,
      },
    })
    vi.mocked(resourcesApi.get).mockResolvedValue(mockResource as any)
    vi.mocked(assignmentsApi.getByResource)
      .mockResolvedValueOnce(initialAssignments as any)
      .mockResolvedValue(refreshedAssignments as any)
  })

  it('uses the standard table-header colors for assignment dates', async () => {
    render(<ResourceDetailPage />, { store, queryClient })

    const dateHeader = await screen.findByRole('columnheader', { name: 'Date: January 15, 2024' })
    expect(dateHeader).toHaveStyle({
      backgroundColor: COLOR_HEADER_BG,
      color: COLOR_HEADER_FG,
    })
    const percentCell = screen.getByText('%').closest('td')
    expect(percentCell).not.toBeNull()
    expect(getComputedStyle(percentCell as HTMLElement).textAlign).toBe('center')
    expect(screen.getByRole('img', {
      name: 'Allocation over time: Total Allocation %',
    })).toBeInTheDocument()
    expect(screen.getByText('Available capacity')).toBeInTheDocument()
    expect(screen.getByText('Capacity limit')).toBeInTheDocument()
  })

  it('places a filled Edit button above the assignment grid', async () => {
    const user = userEvent.setup()
    render(<ResourceDetailPage />, { store, queryClient })

    const grid = await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    const assignmentCard = grid.closest('.MuiPaper-root')
    expect(assignmentCard).not.toBeNull()

    const editButton = within(assignmentCard as HTMLElement).getByRole('button', { name: 'Edit' })
    expect(editButton).toHaveClass('MuiButton-contained')
    expect(editButton.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    await user.click(editButton)
    const cancelButton = within(assignmentCard as HTMLElement).getByRole('button', { name: 'Cancel' })
    const saveButton = within(assignmentCard as HTMLElement).getByRole('button', { name: 'Save Changes' })
    expect(cancelButton.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(saveButton.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('keeps Add Project available when the labor resource has no assignments', async () => {
    const user = userEvent.setup()
    vi.mocked(assignmentsApi.getByResource).mockReset()
    vi.mocked(assignmentsApi.getByResource).mockResolvedValue([])

    render(<ResourceDetailPage />, { store, queryClient })

    const grid = await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    expect(within(grid).getByText(/No projects assigned/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Add Project' }))
    expect(screen.getByRole('combobox', {
      name: 'Choose project to add',
    })).toBeInTheDocument()
  })

  it('adds a searched project as pinned blank rows and creates entered assignments', async () => {
    const user = userEvent.setup()
    const newProject = {
      id: 'project-gamma',
      business_id: 'PRJ-003',
      program_id: 'program-1',
      name: 'Project Gamma',
      business_sponsor: 'Sponsor',
      project_manager: 'Manager',
      technical_lead: 'Lead',
      start_date: '2024-01-16',
      end_date: '2024-01-17',
      cost_center_code: 'CC-003',
      version: 1,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    }
    vi.mocked(projectsApi.list).mockResolvedValue({
      items: [newProject],
      total: 1,
      page: 1,
      size: 100,
      pages: 1,
    } as any)
    vi.mocked(assignmentsApi.create).mockResolvedValue({
      id: 'assignment-gamma',
      resource_id: 'resource-1',
      project_id: newProject.id,
      project_name: newProject.name,
      assignment_date: '2024-01-16',
      capital_percentage: 25,
      expense_percentage: 0,
      version: 1,
    } as any)

    render(<ResourceDetailPage />, { store, queryClient })
    const grid = await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    const assignmentCard = grid.closest('.MuiPaper-root') as HTMLElement

    await user.click(within(assignmentCard).getByRole('button', { name: 'Add Project' }))

    const projectPicker = within(assignmentCard).getByRole('combobox', {
      name: 'Choose project to add',
    })
    expect(projectPicker.closest('td')).toHaveAttribute('rowspan', '2')
    await user.type(projectPicker, 'Gamma')

    await waitFor(() => {
      expect(projectsApi.list).toHaveBeenCalledWith({
        search: 'Gamma',
        page: 1,
        size: 100,
      })
    })
    await user.click(await screen.findByRole('option', { name: 'PRJ-003 · Project Gamma' }))

    const selectedPicker = within(assignmentCard).getByRole('combobox', {
      name: 'Choose project to add',
    })
    const newProjectRow = selectedPicker.closest('tr') as HTMLElement
    const existingProjectRow = within(assignmentCard).getByText('Project Alpha').closest('tr') as HTMLElement
    expect(
      newProjectRow.compareDocumentPosition(existingProjectRow)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(screen.getByRole('columnheader', {
      name: 'Date: January 16, 2024',
    })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', {
      name: 'Date: January 17, 2024',
    })).toBeInTheDocument()

    const allocationCell = within(newProjectRow).getAllByRole('button', {
      name: 'Allocation percentage',
    })[1]
    await user.click(allocationCell)
    const allocationInput = within(newProjectRow).getByRole('textbox', {
      name: 'Allocation percentage',
    })
    await user.type(allocationInput, '25')
    await user.tab()

    await user.click(within(assignmentCard).getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(assignmentsApi.create).toHaveBeenCalledWith({
        resource_id: 'resource-1',
        project_id: 'project-gamma',
        assignment_date: '2024-01-16',
        capital_percentage: 25,
        expense_percentage: 0,
      })
    })
  })

  it('shows calendar-day averages in Monthly view and returns to Daily for editing', async () => {
    const user = userEvent.setup()
    render(<ResourceDetailPage />, { store, queryClient })

    const grid = await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    await user.click(screen.getByRole('button', { name: 'Monthly view' }))

    expect(screen.getByRole('columnheader', { name: 'Month: January 2024' })).toHaveTextContent("1 '24")
    const totalRow = screen.getByText('Total Allocation').closest('tr')
    expect(totalRow).not.toBeNull()
    // 80% on one day averaged across all 31 days in January.
    expect(within(totalRow as HTMLElement).getByText('2.6')).toBeInTheDocument()

    const assignmentCard = grid.closest('.MuiPaper-root')
    const editButton = within(assignmentCard as HTMLElement).getByRole('button', { name: 'Edit' })
    await user.click(editButton)

    expect(screen.getByRole('button', { name: 'Daily view' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Weekly view' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Monthly view' })).toBeDisabled()
  })

  it('colors a weekly average over 100 percent red', async () => {
    const user = userEvent.setup()
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.UTC(2024, 0, 14 + index))
      return date.toISOString().slice(0, 10)
    })
    const overallocatedAssignments = dates.flatMap((assignmentDate, index) => ([
      {
        ...initialAssignments[0],
        id: `assignment-a-${index}`,
        assignment_date: assignmentDate,
        capital_percentage: 60,
      },
      {
        ...initialAssignments[1],
        id: `assignment-b-${index}`,
        assignment_date: assignmentDate,
        capital_percentage: 50,
      },
    ]))
    vi.mocked(assignmentsApi.getByResource).mockReset()
    vi.mocked(assignmentsApi.getByResource).mockResolvedValue(overallocatedAssignments as any)

    render(<ResourceDetailPage />, { store, queryClient })
    await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    await user.click(screen.getByRole('button', { name: 'Weekly view' }))

    const totalRow = screen.getByText('Total Allocation').closest('tr')
    const total = within(totalRow as HTMLElement).getByText('110')
    expect(total).toHaveStyle({ color: '#d32f2f' })
  })

  it('colors an exact 100 percent total black', async () => {
    const dates = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(Date.UTC(2024, 0, 14 + index))
      return date.toISOString().slice(0, 10)
    })
    const fullyAllocatedAssignments = dates.flatMap((assignmentDate, index) => ([
      {
        ...initialAssignments[0],
        id: `assignment-a-${index}`,
        assignment_date: assignmentDate,
        capital_percentage: 60,
      },
      {
        ...initialAssignments[1],
        id: `assignment-b-${index}`,
        assignment_date: assignmentDate,
        capital_percentage: 40,
      },
    ]))
    vi.mocked(assignmentsApi.getByResource).mockReset()
    vi.mocked(assignmentsApi.getByResource).mockResolvedValue(fullyAllocatedAssignments as any)

    render(<ResourceDetailPage />, { store, queryClient })
    await screen.findByRole('grid', { name: 'Resource assignment calendar' })

    const totalRow = screen.getByText('Total Allocation').closest('tr')
    const total = within(totalRow as HTMLElement).getAllByText('100')[0]
    expect(total).toHaveStyle({ color: '#000000' })
  })

  it('keeps the conflicting cell in edit mode and preserves it after a partial bulk-update failure', async () => {
    const user = userEvent.setup()

    vi.mocked(assignmentsApi.bulkUpdate).mockResolvedValueOnce({
      succeeded: [{ id: 'assignment-a', version: 2 }],
      failed: [
        {
          id: 'assignment-b',
          error: 'conflict',
          message: 'Version mismatch - assignment was modified by another user',
          current_state: { ...initialAssignments[1], version: 2 } as any,
        },
      ],
    })

    render(<ResourceDetailPage />, { store, queryClient })

    await waitFor(() => expect(screen.getByText('Project Alpha')).toBeInTheDocument())

    // Two "Edit" buttons exist on this page (resource details card, and the
    // calendar below it) — the calendar's is the second one in DOM order.
    const editButtons = screen.getAllByRole('button', { name: /^edit$/i })
    await user.click(editButtons[editButtons.length - 1])

    // Edit Project Alpha's capital cell: 50 -> 60 (will succeed)
    await user.click(screen.getByText('50'))
    const inputA = screen.getByDisplayValue('50')
    await user.clear(inputA)
    await user.type(inputA, '60')
    await user.tab()

    // Edit Project Beta's capital cell: 30 -> 40 (will conflict)
    await user.click(screen.getByText('30'))
    const inputB = screen.getByDisplayValue('30')
    await user.clear(inputB)
    await user.type(inputB, '40')
    await user.tab()

    await user.click(screen.getByRole('button', { name: /save changes/i }))

    // A summary conflict message is surfaced
    await waitFor(() => {
      expect(screen.getByText(/1 change\(s\) conflicted/i)).toBeInTheDocument()
    })

    // Still in edit mode: Save/Cancel remain, the calendar's Edit button is gone
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(1) // only the details-card Edit remains

    // The failed cell (Beta) still shows its edited value...
    const editedBetaCell = screen.getByText('40')
    expect(editedBetaCell).toBeInTheDocument()

    // ...and is flagged with an error: clicking back into it shows the red
    // error border driven by validationErrors having an entry for its key.
    await user.click(editedBetaCell)
    const reopenedInput = screen.getByDisplayValue('40')
    expect(reopenedInput).toHaveAttribute('aria-invalid', 'true')

    // The query was invalidated (refetch triggered) so versions refresh
    await waitFor(() => {
      expect(assignmentsApi.getByResource).toHaveBeenCalledTimes(2)
    })

    // The succeeded cell (Alpha) was cleared from editedCells: saving again
    // only resends the still-failed Beta assignment, proving Alpha isn't
    // still tracked as an edit.
    vi.mocked(assignmentsApi.bulkUpdate).mockResolvedValueOnce({
      succeeded: [{ id: 'assignment-b', version: 3 }],
      failed: [],
    })
    await user.tab() // commit the reopened input without changing its value
    await user.click(screen.getByRole('button', { name: /save changes/i }))

    await waitFor(() => {
      expect(assignmentsApi.bulkUpdate).toHaveBeenCalledTimes(2)
    })
    const secondCallArgs = vi.mocked(assignmentsApi.bulkUpdate).mock.calls[1][0]
    expect(secondCallArgs).toHaveLength(1)
    expect(secondCallArgs[0].id).toBe('assignment-b')

    // And the second save succeeds fully, exiting edit mode
    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /^edit$/i })).toHaveLength(2)
    })
  })
})
