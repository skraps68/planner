import React, { useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
  Tabs,
  Tab,
  Alert,
  Snackbar,
  TextField,
  Autocomplete,
} from '@mui/material'
import { Edit, ArrowBack, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { projectsApi } from '../../api/projects'
import { programsApi } from '../../api/programs'
import { phasesApi } from '../../api/phases'
import { getProjectForecast } from '../../api/forecast'
import { transformForecastData } from '../../utils/forecastTransform'
import { format } from 'date-fns'
import PhaseEditor from '../../components/phases/PhaseEditor'
import { FinancialSummaryTable } from '../../components/portfolio/FinancialSummaryTable'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ResourceAssignmentCalendar from '../../components/resources/ResourceAssignmentCalendar'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ paddingTop: 24, maxWidth: '100%', overflow: 'hidden' }}>
      {value === index && children}
    </div>
  )
}

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get program and portfolio context from navigation state
  const navigationState = location.state as { 
    programId?: string
    programName?: string
    portfolioId?: string
    portfolioName?: string
  } | null
  
  const [tabValue, setTabValue] = useState(() => {
    // Check if there's a tab parameter in the URL
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    return tabParam ? parseInt(tabParam, 10) : 0
  })
  const { conflictState, handleError, clearConflict } = useConflictHandler()
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editValues, setEditValues] = useState({
    name: '',
    business_sponsor: '',
    project_manager: '',
    technical_lead: '',
    cost_center_code: '',
    start_date: '',
    end_date: '',
    version: 1,
  })
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)

  const { data: project, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  })

  const { data: program } = useQuery({
    queryKey: ['program', project?.program_id],
    queryFn: () => programsApi.get(project!.program_id),
    enabled: !!project?.program_id,
  })

  // Fetch phases for the phase dropdown
  const { data: phases = [] } = useQuery({
    queryKey: ['phases', id],
    queryFn: () => phasesApi.list(id!),
    enabled: !!id && tabValue === 2,
  })

  // Fetch forecast data based on selection
  const { data: forecastData } = useQuery({
    queryKey: ['forecast', 'project', id, selectedPhaseId],
    queryFn: async () => {
      const data = await getProjectForecast(id!, selectedPhaseId || undefined)
      return transformForecastData(data)
    },
    enabled: !!id && tabValue === 2,
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

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
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

  const handleAssignmentSaveSuccess = useCallback(() => {
    setSnackbar({
      open: true,
      message: 'Assignments saved successfully',
      severity: 'success',
    })
  }, [])

  const handleAssignmentSaveError = useCallback((error: string) => {
    setSnackbar({
      open: true,
      message: `Failed to save assignments: ${error}`,
      severity: 'error',
    })
  }, [])

  const handleProjectDateChange = async (startDate: string, endDate: string) => {
    try {
      const response = await projectsApi.update(id!, {
        start_date: startDate,
        end_date: endDate,
      })
      
      // Check if phase adjustments were made
      if (response.phase_adjustments && response.phase_adjustments.length > 0) {
        // Build notification message
        const adjustmentMessages = response.phase_adjustments.map((adj: any) => {
          if (adj.field === 'start_date and end_date') {
            return `"${adj.phase_name}" dates updated to match project dates`
          } else if (adj.field === 'start_date') {
            return `"${adj.phase_name}" start date updated to ${new Date(adj.new_value).toLocaleDateString()}`
          } else if (adj.field === 'end_date') {
            return `"${adj.phase_name}" end date updated to ${new Date(adj.new_value).toLocaleDateString()}`
          }
          return ''
        }).filter(Boolean).join('; ')
        
        setSnackbar({
          open: true,
          message: `Project dates updated. Phase adjustments: ${adjustmentMessages}`,
          severity: 'success',
        })
      }
      
      // Refetch project to get updated dates
      refetch()
    } catch (error) {
      console.error('Failed to update project dates:', error)
      setSnackbar({
        open: true,
        message: 'Failed to update project dates',
        severity: 'error',
      })
    }
  }

  const handleEditInfo = () => {
    if (project) {
      setEditValues({
        name: project.name,
        business_sponsor: project.business_sponsor,
        project_manager: project.project_manager,
        technical_lead: project.technical_lead,
        cost_center_code: project.cost_center_code,
        start_date: project.start_date,
        end_date: project.end_date,
        version: project.version,
      })
      setIsEditingInfo(true)
    }
  }

  const handleSaveInfo = async () => {
    try {
      await projectsApi.update(id!, editValues)
      setSnackbar({
        open: true,
        message: 'Project information updated successfully',
        severity: 'success',
      })
      setIsEditingInfo(false)
      refetch()
    } catch (error: any) {
      // Try to handle as conflict error
      const isConflict = handleError(error, editValues)
      
      if (!isConflict) {
        // Not a conflict, show generic error
        console.error('Failed to update project:', error)
        setSnackbar({
          open: true,
          message: 'Failed to update project information',
          severity: 'error',
        })
      }
    }
  }

  const handleCancelEdit = () => {
    setIsEditingInfo(false)
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

  // Build breadcrumbs based on navigation context
  const breadcrumbItems = [
    { label: 'Home', path: '/dashboard' },
    { label: 'Portfolios', path: '/portfolios' },
  ]

  // If we have portfolio context, show specific portfolio
  if (navigationState?.portfolioId && navigationState?.portfolioName) {
    breadcrumbItems.push({
      label: navigationState.portfolioName,
      path: `/portfolios/${navigationState.portfolioId}`,
    })
  } else {
    // Otherwise show generic Programs
    breadcrumbItems.push({ label: 'Programs', path: '/programs' })
  }

  // If we have program context from navigation, show specific program
  if (navigationState?.programId && navigationState?.programName) {
    breadcrumbItems.push({
      label: navigationState.programName,
      path: `/programs/${navigationState.programId}`,
      // Pass portfolio context when clicking on program breadcrumb
      state: navigationState?.portfolioId && navigationState?.portfolioName ? {
        portfolioId: navigationState.portfolioId,
        portfolioName: navigationState.portfolioName,
      } : undefined,
    })
  } else {
    // Otherwise show generic Projects
    breadcrumbItems.push({ label: 'Projects', path: '/projects' })
  }

  breadcrumbItems.push({ label: project.name })

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <ScopeBreadcrumbs items={breadcrumbItems} />

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {project.name}
        </Typography>
        <Chip label={status} color={statusColor} />
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Details" />
          <Tab label="Assignments" />
          <Tab label="Financials" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Project Name
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValues.name}
                      onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">{project.name}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Business Sponsor
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValues.business_sponsor}
                      onChange={(e) => setEditValues({ ...editValues, business_sponsor: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">{project.business_sponsor}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Project Manager
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValues.project_manager}
                      onChange={(e) => setEditValues({ ...editValues, project_manager: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">{project.project_manager}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Technical Lead
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValues.technical_lead}
                      onChange={(e) => setEditValues({ ...editValues, technical_lead: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">{project.technical_lead}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Program
                  </Typography>
                  <Typography variant="body1">{program?.name || 'Loading...'}</Typography>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Cost Center
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValues.cost_center_code}
                      onChange={(e) => setEditValues({ ...editValues, cost_center_code: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">{project.cost_center_code}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      value={editValues.start_date}
                      onChange={(e) => setEditValues({ ...editValues, start_date: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">
                      {format(new Date(project.start_date), 'MMMM dd, yyyy')}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    End Date
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      type="date"
                      value={editValues.end_date}
                      onChange={(e) => setEditValues({ ...editValues, end_date: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">
                      {format(new Date(project.end_date), 'MMMM dd, yyyy')}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                  {!isEditingInfo ? (
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Edit />}
                      onClick={handleEditInfo}
                    >
                      Edit
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={handleSaveInfo}
                      >
                        Save
                      </Button>
                    </Box>
                  )}
                </Grid>
              </Grid>
            </Paper>
            
            <PhaseEditor
              projectId={id!}
              projectStartDate={project.start_date}
              projectEndDate={project.end_date}
              onSaveSuccess={handlePhaseSaveSuccess}
              onSaveError={handlePhaseSaveError}
              onProjectDateChange={handleProjectDateChange}
            />
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ResourceAssignmentCalendar
          projectId={id!}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
          onSaveSuccess={handleAssignmentSaveSuccess}
          onSaveError={handleAssignmentSaveError}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={phases}
                getOptionLabel={(option: any) => option.name}
                value={phases.find((p: any) => p.id === selectedPhaseId) || null}
                onChange={(_, newValue: any) => setSelectedPhaseId(newValue?.id || null)}
                renderInput={(params) => <TextField {...params} label="Phase" />}
              />
            </Grid>
          </Grid>
          {forecastData && <FinancialSummaryTable data={forecastData} />}
        </Paper>
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

      {/* Conflict Dialog */}
      <ConflictDialog
        open={conflictState.isConflict}
        entityType={conflictState.entityType}
        attemptedChanges={conflictState.attemptedChanges}
        currentState={conflictState.currentState}
        onRefreshAndRetry={() => {
          // Reload the project data
          refetch()
          // Pre-fill form with attempted changes and new version
          setEditValues({
            ...conflictState.attemptedChanges,
            version: conflictState.currentState.version,
          })
          clearConflict()
        }}
        onCancel={() => {
          clearConflict()
          setIsEditingInfo(false)
        }}
      />
    </Box>
  )
}

export default ProjectDetailPage
