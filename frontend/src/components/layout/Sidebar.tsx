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
  Tooltip,
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
  Lock,
} from '@mui/icons-material'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { hasPermission, Permission } from '../../utils/permissions'

interface NavItem {
  text: string
  icon: React.ReactElement
  path: string
  requiredPermission?: Permission
  requiredRole?: string
}

const navItems: NavItem[] = [
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
  { text: 'Programs', icon: <Folder />, path: '/programs', requiredPermission: 'view_programs' },
  { text: 'Projects', icon: <Assignment />, path: '/projects', requiredPermission: 'view_projects' },
  { text: 'Resources', icon: <People />, path: '/resources', requiredPermission: 'view_resources' },
  { text: 'Workers', icon: <Work />, path: '/workers', requiredPermission: 'view_workers' },
  { text: 'Actuals', icon: <Assessment />, path: '/actuals', requiredPermission: 'view_actuals' },
  { text: 'Reports', icon: <BarChart />, path: '/reports', requiredPermission: 'view_reports' },
]

const adminItems: NavItem[] = [
  { 
    text: 'User Management', 
    icon: <AdminPanelSettings />, 
    path: '/admin/users', 
    requiredRole: 'ADMIN',
    requiredPermission: 'manage_users'
  },
]

const Sidebar: React.FC = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const sidebarOpen = useSelector((state: RootState) => state.ui.sidebarOpen)
  const user = useSelector((state: RootState) => state.auth.user)

  const checkItemAccess = (item: NavItem) => {
    // Check role requirement
    if (item.requiredRole) {
      const activeRole = user?.roles?.[0]
      // Case-insensitive role comparison
      if (!activeRole || activeRole.toUpperCase() !== item.requiredRole.toUpperCase()) {
        return { hasAccess: false, reason: `Requires ${item.requiredRole} role` }
      }
    }

    // Check permission requirement
    if (item.requiredPermission) {
      const permCheck = hasPermission(user, item.requiredPermission)
      if (!permCheck.hasPermission) {
        return { hasAccess: false, reason: permCheck.reason || 'Insufficient permissions' }
      }
    }

    return { hasAccess: true }
  }

  const renderNavItem = (item: NavItem) => {
    const accessCheck = checkItemAccess(item)
    const isSelected = location.pathname.startsWith(item.path)

    const button = (
      <ListItemButton
        selected={isSelected}
        onClick={() => accessCheck.hasAccess && navigate(item.path)}
        disabled={!accessCheck.hasAccess}
        sx={{
          minHeight: 48,
          justifyContent: sidebarOpen ? 'initial' : 'center',
          px: 2.5,
          opacity: accessCheck.hasAccess ? 1 : 0.5,
          cursor: accessCheck.hasAccess ? 'pointer' : 'not-allowed',
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: sidebarOpen ? 3 : 'auto',
            justifyContent: 'center',
            color: accessCheck.hasAccess ? 'inherit' : 'text.disabled',
          }}
        >
          {accessCheck.hasAccess ? item.icon : <Lock />}
        </ListItemIcon>
        {sidebarOpen && (
          <ListItemText 
            primary={item.text}
            sx={{
              color: accessCheck.hasAccess ? 'inherit' : 'text.disabled',
            }}
          />
        )}
      </ListItemButton>
    )

    if (!accessCheck.hasAccess && accessCheck.reason) {
      return (
        <Tooltip title={accessCheck.reason} placement="right" arrow key={item.text}>
          <ListItem disablePadding sx={{ display: 'block' }}>
            {button}
          </ListItem>
        </Tooltip>
      )
    }

    return (
      <ListItem key={item.text} disablePadding sx={{ display: 'block' }}>
        {button}
      </ListItem>
    )
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
          {navItems.map((item) => renderNavItem(item))}
        </List>
        <Divider />
        <List>
          {adminItems.map((item) => renderNavItem(item))}
        </List>
      </Box>
    </Drawer>
  )
}

export default Sidebar
