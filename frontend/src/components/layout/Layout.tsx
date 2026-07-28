import React from 'react'
import { Box } from '@mui/material'
import Header from './Header'
import { useRealtime } from '../../realtime/useRealtime'
import { APP_HEADER_HEIGHT } from '../../theme'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  useRealtime()
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Header />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          mt: `${APP_HEADER_HEIGHT}px`,
          width: '100%',
          maxWidth: '100%',
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout
