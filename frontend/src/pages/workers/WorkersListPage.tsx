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
  Tabs,
  Tab,
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { workersApi, workerTypesApi } from '../../api/workers'
import { Worker, WorkerType } from '../../types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 1.5 }}>{children}</Box>}
    </div>
  )
}

const WorkersListPage = () => {
  const navigate = useNavigate()
  const [tabValue, setTabValue] = useState(0)
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
    if (tabValue === 0) {
      fetchWorkers()
    }
  }, [page, rowsPerPage, search, selectedWorkerType, tabValue])

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

  const handleDeleteWorkerType = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this worker type?')) {
      return
    }

    try {
      await workerTypesApi.delete(id)
      fetchWorkerTypes()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete worker type')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5">Workers & Types</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() =>
            navigate(tabValue === 0 ? '/workers/new' : '/workers/types/new')
          }
        >
          {tabValue === 0 ? 'Create Worker' : 'Create Worker Type'}
        </Button>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
          <Tab label="Workers" />
          <Tab label="Worker Types" />
        </Tabs>
      </Box>

      <TabPanel value={tabValue} index={0}>
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
              <Table>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>External ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Worker Type</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Rate</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} align="center">
                        No workers found
                      </TableCell>
                    </TableRow>
                  ) : (
                    workers.map((worker: Worker) => (
                      <TableRow
                        key={worker.id}
                        hover
                        onClick={() => navigate(`/workers/${worker.id}`)}
                        sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { backgroundColor: 'action.hover' } }}
                      >
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {worker.name}
                          </Typography>
                        </TableCell>
                        <TableCell>{worker.external_id}</TableCell>
                        <TableCell>{workerTypeMap.get(worker.worker_type_id) || worker.worker_type_id}</TableCell>
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
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workerTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No worker types found
                    </TableCell>
                  </TableRow>
                ) : (
                  workerTypes.map((type: WorkerType) => (
                    <TableRow
                      key={type.id}
                      hover
                      onClick={() => navigate(`/workers/types/${type.id}`)}
                      sx={{ cursor: 'pointer', transition: 'all 0.2s ease', '&:hover': { backgroundColor: 'action.hover' } }}
                    >
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {type.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{type.description}</TableCell>
                      <TableCell>{new Date(type.created_at).toLocaleDateString()}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleDeleteWorkerType(type.id) }}>
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </TabPanel>
    </Box>
  )
}

export default WorkersListPage
