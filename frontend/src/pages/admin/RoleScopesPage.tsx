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
  Autocomplete,
  TextField,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { usersApi, ScopeAssignment, ScopeAssignmentCreate } from '../../api/users'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { Program, Project } from '../../types'

const RoleScopesPage: React.FC = () => {
  const { id: userId, roleId } = useParams<{ id: string; roleId: string }>()
  const navigate = useNavigate()
  const [scopes, setScopes] = useState<ScopeAssignment[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newScope, setNewScope] = useState({
    scope_type: 'PROGRAM' as 'PROGRAM' | 'PROJECT' | 'GLOBAL',
    program_id: '',
    project_id: '',
    is_active: true,
  })

  const fetchData = async () => {
    if (!roleId) return

    try {
      setLoading(true)
      setError(null)
      const [scopesData, programsData, projectsData] = await Promise.all([
        usersApi.getRoleScopes(roleId, false),
        programsApi.list({ skip: 0, limit: 1000 }),
        projectsApi.list({ skip: 0, limit: 1000 }),
      ])
      setScopes(scopesData)
      setPrograms(programsData.items)
      setProjects(projectsData.items)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load scope assignments')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [roleId])

  const handleAddScope = async () => {
    if (!roleId) return

    try {
      const scopeData: ScopeAssignmentCreate = {
        scope_type: newScope.scope_type,
        program_id: newScope.scope_type === 'PROGRAM' ? newScope.program_id : undefined,
        project_id: newScope.scope_type === 'PROJECT' ? newScope.project_id : undefined,
        is_active: newScope.is_active,
      }
      await usersApi.assignScope(roleId, scopeData)
      setAddDialogOpen(false)
      setNewScope({
        scope_type: 'PROGRAM',
        program_id: '',
        project_id: '',
        is_active: true,
      })
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to assign scope')
    }
  }

  const handleRemoveScope = async (scopeId: string) => {
    if (!window.confirm('Are you sure you want to remove this scope assignment?')) {
      return
    }

    try {
      await usersApi.removeScope(scopeId)
      fetchData()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to remove scope')
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

  const getScopeTypeColor = (scopeType: string): 'primary' | 'success' | 'error' => {
    switch (scopeType) {
      case 'PROGRAM':
        return 'primary'
      case 'PROJECT':
        return 'success'
      case 'GLOBAL':
        return 'error'
      default:
        return 'primary'
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/admin/users/${userId}/roles`)}>
          Back to Roles
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate(`/admin/users/${userId}/roles`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Manage Scope Assignments</Typography>
      </Box>

      <Card>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Scope Assignments</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setAddDialogOpen(true)}
            >
              Add Scope
            </Button>
          </Box>

          {scopes.length === 0 ? (
            <Alert severity="info">No scope assignments for this role</Alert>
          ) : (
            <List>
              {scopes.map((scope, index) => (
                <React.Fragment key={scope.id}>
                  {index > 0 && <Divider />}
                  <ListItem>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip
                            label={getScopeTypeLabel(scope.scope_type)}
                            size="small"
                            color={getScopeTypeColor(scope.scope_type)}
                          />
                          {!scope.is_active && (
                            <Chip label="Inactive" size="small" variant="outlined" />
                          )}
                        </Box>
                      }
                      secondary={
                        <Box sx={{ mt: 0.5 }}>
                          {scope.scope_type === 'PROGRAM' && scope.program_name && (
                            <Typography variant="body2">
                              Program: {scope.program_name}
                            </Typography>
                          )}
                          {scope.scope_type === 'PROJECT' && scope.project_name && (
                            <Typography variant="body2">
                              Project: {scope.project_name}
                            </Typography>
                          )}
                          {scope.scope_type === 'GLOBAL' && (
                            <Typography variant="body2">
                              Full system access
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <IconButton edge="end" onClick={() => handleRemoveScope(scope.id)}>
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                </React.Fragment>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* Add Scope Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Scope Assignment</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Scope Type</InputLabel>
              <Select
                value={newScope.scope_type}
                onChange={(e) =>
                  setNewScope((prev) => ({
                    ...prev,
                    scope_type: e.target.value as 'PROGRAM' | 'PROJECT' | 'GLOBAL',
                    program_id: '',
                    project_id: '',
                  }))
                }
                label="Scope Type"
              >
                <MenuItem value="PROGRAM">Program</MenuItem>
                <MenuItem value="PROJECT">Project</MenuItem>
                <MenuItem value="GLOBAL">Global</MenuItem>
              </Select>
            </FormControl>

            {newScope.scope_type === 'PROGRAM' && (
              <Autocomplete
                options={programs}
                getOptionLabel={(option) => option.name}
                value={programs.find((p) => p.id === newScope.program_id) || null}
                onChange={(_e, value) =>
                  setNewScope((prev) => ({ ...prev, program_id: value?.id || '' }))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Select Program" required />
                )}
              />
            )}

            {newScope.scope_type === 'PROJECT' && (
              <Autocomplete
                options={projects}
                getOptionLabel={(option) => option.name}
                value={projects.find((p) => p.id === newScope.project_id) || null}
                onChange={(_e, value) =>
                  setNewScope((prev) => ({ ...prev, project_id: value?.id || '' }))
                }
                renderInput={(params) => (
                  <TextField {...params} label="Select Project" required />
                )}
              />
            )}

            {newScope.scope_type === 'GLOBAL' && (
              <Alert severity="warning">
                Global scope grants full system access. Use with caution.
              </Alert>
            )}

            <FormControlLabel
              control={
                <Switch
                  checked={newScope.is_active}
                  onChange={(e) =>
                    setNewScope((prev) => ({ ...prev, is_active: e.target.checked }))
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
            onClick={handleAddScope}
            variant="contained"
            disabled={
              (newScope.scope_type === 'PROGRAM' && !newScope.program_id) ||
              (newScope.scope_type === 'PROJECT' && !newScope.project_id)
            }
          >
            Add Scope
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default RoleScopesPage
