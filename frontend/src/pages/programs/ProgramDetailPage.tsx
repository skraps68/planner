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
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { Edit, ArrowBack, OpenInNew, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { Project } from '../../types'
import { format } from 'date-fns'
import { usePermissions } from '../../hooks/usePermissions'

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
  const [tabValue, setTabValue] = React.useState(() => {
    // Check if there's a tab parameter in the URL
    const params = new URLSearchParams(location.search)
    const tabParam = params.get('tab')
    return tabParam ? parseInt(tabParam, 10) : 0
  })
  const { canAccessProject } = usePermissions()
  const [isEditingInfo, setIsEditingInfo] = useState(false)
  const [editValues, setEditValues] = useState({
    name: '',
    business_sponsor: '',
    program_manager: '',
    technical_lead: '',
    start_date: '',
    end_date: '',
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

  const { data: program, isLoading, refetch } = useQuery({
    queryKey: ['program', id],
    queryFn: () => programsApi.get(id!),
    enabled: !!id,
  })

  // Fetch projects for this program
  const { data: projectsData, isLoading: projectsLoading } = useQuery({
    queryKey: ['projects', 'program', id],
    queryFn: () => projectsApi.list({ program_id: id!, limit: 1000 }),
    enabled: !!id,
  })

  const projects = projectsData?.items || []

  // Handle tab change - navigate to Financials when tab 1 is clicked
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === 1) {
      // Navigate to Financials with program pre-selected and remember current tab
      navigate(`/portfolio?programId=${id}&returnTo=program&returnId=${id}&returnTab=${tabValue}`)
    } else {
      setTabValue(newValue)
    }
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
    } catch (error) {
      console.error('Failed to update program:', error)
      setSnackbar({
        open: true,
        message: 'Failed to update program information',
        severity: 'error',
      })
    }
  }

  const handleCancelEdit = () => {
    setIsEditingInfo(false)
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
    // Sum up all phases for each project
    const projectBudget = (project.phases || []).reduce((phaseSum, phase) => {
      // Ensure we're adding numbers, not concatenating strings
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
      navigate(`/projects/${project.id}`)
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
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBack />} onClick={() => navigate('/programs')} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>
          {program.name}
        </Typography>
        <Chip label={status} color={statusColor} />
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Details" />
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
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
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
              </Box>
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
              </Grid>
            </Paper>

            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Projects
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Project Name</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>End Date</TableCell>
                      <TableCell align="right">Capital Budget</TableCell>
                      <TableCell align="right">Expense Budget</TableCell>
                      <TableCell align="right">Total Budget</TableCell>
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
                          sx={{ cursor: 'pointer' }}
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

export default ProgramDetailPage
