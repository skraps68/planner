import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, createTestStore, createTestQueryClient } from '../../test/test-utils'
import userEvent from '@testing-library/user-event'
import UsersListPage from './UsersListPage'
import { usersApi } from '../../api/users'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('../../api/users', () => ({
  usersApi: { listUsers: vi.fn(), deleteUser: vi.fn() },
}))

const mkUser = (id: string, username: string) => ({
  id,
  username,
  email: `${username}@example.com`,
  is_active: true,
  user_roles: [],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

describe('UsersListPage column filter', () => {
  beforeEach(() => {
    vi.mocked(usersApi.listUsers).mockResolvedValue({
      items: [mkUser('1', 'admin'), mkUser('2', 'resource_mgr'), mkUser('3', 'viewer')],
      total: 3, page: 1, size: 1000, pages: 1,
    } as any)
  })

  it('username contains "res" keeps resource_mgr and drops the rest', async () => {
    const user = userEvent.setup()
    render(<UsersListPage />, { store: createTestStore(), queryClient: createTestQueryClient() })
    await waitFor(() => expect(screen.getByText('resource_mgr')).toBeInTheDocument())

    // Open the grid's filter panel and type into the value field
    await user.click(screen.getByRole('button', { name: /filters/i }))
    const valueInput = await screen.findByPlaceholderText(/filter value/i)
    await user.type(valueInput, 'res')

    // resource_mgr stays; admin/viewer filtered out (contains is case-insensitive substring)
    await waitFor(() => expect(screen.queryByText('admin')).toBeNull(), { timeout: 3000 })
    expect(screen.getByText('resource_mgr')).toBeInTheDocument()
    expect(screen.queryByText('viewer')).toBeNull()
  })
})
