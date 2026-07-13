import React from 'react'
import { Alert, Button } from '@mui/material'
import { LockHolder } from './realtimeApi'
import { LockState } from './useEntityLock'

export const LockBanner: React.FC<{
  holder?: LockHolder
  state: LockState
  onTakeOver: () => void
}> = ({ holder, state, onTakeOver }) => {
  if (state !== 'blocked') return null

  const name = holder?.name || 'another user'

  const handleTakeOver = () => {
    if (
      window.confirm(
        `${name} is currently editing this. Take over anyway? They may lose unsaved changes.`,
      )
    ) {
      onTakeOver()
    }
  }

  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={
        <Button color="inherit" size="small" onClick={handleTakeOver}>
          Take over
        </Button>
      }
    >
      Locked by {name} (auto-releases if idle)
    </Alert>
  )
}
