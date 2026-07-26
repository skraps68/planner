import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ThemeProvider } from '@mui/material/styles'
import ResourceAssignmentCalendar from './ResourceAssignmentCalendar'
import { assignmentsApi } from '../../api/assignments'
import { resourcesApi } from '../../api/resources'
import { useAuth } from '../../contexts/AuthContext'
import theme from '../../theme'

vi.mock('../../api/assignments', () => ({
  assignmentsApi: {
    getByProject: vi.fn(),
    getByDate: vi.fn(),
    create: vi.fn(),
    bulkUpdate: vi.fn(),
  },
}))

vi.mock('../../api/resources', () => ({
  resourcesApi: {
    list: vi.fn(),
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

const existingAssignment = {
  id: 'assignment-existing',
  resource_id: 'resource-existing',
  resource_name: 'Existing Resource',
  project_id: 'project-1',
  assignment_date: '2024-01-15',
  capital_percentage: 20,
  expense_percentage: 0,
  version: 1,
}

const laborResource = {
  id: 'resource-new',
  name: 'New Labor Resource',
  resource_type: 'LABOR' as const,
  description: '',
  worker_id: 'worker-1',
  version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const nonLaborResource = {
  ...laborResource,
  id: 'resource-non-labor',
  name: 'Non-Labor Resource',
  resource_type: 'NON_LABOR' as const,
}

const renderCalendar = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          <ResourceAssignmentCalendar
            projectId="project-1"
            projectStartDate="2024-01-15"
            projectEndDate="2024-01-15"
          />
        </ThemeProvider>
      </QueryClientProvider>
    </MemoryRouter>,
  )
}

describe('ResourceAssignmentCalendar add-resource workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionStorage.clear()
    vi.mocked(useAuth).mockReturnValue({
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@example.com',
        isActive: true,
        roles: ['ADMIN'],
        permissions: ['manage_resources'],
      },
      isAuthenticated: true,
      isLoading: false,
      login: vi.fn(),
      logout: vi.fn(),
      switchRole: vi.fn(),
    })
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([existingAssignment] as any)
    vi.mocked(assignmentsApi.getByDate).mockResolvedValue([])
    vi.mocked(resourcesApi.list).mockResolvedValue({
      items: [nonLaborResource, laborResource],
      total: 2,
      page: 1,
      size: 100,
      pages: 1,
    } as any)
    vi.mocked(assignmentsApi.create).mockResolvedValue({
      id: 'assignment-new',
      resource_id: laborResource.id,
      resource_name: laborResource.name,
      project_id: 'project-1',
      assignment_date: '2024-01-15',
      capital_percentage: 40,
      expense_percentage: 0,
      version: 1,
    } as any)
  })

  it('keeps Add Resource available when the project has no assignments', async () => {
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([])
    renderCalendar()

    const grid = await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    expect(within(grid).getByText(/No resources are currently assigned/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add Resource' })).toBeInTheDocument()
  })

  it('pins searched labor-resource rows at the top and creates entered assignments', async () => {
    const user = userEvent.setup()
    renderCalendar()

    const grid = await screen.findByRole('grid', { name: 'Resource assignment calendar' })
    const assignmentCard = grid.closest('.MuiPaper-root') as HTMLElement
    await user.click(within(assignmentCard).getByRole('button', { name: 'Add Resource' }))

    const resourcePicker = within(assignmentCard).getByRole('combobox', {
      name: 'Choose labor resource to add',
    })
    expect(resourcePicker.closest('td')).toHaveAttribute('rowspan', '2')
    await user.type(resourcePicker, 'New Labor')

    await waitFor(() => {
      expect(resourcesApi.list).toHaveBeenCalledWith({
        page: 1,
        size: 100,
        resource_type: 'LABOR',
        search: 'New Labor',
      })
    })
    expect(screen.queryByRole('option', { name: 'Non-Labor Resource' })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('option', { name: 'New Labor Resource' }))

    const selectedPicker = within(assignmentCard).getByRole('combobox', {
      name: 'Choose labor resource to add',
    })
    const newResourceRow = selectedPicker.closest('tr') as HTMLElement
    const existingResourceRow = within(assignmentCard)
      .getByText('Existing Resource')
      .closest('tr') as HTMLElement
    expect(
      newResourceRow.compareDocumentPosition(existingResourceRow)
      & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await user.click(within(newResourceRow).getByRole('button', {
      name: 'Allocation percentage',
    }))
    const allocationInput = within(newResourceRow).getByRole('textbox', {
      name: 'Allocation percentage',
    })
    await user.type(allocationInput, '40')
    await user.tab()

    await user.click(within(assignmentCard).getByRole('button', {
      name: 'Save all changes to resource assignments',
    }))

    await waitFor(() => {
      expect(assignmentsApi.create).toHaveBeenCalledWith({
        resource_id: 'resource-new',
        project_id: 'project-1',
        assignment_date: '2024-01-15',
        capital_percentage: 40,
        expense_percentage: 0,
      })
    })
  })
})
