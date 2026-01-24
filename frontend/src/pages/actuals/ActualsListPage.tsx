import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  Alert,
} from '@mui/material'
import { DataGrid, GridColDef, GridPaginationModel, GridValueFormatterParams, GridValueGetterParams } from '@mui/x-data-grid'
import { Add as AddIcon, Upload as UploadIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { actualsApi } from '../../api/actuals'
import { Actual } from '../../types'
import { format } from 'date-fns'

const ActualsListPage = () => {
  const navigate = useNavigate()
  const [actuals, setActuals] = useState<Actual[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  })
  const [rowCount, setRowCount] = useState(0)

  // Filters
  const [projectId, setProjectId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)

  const fetchActuals = async () => {
    setLoading(true)
    setError(null)

    try {
      const params: any = {
        page: paginationModel.page + 1,
        size: paginationModel.pageSize,
      }

      if (projectId) params.project_id = projectId
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
  }, [paginationModel])

  const handleSearch = () => {
    setPaginationModel({ ...paginationModel, page: 0 })
    fetchActuals()
  }

  const handleClearFilters = () => {
    setProjectId('')
    setWorkerId('')
    setStartDate(null)
    setEndDate(null)
    setPaginationModel({ ...paginationModel, page: 0 })
  }

  const columns: GridColDef[] = [
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
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Actuals</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
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

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Filters
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Project ID"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                fullWidth
                label="Worker ID"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                slotProps={{ textField: { size: 'small', fullWidth: true } }}
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
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ height: 600, width: '100%' }}>
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
          onRowClick={(params) => navigate(`/actuals/${params.id}`)}
          sx={{
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
            },
          }}
        />
      </Paper>
    </Box>
  )
}

export default ActualsListPage
