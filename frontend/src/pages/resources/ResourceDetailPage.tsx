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
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from '@mui/material'
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material'
import { resourcesApi } from '../../api/resources'
import { assignmentsApi } from '../../api/assignments'
import { Resource, ResourceAssignment } from '../../types'
import AssignmentCalendar from '../../components/resources/AssignmentCalendar'
import AllocationConflictView from '../../components/resources/AllocationConflictView'

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

const ResourceDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [resource, setResource] = useState<Resource | null>(null)
  const [assignments, setAssignments] = useState<ResourceAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
  })

  const isNewResource = id === 'new'

  useEffect(() => {
    if (!isNewResource && id) {
      fetchResource()
      fetchAssignments()
    } else {
      setLoading(false)
    }
  }, [id])

  const fetchResource = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await resourcesApi.get(id!)
      setResource(data)
      setFormData({
        name: data.name,
        description: data.description || '',
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load resource')
    } finally {
      setLoading(false)
    }
  }

  const fetchAssignments = async () => {
    try {
      const data = await assignmentsApi.getByResource(id!)
      setAssignments(data)
    } catch (err: any) {
      console.error('Failed to load assignments:', err)
    }
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)

      if (isNewResource) {
        await resourcesApi.create({
          name: formData.name,
          resource_type: 'LABOR',
          description: formData.description || undefined,
        })
        navigate('/resources')
      } else {
        await resourcesApi.update(id!, {
          name: formData.name,
          description: formData.description || undefined,
        })
        fetchResource()
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save resource')
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
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/resources')} sx={{ mr: 2 }}>
          Back
        </Button>
        <Typography variant="h4">
          {isNewResource ? 'Create Resource' : 'Resource Details'}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {isNewResource ? (
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  multiline
                  rows={3}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="outlined" onClick={() => navigate('/resources')}>
                    Cancel
                  </Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      ) : (
        <>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 3 }}>
            <Tab label="Details" />
            <Tab label="Assignments" />
            <Tab label="Calendar" />
            <Tab label="Conflicts" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
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
                      label="Type"
                      value={resource?.resource_type || ''}
                      disabled
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Description"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      multiline
                      rows={3}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Button variant="contained" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save Changes'}
                      </Button>
                      <Button variant="outlined" onClick={() => navigate('/resources')}>
                        Cancel
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Paper>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                      <TableCell sx={{ fontWeight: 'bold' }}>Project</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Allocation %</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Capital %</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>Expense %</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {assignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} align="center">
                          No assignments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      assignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>{assignment.project_id}</TableCell>
                          <TableCell>
                            {new Date(assignment.assignment_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{assignment.allocation_percentage}%</TableCell>
                          <TableCell>{assignment.capital_percentage}%</TableCell>
                          <TableCell>{assignment.expense_percentage}%</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <AssignmentCalendar resourceId={id!} />
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <AllocationConflictView resourceId={id!} />
          </TabPanel>
        </>
      )}
    </Box>
  )
}

export default ResourceDetailPage
