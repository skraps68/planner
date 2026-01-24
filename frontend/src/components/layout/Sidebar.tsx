import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
} from '@mui/material'
import {
  Dashboard,
  Folder,
  Assignment,
  People,
  Work,
  Assessment,
  BarChart,
  AdminPanelSettings,
} from '@mui/icons-material'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'

interface NavItem {
  text: string
  icon: React.ReactElement
  path: string
  requiredRole?: string
}

const navItems: NavItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Programs', icon: <Folder />, path: '/programs' },
  { text: 'Projects', icon: <Assignment />, path: '/projects' },
  { text: 'Resources', icon: <People />, path: '/resources' },
  { text: 'Workers', icon: <Work />, path: '/workers' },
  { text: 'Actuals', icon: <Assessment />, path: '/actuals' },
  { text: 'Reports', icon: <BarChart />, path: '/reports' },
]

const adminItems: NavItem[] = [
  { text: 'Admin', icon: <AdminPanelSettings />, path: '/admin', requiredRole: 'ADMIN' },
]

const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen)
  const user = useSelector((state: RootState) => state.auth.user)

  const hasRole = (requiredRole?: string) => {
    if (!requiredRole) return true
    return user?.roles.some((role) => role.role_type === requiredRole)
  }

  const drawerWidth = sidebarOpen ? 240 : 64

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          mt: 8,
          transition: 'width 0.3s',
          overflowX: 'hidden',
        },
      }}
    >
      <Box sx={{ overflow: 'auto' }}>
        <List>
          {navItems.map((item) => (
            <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
              <ListItemButton
                selected={location.pathname === item.path}
                onClick={() => navigate(item.path)}
                sx={{
                  minHeight: 48,
                  justifyContent: sidebarOpen ? 'initial' : 'center',
                  px: 2.5,
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: sidebarOpen ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                {sidebarOpen && <ListItemText primary={item.text} />}
              </ListItemButton>
            </ListItem>
          ))}
        </List>
        <Divider />
        <List>
          {adminItems
            .filter((item) => hasRole(item.requiredRole))
            .map((item) => (
              <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
                <ListItemButton
                  selected={location.pathname === item.path}
                  onClick={() => navigate(item.path)}
                  sx={{
                    minHeight: 48,
                    justifyContent: sidebarOpen ? 'initial' : 'center',
                    px: 2.5,
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: sidebarOpen ? 3 : 'auto',
                      justifyContent: 'center',
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                  {sidebarOpen && <ListItemText primary={item.text} />}
                </ListItemButton>
              </ListItem>
            ))}
        </List>
      </Box>
    </Drawer>
  )
}

export default Sidebar
