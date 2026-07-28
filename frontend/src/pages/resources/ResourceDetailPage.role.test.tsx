import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import ResourceDetailPage from './ResourceDetailPage'
import { resourcesApi } from '../../api/resources'
import { resourceRolesApi } from '../../api/resourceRoles'
import { assignmentsApi } from '../../api/assignments'
import { workersApi } from '../../api/workers'
import { externalReferenceTypesApi } from '../../api/externalReferenceTypes'
import { nonlaborPlansApi } from '../../api/nonlaborPlans'

let mockParams: { id: string } = { id: 'new' }
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<any>('react-router-dom')
  return {
    ...actual,
    useParams: () => mockParams,
    useLocation: () => ({ state: null, search: '', pathname: `/resources/${mockParams.id}` }),
  }
})

vi.mock('../../api/resources', () => ({
  resourcesApi: { get: vi.fn(), create: vi.fn(), update: vi.fn() },
}))
vi.mock('../../api/resourceRoles', () => ({
  resourceRolesApi: { list: vi.fn() },
}))
vi.mock('../../api/assignments', () => ({
  assignmentsApi: { getByResource: vi.fn(), bulkUpdate: vi.fn() },
}))
vi.mock('../../api/workers', () => ({
  workersApi: { get: vi.fn(), search: vi.fn() },
}))
vi.mock('../../api/externalReferenceTypes', () => ({
  externalReferenceTypesApi: { list: vi.fn() },
}))
vi.mock('../../api/nonlaborPlans', () => ({
  nonlaborPlansApi: {
    list: vi.fn(),
    setOverride: vi.fn(),
  },
}))

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

vi.mock('../../realtime/usePresence', () => ({
  usePresence: () => ({ others: [] }),
}))
vi.mock('../../realtime/useEntityLock', () => ({
  useEntityLock: () => ({ state: 'idle', holder: null, takeOver: vi.fn() }),
}))
vi.mock('../../realtime/PresenceBadge', () => ({
  PresenceBadge: () => null,
}))
vi.mock('../../realtime/LockBanner', () => ({
  LockBanner: () => null,
}))

const roles = [
  { id: 'role-default', name: 'Default', version: 1 },
  { id: 'role-eng', name: 'Engineer', version: 1 },
]

const laborResource = {
  id: 'resource-1',
  name: 'Jane Doe',
  resource_type: 'LABOR' as const,
  description: '',
  worker_id: 'worker-1',
  resource_role_id: 'role-eng',
  resource_role_name: 'Engineer',
  worker_type_name: 'Employee',
  current_rate: '1500.00',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const nonlaborResource = {
  id: 'resource-2',
  name: 'Software Subscription',
  resource_type: 'NON_LABOR' as const,
  description: 'Annual platform cost',
  external_references: [{
    id: 'reference-1',
    reference_type_id: 'reference-type-1',
    reference_type_name: 'Contract ID',
    value: 'CONTRACT123',
    version: 1,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  }],
  version: 2,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('ResourceDetailPage resource role', () => {
  beforeEach(() => {
    vi.mocked(resourceRolesApi.list).mockResolvedValue(roles as any)
    vi.mocked(assignmentsApi.getByResource).mockResolvedValue([])
    vi.mocked(workersApi.get).mockResolvedValue({ id: 'worker-1', name: 'Jane Doe' } as any)
    vi.mocked(nonlaborPlansApi.list).mockResolvedValue([])
    vi.mocked(externalReferenceTypesApi.list).mockResolvedValue([{
      id: 'reference-type-1',
      name: 'Contract ID',
      description: 'Contract identifier',
      is_active: true,
      reference_count: 1,
      version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    }])
  })

  it('create mode: shows a Resource Role select defaulting to Default', async () => {
    mockParams = { id: 'new' }
    render(<ResourceDetailPage />)

    const select = await screen.findByRole('combobox', { name: /resource role/i })
    await waitFor(() => expect(select).toHaveTextContent('Default'))
  })

  it('read mode: orders Worker, Description, and Resource Role on one line', async () => {
    mockParams = { id: 'resource-1' }
    vi.mocked(resourcesApi.get).mockResolvedValue(laborResource as any)
    render(<ResourceDetailPage />)

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    expect(screen.getByText('Engineer')).toBeInTheDocument()
    expect(screen.getByText('Worker Type: Employee, Rate: $1,500.00')).toBeInTheDocument()

    const workerCell = screen.getByText('Worker').closest('.MuiGrid-item')
    const descriptionCell = screen.getByText('Description').closest('.MuiGrid-item')
    const roleCell = screen.getByText('Resource Role').closest('.MuiGrid-item')

    expect(workerCell?.parentElement).toBe(descriptionCell?.parentElement)
    expect(descriptionCell?.parentElement).toBe(roleCell?.parentElement)
    expect(workerCell).toHaveClass('MuiGrid-grid-sm-3')
    expect(descriptionCell).toHaveClass('MuiGrid-grid-sm-4')
    expect(roleCell).toHaveClass('MuiGrid-grid-sm-3')
    expect(workerCell!.compareDocumentPosition(descriptionCell!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(descriptionCell!.compareDocumentPosition(roleCell!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('edit mode: keeps Worker Type/Rate in place (read-only) and turns Resource Role into a select', async () => {
    mockParams = { id: 'resource-1' }
    vi.mocked(resourcesApi.get).mockResolvedValue(laborResource as any)
    const user = userEvent.setup()
    render(<ResourceDetailPage />)

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('Worker Type: Employee, Rate: $1,500.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit/i }))

    // Worker Type/Rate stays exactly where it was (read-only) so the layout doesn't reflow.
    expect(screen.getByText('Worker Type: Employee, Rate: $1,500.00')).toBeInTheDocument()
    // Resource Role becomes an editable select, labelled once (no double label).
    expect(screen.getByRole('combobox', { name: /resource role/i })).toBeInTheDocument()
  })

  it('page title reflects the resource type', async () => {
    mockParams = { id: 'resource-1' }
    vi.mocked(resourcesApi.get).mockResolvedValue(laborResource as any)
    render(<ResourceDetailPage />)

    await waitFor(() => expect(screen.getByText('Resource (Labor)')).toBeInTheDocument())
  })

  it('shows and updates default references for a non-labor resource', async () => {
    mockParams = { id: 'resource-2' }
    vi.mocked(resourcesApi.get).mockResolvedValue(nonlaborResource as any)
    vi.mocked(resourcesApi.update).mockImplementation(async (_id, input) => ({
      ...nonlaborResource,
      external_references: [{
        ...nonlaborResource.external_references[0],
        value: input.external_references?.[0]?.value ?? 'CONTRACT123',
      }],
      version: 3,
    } as any))
    const user = userEvent.setup()
    render(<ResourceDetailPage />)

    expect(await screen.findByText('Contract ID: CONTRACT123')).toBeInTheDocument()
    const detailEdit = screen.getAllByRole('button', { name: 'Edit' })
      .find((button) => !button.hasAttribute('disabled'))
    expect(detailEdit).toBeDefined()
    await user.click(detailEdit!)

    const referenceInput = screen.getByRole('textbox', {
      name: 'Reference Value',
    })
    await user.clear(referenceInput)
    await user.type(referenceInput, 'CONTRACT456')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => {
      expect(resourcesApi.update).toHaveBeenCalledWith(
        'resource-2',
        expect.objectContaining({
          version: 2,
          external_references: [{
            reference_type_id: 'reference-type-1',
            value: 'CONTRACT456',
          }],
        }),
      )
    })
  })
})
