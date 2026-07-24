import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, createTestStore, createTestQueryClient } from '../../test/test-utils'
import UsersListPage from './UsersListPage'
import { usersApi } from '../../api/users'

vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => vi.fn(),
}))

vi.mock('../../api/users', () => ({
  usersApi: { listUsers: vi.fn(), deleteUser: vi.fn() },
}))

describe('UsersListPage', () => {
  beforeEach(() => {
    vi.mocked(usersApi.listUsers).mockResolvedValue({ items: [], total: 0, page: 1, size: 1000, pages: 0 } as any)
  })

  it('renders the page title and the grid quick-filter toolbar', async () => {
    render(<UsersListPage />, { store: createTestStore(), queryClient: createTestQueryClient() })
    expect(screen.getByText('User Management')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /create user/i })).toBeInTheDocument()
  })
})
