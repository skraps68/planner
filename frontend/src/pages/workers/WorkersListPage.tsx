import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { workersApi, workerTypesApi } from '../../api/workers'
import { Worker, WorkerType } from '../../types'
import { usePermissions } from '../../hooks/usePermissions'

const WorkersListPage = () => {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('manage_workers').hasPermission
  const [workers, setWorkers] = useState<Worker[]>([])
  const [workerTypes, setWorkerTypes] = useState<WorkerType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [selectedWorkerType, setSelectedWorkerType] = useState<string>('')

  const fetchWorkers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await workersApi.list({
        page: page + 1,
        size: rowsPerPage,
        search: search || undefined,
        worker_type_id: selectedWorkerType || undefined,
      })
      setWorkers(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load workers')
    } finally {
      setLoading(false)
    }
  }

  const workerTypeMap = new Map(workerTypes.map((type) => [type.id, type.type]))

  const fetchWorkerTypes = async () => {
    try {
      const data = await workerTypesApi.list()
      setWorkerTypes(data)
    } catch (err: any) {
      console.error('Failed to load worker types:', err)
    }
  }

  useEffect(() => {
    fetchWorkerTypes()
  }, [])

  useEffect(() => {
    fetchWorkers()
  }, [page, rowsPerPage, search, selectedWorkerType])

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleDeleteWorker = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this worker?')) {
      return
    }

    try {
      await workersApi.delete(id)
      fetchWorkers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete worker')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5">Workers</Typography>
        {canEdit && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/workers/new')}
          >
            Create Worker
          </Button>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5 }}>
        <TextField
          placeholder="Search workers..."
          size="small"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          sx={{ flexGrow: 1 }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Worker Type</InputLabel>
          <Select
            value={selectedWorkerType}
            label="Worker Type"
            onChange={(e: any) => setSelectedWorkerType(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {workerTypes.map((type: WorkerType) => (
              <MenuItem key={type.id} value={type.id}>
                {type.type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>External ID</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Worker Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Cost Center</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Rate</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No workers found
                    </TableCell>
                  </TableRow>
                ) : (
                  workers.map((worker: Worker) => (
                    <TableRow
                      key={worker.id}
                      hover
                      onClick={() => navigate(`/workers/${worker.id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          {worker.name}
                        </Typography>
                      </TableCell>
                      <TableCell>{worker.external_id}</TableCell>
                      <TableCell>{workerTypeMap.get(worker.worker_type_id) || worker.worker_type_id}</TableCell>
                      <TableCell>{worker.cost_center_code || '—'}</TableCell>
                      <TableCell>
                        {worker.current_rate ? `$${Number(worker.current_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </TableCell>
                      <TableCell>
                        {new Date(worker.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteWorker(worker.id) }}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={total}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </Paper>
      )}
    </Box>
  )
}

export default WorkersListPage
