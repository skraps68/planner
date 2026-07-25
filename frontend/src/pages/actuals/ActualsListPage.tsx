import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel, GridValueFormatterParams, GridValueGetterParams } from '@mui/x-data-grid'
import { Add as AddIcon, Upload as UploadIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { actualsApi } from '../../api/actuals'
import { projectsApi } from '../../api/projects'
import { Actual, Project } from '../../types'
import { format } from 'date-fns'
import { prioritizeGridColumns } from '../../components/common/DataTable'

const ActualsListPage = () => {
  const navigate = useNavigate()
  const [actuals, setActuals] = useState<Actual[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  })
  const [rowCount, setRowCount] = useState(0)

  // Filters
  const [projectId, setProjectId] = useState('all')
  const [workerId, setWorkerId] = useState('')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  // Fetch projects for dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await projectsApi.list({ limit: 1000 })
        setProjects(response.items)
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    fetchProjects()
  }, [])

  const fetchActuals = async () => {
    setLoading(true)
    setError(null)

    try {
      const params: any = {
        page: paginationModel.page + 1,
        size: paginationModel.pageSize,
      }

      if (projectId && projectId !== 'all') params.project_id = projectId
      if (workerId) params.external_worker_id = workerId
      if (startDate) params.start_date = format(startDate, 'yyyy-MM-dd')
      if (endDate) params.end_date = format(endDate, 'yyyy-MM-dd')

      const response = await actualsApi.listActuals(params)
      setActuals(response.items)
      setRowCount(response.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load actuals')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActuals()
  }, [paginationModel, projectId])

  const handleSearch = () => {
    setPaginationModel({ ...paginationModel, page: 0 })
    fetchActuals()
  }

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleClearFilters = () => {
    setProjectId('all')
    setWorkerId('')
    setStartDate(null)
    setEndDate(null)
    setPaginationModel({ ...paginationModel, page: 0 })
  }

  const columns: GridColDef[] = prioritizeGridColumns([
    {
      field: 'actual_date',
      headerName: 'Date',
      width: 120,
      valueFormatter: (params: GridValueFormatterParams) => format(new Date(params.value as string), 'yyyy-MM-dd'),
    },
    {
      field: 'worker_name',
      headerName: 'Worker',
      width: 180,
    },
    {
      field: 'external_worker_id',
      headerName: 'Worker ID',
      width: 120,
    },
    {
      field: 'project_name',
      headerName: 'Project',
      width: 200,
      valueGetter: (params: GridValueGetterParams) => {
        const row = params.row as Actual
        return row.project_name || 'N/A'
      },
    },
    {
      field: 'allocation_percentage',
      headerName: 'Allocation %',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params: GridValueFormatterParams) => `${params.value}%`,
    },
    {
      field: 'actual_cost',
      headerName: 'Cost',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
    },
    {
      field: 'capital_amount',
      headerName: 'Capital',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
    },
    {
      field: 'expense_amount',
      headerName: 'Expense',
      width: 120,
      align: 'right',
      headerAlign: 'right',
      valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
    },
  ])

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5">Actuals</Typography>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={<UploadIcon />}
            onClick={() => navigate('/actuals/import')}
          >
            Import CSV
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/actuals/new')}
          >
            Add Actual
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Project</InputLabel>
                <Select
                  value={projectId}
                  label="Project"
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  <MenuItem value="all">All Projects</MenuItem>
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Worker ID"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                onKeyDown={handleFilterKeyDown}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                slotProps={{ textField: { size: 'small', fullWidth: true, onKeyDown: handleFilterKeyDown } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                slotProps={{ textField: { size: 'small', fullWidth: true, onKeyDown: handleFilterKeyDown } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="contained" onClick={handleSearch} fullWidth>
                  Search
                </Button>
                <Button variant="outlined" onClick={handleClearFilters}>
                  Clear
                </Button>
              </Box>
            </Grid>
          </Grid>
        </LocalizationProvider>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 'calc(100vh - 300px)', width: '100%' }}>
        <DataGrid
          rows={actuals}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[10, 25, 50, 100]}
          rowCount={rowCount}
          paginationMode="server"
          loading={loading}
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  )
}

export default ActualsListPage
