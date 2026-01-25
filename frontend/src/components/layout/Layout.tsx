import React from 'react'
import { Box } from '@mui/material'
import Header from './Header'
import Sidebar from './Sidebar'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

interface LayoutProps {
  children: React.ReactNode
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen)

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', width: '100%' }}>
      <Header />
      <Sidebar />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          mt: 8,
          width: '100%',
          maxWidth: '100%',
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

export default Layout
