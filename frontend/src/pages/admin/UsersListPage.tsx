import React, { useState, useEffect, useMemo } from 'react'
import {
  Alert, Box, Button, Chip, IconButton, Typography, Tooltip, FormControlLabel, Switch,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon, Security as SecurityIcon,
} from '@mui/icons-material'
import { GridColDef } from '@mui/x-data-grid'
import { useNavigate } from 'react-router-dom'
import { usersApi, User } from '../../api/users'
import PageHeader from '../../components/common/PageHeader'
import DataTable from '../../components/common/DataTable'

const getRoleBadgeColor = (roleType: string): 'error' | 'primary' | 'success' | 'secondary' | 'warning' | 'info' => {
  switch (roleType) {
    case 'admin': return 'error'
    case 'program_manager': return 'primary'
    case 'project_manager': return 'success'
    case 'finance_manager': return 'secondary'
    case 'resource_manager': return 'warning'
    default: return 'info'
  }
}

const UsersListPage: React.FC = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeOnly, setActiveOnly] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      // Load all and let the grid sort/filter/paginate client-side.
      const response = await usersApi.listUsers({ skip: 0, limit: 1000 })
      setUsers(response.items)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchUsers() }, [])

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return
    try {
      await usersApi.deleteUser(userId)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete user')
    }
  }

  const rows = useMemo(() => (activeOnly ? users.filter((u) => u.is_active) : users), [users, activeOnly])

  const columns: GridColDef<User>[] = [
    {
      field: 'username', headerName: 'Username', flex: 1, minWidth: 140,
      renderCell: (p) => <Typography variant="body2" fontWeight="medium">{p.value}</Typography>,
    },
    { field: 'email', headerName: 'Email', flex: 1.4, minWidth: 180 },
    {
      field: 'roles', headerName: 'Roles', flex: 1.4, minWidth: 200, sortable: false, filterable: false,
      valueGetter: (p) => (p.row.user_roles || []).filter((r) => r.is_active).map((r) => r.role_type).join(', '),
      renderCell: (p) => {
        const roles = (p.row.user_roles || []).filter((r) => r.is_active)
        if (roles.length === 0) return <Typography variant="body2" color="text.secondary">No roles</Typography>
        return (
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflow: 'hidden' }}>
            {roles.map((role) => (
              <Chip key={role.id} label={role.role_type.replace('_', ' ')} size="small" color={getRoleBadgeColor(role.role_type)} />
            ))}
          </Box>
        )
      },
    },
    {
      field: 'is_active', headerName: 'Status', width: 100,
      renderCell: (p) => <Chip label={p.value ? 'Active' : 'Inactive'} size="small" color={p.value ? 'success' : 'default'} />,
    },
    {
      field: 'created_at', headerName: 'Created', width: 110,
      valueFormatter: (p) => new Date(p.value as string).toLocaleDateString(),
    },
    {
      field: 'actions', headerName: '', width: 140, sortable: false, filterable: false, align: 'right', headerAlign: 'right',
      renderCell: (p) => (
        <Box sx={{ display: 'flex' }}>
          <Tooltip title="View Details"><IconButton size="small" sx={{ p: 0.25 }} onClick={() => navigate(`/admin/users/${p.row.id}`)}><ViewIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Edit User"><IconButton size="small" sx={{ p: 0.25 }} onClick={() => navigate(`/admin/users/${p.row.id}/edit`)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Manage Roles"><IconButton size="small" sx={{ p: 0.25 }} onClick={() => navigate(`/admin/users/${p.row.id}/roles`)}><SecurityIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Deactivate User"><span><IconButton size="small" sx={{ p: 0.25 }} onClick={() => handleDeleteUser(p.row.id)} disabled={!p.row.is_active}><DeleteIcon fontSize="small" /></IconButton></span></Tooltip>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <PageHeader
        title="User Management"
        actions={
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/admin/users/create')}>
            Create User
          </Button>
        }
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
        <FormControlLabel
          control={<Switch checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />}
          label="Active only"
        />
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <DataTable rows={rows} columns={columns} loading={loading} getRowId={(r) => r.id} />
    </Box>
  )
}

export default UsersListPage
