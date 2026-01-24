import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  FormControlLabel,
  Switch,
  IconButton,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Save as SaveIcon } from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { usersApi, UserCreate, UserUpdate } from '../../api/users'

const UserFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEditMode = Boolean(id)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    is_active: true,
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isEditMode && id) {
      const fetchUser = async () => {
        try {
          setLoading(true)
          const user = await usersApi.getUser(id)
          setFormData({
            username: user.username,
            email: user.email,
            password: '',
            confirmPassword: '',
            is_active: user.is_active,
          })
        } catch (err: any) {
          setError(err.response?.data?.detail || 'Failed to load user')
        } finally {
          setLoading(false)
        }
      }
      fetchUser()
    }
  }, [id, isEditMode])

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!formData.username.trim()) {
      errors.username = 'Username is required'
    }

    if (!formData.email.trim()) {
      errors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Invalid email format'
    }

    if (!isEditMode) {
      if (!formData.password) {
        errors.password = 'Password is required'
      } else if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }

      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    } else if (formData.password) {
      if (formData.password.length < 8) {
        errors.password = 'Password must be at least 8 characters'
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      if (isEditMode && id) {
        const updateData: UserUpdate = {
          username: formData.username,
          email: formData.email,
          is_active: formData.is_active,
        }
        await usersApi.updateUser(id, updateData)
      } else {
        const createData: UserCreate = {
          username: formData.username,
          email: formData.email,
          password: formData.password,
          is_active: formData.is_active,
        }
        await usersApi.createUser(createData)
      }

      navigate('/admin/users')
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${isEditMode ? 'update' : 'create'} user`)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [field]: e.target.value,
    }))
    // Clear validation error for this field
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  if (loading && isEditMode) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate('/admin/users')}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">{isEditMode ? 'Edit User' : 'Create User'}</Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <TextField
                label="Username"
                value={formData.username}
                onChange={handleChange('username')}
                error={Boolean(validationErrors.username)}
                helperText={validationErrors.username}
                required
                fullWidth
              />

              <TextField
                label="Email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                error={Boolean(validationErrors.email)}
                helperText={validationErrors.email}
                required
                fullWidth
              />

              <TextField
                label={isEditMode ? 'New Password (leave blank to keep current)' : 'Password'}
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                error={Boolean(validationErrors.password)}
                helperText={validationErrors.password || 'Minimum 8 characters'}
                required={!isEditMode}
                fullWidth
              />

              <TextField
                label="Confirm Password"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                error={Boolean(validationErrors.confirmPassword)}
                helperText={validationErrors.confirmPassword}
                required={!isEditMode || Boolean(formData.password)}
                fullWidth
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.is_active}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                    }
                  />
                }
                label="Active"
              />

              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => navigate('/admin/users')}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<SaveIcon />}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : isEditMode ? 'Update User' : 'Create User'}
                </Button>
              </Box>
            </Box>
          </form>
        </CardContent>
      </Card>
    </Box>
  )
}

export default UserFormPage
