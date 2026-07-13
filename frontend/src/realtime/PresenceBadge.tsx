import React from 'react'
import { Chip, Tooltip } from '@mui/material'
import PeopleIcon from '@mui/icons-material/People'
import { PresentUser } from './usePresence'

export const PresenceBadge: React.FC<{ others: PresentUser[] }> = ({ others }) => {
  if (others.length === 0) return null
  const names = others.map((o) => o.name).join(', ')
  return (
    <Tooltip title={`Editing now: ${names}`}>
      <Chip
        size="small"
        color="warning"
        icon={<PeopleIcon />}
        label={`${others.length} editing`}
        sx={{ ml: 1 }}
      />
    </Tooltip>
  )
}
