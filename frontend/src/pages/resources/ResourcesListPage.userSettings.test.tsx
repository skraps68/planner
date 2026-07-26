import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestQueryClient, createTestStore } from '../../test/test-utils'
import ResourcesListPage from './ResourcesListPage'
import { resourcesApi } from '../../api/resources'

const updateSettings = vi.fn()

vi.mock('../../contexts/UserSettingsContext', () => ({
  useUserSettings: () => ({
    settings: { lists: { resources: { defaultTab: 'non_labor' } } },
    updateSettings,
  }),
}))

vi.mock('../../api/resources', () => ({
  resourcesApi: { list: vi.fn() },
}))

const store = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'a', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('ResourcesListPage user settings', () => {
  beforeEach(() => {
    updateSettings.mockClear()
    window.history.pushState({}, '', '/resources')
    vi.mocked(resourcesApi.list).mockResolvedValue({
      items: [], total: 0, page: 1, size: 25, pages: 0,
    } as any)
  })

  it('uses and updates the preferred resource type', async () => {
    const user = userEvent.setup()
    render(<ResourcesListPage />, {
      store: store(),
      queryClient: createTestQueryClient(),
    })

    expect(screen.getByRole('tab', { name: 'Non-Labor' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    await user.click(screen.getByRole('tab', { name: 'Labor' }))
    expect(updateSettings).toHaveBeenCalledWith({
      lists: { resources: { defaultTab: 'labor' } },
    })
  })
})
