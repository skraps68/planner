import React, { useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  Chip,
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
  Switch,
  FormControlLabel,
} from '@mui/material'
import { Edit, ArrowBack, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { programsApi } from '../../api/programs'
import { portfoliosApi } from '../../api/portfolios'
import { projectsApi } from '../../api/projects'
import { phasesApi } from '../../api/phases'
import { getProgramForecast, getProjectForecast } from '../../api/forecast'
import { transformForecastData, LaborToggle } from '../../utils/forecastTransform'
import { nextToggleState } from '../projects/laborToggle'
import { FinancialSummaryTable } from '../../components/portfolio/FinancialSummaryTable'
import ChartSection from '../../components/portfolio/ChartSection'
import { Project } from '../../types'
import { format } from 'date-fns'
import { usePermissions } from '../../hooks/usePermissions'
import DetailPaneHeader from '../../components/common/DetailPaneHeader'
import DetailField from '../../components/common/DetailField'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'

const ProgramDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { canAccessProject } = usePermissions()
  const { conflictState, handleError, clearConflict } = useConflictHandler()
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editValues, setEditValues] = useState({
    name: '',
    business_sponsor: '',
    program_manager: '',
    technical_lead: '',
    description: '',
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

  // Financials drill-down state
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  // Labor / Non-Labor toggle state for the financial panel
  const [toggle, setToggle] = useState<LaborToggle>({ laborOn: true, nonlaborOn: true })

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

  // Fetch phases for the selected project (financials drill-down)
  const { data: phasesData, isLoading: phasesLoading } = useQuery({
    queryKey: ['phases', selectedProjectId],
    queryFn: () => phasesApi.list(selectedProjectId!),
    enabled: !!selectedProjectId,
  })

  const phases = phasesData || []

  // Fetch forecast for the financials panel, scoped to the drill-down selection
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
    enabled: !!id,
  })

  // Transform forecast data for display
  const financialTableData = useMemo(() => {
    if (!forecastData) return null
    return transformForecastData(forecastData, toggle)
  }, [forecastData, toggle])

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
        description: program.description || '',
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
      // Refresh the hierarchy views (slim tree / rich list) so the new name shows
      queryClient.invalidateQueries({ queryKey: ['programs'] })
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
          portfolioId: program?.portfolio?.id,
          portfolioName: program?.portfolio?.name,
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

  return (
    <Box>
      <DetailPaneHeader
        title={program.name}
        statusChip={<Chip label={status} color={statusColor} />}
        onClose={() => navigate('/portfolios')}
      />

      {/* Combined Details + Financials split view */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 1.5, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minHeight: 34, mb: 0.5 }}>
              {!isEditingInfo ? (
                <Button variant="contained" size="small" startIcon={<Edit />} onClick={handleEditInfo}>
                  Edit
                </Button>
              ) : (
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleCancelEdit}>
                    Cancel
                  </Button>
                  <Button variant="contained" size="small" startIcon={<SaveIcon />} onClick={handleSaveInfo}>
                    Save
                  </Button>
                </Box>
              )}
            </Box>
            <Grid container rowSpacing={0.25} columnSpacing={1}>
              <DetailField label="Program Name" editing={isEditingInfo} value={program.name}>
                <TextField fullWidth size="small" value={editValues.name}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
              </DetailField>
              <DetailField label="ID" editing={isEditingInfo} value={program.business_id} />
              <DetailField label="Business Sponsor" editing={isEditingInfo} value={program.business_sponsor}>
                <TextField fullWidth size="small" value={editValues.business_sponsor}
                  onChange={(e) => setEditValues({ ...editValues, business_sponsor: e.target.value })} />
              </DetailField>
              <DetailField label="Program Manager" editing={isEditingInfo} value={program.program_manager}>
                <TextField fullWidth size="small" value={editValues.program_manager}
                  onChange={(e) => setEditValues({ ...editValues, program_manager: e.target.value })} />
              </DetailField>
              <DetailField label="Technical Lead" editing={isEditingInfo} value={program.technical_lead}>
                <TextField fullWidth size="small" value={editValues.technical_lead}
                  onChange={(e) => setEditValues({ ...editValues, technical_lead: e.target.value })} />
              </DetailField>
              <DetailField label="Portfolio" editing={isEditingInfo} value={program.portfolio?.name || 'N/A'}>
                <Autocomplete
                  fullWidth
                  size="small"
                  options={portfolios}
                  getOptionLabel={(option) => option.name}
                  value={portfolios.find((p) => p.id === editValues.portfolio_id) || null}
                  onChange={(_, newValue) => setEditValues({ ...editValues, portfolio_id: newValue?.id || '' })}
                  renderInput={(params) => (
                    <TextField {...params} size="small" placeholder="Select Portfolio" />
                  )}
                />
              </DetailField>
              <DetailField label="Start Date" editing={isEditingInfo}
                value={format(new Date(program.start_date), 'MMMM dd, yyyy')}>
                <TextField fullWidth size="small" type="date" value={editValues.start_date}
                  onChange={(e) => setEditValues({ ...editValues, start_date: e.target.value })} />
              </DetailField>
              <DetailField label="End Date" editing={isEditingInfo}
                value={format(new Date(program.end_date), 'MMMM dd, yyyy')}>
                <TextField fullWidth size="small" type="date" value={editValues.end_date}
                  onChange={(e) => setEditValues({ ...editValues, end_date: e.target.value })} />
              </DetailField>
              <DetailField label="Description" editing={isEditingInfo} value={program.description} multiline>
                <TextField fullWidth multiline rows={3} size="small" value={editValues.description}
                  onChange={(e) => setEditValues({ ...editValues, description: e.target.value })} />
              </DetailField>
            </Grid>
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 1.5, height: '100%' }}>
            {/* Drill-down filters: scope financials to a project / phase */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Autocomplete
                size="small"
                sx={{ flex: 1 }}
                options={projects}
                getOptionLabel={(option) => option.name}
                value={projects.find(p => p.id === selectedProjectId) || null}
                onChange={(_, newValue) => handleProjectChange(newValue?.id || null)}
                renderInput={(params) => (
                  <TextField {...params} label="Project" placeholder="All" />
                )}
              />
              <Autocomplete
                size="small"
                sx={{ flex: 1 }}
                options={phases}
                getOptionLabel={(option) => option.name}
                value={phases.find(p => p.id === selectedPhaseId) || null}
                onChange={(_, newValue) => setSelectedPhaseId(newValue?.id || null)}
                loading={phasesLoading}
                disabled={!selectedProjectId || phasesLoading}
                renderInput={(params) => (
                  <TextField {...params} label="Phase" placeholder="All" />
                )}
              />
              <Box sx={{ display: 'flex', ml: 'auto' }}>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={toggle.laborOn}
                      onChange={() => setToggle(nextToggleState(toggle, 'labor'))}
                    />
                  }
                  label="Labor"
                />
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={toggle.nonlaborOn}
                      onChange={() => setToggle(nextToggleState(toggle, 'nonlabor'))}
                    />
                  }
                  label="Non-Labor"
                />
              </Box>
            </Box>
            <FinancialSummaryTable
              compact
              data={financialTableData}
              loading={forecastLoading}
              error={forecastError ? new Error('Failed to load financial data') : null}
            />
            <ChartSection compact data={financialTableData} />
          </Paper>
        </Grid>
      </Grid>

      <Paper sx={{ p: 2 }}>
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
                            ${projectCapital.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell align="right">
                            ${projectExpense.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </TableCell>
                          <TableCell align="right">
                            ${projectTotal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
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
                        ${totalCapitalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 2, borderColor: 'grey.400' }}>
                        ${totalExpenseBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 'bold', borderTop: 2, borderColor: 'grey.400' }}>
                        ${totalBudget.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

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
