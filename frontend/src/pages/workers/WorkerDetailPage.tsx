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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
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
  const [formData, setFormData] = useState({
    external_id: '',
    name: '',
    worker_type_id: '',
  })

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
        fetchWorker()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save worker')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/workers')} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4">
          {isNewWorker ? 'Create Worker' : 'Worker Details'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="External ID"
                value={formData.external_id}
                onChange={(e) => setFormData({ ...formData, external_id: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <FormControl fullWidth required>
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
                  {saving ? 'Saving...' : isNewWorker ? 'Create' : 'Save Changes'}
                </Button>
                <Button variant="outlined" onClick={() => navigate('/workers')}>
                  Cancel
                </Button>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  )
}

export default WorkerDetailPage
