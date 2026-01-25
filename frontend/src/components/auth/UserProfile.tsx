import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Avatar,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
} from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'

interface UserProfileProps {
  open: boolean
  onClose: () => void
}

const UserProfile: React.FC<UserProfileProps> = ({ open, onClose }) => {
  const { user } = useAuth()

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

  const formatRoleType = (roleType: string) => {
    return roleType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>User Profile</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
          <Avatar
            sx={{
              width: 80,
              height: 80,
              bgcolor: 'primary.main',
              fontSize: '2rem',
              mb: 2,
            }}
          >
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Typography variant="h6">{user?.username}</Typography>
          <Typography variant="body2" color="text.secondary">
            {user?.email}
          </Typography>
        </Box>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Assigned Roles
        </Typography>
        <List dense>
          {user?.roles && user.roles.length > 0 ? (
            user.roles.map((role, index) => (
              <ListItem key={index} sx={{ px: 0 }}>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <Typography variant="body2">
                        {formatRoleType(role)}
                      </Typography>
                      <Chip
                        label={role}
                        size="small"
                        color={getRoleBadgeColor(role)}
                        sx={{ height: 20, fontSize: '0.7rem' }}
                      />
                      {index === 0 && (
                        <Chip
                          label="Active"
                          size="small"
                          color="success"
                          variant="outlined"
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Typography variant="caption" color="text.secondary">
                      • {role === 'ADMIN' ? 'Full System Access' : 'Role-based Access'}
                    </Typography>
                  }
                />
              </ListItem>
            ))
          ) : (
            <ListItem sx={{ px: 0 }}>
              <ListItemText
                primary={
                  <Typography variant="body2" color="text.secondary">
                    No roles assigned
                  </Typography>
                }
              />
            </ListItem>
          )}
        </List>

        <Divider sx={{ my: 2 }} />

        <Typography variant="subtitle2" gutterBottom>
          Account Information
        </Typography>
        <List dense>
          <ListItem sx={{ px: 0 }}>
            <ListItemText
              primary="User ID"
              secondary={user?.id}
              primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              secondaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
          <ListItem sx={{ px: 0 }}>
            <ListItemText
              primary="Total Roles"
              secondary={user?.roles?.length || 0}
              primaryTypographyProps={{ variant: 'caption', color: 'text.secondary' }}
              secondaryTypographyProps={{ variant: 'body2' }}
            />
          </ListItem>
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  )
}

export default UserProfile
