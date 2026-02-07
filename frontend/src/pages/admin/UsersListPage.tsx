import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  Tooltip,
  FormControlLabel,
  Switch,
} from '@mui/material'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Security as SecurityIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { usersApi, User } from '../../api/users'

const UsersListPage: React.FC = () => {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [activeOnly, setActiveOnly] = useState(false)

  const fetchUsers = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await usersApi.listUsers({
        skip: page * rowsPerPage,
        limit: rowsPerPage,
        is_active: activeOnly ? true : undefined,
      })
      setUsers(response.items)
      setTotal(response.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load users')
      console.error('Error fetching users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [page, rowsPerPage, activeOnly])

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return
    }

    try {
      await usersApi.deleteUser(userId)
      fetchUsers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete user')
    }
  }

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

  const filteredUsers = users.filter(
    (user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">User Management</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/admin/users/create')}
        >
          Create User
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              label="Search users"
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <FormControlLabel
              control={
                <Switch
                  checked={activeOnly}
                  onChange={(e) => {
                    setActiveOnly(e.target.checked)
                    setPage(0)
                  }}
                />
              }
              label="Active only"
            />
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Card sx={{ mb: 3, bgcolor: 'error.light' }}>
          <CardContent>
            <Typography color="error">{error}</Typography>
          </CardContent>
        </Card>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Roles</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredUsers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              filteredUsers.map((user) => (
                <TableRow key={user.id} hover>
                  <TableCell>
                    <Typography variant="body2" fontWeight="medium">
                      {user.username}
                    </Typography>
                  </TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {user.user_roles && user.user_roles.length > 0 ? (
                        user.user_roles
                          .filter((role) => role.is_active)
                          .map((role) => (
                            <Chip
                              key={role.id}
                              label={role.role_type.replace('_', ' ')}
                              size="small"
                              color={getRoleBadgeColor(role.role_type)}
                            />
                          ))
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          No roles
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={user.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={user.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/users/${user.id}`)}
                      >
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit User">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/users/${user.id}/edit`)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Manage Roles">
                      <IconButton
                        size="small"
                        onClick={() => navigate(`/admin/users/${user.id}/roles`)}
                      >
                        <SecurityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Deactivate User">
                      <IconButton
                        size="small"
                        onClick={() => handleDeleteUser(user.id)}
                        disabled={!user.is_active}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </TableContainer>
    </Box>
  )
}

export default UsersListPage
