import React from 'react'
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
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { Edit, ArrowBack, OpenInNew } from '@mui/icons-material'
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

  const { data: program, isLoading } = useQuery({
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

  // Handle tab change - navigate to Financials when tab 2 is clicked
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    if (newValue === 2) {
      // Navigate to Financials with program pre-selected and remember current tab
      navigate(`/portfolio?programId=${id}&returnTo=program&returnId=${id}&returnTab=${tabValue}`)
    } else {
      setTabValue(newValue)
    }
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

  // Define columns for projects DataGrid
  const projectColumns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Project Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'project_manager',
      headerName: 'Project Manager',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'cost_center_code',
      headerName: 'Cost Center',
      width: 120,
    },
    {
      field: 'start_date',
      headerName: 'Start Date',
      width: 120,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
    {
      field: 'end_date',
      headerName: 'End Date',
      width: 120,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<Project>) => {
        const now = new Date()
        const startDate = new Date(params.row.start_date)
        const endDate = new Date(params.row.end_date)

        let status = 'Active'
        let color: 'success' | 'warning' | 'default' = 'success'

        if (now < startDate) {
          status = 'Planned'
          color = 'warning'
        } else if (now > endDate) {
          status = 'Completed'
          color = 'default'
        }

        return <Chip label={status} color={color} size="small" />
      },
    },
  ]

  const handleProjectRowClick = (params: any) => {
    const projectAccess = canAccessProject(params.row.id, params.row.program_id)
    if (projectAccess.hasPermission) {
      navigate(`/projects/${params.row.id}`)
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
        <Chip label={status} color={statusColor} sx={{ mr: 2 }} />
        <Button variant="contained" startIcon={<Edit />} onClick={() => navigate(`/programs/${id}/edit`)}>
          Edit
        </Button>
      </Box>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Overview" />
          <Tab label="Projects" />
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
                Program Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Program Name
                  </Typography>
                  <Typography variant="body1">{program.name}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Business Sponsor
                  </Typography>
                  <Typography variant="body1">{program.business_sponsor}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Program Manager
                  </Typography>
                  <Typography variant="body1">{program.program_manager}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Technical Lead
                  </Typography>
                  <Typography variant="body1">{program.technical_lead}</Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    Start Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(program.start_date), 'MMMM dd, yyyy')}
                  </Typography>
                </Grid>
                <Grid item xs={6}>
                  <Typography variant="caption" color="text.secondary">
                    End Date
                  </Typography>
                  <Typography variant="body1">
                    {format(new Date(program.end_date), 'MMMM dd, yyyy')}
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
                    Total Projects
                  </Typography>
                  <Typography variant="h4">{totalProjects}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Active Projects
                  </Typography>
                  <Typography variant="h4">{activeProjects}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Total Budget
                  </Typography>
                  <Typography variant="h4">
                    ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper sx={{ height: 600, width: '100%' }}>
          <DataGrid
            rows={projects}
            columns={projectColumns}
            loading={projectsLoading}
            pageSizeOptions={[10, 25, 50, 100]}
            initialState={{
              pagination: {
                paginationModel: { page: 0, pageSize: 25 },
              },
            }}
            paginationMode="client"
            disableRowSelectionOnClick
            onRowClick={handleProjectRowClick}
            sx={{
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'action.hover',
                  border: '2px solid',
                  borderColor: 'primary.main',
                },
              },
            }}
          />
        </Paper>
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        {/* This tab navigates to Financials page - content not needed */}
      </TabPanel>
    </Box>
  )
}

export default ProgramDetailPage
