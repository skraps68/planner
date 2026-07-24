import React from 'react'
import { Box, Typography } from '@mui/material'

/**
 * The one consistent page title across the app: a fixed-weight title on the left
 * and an optional right-aligned actions slot (Create buttons, etc.). Replaces the
 * ad-hoc mix of h4/h5/h6 headers and breadcrumbs.
 */
const PageHeader: React.FC<{ title: string; actions?: React.ReactNode }> = ({ title, actions }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, minHeight: 34 }}>
    <Typography variant="h5">{title}</Typography>
    {actions ? <Box sx={{ display: 'flex', gap: 1 }}>{actions}</Box> : null}
  </Box>
)

export default PageHeader
