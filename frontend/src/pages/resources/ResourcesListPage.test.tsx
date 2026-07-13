import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import ResourcesListPage from './ResourcesListPage'
import { resourcesApi } from '../../api/resources'

vi.mock('../../api/resources', () => ({
  resourcesApi: { list: vi.fn() },
}))

const adminStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

const renderPage = () =>
  render(<ResourcesListPage />, { store: adminStore(), queryClient: createTestQueryClient() })

describe('ResourcesListPage tab persistence', () => {
  beforeEach(() => {
    vi.mocked(resourcesApi.list).mockResolvedValue({
      items: [], total: 0, page: 1, size: 25, pages: 0,
    } as any)
  })

  it('defaults to the Labor tab with no query param', () => {
    window.history.pushState({}, '', '/resources')
    renderPage()
    expect(screen.getByRole('tab', { name: 'Labor' })).toHaveAttribute('aria-selected', 'true')
  })

  it('restores the Non-Labor tab from ?tab=1 (the URL the back button returns to)', () => {
    window.history.pushState({}, '', '/resources?tab=1')
    renderPage()
    expect(screen.getByRole('tab', { name: 'Non-Labor' })).toHaveAttribute('aria-selected', 'true')
  })

  it('reflects the active tab in the URL when switched', async () => {
    window.history.pushState({}, '', '/resources')
    const user = userEvent.setup()
    renderPage()

    await user.click(screen.getByRole('tab', { name: 'Non-Labor' }))
    await waitFor(() => expect(window.location.search).toBe('?tab=1'))

    await user.click(screen.getByRole('tab', { name: 'Labor' }))
    // tab 0 is the default, so the param is dropped rather than set to 0
    await waitFor(() => expect(window.location.search).toBe(''))
  })
})
