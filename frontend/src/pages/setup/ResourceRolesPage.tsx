import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tooltip,
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { resourceRolesApi } from '../../api/resourceRoles'
import { ResourceRole } from '../../types'

const DEFAULT_ROLE_NAME = 'Default'

interface RoleFormState {
  name: string
  description: string
}

const emptyForm: RoleFormState = { name: '', description: '' }

const ResourceRolesPage: React.FC = () => {
  const [roles, setRoles] = useState<ResourceRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRole, setEditingRole] = useState<ResourceRole | null>(null)
  const [form, setForm] = useState<RoleFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchRoles = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await resourceRolesApi.list()
      setRoles(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load resource roles')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRoles()
  }, [])

  const openCreateDialog = () => {
    setEditingRole(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (role: ResourceRole) => {
    setEditingRole(role)
    setForm({ name: role.name, description: role.description || '' })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingRole(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (editingRole) {
        await resourceRolesApi.update(editingRole.id, {
          name: form.name,
          description: form.description || undefined,
          version: editingRole.version,
        })
      } else {
        await resourceRolesApi.create({
          name: form.name,
          description: form.description || undefined,
        })
      }
      closeDialog()
      fetchRoles()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save resource role')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (role: ResourceRole) => {
    if (role.name === DEFAULT_ROLE_NAME) return
    if (!window.confirm(`Are you sure you want to delete the "${role.name}" role?`)) {
      return
    }

    try {
      await resourceRolesApi.delete(role.id)
      fetchRoles()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete resource role')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5">Resource Roles</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Role
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Resources</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {roles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No resource roles found
                    </TableCell>
                  </TableRow>
                ) : (
                  roles.map((role) => {
                    const isDefault = role.name === DEFAULT_ROLE_NAME
                    return (
                      <TableRow key={role.id} hover>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {role.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{role.description}</TableCell>
                        <TableCell>{role.resource_count ?? 0}</TableCell>
                        <TableCell align="right">
                          <IconButton size="small" aria-label={`Edit ${role.name}`} onClick={() => openEditDialog(role)}>
                            <EditIcon />
                          </IconButton>
                          <Tooltip title={isDefault ? 'Default role cannot be deleted' : ''}>
                            <span>
                              <IconButton
                                size="small"
                                aria-label={`Delete ${role.name}`}
                                disabled={isDefault}
                                onClick={() => handleDelete(role)}
                              >
                                <DeleteIcon />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingRole ? 'Edit Role' : 'Add Role'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!form.name || saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ResourceRolesPage
