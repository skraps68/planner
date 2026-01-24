import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  Grid,
  Typography,
  Alert,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from '@mui/material'
import {
  Edit as EditIcon,
  ArrowBack as ArrowBackIcon,
  Security as SecurityIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { usersApi, User } from '../../api/users'

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUser = async () => {
      if (!id) return

      try {
        setLoading(true)
        setError(null)
        const userData = await usersApi.getUser(id)
        setUser(userData)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load user')
        console.error('Error fetching user:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchUser()
  }, [id])

  const getRoleBadgeColor = (roleType: string): 'error' | 'primary' | 'success' | 'secondary' | 'warning' | 'info' => {
    switch (roleType) {
      case 'ADMIN':
        return 'error'
      case 'PROGRAM_MANAGER':
        return 'primary'
      case 'PROJECT_MANAGER':
        return 'success'
      case 'FINANCE_MANAGER':
        return 'secondary'
      case 'RESOURCE_MANAGER':
        return 'warning'
      case 'VIEWER':
        return 'info'
      default:
        return 'info'
    }
  }

  const getScopeTypeLabel = (scopeType: string): string => {
    switch (scopeType) {
      case 'PROGRAM':
        return 'Program'
      case 'PROJECT':
        return 'Project'
      case 'GLOBAL':
        return 'Global'
      default:
        return scopeType
    }
  }

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton onClick={() => navigate('/admin/users')}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h4">User Details</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<HistoryIcon />}
            onClick={() => navigate(`/admin/users/${id}/audit`)}
          >
            View Audit Trail
          </Button>
          <Button
            variant="outlined"
            startIcon={<SecurityIcon />}
            onClick={() => navigate(`/admin/users/${id}/roles`)}
          >
            Manage Roles
          </Button>
          <Button
            variant="contained"
            startIcon={<EditIcon />}
            onClick={() => navigate(`/admin/users/${id}/edit`)}
          >
            Edit User
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Basic Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Username
                  </Typography>
                  <Typography variant="body1">{user.username}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography variant="body1">{user.email}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={user.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={user.is_active ? 'success' : 'default'}
                    />
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Created
                  </Typography>
                  <Typography variant="body1">
                    {new Date(user.created_at).toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Last Updated
                  </Typography>
                  <Typography variant="body1">
                    {new Date(user.updated_at).toLocaleString()}
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Roles & Permissions
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {user.user_roles && user.user_roles.length > 0 ? (
                <List>
                  {user.user_roles.map((role) => (
                    <ListItem key={role.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Chip
                              label={role.role_type.replace('_', ' ')}
                              size="small"
                              color={getRoleBadgeColor(role.role_type)}
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
                                Scopes:
                              </Typography>
                              {role.scope_assignments.map((scope) => (
                                <Box key={scope.id} sx={{ ml: 2, mt: 0.5 }}>
                                  <Typography variant="body2">
                                    • {getScopeTypeLabel(scope.scope_type)}
                                    {scope.program_name && `: ${scope.program_name}`}
                                    {scope.project_name && `: ${scope.project_name}`}
                                    {!scope.is_active && ' (Inactive)'}
                                  </Typography>
                                </Box>
                              ))}
                            </Box>
                          ) : (
                            <Typography variant="body2" color="text.secondary">
                              No scope assignments
                            </Typography>
                          )
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              ) : (
                <Alert severity="info">No roles assigned to this user</Alert>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  )
}

export default UserDetailPage
