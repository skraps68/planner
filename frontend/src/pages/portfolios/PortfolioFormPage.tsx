import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
} from '@mui/material'
import { ArrowBack, Save } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { PortfolioCreate } from '../../types/portfolio'
import { format } from 'date-fns'

const PortfolioFormPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<PortfolioCreate>({
    name: '',
    description: '',
    owner: '',
    reporting_start_date: format(new Date(), 'yyyy-MM-dd'),
    reporting_end_date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [error, setError] = useState('')
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const createMutation = useMutation({
    mutationFn: portfoliosApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      navigate(`/portfolios/${data.id}`)
    },
    onError: (err: any) => {
      const errorMessage = err.response?.data?.detail || 'Failed to create portfolio'
      setError(errorMessage)
    },
  })

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Validate required fields
    if (!formData.name.trim()) {
      errors.name = 'Portfolio name is required'
    } else if (formData.name.length > 255) {
      errors.name = 'Portfolio name must be 255 characters or less'
    }

    if (!formData.description.trim()) {
      errors.description = 'Description is required'
    } else if (formData.description.length > 1000) {
      errors.description = 'Description must be 1000 characters or less'
    }

    if (!formData.owner.trim()) {
      errors.owner = 'Owner is required'
    } else if (formData.owner.length > 255) {
      errors.owner = 'Owner must be 255 characters or less'
    }

    if (!formData.reporting_start_date) {
      errors.reporting_start_date = 'Reporting start date is required'
    }

    if (!formData.reporting_end_date) {
      errors.reporting_end_date = 'Reporting end date is required'
    }

    // Validate date range
    if (formData.reporting_start_date && formData.reporting_end_date) {
      if (new Date(formData.reporting_start_date) >= new Date(formData.reporting_end_date)) {
        errors.reporting_end_date = 'Reporting end date must be after reporting start date'
      }
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setValidationErrors({})

    if (!validateForm()) {
      return
    }

    createMutation.mutate(formData)
  }

  const handleChange = (field: keyof PortfolioCreate, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear validation error for this field when user starts typing
    if (validationErrors[field]) {
      setValidationErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[field]
        return newErrors
      })
    }
  }

  const handleCancel = () => {
    navigate('/portfolios')
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleCancel}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">Create Portfolio</Typography>
      </Box>

      <Paper sx={{ p: 3 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Portfolio Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                error={!!validationErrors.name}
                helperText={validationErrors.name}
                inputProps={{ maxLength: 255 }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                required
                multiline
                rows={4}
                error={!!validationErrors.description}
                helperText={validationErrors.description}
                inputProps={{ maxLength: 1000 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Owner"
                value={formData.owner}
                onChange={(e) => handleChange('owner', e.target.value)}
                required
                error={!!validationErrors.owner}
                helperText={validationErrors.owner}
                inputProps={{ maxLength: 255 }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reporting Start Date"
                type="date"
                value={formData.reporting_start_date}
                onChange={(e) => handleChange('reporting_start_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                error={!!validationErrors.reporting_start_date}
                helperText={validationErrors.reporting_start_date}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Reporting End Date"
                type="date"
                value={formData.reporting_end_date}
                onChange={(e) => handleChange('reporting_end_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
                error={!!validationErrors.reporting_end_date}
                helperText={validationErrors.reporting_end_date}
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={createMutation.isPending}
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Portfolio'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  )
}

export default PortfolioFormPage
