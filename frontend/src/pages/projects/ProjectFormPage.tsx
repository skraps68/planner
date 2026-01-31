import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Grid,
  Alert,
  MenuItem,
} from '@mui/material'
import { ArrowBack, Save } from '@mui/icons-material'
import { projectsApi, ProjectCreateRequest } from '../../api/projects'
import { programsApi } from '../../api/programs'
import { format } from 'date-fns'

const ProjectFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isEdit = id !== undefined && id !== 'new'

  const [formData, setFormData] = useState<ProjectCreateRequest>({
    program_id: '',
    name: '',
    business_sponsor: '',
    project_manager: '',
    technical_lead: '',
    start_date: format(new Date(), 'yyyy-MM-dd'),
    end_date: format(new Date(), 'yyyy-MM-dd'),
    cost_center_code: '',
    execution_phase: {
      capital_budget: 0,
      expense_budget: 0,
    },
  })
  const [error, setError] = useState('')

  // Fetch programs for dropdown
  const { data: programsData } = useQuery({
    queryKey: ['programs'],
    queryFn: () => programsApi.list(),
  })

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: isEdit,
  })

  useEffect(() => {
    if (project) {
      setFormData({
        program_id: project.program_id || '',
        name: project.name,
        business_sponsor: project.business_sponsor,
        project_manager: project.project_manager,
        technical_lead: project.technical_lead,
        start_date: project.start_date,
        end_date: project.end_date,
        cost_center_code: project.cost_center_code,
        execution_phase: {
          capital_budget: project.capital_budget || 0,
          expense_budget: project.expense_budget || 0,
        },
        planning_phase: {
          capital_budget: 0,
          expense_budget: 0,
        },
      })
    }
  }, [project])

  const createMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      navigate('/projects')
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create project')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: Partial<ProjectCreateRequest>) => projectsApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project', id] })
      navigate(`/projects/${id}`)
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to update project')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (new Date(formData.start_date) >= new Date(formData.end_date)) {
      setError('End date must be after start date')
      return
    }

    if (isEdit) {
      // For update, exclude program_id
      const { program_id, ...updateData } = formData
      updateMutation.mutate(updateData)
    } else {
      createMutation.mutate(formData)
    }
  }

  const handleChange = (field: string, value: any) => {
    if (field.startsWith('execution_phase.') || field.startsWith('planning_phase.')) {
      const [phase, subfield] = field.split('.')
      setFormData((prev) => ({
        ...prev,
        [phase]: {
          ...(prev[phase as keyof typeof prev] as any),
          [subfield]: value,
        },
      }))
    } else {
      setFormData((prev) => ({ ...prev, [field]: value }))
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}
          sx={{ mr: 2 }}
        >
          Back
        </Button>
        <Typography variant="h4">
          {isEdit ? 'Edit Project' : 'Create Project'}
        </Typography>
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
                label="Project Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                select
                label="Program"
                value={formData.program_id}
                onChange={(e) => handleChange('program_id', e.target.value)}
                required
                disabled={isEdit}
                helperText={isEdit ? 'Program cannot be changed after creation' : 'Select the program this project belongs to'}
              >
                <MenuItem value="">
                  <em>Select a program</em>
                </MenuItem>
                {programsData?.items.map((program) => (
                  <MenuItem key={program.id} value={program.id}>
                    {program.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Cost Center Code"
                value={formData.cost_center_code}
                onChange={(e) => handleChange('cost_center_code', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Business Sponsor"
                value={formData.business_sponsor}
                onChange={(e) => handleChange('business_sponsor', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Project Manager"
                value={formData.project_manager}
                onChange={(e) => handleChange('project_manager', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Technical Lead"
                value={formData.technical_lead}
                onChange={(e) => handleChange('technical_lead', e.target.value)}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Start Date"
                type="date"
                value={formData.start_date}
                onChange={(e) => handleChange('start_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="End Date"
                type="date"
                value={formData.end_date}
                onChange={(e) => handleChange('end_date', e.target.value)}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                <Button
                  variant="outlined"
                  onClick={() => navigate(isEdit ? `/projects/${id}` : '/projects')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={<Save />}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {createMutation.isPending || updateMutation.isPending
                    ? 'Saving...'
                    : 'Save Project'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>
      </Paper>
    </Box>
  )
}

export default ProjectFormPage
