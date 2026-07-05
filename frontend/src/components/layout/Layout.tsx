import React from 'react'
import { Box } from '@mui/material'
import Header from './Header'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
          mt: '48px',
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
