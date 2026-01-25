import React, { useState } from 'react'
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Avatar,
  Menu,
  MenuItem,
  Chip,
  Divider,
  ListItemIcon,
  ListItemText,
} from '@mui/material'
import {
  Menu as MenuIcon,
  AccountCircle,
  Logout,
  Settings,
  SwapHoriz,
  Notifications as NotificationsIcon,
} from '@mui/icons-material'
import { useDispatch } from 'react-redux'
import { toggleSidebar } from '../../store/slices/uiSlice'
import { useAuth } from '../../contexts/AuthContext'
import RoleSwitcher from '../auth/RoleSwitcher'
import UserProfile from '../auth/UserProfile'
import ChangePassword from '../auth/ChangePassword'

const Header: React.FC = () => {
  const dispatch = useDispatch()
  const { user, logout } = useAuth()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [roleSwitcherOpen, setRoleSwitcherOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleLogout = async () => {
    handleMenuClose()
    await logout()
  }

  const handleOpenRoleSwitcher = () => {
    handleMenuClose()
    setRoleSwitcherOpen(true)
  }

  const handleOpenProfile = () => {
    handleMenuClose()
    setProfileOpen(true)
  }

  const handleOpenChangePassword = () => {
    handleMenuClose()
    setChangePasswordOpen(true)
  }

  const getRoleBadgeColor = (roleType: string) => {
    const colors: Record<string, 'error' | 'primary' | 'success' | 'secondary' | 'warning' | 'default'> = {
      ADMIN: 'error',
      PROGRAM_MANAGER: 'primary',
      PROJECT_MANAGER: 'success',
      FINANCE_MANAGER: 'secondary',
      RESOURCE_MANAGER: 'warning',
      VIEWER: 'default',
    }
    return colors[roleType] || 'default'
  }

  const activeRole = user?.roles?.[0] // Just the role string like "ADMIN"
  const scopeText = 'Full Access' // Simplified for now

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        backgroundColor: 'white',
        color: 'text.primary',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      }}
    >
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={() => dispatch(toggleSidebar())}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1, color: 'primary.main' }}>
          Program & Project Management
        </Typography>

        <IconButton color="inherit" sx={{ mr: 2 }}>
          <NotificationsIcon />
        </IconButton>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ textAlign: 'right', mr: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
              {user?.username || 'User'}
            </Typography>
            {activeRole && (
              <Chip
                label={activeRole.replace('_', ' ')}
                size="small"
                color={getRoleBadgeColor(activeRole)}
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            )}
          </Box>
          <IconButton onClick={handleMenuOpen} size="small">
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </Avatar>
          </IconButton>
        </Box>

        <Menu
          anchorEl={anchorEl}
          open={Boolean(anchorEl)}
          onClose={handleMenuClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
        >
          <Box sx={{ px: 2, py: 1, minWidth: 250 }}>
            <Typography variant="subtitle2">{user?.username}</Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
            {scopeText && (
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                {scopeText}
              </Typography>
            )}
          </Box>
          <Divider />
          {user && user.roles.length > 1 && (
            <>
              <MenuItem onClick={handleOpenRoleSwitcher}>
                <ListItemIcon>
                  <SwapHoriz fontSize="small" />
                </ListItemIcon>
                <ListItemText>Switch Role</ListItemText>
              </MenuItem>
              <Divider />
            </>
          )}
          <MenuItem onClick={handleOpenProfile}>
            <ListItemIcon>
              <AccountCircle fontSize="small" />
            </ListItemIcon>
            <ListItemText>Profile</ListItemText>
          </MenuItem>
          <MenuItem onClick={handleOpenChangePassword}>
            <ListItemIcon>
              <Settings fontSize="small" />
            </ListItemIcon>
            <ListItemText>Change Password</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            <ListItemText>Logout</ListItemText>
          </MenuItem>
        </Menu>

        <RoleSwitcher open={roleSwitcherOpen} onClose={() => setRoleSwitcherOpen(false)} />
        <UserProfile open={profileOpen} onClose={() => setProfileOpen(false)} />
        <ChangePassword open={changePasswordOpen} onClose={() => setChangePasswordOpen(false)} />
      </Toolbar>
    </AppBar>
  )
}

export default Header
