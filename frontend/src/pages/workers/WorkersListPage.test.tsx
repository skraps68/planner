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

// The page imports workersApi (for workers CRUD) and workerTypesApi (for worker types CRUD).
// workerTypesApi.list() returns WorkerType[] directly (not paginated).
vi.mock('../../api/workers', () => ({
  workersApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
  workerTypesApi: {
    list: vi.fn(),
    delete: vi.fn(),
  },
}))

const worker = {
  id: 'w1',
  external_id: 'EMP001',
  name: 'Jane Doe',
  worker_type_id: 'wt1',
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
      user: {
        id: '1',
        username: 'a',
        email: 'a@e.c',
        roles: ['ADMIN'],
        permissions: [],
      },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('WorkersListPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
    vi.mocked(workersApi.list).mockResolvedValue({
      items: [worker],
      total: 1,
      page: 1,
      size: 10,
      pages: 1,
    } as any)
    // workerTypesApi.list() returns WorkerType[] directly (not paginated)
    vi.mocked(workerTypesApi.list).mockResolvedValue([workerType] as any)
  })

  it('row click navigates to the worker detail', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, {
      store: adminStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    await user.click(screen.getByText('Jane Doe'))
    expect(mockNavigate).toHaveBeenCalledWith('/workers/w1')
  })

  it('delete icon on workers tab does not navigate', async () => {
    window.confirm = () => false
    const user = userEvent.setup()
    render(<WorkersListPage />, {
      store: adminStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    const del = screen.getAllByRole('button').find((b) => b.querySelector('[data-testid="DeleteIcon"]'))!
    await user.click(del)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('row click on worker-types tab navigates to the worker type detail', async () => {
    const user = userEvent.setup()
    render(<WorkersListPage />, {
      store: adminStore(),
      queryClient: createTestQueryClient(),
    })
    // Switch to Worker Types tab
    await user.click(screen.getByRole('tab', { name: /worker types/i }))
    await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument())
    await user.click(screen.getByText('Engineer'))
    expect(mockNavigate).toHaveBeenCalledWith('/workers/types/wt1')
  })

  it('delete icon on worker-types tab does not navigate', async () => {
    window.confirm = () => false
    const user = userEvent.setup()
    render(<WorkersListPage />, {
      store: adminStore(),
      queryClient: createTestQueryClient(),
    })
    await user.click(screen.getByRole('tab', { name: /worker types/i }))
    await waitFor(() => expect(screen.getByText('Engineer')).toBeInTheDocument())
    const del = screen.getAllByRole('button').find((b) => b.querySelector('[data-testid="DeleteIcon"]'))!
    await user.click(del)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
