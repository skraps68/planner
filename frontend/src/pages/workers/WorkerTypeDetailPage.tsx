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
  Grid,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon, Add as AddIcon } from '@mui/icons-material'
import { workerTypesApi } from '../../api/workers'
import { ratesApi, RateHistory } from '../../api/rates'
import { WorkerType } from '../../types'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  )
}

const WorkerTypeDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workerType, setWorkerType] = useState<WorkerType | null>(null)
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [showRateDialog, setShowRateDialog] = useState(false)
  const [newRate, setNewRate] = useState({
    rate_amount: '',
    effective_date: new Date().toISOString().split('T')[0],
  })
  const [formData, setFormData] = useState({
    type: '',
    description: '',
  })

  const isNewWorkerType = id === 'new'

  useEffect(() => {
    if (!isNewWorkerType && id) {
      fetchWorkerType()
      fetchRateHistory()
    } else {
      setLoading(false)
    }
  }, [id, isNewWorkerType])

  const fetchWorkerType = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await workerTypesApi.get(id!)
      setWorkerType(data)
      setFormData({
        type: data.type,
        description: data.description,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load worker type')
    } finally {
      setLoading(false)
    }
  }

  const fetchRateHistory = async () => {
    try {
      const data = await ratesApi.getRateHistory(id!)
      setRateHistory(data.rate_history)
    } catch (err: any) {
      console.error('Failed to load rate history:', err)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (isNewWorkerType) {
        await workerTypesApi.create(formData)
        navigate('/workers')
      } else {
        await workerTypesApi.update(id!, formData)
        fetchWorkerType()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save worker type')
    } finally {
      setSaving(false)
    }
  }

  const handleAddRate = async () => {
    try {
      setError(null)
      await ratesApi.updateRate(id!, parseFloat(newRate.rate_amount), newRate.effective_date)
      setShowRateDialog(false)
      setNewRate({
        rate_amount: '',
        effective_date: new Date().toISOString().split('T')[0],
      })
      fetchRateHistory()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to add rate')
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
          {isNewWorkerType ? 'Create Worker Type' : 'Worker Type Details'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isNewWorkerType ? (
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Type"
                  value={formData.type}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, type: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                  required
                />
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
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={tabValue} onChange={(_: React.SyntheticEvent, newValue: number) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Details" />
            <Tab label="Rate History" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Card>
              <CardContent>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Type"
                      value={formData.type}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, type: e.target.value })}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={formData.description}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, description: e.target.value })}
                      multiline
                      rows={3}
                      required
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button variant="outlined" onClick={() => navigate('/workers')}>
                        Cancel
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ mb: 2 }}>
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => setShowRateDialog(true)}>
                Add Rate
              </Button>
            </Box>
            <Paper>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Rate Amount</TableCell>
                      <TableCell>Start Date</TableCell>
                      <TableCell>End Date</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rateHistory.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} align="center">
                          No rate history found
                        </TableCell>
                      </TableRow>
                    ) : (
                      rateHistory.map((rate: RateHistory) => (
                        <TableRow key={rate.id}>
                          <TableCell>${rate.rate_amount}</TableCell>
                          <TableCell>{new Date(rate.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            {rate.end_date ? new Date(rate.end_date).toLocaleDateString() : 'Current'}
                          </TableCell>
                          <TableCell>{rate.is_current ? 'Active' : 'Closed'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </TabPanel>
        </>
      )}

      <Dialog open={showRateDialog} onClose={() => setShowRateDialog(false)}>
        <DialogTitle>Add New Rate</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2, minWidth: 400 }}>
            <TextField
              fullWidth
              label="Rate Amount"
              type="number"
              value={newRate.rate_amount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRate({ ...newRate, rate_amount: e.target.value })}
              required
            />
            <TextField
              fullWidth
              label="Effective Date"
              type="date"
              value={newRate.effective_date}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRate({ ...newRate, effective_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowRateDialog(false)}>Cancel</Button>
          <Button onClick={handleAddRate} variant="contained">
            Add Rate
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default WorkerTypeDetailPage
