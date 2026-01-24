import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
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
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { resourcesApi } from '../../api/resources'
import { Resource } from '../../types'

const ResourcesListPage = () => {
  const navigate = useNavigate()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [resourceType, setResourceType] = useState<'LABOR' | 'NON_LABOR' | ''>('')

  const fetchResources = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await resourcesApi.list({
        page: page + 1,
        size: rowsPerPage,
        search: search || undefined,
        resource_type: resourceType || undefined,
      })
      setResources(data.items)
      setTotal(data.total)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load resources')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchResources()
  }, [page, rowsPerPage, search, resourceType])

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) {
      return
    }

    try {
      await resourcesApi.delete(id)
      fetchResources()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete resource')
    }
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Resources</Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/resources/new')}
        >
          Create Resource
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <TextField
              label="Search"
              variant="outlined"
              size="small"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flexGrow: 1 }}
            />
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Resource Type</InputLabel>
              <Select
                value={resourceType}
                label="Resource Type"
                onChange={(e) => setResourceType(e.target.value as 'LABOR' | 'NON_LABOR' | '')}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="LABOR">Labor</MenuItem>
                <MenuItem value="NON_LABOR">Non-Labor</MenuItem>
              </Select>
            </FormControl>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
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
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {resources.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No resources found
                    </TableCell>
                  </TableRow>
                ) : (
                  resources.map((resource) => (
                    <TableRow key={resource.id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {resource.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={resource.resource_type}
                          color={resource.resource_type === 'LABOR' ? 'primary' : 'secondary'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{resource.description || '-'}</TableCell>
                      <TableCell>
                        {new Date(resource.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/resources/${resource.id}`)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton size="small" onClick={() => handleDelete(resource.id)}>
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

export default ResourcesListPage
