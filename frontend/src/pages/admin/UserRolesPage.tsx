import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormControlLabel,
  Switch,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { usersApi, User, UserRole, UserRoleCreate } from '../../api/users'

const ROLE_TYPES = [
  { value: 'ADMIN', label: 'Admin', color: 'error' as const },
  { value: 'PROGRAM_MANAGER', label: 'Program Manager', color: 'primary' as const },
  { value: 'PROJECT_MANAGER', label: 'Project Manager', color: 'success' as const },
  { value: 'FINANCE_MANAGER', label: 'Finance Manager', color: 'secondary' as const },
  { value: 'RESOURCE_MANAGER', label: 'Resource Manager', color: 'warning' as const },
  { value: 'VIEWER', label: 'Viewer', color: 'info' as const },
]

const UserRolesPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newRole, setNewRole] = useState({
    role_type: '',
    is_active: true,
  })

  const fetchUserAndRoles = async () => {
    if (!id) return

    try {
      setLoading(true)
      setError(null)
      const [userData, rolesData] = await Promise.all([
        usersApi.getUser(id),
        usersApi.getUserRoles(id, false),
      ])
      setUser(userData)
      setRoles(rolesData)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load user roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUserAndRoles()
  }, [id])

  const handleAddRole = async () => {
    if (!id || !newRole.role_type) return

    try {
      const roleData: UserRoleCreate = {
        role_type: newRole.role_type,
        is_active: newRole.is_active,
      }
      await usersApi.assignRole(id, roleData)
      setAddDialogOpen(false)
      setNewRole({ role_type: '', is_active: true })
      fetchUserAndRoles()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to assign role')
    }
  }

  const handleRemoveRole = async (roleType: string) => {
    if (!id) return

    if (!window.confirm(`Are you sure you want to remove the ${roleType} role?`)) {
      return
    }

    try {
      await usersApi.removeRole(id, roleType)
      fetchUserAndRoles()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove role')
    }
  }

  const getRoleConfig = (roleType: string) => {
    return ROLE_TYPES.find((r) => r.value === roleType) || { value: roleType, label: roleType, color: 'default' as const }
  }

  const availableRoles = ROLE_TYPES.filter(
    (roleType) => !roles.some((r) => r.role_type === roleType.value && r.is_active)
  )

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error || !user) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || 'User not found'}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/admin/users')}>
          Back to Users
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate(`/admin/users/${id}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Manage Roles - {user.username}</Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Assigned Roles</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
              disabled={availableRoles.length === 0}
            >
              Add Role
            </Button>
          </Box>

          {roles.length === 0 ? (
            <Alert severity="info">No roles assigned to this user</Alert>
          ) : (
            <List>
              {roles.map((role, index) => {
                const roleConfig = getRoleConfig(role.role_type)
                return (
                  <React.Fragment key={role.id}>
                    {index > 0 && <Divider />}
                    <ListItem>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={roleConfig.label}
                              size="small"
                              color={roleConfig.color}
                            />
                            {!role.is_active && (
                              <Chip label="Inactive" size="small" variant="outlined" />
                            )}
                          </Box>
                        }
                        secondary={
                          role.scope_assignments && role.scope_assignments.length > 0 ? (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary">
                                {role.scope_assignments.length} scope assignment(s)
                              </Typography>
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              No scope assignments
                            </Typography>
                          )
                        }
                      />
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          onClick={() => navigate(`/admin/users/${id}/roles/${role.id}/scopes`)}
                          sx={{ mr: 1 }}
                        >
                          <SettingsIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          onClick={() => handleRemoveRole(role.role_type)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  </React.Fragment>
                )
              })}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Add Role Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Role</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Role Type</InputLabel>
              <Select
                value={newRole.role_type}
                onChange={(e) => setNewRole((prev) => ({ ...prev, role_type: e.target.value }))}
                label="Role Type"
              >
                {availableRoles.map((role) => (
                  <MenuItem key={role.value} value={role.value}>
                    {role.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControlLabel
              control={
                <Switch
                  checked={newRole.is_active}
                  onChange={(e) =>
                    setNewRole((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleAddRole}
            variant="contained"
            disabled={!newRole.role_type}
          >
            Add Role
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserRolesPage
