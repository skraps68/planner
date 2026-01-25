import React, { useState } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  ListItemIcon,
  Radio,
  Chip,
  Box,
  Typography,
  Divider,
} from '@mui/material'
import { useAuth } from '../../contexts/AuthContext'

interface RoleSwitcherProps {
  open: boolean
  onClose: () => void
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ open, onClose }) => {
  const { user, switchRole } = useAuth()
  const [selectedRole, setSelectedRole] = useState<string>(
    user?.roles?.[0] || ''
  )
  const [loading, setLoading] = useState(false)

  const handleRoleChange = (role: string) => {
    setSelectedRole(role)
  }

  const handleConfirm = async () => {
    if (selectedRole && selectedRole !== user?.roles?.[0]) {
      setLoading(true)
      try {
        await switchRole(selectedRole)
        onClose()
      } catch (error) {
        console.error('Failed to switch role:', error)
      } finally {
        setLoading(false)
      }
    } else {
      onClose()
    }
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

  const formatRoleType = (roleType: string) => {
    return roleType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Switch Role</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a role to switch your current permissions and access scope
        </Typography>
        <List>
          {user?.roles?.map((role, index) => (
            <React.Fragment key={role}>
              {index > 0 && <Divider />}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleRoleChange(role)}
                  selected={selectedRole === role}
                >
                  <ListItemIcon>
                    <Radio
                      checked={selectedRole === role}
                      value={role}
                      name="role-radio"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          {formatRoleType(role)}
                        </Typography>
                        <Chip
                          label={role}
                          size="small"
                          color={getRoleBadgeColor(role)}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {role === user?.roles?.[0] && (
                          <Chip
                            label="Current"
                            size="small"
                            variant="outlined"
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                        )}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {role === 'ADMIN' ? 'Full System Access' : 'Role-based Access'}
                      </Typography>
                    }
                  />
                </ListItemButton>
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading || selectedRole === user?.roles?.[0]}
        >
          {loading ? 'Switching...' : 'Switch Role'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RoleSwitcher
