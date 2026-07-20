import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import WorkerDetailPage from './WorkerDetailPage'
import { workersApi, workerTypesApi } from '../../api/workers'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useParams: () => ({ id: 'w1' }),
}))

vi.mock('../../api/workers', () => ({
  workersApi: {
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  workerTypesApi: {
    list: vi.fn(),
  },
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

const worker = {
  id: 'w1',
  external_id: 'EMP001',
  name: 'Jane Doe',
  worker_type_id: 'wt1',
  worker_type_name: 'Employee',
  current_rate: '1000.00',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const workerType = {
  id: 'wt1',
  type: 'Employee',
  description: 'Employee type',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('WorkerDetailPage rate display', () => {
  beforeEach(() => {
    vi.mocked(workersApi.get).mockResolvedValue(worker as any)
    vi.mocked(workerTypesApi.list).mockResolvedValue([workerType] as any)
  })

  it('shows the formatted rate in read mode', async () => {
    render(<WorkerDetailPage />)

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())

    expect(screen.getByText('$1,000.00')).toBeInTheDocument()
  })

  it('hides the rate value after entering edit mode', async () => {
    const user = userEvent.setup()
    render(<WorkerDetailPage />)

    await waitFor(() => expect(screen.getByText('Jane Doe')).toBeInTheDocument())
    expect(screen.getByText('$1,000.00')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /edit/i }))

    expect(screen.queryByText('$1,000.00')).not.toBeInTheDocument()
  })
})
