import React, { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Divider,
  Card,
  CardContent,
  Tabs,
  Tab,
  Alert,
  Snackbar,
} from '@mui/material'
import { Edit, ArrowBack, OpenInNew } from '@mui/icons-material'
import { projectsApi } from '../../api/projects'
import { format } from 'date-fns'
import PhaseEditor from '../../components/phases/PhaseEditor'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ paddingTop: 24 }}>
      {value === index && children}
    </div>
  )
}

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const [tabValue, setTabValue] = useState(() => {
    // Check if there's a tab parameter in the URL
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    return tabParam ? parseInt(tabParam, 10) : 0
  })
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })

  const { data: project, isLoading, refetch } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  // Calculate budget statistics from phases
  const totalBudget = (project?.phases || []).reduce((sum, phase) => {
    return sum + Number(phase.total_budget || 0)
  }, 0)

  const capitalBudget = (project?.phases || []).reduce((sum, phase) => {
    return sum + Number(phase.capital_budget || 0)
  }, 0)

  const expenseBudget = (project?.phases || []).reduce((sum, phase) => {
    return sum + Number(phase.expense_budget || 0)
  }, 0)

  // Handle tab change - navigate to Financials when tab 3 is clicked
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === 3 && project) {
      // Navigate to Financials with program and project pre-selected and remember current tab
      navigate(`/portfolio?programId=${project.program_id}&projectId=${id}&returnTo=project&returnId=${id}&returnTab=${tabValue}`)
    } else {
      setTabValue(newValue)
    }
  }

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  const handlePhaseSaveSuccess = () => {
    setSnackbar({
      open: true,
      message: 'Phases saved successfully',
      severity: 'success',
    })
    refetch()
  }

  const handlePhaseSaveError = (error: string) => {
    setSnackbar({
      open: true,
      message: `Failed to save phases: ${error}`,
      severity: 'error',
    })
  }

  if (isLoading) {
    return <Typography>Loading...</Typography>
  }

  if (!project) {
    return <Typography>Project not found</Typography>
  }

  const now = new Date()
  const startDate = new Date(project.start_date)
  const endDate = new Date(project.end_date)

  let status = 'Active'
  let statusColor: 'success' | 'warning' | 'default' = 'success'

  if (now < startDate) {
    status = 'Planned'
    statusColor = 'warning'
  } else if (now > endDate) {
    status = 'Completed'
    statusColor = 'default'
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/projects')} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {project.name}
        </Typography>
        <Chip label={status} color={statusColor} sx={{ mr: 2 }} />
        <Button variant="contained" startIcon={<Edit />} onClick={() => navigate(`/projects/${id}/edit`)}>
          Edit
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Phases" />
          <Tab label="Assignments" />
          <Tab 
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                Financials
                <OpenInNew sx={{ fontSize: 16 }} />
              </Box>
            } 
          />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Project Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Project Name
                  </Typography>
                  <Typography variant="body1">{project.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Project Manager
                  </Typography>
                  <Typography variant="body1">{project.project_manager}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Cost Center
                  </Typography>
                  <Typography variant="body1">{project.cost_center_code}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Program
                  </Typography>
                  <Typography variant="body1">{project.program_id || 'N/A'}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(project.start_date), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    End Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(project.end_date), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Quick Stats
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Total Budget
                  </Typography>
                  <Typography variant="h4">
                    ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Capital Budget
                  </Typography>
                  <Typography variant="h5">
                    ${capitalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Expense Budget
                  </Typography>
                  <Typography variant="h5">
                    ${expenseBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <PhaseEditor
          projectId={id!}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
          onSaveSuccess={handlePhaseSaveSuccess}
          onSaveError={handlePhaseSaveError}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Resource Assignments
          </Typography>
          <Typography color="text.secondary">Assignment data will be displayed here</Typography>
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        {/* This tab navigates to Financials page - content not needed */}
      </TabPanel>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ProjectDetailPage
