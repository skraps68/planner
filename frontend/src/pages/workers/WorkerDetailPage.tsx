import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Edit as EditIcon } from '@mui/icons-material'
import { workersApi, workerTypesApi } from '../../api/workers'
import { Worker, WorkerType } from '../../types'

const WorkerDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [worker, setWorker] = useState<Worker | null>(null)
  const [workerTypes, setWorkerTypes] = useState<WorkerType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [formData, setFormData] = useState({
    external_id: '',
    name: '',
    worker_type_id: '',
    version: 0,
  })
  const [isEditing, setIsEditing] = useState(false)

  const isNewWorker = id === 'new'

  useEffect(() => {
    fetchWorkerTypes()
    if (!isNewWorker && id) {
      fetchWorker()
    } else {
      setLoading(false)
    }
  }, [id])

  const fetchWorker = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await workersApi.get(id!)
      setWorker(data)
      setFormData({
        external_id: data.external_id,
        name: data.name,
        worker_type_id: data.worker_type_id,
        version: data.version,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load worker')
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkerTypes = async () => {
    try {
      const data = await workerTypesApi.list()
      setWorkerTypes(data)
    } catch (err: any) {
      console.error('Failed to load worker types:', err)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (isNewWorker) {
        await workersApi.create(formData)
        navigate('/workers')
      } else {
        await workersApi.update(id!, formData)
        await fetchWorker()
        setIsEditing(false)
        setSnackbar({ open: true, message: 'Worker saved successfully', severity: 'success' })
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save worker')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (worker) {
      setFormData({
        external_id: worker.external_id,
        name: worker.name,
        worker_type_id: worker.worker_type_id,
        version: worker.version,
      })
    }
    setIsEditing(false)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/workers')} sx={{ mr: 1.5 }}>
          Back
        </Button>
        <Typography variant="h5">
          {isNewWorker ? 'Create Worker' : 'Worker Details'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 1.5 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {!isNewWorker ? (
            <Grid container rowSpacing={1} columnSpacing={1}>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Name</Typography>
                {isEditing ? (
                  <TextField fullWidth size="small" value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} sx={{ mt: 0.5 }} />
                ) : (
                  <Typography variant="body1">{formData.name}</Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">External ID</Typography>
                {isEditing ? (
                  <TextField fullWidth size="small" value={formData.external_id}
                    onChange={(e) => setFormData({ ...formData, external_id: e.target.value })} sx={{ mt: 0.5 }} />
                ) : (
                  <Typography variant="body1">{formData.external_id}</Typography>
                )}
              </Grid>
              <Grid item xs={12} sm={4} sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-start' }}>
                {!isEditing ? (
                  <Button variant="contained" size="small" startIcon={<EditIcon />} onClick={() => setIsEditing(true)}>
                    Edit
                  </Button>
                ) : (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button variant="outlined" size="small" onClick={handleCancelEdit} disabled={saving}>Cancel</Button>
                    <Button variant="contained" size="small" onClick={handleSave} disabled={saving}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </Box>
                )}
              </Grid>
              <Grid item xs={12} sm={4}>
                <Typography variant="caption" color="text.secondary">Worker Type</Typography>
                {isEditing ? (
                  <FormControl fullWidth size="small" sx={{ mt: 0.5 }}>
                    <Select value={formData.worker_type_id}
                      onChange={(e) => setFormData({ ...formData, worker_type_id: e.target.value })}>
                      {workerTypes.map((type) => (
                        <MenuItem key={type.id} value={type.id}>{type.type}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : (
                  <Typography variant="body1">
                    {workerTypes.find((t) => t.id === formData.worker_type_id)?.type || '—'}
                  </Typography>
                )}
              </Grid>
            </Grid>
          ) : (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="Name"
                  size="small"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  fullWidth
                  label="External ID"
                  size="small"
                  value={formData.external_id}
                  onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControl fullWidth required size="small">
                  <InputLabel>Worker Type</InputLabel>
                  <Select
                    value={formData.worker_type_id}
                    label="Worker Type"
                    onChange={(e) => setFormData({ ...formData, worker_type_id: e.target.value })}
                  >
                    {workerTypes.map((type) => (
                      <MenuItem key={type.id} value={type.id}>
                        {type.type}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="outlined" onClick={() => navigate('/workers')}>
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          )}
        </CardContent>
      </Card>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default WorkerDetailPage
