import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import WorkersListPage from './WorkersListPage'
import { workersApi, workerTypesApi } from '../../api/workers'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
}))

vi.mock('../../api/workers', () => ({
  workersApi: { list: vi.fn(), delete: vi.fn() },
  workerTypesApi: { list: vi.fn(), delete: vi.fn() },
}))

const worker = {
  id: 'w1',
  external_id: 'EMP001',
  name: 'Jane Doe',
  worker_type_id: 'wt1',
  cost_center_code: 'CC-1002',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const worker2 = {
  id: 'w2',
  external_id: 'EMP777',
  name: 'Bob Smith',
  worker_type_id: 'wt1',
  cost_center_code: 'CC-1003',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const workerType = {
  id: 'wt1',
  type: 'Engineer',
  description: 'Software engineer',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const adminStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

const viewerStore = () =>
  createTestStore({
    auth: {
      user: { id: '2', username: 'v', email: 'v@e.c', roles: ['VIEWER'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('WorkersListPage (grid)', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(workersApi.list).mockResolvedValue({
      items: [worker, worker2], total: 2, page: 1, size: 100, pages: 1,
    } as any)
    vi.mocked(workerTypesApi.list).mockResolvedValue([workerType] as any)
  })

  it('row click navigates to the worker detail', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    await user.click(screen.getByText('Jane Doe'))
    expect(mockNavigate).toHaveBeenCalledWith('/workers/w1')
  })

  it('delete icon does not navigate', async () => {
    window.confirm = () => false
    const user = userEvent.setup()
    render(<WorkersListPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    await user.click(screen.getAllByRole('button', { name: 'delete' })[0])
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('shows the Cost Center column and the worker type name', async () => {
    render(<WorkersListPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('Cost Center')).toBeInTheDocument()
    expect(screen.getByText('CC-1002')).toBeInTheDocument()
    expect(screen.getAllByText('Engineer').length).toBeGreaterThan(0)
  })

  it('hides Create Worker for a user without manage_workers', async () => {
    render(<WorkersListPage />, { store: viewerStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /create worker/i })).toBeNull()
  })

  it('quick-filter narrows by name and highlights the match', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText('Search…'), 'Jane')

    await waitFor(() => expect(screen.queryByText('Bob Smith')).toBeNull(), { timeout: 3000 })
    const mark = document.querySelector('[data-highlight]')
    expect(mark).not.toBeNull()
    expect(mark!.textContent).toBe('Jane')
  })

  it('quick-filter matches the employee (external) ID', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, { store: adminStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Search…'), 'EMP777')

    await waitFor(() => expect(screen.queryByText('Jane Doe')).toBeNull(), { timeout: 3000 })
    expect(screen.getByText('Bob Smith')).toBeInTheDocument()
  })
})
