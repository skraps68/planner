import React from 'react'
import { Box } from '@mui/material'

/**
 * First-occurrence highlight of `term` inside `label` (case-insensitive).
 * Shared by the slim hierarchy tree and the rich hierarchical list so
 * type-ahead filtering looks identical in both views.
 */
const HighlightedLabel: React.FC<{ label: string; term: string }> = ({ label, term }) => {
  const t = term.trim().toLowerCase()
  const idx = t ? label.toLowerCase().indexOf(t) : -1
  if (idx < 0) return <>{label}</>
  return (
    <>
      {label.slice(0, idx)}
      <Box
        component="span"
        data-highlight="true"
        sx={{ backgroundColor: 'rgba(255, 213, 79, 0.6)', borderRadius: '2px' }}
      >
        {label.slice(idx, idx + t.length)}
      </Box>
      {label.slice(idx + t.length)}
    </>
  )
}

export default HighlightedLabel
