import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import PreferencesDialog from './PreferencesDialog'

const updateSettings = vi.fn()
const resetSettings = vi.fn()

vi.mock('../../contexts/UserSettingsContext', () => ({
  useUserSettings: () => ({
    settings: { navigation: { landingDestination: 'hierarchy' } },
    isSaving: false,
    saveError: null,
    updateSettings,
    resetSettings,
  }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: (permission: string) => ({
      hasPermission: permission !== 'manage_users',
    }),
  }),
}))

describe('PreferencesDialog', () => {
  beforeEach(() => {
    updateSettings.mockClear()
    resetSettings.mockClear()
  })

  it('updates the landing destination and hides inaccessible choices', async () => {
    const user = userEvent.setup()
    render(<PreferencesDialog open onClose={vi.fn()} />)

    await user.click(screen.getByLabelText('Landing page'))
    expect(screen.queryByRole('option', { name: 'Users' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('option', { name: 'Resources' }))

    expect(updateSettings).toHaveBeenCalledWith({
      navigation: { landingDestination: 'resources' },
    })
  })

  it('resets all preferences from the dialog', async () => {
    const user = userEvent.setup()
    render(<PreferencesDialog open onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Reset all preferences' }))

    expect(resetSettings).toHaveBeenCalled()
  })
})
