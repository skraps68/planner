import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import LandingRedirect from './LandingRedirect'

let landingDestination = 'hierarchy'
let allowResources = true

vi.mock('../../contexts/UserSettingsContext', () => ({
  useUserSettings: () => ({
    settings: { navigation: { landingDestination } },
  }),
}))

vi.mock('../../hooks/usePermissions', () => ({
  usePermissions: () => ({
    hasPermission: (permission: string) => ({
      hasPermission: permission !== 'view_resources' || allowResources,
    }),
  }),
}))

const Location = () => <span data-testid="location">{useLocation().pathname}</span>

const renderRedirect = () =>
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<LandingRedirect />} />
        <Route path="*" element={<Location />} />
      </Routes>
    </MemoryRouter>,
  )

describe('LandingRedirect', () => {
  beforeEach(() => {
    landingDestination = 'hierarchy'
    allowResources = true
  })

  it('uses the preferred permitted landing destination', async () => {
    landingDestination = 'resources'
    const view = renderRedirect()
    await waitFor(() => {
      expect(view.getByTestId('location')).toHaveTextContent('/resources')
    })
  })

  it('falls back to the hierarchy when access is no longer available', async () => {
    landingDestination = 'resources'
    allowResources = false
    const view = renderRedirect()
    await waitFor(() => {
      expect(view.getByTestId('location')).toHaveTextContent('/portfolios')
    })
  })
})
