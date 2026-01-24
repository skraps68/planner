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
import { UserRole } from '../../store/slices/authSlice'

interface RoleSwitcherProps {
  open: boolean
  onClose: () => void
}

const RoleSwitcher: React.FC<RoleSwitcherProps> = ({ open, onClose }) => {
  const { user, switchRole } = useAuth()
  const [selectedRole, setSelectedRole] = useState<string>(
    user?.activeRole?.id || user?.roles[0]?.id || ''
  )
  const [loading, setLoading] = useState(false)

  const handleRoleChange = (roleId: string) => {
    setSelectedRole(roleId)
  }

  const handleConfirm = async () => {
    if (selectedRole && selectedRole !== user?.activeRole?.id) {
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

  const getScopeDescription = (role: UserRole) => {
    if (!role.scopes || role.scopes.length === 0) {
      return 'No scope assigned'
    }

    const scopeTexts = role.scopes.map((scope) => {
      if (scope.scope_type === 'GLOBAL') return 'Full System Access'
      if (scope.scope_type === 'PROGRAM') return `Program: ${scope.program_name || 'Unknown'}`
      if (scope.scope_type === 'PROJECT') return `Project: ${scope.project_name || 'Unknown'}`
      return ''
    })

    return scopeTexts.filter(Boolean).join(', ')
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Switch Role</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select a role to switch your current permissions and access scope
        </Typography>
        <List>
          {user?.roles.map((role, index) => (
            <React.Fragment key={role.id}>
              {index > 0 && <Divider />}
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => handleRoleChange(role.id)}
                  selected={selectedRole === role.id}
                >
                  <ListItemIcon>
                    <Radio
                      checked={selectedRole === role.id}
                      value={role.id}
                      name="role-radio"
                    />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body1">
                          {formatRoleType(role.role_type)}
                        </Typography>
                        <Chip
                          label={role.role_type}
                          size="small"
                          color={getRoleBadgeColor(role.role_type)}
                          sx={{ height: 20, fontSize: '0.7rem' }}
                        />
                        {role.id === user?.activeRole?.id && (
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
                        {getScopeDescription(role)}
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
          disabled={loading || selectedRole === user?.activeRole?.id}
        >
          {loading ? 'Switching...' : 'Switch Role'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default RoleSwitcher
