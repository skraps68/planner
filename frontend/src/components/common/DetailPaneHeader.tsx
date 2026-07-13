import React from 'react'
import { Box, IconButton, Typography } from '@mui/material'
import { Close } from '@mui/icons-material'

interface DetailPaneHeaderProps {
  title: string
  statusChip?: React.ReactNode
  onClose: () => void
}

/**
 * Header row for a detail page rendered in the Portfolios shell content pane:
 * title + status chip on the left, ✕ close (back to the rich list) on the right.
 * Replaces the removed breadcrumb bar.
 */
const DetailPaneHeader: React.FC<DetailPaneHeaderProps> = ({ title, statusChip, onClose }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
    <Typography variant="h6" noWrap title={title}>
      {title}
    </Typography>
    {statusChip}
    <Box sx={{ flex: 1 }} />
    <IconButton aria-label="Close detail" size="small" onClick={onClose}>
      <Close fontSize="small" />
    </IconButton>
  </Box>
)

export default DetailPaneHeader
