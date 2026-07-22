import { useState, useEffect, useMemo } from 'react'
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
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import HighlightedLabel from '../../components/portfolio/HighlightedLabel'

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
  const [search, setSearch] = useState('')
  const [selectedWorkerType, setSelectedWorkerType] = useState<string>('')

  // Load the full set once and filter/paginate client-side so search is
  // filter-as-you-type (instant, no round-trip) and matches can be highlighted.
  const fetchWorkers = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await workersApi.list({ page: 1, size: 1000 })
      setWorkers(data.items)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load workers')
    } finally {
      setLoading(false)
    }
  }

  const workerTypeMap = new Map(workerTypes.map((type) => [type.id, type.type]))

  // Filter by the worker-type dropdown and the search term (name + employee/
  // external ID), then paginate the result client-side.
  const filteredWorkers = useMemo(() => {
    const term = search.trim().toLowerCase()
    return workers.filter((w) => {
      if (selectedWorkerType && w.worker_type_id !== selectedWorkerType) return false
      if (!term) return true
      return (
        w.name.toLowerCase().includes(term) ||
        (w.external_id || '').toLowerCase().includes(term)
      )
    })
  }, [workers, search, selectedWorkerType])

  const pagedWorkers = useMemo(
    () => filteredWorkers.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filteredWorkers, page, rowsPerPage]
  )

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
    fetchWorkers()
  }, [])

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
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Workers' },
        ]}
      />

      <Box sx={{ display: 'flex', gap: 1.5, mb: 1.5, alignItems: 'center' }}>
        <TextField
          placeholder="Search name or employee ID..."
          size="small"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => { setSearch(e.target.value); setPage(0) }}
          sx={{ flex: '0 0 40%' }}
        />
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Worker Type</InputLabel>
          <Select
            value={selectedWorkerType}
            label="Worker Type"
            onChange={(e: any) => { setSelectedWorkerType(e.target.value); setPage(0) }}
          >
            <MenuItem value="">All</MenuItem>
            {workerTypes.map((type: WorkerType) => (
              <MenuItem key={type.id} value={type.id}>
                {type.type}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ flexGrow: 1 }} />
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
            <Table size="small" sx={{ '& .MuiTableCell-root': { paddingTop: '1px', paddingBottom: '1px' } }}>
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
                {filteredWorkers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center">
                      No workers found
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedWorkers.map((worker: Worker) => (
                    <TableRow
                      key={worker.id}
                      hover
                      onClick={() => navigate(`/workers/${worker.id}`)}
                      sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>
                        <Typography variant="body2" fontWeight="medium">
                          <HighlightedLabel label={worker.name} term={search} />
                        </Typography>
                      </TableCell>
                      <TableCell><HighlightedLabel label={worker.external_id} term={search} /></TableCell>
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
            count={filteredWorkers.length}
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
