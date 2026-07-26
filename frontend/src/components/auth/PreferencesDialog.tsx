import React, { useMemo, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from '@mui/material'
import { useUserSettings } from '../../contexts/UserSettingsContext'
import { usePermissions } from '../../hooks/usePermissions'
import { LANDING_DESTINATIONS } from '../../utils/landingDestinations'
import type { LandingDestination } from '../../types/userSettings'

interface PreferencesDialogProps {
  open: boolean
  onClose: () => void
}

const PreferencesDialog: React.FC<PreferencesDialogProps> = ({ open, onClose }) => {
  const { settings, isSaving, saveError, updateSettings, resetSettings } = useUserSettings()
  const { hasPermission } = usePermissions()
  const [resetError, setResetError] = useState<string | null>(null)
  const destinations = useMemo(
    () => LANDING_DESTINATIONS.filter(
      (destination) =>
        !destination.permission || hasPermission(destination.permission).hasPermission,
    ),
    [hasPermission],
  )
  const preferredLanding = settings.navigation?.landingDestination ?? 'hierarchy'
  const landingDestination = destinations.some(
    (destination) => destination.value === preferredLanding,
  )
    ? preferredLanding
    : 'hierarchy'

  const handleLandingChange = (value: LandingDestination) => {
    updateSettings({ navigation: { landingDestination: value } })
  }

  const handleReset = async () => {
    setResetError(null)
    try {
      await resetSettings()
    } catch {
      setResetError('Preferences could not be reset. Please try again.')
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Preferences</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          <FormControl fullWidth>
            <InputLabel id="landing-page-label">Landing page</InputLabel>
            <Select
              labelId="landing-page-label"
              label="Landing page"
              value={landingDestination}
              onChange={(event) =>
                handleLandingChange(event.target.value as LandingDestination)
              }
            >
              {destinations.map((destination) => (
                <MenuItem key={destination.value} value={destination.value}>
                  {destination.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Typography variant="body2" color="text.secondary">
            Other presentation preferences are saved automatically as you use their controls.
          </Typography>
          {(saveError || resetError) && (
            <Alert severity="error">{resetError ?? saveError}</Alert>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between' }}>
        <Button color="secondary" onClick={handleReset} disabled={isSaving}>
          Reset all preferences
        </Button>
        <Button variant="contained" onClick={onClose}>
          Done
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default PreferencesDialog
