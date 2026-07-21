import React, { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
  Switch,
  FormControlLabel,
} from '@mui/material'
import { Edit, ArrowBack, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { projectsApi } from '../../api/projects'
import { programsApi } from '../../api/programs'
import { phasesApi } from '../../api/phases'
import { getProjectForecast } from '../../api/forecast'
import { transformForecastData, LaborToggle } from '../../utils/forecastTransform'
import { nextToggleState } from './laborToggle'
import { format } from 'date-fns'
import PhaseEditor from '../../components/phases/PhaseEditor'
import { FinancialSummaryTable } from '../../components/portfolio/FinancialSummaryTable'
import ChartSection from '../../components/portfolio/ChartSection'
import DetailPaneHeader from '../../components/common/DetailPaneHeader'
import DetailField from '../../components/common/DetailField'
import ResourceAssignmentCalendar from '../../components/resources/ResourceAssignmentCalendar'
import ProjectActualsTab from '../../components/actuals/ProjectActualsTab'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div hidden={value !== index} style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {value === index && children}
    </div>
  )
}

const ProjectDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // The URL is the single source of truth for the active tab (?tab=N, clamped).
  // - Selecting a different project in the nav tree lands on a bare /projects/:id
  //   URL, so the new project always opens on the default Details tab.
  // - Tab switches rewrite the URL in place (replace), so returning from a
  //   resource page via the browser back button restores the tab you left.
  const [searchParams, setSearchParams] = useSearchParams()
  const tabValue = useMemo(() => {
    const tabParam = searchParams.get('tab')
    const parsed = tabParam ? parseInt(tabParam, 10) : 0
    return Math.min(Math.max(Number.isNaN(parsed) ? 0 : parsed, 0), 2)
  }, [searchParams])
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
    description: '',
    start_date: '',
    end_date: '',
    version: 1,
  })
  // Financials drill-down state
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null)
  // Labor / Non-Labor toggle state for the financial panel
  const [toggle, setToggle] = useState<LaborToggle>({ laborOn: true, nonlaborOn: true })

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

  // Fetch phases for the financials drill-down
  const { data: phases = [] } = useQuery({
    queryKey: ['phases', id],
    queryFn: () => phasesApi.list(id!),
    enabled: !!id,
  })

  // Fetch forecast for the financials panel, scoped to the selected phase.
  // The raw API response doesn't change with the labor/non-labor toggle, so the
  // toggle is intentionally excluded from the queryKey and applied separately
  // below (useMemo) to avoid refetching on every toggle flip.
  const { data: rawForecastData, isLoading: forecastLoading, error: forecastError } = useQuery({
    queryKey: ['forecast', 'project', id, selectedPhaseId],
    queryFn: async () => {
      return await getProjectForecast(id!, new Date().toISOString().split('T')[0], selectedPhaseId || undefined)
    },
    enabled: !!id,
  })

  const forecastData = useMemo(() => {
    if (!rawForecastData) return null
    return transformForecastData(rawForecastData, toggle)
  }, [rawForecastData, toggle])

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

  // Handle tab change: reflect the tab in the URL (replace, not push, so
  // switching tabs doesn't stack history entries)
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    const next = new URLSearchParams(searchParams)
    if (newValue === 0) {
      next.delete('tab')
    } else {
      next.set('tab', String(newValue))
    }
    setSearchParams(next, { replace: true })
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

  const handleEditInfo = () => {
    if (project) {
      setEditValues({
        name: project.name,
        business_sponsor: project.business_sponsor,
        project_manager: project.project_manager,
        technical_lead: project.technical_lead,
        cost_center_code: project.cost_center_code,
        description: project.description || '',
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
      // Refresh the hierarchy views (slim tree / rich list) so the new name shows
      queryClient.invalidateQueries({ queryKey: ['projects'] })
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

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', overflow: 'hidden' }}>
      <DetailPaneHeader
        title={project.name}
        statusChip={<Chip label={status} color={statusColor} />}
        onClose={() => navigate('/portfolios')}
      />

      <Paper sx={{ mb: 2 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Details" />
          <Tab label="Assignments" />
          <Tab label="Actuals" />
        </Tabs>
      </Paper>

      <TabPanel value={tabValue} index={0}>
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
                <DetailField label="Project Name" editing={isEditingInfo} value={project.name}>
                  <TextField fullWidth size="small" value={editValues.name}
                    onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} />
                </DetailField>
                <DetailField label="ID" editing={isEditingInfo} value={project.business_id} />
                <DetailField label="Business Sponsor" editing={isEditingInfo} value={project.business_sponsor}>
                  <TextField fullWidth size="small" value={editValues.business_sponsor}
                    onChange={(e) => setEditValues({ ...editValues, business_sponsor: e.target.value })} />
                </DetailField>
                <DetailField label="Project Manager" editing={isEditingInfo} value={project.project_manager}>
                  <TextField fullWidth size="small" value={editValues.project_manager}
                    onChange={(e) => setEditValues({ ...editValues, project_manager: e.target.value })} />
                </DetailField>
                <DetailField label="Technical Lead" editing={isEditingInfo} value={project.technical_lead}>
                  <TextField fullWidth size="small" value={editValues.technical_lead}
                    onChange={(e) => setEditValues({ ...editValues, technical_lead: e.target.value })} />
                </DetailField>
                <DetailField label="Program" editing={isEditingInfo} value={program?.name || 'Loading...'} />
                <DetailField label="Cost Center" editing={isEditingInfo} value={project.cost_center_code}>
                  <TextField fullWidth size="small" value={editValues.cost_center_code}
                    onChange={(e) => setEditValues({ ...editValues, cost_center_code: e.target.value })} />
                </DetailField>
                <DetailField label="Start Date" editing={isEditingInfo}
                  value={format(new Date(project.start_date), 'MMMM dd, yyyy')}>
                  <TextField fullWidth size="small" type="date" value={editValues.start_date}
                    onChange={(e) => setEditValues({ ...editValues, start_date: e.target.value })} />
                </DetailField>
                <DetailField label="End Date" editing={isEditingInfo}
                  value={format(new Date(project.end_date), 'MMMM dd, yyyy')}>
                  <TextField fullWidth size="small" type="date" value={editValues.end_date}
                    onChange={(e) => setEditValues({ ...editValues, end_date: e.target.value })} />
                </DetailField>
                <DetailField label="Description" editing={isEditingInfo} value={project.description} multiline>
                  <TextField fullWidth multiline rows={3} size="small" value={editValues.description}
                    onChange={(e) => setEditValues({ ...editValues, description: e.target.value })} />
                </DetailField>
              </Grid>
            </Paper>
          </Grid>
          <Grid item xs={12} md={7}>
            <Paper sx={{ p: 1.5, height: '100%' }}>
              {/* Drill-down filter: scope financials to a phase */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Autocomplete
                  size="small"
                  sx={{ flex: 1, maxWidth: 320 }}
                  options={phases}
                  getOptionLabel={(option: any) => option.name}
                  value={phases.find((p: any) => p.id === selectedPhaseId) || null}
                  onChange={(_, newValue: any) => setSelectedPhaseId(newValue?.id || null)}
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
                data={forecastData || null}
                loading={forecastLoading}
                error={forecastError ? new Error('Failed to load financial data') : null}
              />
              <ChartSection compact data={forecastData || null} />
            </Paper>
          </Grid>
        </Grid>

        <PhaseEditor
          projectId={id!}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
          onSaveSuccess={handlePhaseSaveSuccess}
          onSaveError={handlePhaseSaveError}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <ResourceAssignmentCalendar
          projectId={id!}
          projectStartDate={project.start_date}
          projectEndDate={project.end_date}
          onSaveSuccess={handleAssignmentSaveSuccess}
          onSaveError={handleAssignmentSaveError}
          projectBreadcrumbItems={[
            { label: project.name, path: `/projects/${id}?tab=1` },
          ]}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <ProjectActualsTab projectId={id!} />
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
