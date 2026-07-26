import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { UserSettingsProvider, useUserSettings } from './UserSettingsContext'
import { userSettingsApi } from '../api/userSettings'

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'u1', username: 'user' },
    isAuthenticated: true,
  }),
}))

vi.mock('../api/userSettings', () => ({
  userSettingsApi: {
    get: vi.fn(),
    patch: vi.fn(),
    reset: vi.fn(),
  },
}))

const response = {
  settings_schema_version: 1,
  settings: {
    navigation: {
      hierarchyPane: { width: 320, collapsed: false },
      landingDestination: 'resources' as const,
    },
  },
  version: 3,
  created_at: '2026-07-26T12:00:00Z',
  updated_at: '2026-07-26T12:00:00Z',
}

const Probe = () => {
  const { settings, updateSettings, resetSettings } = useUserSettings()
  return (
    <>
      <span data-testid="width">{settings.navigation?.hierarchyPane?.width}</span>
      <button
        onClick={() =>
          updateSettings({ navigation: { hierarchyPane: { width: 388 } } })
        }
      >
        Resize
      </button>
      <button onClick={() => void resetSettings()}>Reset</button>
    </>
  )
}

describe('UserSettingsProvider', () => {
  beforeEach(() => {
    localStorage.clear()
    sessionStorage.clear()
    vi.clearAllMocks()
    vi.mocked(userSettingsApi.get).mockResolvedValue(response)
    vi.mocked(userSettingsApi.patch).mockResolvedValue({
      ...response,
      version: 4,
      settings: {
        ...response.settings,
        navigation: {
          ...response.settings.navigation,
          hierarchyPane: { width: 388, collapsed: false },
        },
      },
    })
    vi.mocked(userSettingsApi.reset).mockResolvedValue({
      ...response,
      version: 5,
      settings: {},
    })
  })

  it('loads settings and debounces automatic preference saves', async () => {
    const user = userEvent.setup()
    render(
      <UserSettingsProvider>
        <Probe />
      </UserSettingsProvider>,
    )

    expect(await screen.findByTestId('width')).toHaveTextContent('320')
    await user.click(screen.getByRole('button', { name: 'Resize' }))
    expect(screen.getByTestId('width')).toHaveTextContent('388')

    await waitFor(
      () => {
        expect(userSettingsApi.patch).toHaveBeenCalledWith(3, {
          navigation: { hierarchyPane: { width: 388 } },
        })
      },
      { timeout: 2000 },
    )
  })

  it('resets the document to application defaults', async () => {
    const user = userEvent.setup()
    render(
      <UserSettingsProvider>
        <Probe />
      </UserSettingsProvider>,
    )

    expect(await screen.findByTestId('width')).toHaveTextContent('320')
    await user.click(screen.getByRole('button', { name: 'Reset' }))

    await waitFor(() => expect(userSettingsApi.reset).toHaveBeenCalled())
    expect(screen.getByTestId('width')).toHaveTextContent('')
  })
})
