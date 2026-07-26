import React from 'react'
import { Navigate } from 'react-router-dom'
import { useUserSettings } from '../../contexts/UserSettingsContext'
import { usePermissions } from '../../hooks/usePermissions'
import { LANDING_DESTINATIONS } from '../../utils/landingDestinations'

const LandingRedirect: React.FC = () => {
  const { settings } = useUserSettings()
  const { hasPermission } = usePermissions()
  const preference = settings.navigation?.landingDestination ?? 'hierarchy'
  const destination = LANDING_DESTINATIONS.find(
    (option) =>
      option.value === preference
      && (!option.permission || hasPermission(option.permission).hasPermission),
  )

  return <Navigate to={destination?.path ?? '/portfolios'} replace />
}

export default LandingRedirect
