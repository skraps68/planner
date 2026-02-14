import React, { useState, useMemo } from 'react'
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
  CircularProgress,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert,
  Snackbar,
  Autocomplete,
} from '@mui/material'
import { Edit, ArrowBack, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { programsApi } from '../../api/programs'
import { portfoliosApi } from '../../api/portfolios'
import { projectsApi } from '../../api/projects'
import { phasesApi } from '../../api/phases'
import { getProgramForecast, getProjectForecast } from '../../api/forecast'
import { transformForecastData } from '../../utils/forecastTransform'
import { FinancialSummaryTable } from '../../components/portfolio/FinancialSummaryTable'
import { Project } from '../../types'
import { format } from 'date-fns'
import { usePermissions } from '../../hooks/usePermissions'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'

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

const ProgramDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Get portfolio context from navigation state
  const navigationState = location.state as { portfolioId?: string; portfolioName?: string } | null
  
  const [tabValue, setTabValue] = React.useState(() => {
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    return tabParam ? parseInt(tabParam, 10) : 0
  })
  const { canAccessProject } = usePermissions()
  const { conflictState, handleError, clearConflict } = useConflictHandler()
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editValues, setEditValues] = useState({
    name: '',
    business_sponsor: '',
    program_manager: '',
    technical_lead: '',
    start_date: '',
    end_date: '',
    portfolio_id: '',
    version: 1,
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

  // Financials tab state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)

  // Get today's date for forecast API
  const today = useMemo(() => {
    const date = new Date()
    return date.toISOString().split('T')[0]
  }, [])

  const { data: program, isLoading, refetch } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.get(id!),
    enabled: !!id,
  })

  // Fetch all portfolios for the dropdown
  const { data: portfoliosData } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => portfoliosApi.list({ limit: 1000 }),
    enabled: isEditingInfo,
  })

  const portfolios = portfoliosData?.items || []

  // Fetch projects for this program
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'program', id],
    queryFn: () => projectsApi.list({ program_id: id!, limit: 1000 }),
    enabled: !!id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  const projects = projectsData?.items || []

  // Fetch phases for selected project (for Financials tab)
  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ['phases', selectedProjectId],
    queryFn: () => phasesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  })

  const phases = phasesData || []

  // Fetch forecast data for Financials tab
  const { 
    data: forecastData, 
    isLoading: forecastLoading,
    error: forecastError 
  } = useQuery({
    queryKey: ['forecast', id, selectedProjectId, selectedPhaseId, today],
    queryFn: async () => {
      if (selectedProjectId) {
        return await getProjectForecast(selectedProjectId, today, selectedPhaseId)
      }
      return await getProgramForecast(id!, today)
    },
    enabled: !!id && tabValue === 1
  })

  // Transform forecast data for display
  const financialTableData = useMemo(() => {
    if (!forecastData) return null
    return transformForecastData(forecastData)
  }, [forecastData])

  // Handle tab change
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue)
  }

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  const handleEditInfo = () => {
    if (program) {
      setEditValues({
        name: program.name,
        business_sponsor: program.business_sponsor,
        program_manager: program.program_manager,
        technical_lead: program.technical_lead,
        start_date: program.start_date,
        end_date: program.end_date,
        portfolio_id: program.portfolio?.id || '',
        version: program.version,
      })
      setIsEditingInfo(true)
    }
  }

  const handleSaveInfo = async () => {
    try {
      await programsApi.update(id!, editValues)
      setSnackbar({
        open: true,
        message: 'Program information updated successfully',
        severity: 'success',
      })
      setIsEditingInfo(false)
      refetch()
    } catch (error: any) {
      // Try to handle as conflict error
      const isConflict = handleError(error, editValues)
      
      if (!isConflict) {
        // Not a conflict, show generic error
        console.error('Failed to update program:', error)
        setSnackbar({
          open: true,
          message: 'Failed to update program information',
          severity: 'error',
        })
      }
    }
  }

  const handleCancelEdit = () => {
    setIsEditingInfo(false)
  }

  const handleProjectChange = (projectId: string | null) => {
    setSelectedProjectId(projectId)
    setSelectedPhaseId(null)
  }

  const handlePhaseChange = (phaseId: string | null) => {
    setSelectedPhaseId(phaseId)
  }

  // Calculate statistics
  const totalProjects = projects.length
  const now = new Date()
  const activeProjects = projects.filter(project => {
    const start = new Date(project.start_date)
    const end = new Date(project.end_date)
    return now >= start && now <= end
  }).length

  // Calculate total budget from all project phases
  const totalBudget = projects.reduce((sum, project) => {
    const projectBudget = (project.phases || []).reduce((phaseSum, phase) => {
      return phaseSum + Number(phase.total_budget || 0)
    }, 0)
    return sum + projectBudget
  }, 0)

  const totalCapitalBudget = projects.reduce((sum, project) => {
    const projectCapital = (project.phases || []).reduce((phaseSum, phase) => {
      return phaseSum + Number(phase.capital_budget || 0)
    }, 0)
    return sum + projectCapital
  }, 0)

  const totalExpenseBudget = projects.reduce((sum, project) => {
    const projectExpense = (project.phases || []).reduce((phaseSum, phase) => {
      return phaseSum + Number(phase.expense_budget || 0)
    }, 0)
    return sum + projectExpense
  }, 0)

  const handleProjectRowClick = (project: Project) => {
    const projectAccess = canAccessProject(project.id, project.program_id)
    if (projectAccess.hasPermission) {
      navigate(`/projects/${project.id}`, {
        state: {
          portfolioId: navigationState?.portfolioId || program?.portfolio?.id,
          portfolioName: navigationState?.portfolioName || program?.portfolio?.name,
          programId: program?.id,
          programName: program?.name,
        },
      })
    }
  }

  if (isLoading || projectsLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (!program) {
    return <Typography>Program not found</Typography>
  }

  const startDate = new Date(program.start_date)
  const endDate = new Date(program.end_date)

  let status = 'Active'
  let statusColor: 'success' | 'warning' | 'default' = 'success'

  if (now < startDate) {
    status = 'Planned'
    statusColor = 'warning'
  } else if (now > endDate) {
    status = 'Completed'
    statusColor = 'default'
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null
  const selectedPhase = phases.find(p => p.id === selectedPhaseId) || null

  // Build breadcrumbs based on navigation context
  const breadcrumbItems = [
    { label: 'Home', path: '/dashboard' },
    { label: 'Portfolios', path: '/portfolios' },
  ]

  // If we have portfolio context from navigation, show specific portfolio
  if (navigationState?.portfolioId && navigationState?.portfolioName) {
    breadcrumbItems.push({
      label: navigationState.portfolioName,
      path: `/portfolios/${navigationState.portfolioId}`,
    })
  } else {
    // Otherwise show generic Programs
    breadcrumbItems.push({ label: 'Programs', path: '/programs' })
  }

  breadcrumbItems.push({ label: program.name })

  return (
    <Box>
      <ScopeBreadcrumbs items={breadcrumbItems} />

      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {program.name}
        </Typography>
        <Chip label={status} color={statusColor} />
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Details" />
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
                    Program Name
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
                    <Typography variant="body1">{program.name}</Typography>
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
                    <Typography variant="body1">{program.business_sponsor}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Program Manager
                  </Typography>
                  {isEditingInfo ? (
                    <TextField
                      fullWidth
                      size="small"
                      value={editValues.program_manager}
                      onChange={(e) => setEditValues({ ...editValues, program_manager: e.target.value })}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Typography variant="body1">{program.program_manager}</Typography>
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
                    <Typography variant="body1">{program.technical_lead}</Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Typography variant="caption" color="text.secondary">
                    Portfolio
                  </Typography>
                  {isEditingInfo ? (
                    <Autocomplete
                      options={portfolios}
                      getOptionLabel={(option) => option.name}
                      value={portfolios.find((p) => p.id === editValues.portfolio_id) || null}
                      onChange={(_, newValue) =>
                        setEditValues({ ...editValues, portfolio_id: newValue?.id || '' })
                      }
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder="Select Portfolio"
                          sx={{ mt: 0.5 }}
                        />
                      )}
                    />
                  ) : (
                    <Typography variant="body1">{program.portfolio?.name || 'N/A'}</Typography>
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
                      {format(new Date(program.start_date), 'MMMM dd, yyyy')}
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
                      {format(new Date(program.end_date), 'MMMM dd, yyyy')}
                    </Typography>
                  )}
                </Grid>
                <Grid item xs={12} sm={6} md={6} sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
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

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Projects
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Project Name</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>End Date</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Capital Budget</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Expense Budget</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Budget</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {projects.map((project) => {
                      const projectCapital = (project.phases || []).reduce((sum, phase) => sum + Number(phase.capital_budget || 0), 0)
                      const projectExpense = (project.phases || []).reduce((sum, phase) => sum + Number(phase.expense_budget || 0), 0)
                      const projectTotal = (project.phases || []).reduce((sum, phase) => sum + Number(phase.total_budget || 0), 0)
                      
                      return (
                        <TableRow
                          key={project.id}
                          hover
                          onClick={() => handleProjectRowClick(project)}
                          sx={{ 
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            '&:hover': {
                              border: '2px solid',
                              borderColor: 'primary.main',
                            },
                          }}
                        >
                          <TableCell>{project.name}</TableCell>
                          <TableCell>{format(new Date(project.start_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>{format(new Date(project.end_date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell align="right">
                            ${projectCapital.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right">
                            ${projectExpense.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell align="right">
                            ${projectTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    <TableRow sx={{ backgroundColor: 'grey.100' }}>
                      <TableCell sx={{ fontWeight: 'bold', borderTop: 2, borderColor: 'grey.400' }}>
                        Total
                      </TableCell>
                      <TableCell sx={{ borderTop: 2, borderColor: 'grey.400' }} />
                      <TableCell sx={{ borderTop: 2, borderColor: 'grey.400' }} />
                      <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 2, borderColor: 'grey.400' }}>
                        ${totalCapitalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 2, borderColor: 'grey.400' }}>
                        ${totalExpenseBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 2, borderColor: 'grey.400' }}>
                        ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={projects}
                    getOptionLabel={(option) => option.name}
                    value={selectedProject}
                    onChange={(_, newValue) => handleProjectChange(newValue?.id || null)}
                    loading={projectsLoading}
                    disabled={projectsLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Project"
                        placeholder="All"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {projectsLoading ? <CircularProgress size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <Autocomplete
                    options={phases}
                    getOptionLabel={(option) => option.name}
                    value={selectedPhase}
                    onChange={(_, newValue) => handlePhaseChange(newValue?.id || null)}
                    loading={phasesLoading}
                    disabled={!selectedProjectId || phasesLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Phase"
                        placeholder="All"
                        InputProps={{
                          ...params.InputProps,
                          endAdornment: (
                            <>
                              {phasesLoading ? <CircularProgress size={20} /> : null}
                              {params.InputProps.endAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>

          <Grid item xs={12}>
            <FinancialSummaryTable
              data={financialTableData}
              loading={forecastLoading}
              error={forecastError ? new Error('Failed to load financial data') : null}
            />
          </Grid>
        </Grid>
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
          // Reload the program data
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

export default ProgramDetailPage
