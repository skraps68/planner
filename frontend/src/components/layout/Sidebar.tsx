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
  BusinessCenter,
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
  indent?: number // Indentation level for hierarchical display
}

const navItems: NavItem[] = [
  { text: 'Portfolios', icon: <BusinessCenter />, path: '/portfolios', requiredPermission: 'view_portfolios', indent: 0 },
  { text: 'Programs', icon: <Folder />, path: '/programs', requiredPermission: 'view_programs', indent: 1 },
  { text: 'Projects', icon: <Assignment />, path: '/projects', requiredPermission: 'view_projects', indent: 2 },
  { text: 'Resources', icon: <People />, path: '/resources', requiredPermission: 'view_resources' },
  { text: 'Workers', icon: <Work />, path: '/workers', requiredPermission: 'view_workers' },
  { text: 'Actuals', icon: <Assessment />, path: '/actuals', requiredPermission: 'view_actuals' },
  { text: 'Reports', icon: <BarChart />, path: '/reports', requiredPermission: 'view_reports' },
  { text: 'Dashboard', icon: <Dashboard />, path: '/dashboard' },
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
    // Exact match or path segment match (e.g., /portfolio/123 matches /portfolio, but /portfolios doesn't)
    const isSelected = location.pathname === item.path ||
                      location.pathname.startsWith(item.path + '/')
    const indentAmount = (item.indent || 0) * 8 // 8px per indent level

    const button = (
      <ListItemButton
        selected={isSelected}
        onClick={() => accessCheck.hasAccess && navigate(item.path)}
        disabled={!accessCheck.hasAccess}
        sx={{
          minHeight: 36,
          justifyContent: sidebarOpen ? 'initial' : 'center',
          px: 1.5,
          pl: sidebarOpen ? 1.5 + indentAmount / 8 : 1.5,
          opacity: accessCheck.hasAccess ? 1 : 0.5,
          cursor: accessCheck.hasAccess ? 'pointer' : 'not-allowed',
        }}
      >
        {/* Tree elbow: marks this item as a child of the level above
            (Portfolio -> Program -> Project); purely visual, no expand/collapse */}
        {sidebarOpen && (item.indent || 0) > 0 && (
          <Box
            sx={{
              width: 8,
              height: 12,
              flexShrink: 0,
              mr: 0.75,
              transform: 'translateY(-5px)',
              borderLeft: '1.5px solid',
              borderBottom: '1.5px solid',
              borderColor: 'action.disabled',
              borderBottomLeftRadius: 4,
            }}
          />
        )}
        <ListItemIcon
          sx={{
            minWidth: 0,
            mr: sidebarOpen ? 1.5 : 'auto',
            justifyContent: 'center',
            color: accessCheck.hasAccess ? 'inherit' : 'text.disabled',
            '& .MuiSvgIcon-root': { fontSize: '1.1rem' },
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

  const drawerWidth = sidebarOpen ? 200 : 52

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          mt: '48px',
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
