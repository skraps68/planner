import { useState, useEffect } from 'react'
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Grid,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  Chip,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Collapse,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Warning as WarningIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { DatePicker } from '@mui/x-date-pickers/DatePicker'
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider'
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns'
import { useSearchParams } from 'react-router-dom'
import { actualsApi, VarianceAnalysisResponse, ExceptionalVariancesResponse, VarianceRecord } from '../../api/actuals'
import { projectsApi } from '../../api/projects'
import { Project } from '../../types'
import { format } from 'date-fns'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import VarianceDrillDown from '../../components/actuals/VarianceDrillDown'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel = (props: TabPanelProps) => {
  const { children, value, index, ...other } = props
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const VarianceAnalysisPage = () => {
  const [searchParams] = useSearchParams()
  const [projectId, setProjectId] = useState(searchParams.get('project_id') || '')
  const [projects, setProjects] = useState<Project[]>([])
  const [startDate, setStartDate] = useState<Date | null>(
    searchParams.get('start_date') ? new Date(searchParams.get('start_date')!) : null
  )
  const [endDate, setEndDate] = useState<Date | null>(
    searchParams.get('end_date') ? new Date(searchParams.get('end_date')!) : null
  )
  const [allocationThreshold, setAllocationThreshold] = useState(20)
  const [costThreshold, setCostThreshold] = useState(10)
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [varianceData, setVarianceData] = useState<VarianceAnalysisResponse | null>(null)
  const [exceptionsData, setExceptionsData] = useState<ExceptionalVariancesResponse | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set())
  const [selectedVariance, setSelectedVariance] = useState<VarianceRecord | null>(null)
  const [drillDownOpen, setDrillDownOpen] = useState(false)

  const fetchVarianceAnalysis = async () => {
    if (!projectId || !startDate || !endDate) {
      setError('Please provide project ID, start date, and end date')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const [variance, exceptions] = await Promise.all([
        actualsApi.getVarianceAnalysis(
          projectId,
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd'),
          allocationThreshold,
          costThreshold
        ),
        actualsApi.getExceptionalVariances(
          projectId,
          format(startDate, 'yyyy-MM-dd'),
          format(endDate, 'yyyy-MM-dd'),
          allocationThreshold + 10,
          costThreshold + 10
        ),
      ])

      setVarianceData(variance)
      setExceptionsData(exceptions)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load variance analysis')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const loadProjects = async () => {
      try {
        const response = await projectsApi.list()
        setProjects(response.items || [])
      } catch (err) {
        console.error('Failed to load projects:', err)
      }
    }
    loadProjects()
  }, [])

  // Auto-populate dates when project is selected
  useEffect(() => {
    if (projectId && projects.length > 0) {
      const selectedProject = projects.find(p => p.id === projectId)
      if (selectedProject) {
        setStartDate(new Date(selectedProject.start_date))
        setEndDate(new Date(selectedProject.end_date))
      }
    }
  }, [projectId, projects])

  useEffect(() => {
    if (projectId && startDate && endDate) {
      fetchVarianceAnalysis()
    }
  }, [])

  const handleAnalyze = () => {
    fetchVarianceAnalysis()
  }

  const toggleRowExpansion = (index: number) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(index)) {
      newExpanded.delete(index)
    } else {
      newExpanded.add(index)
    }
    setExpandedRows(newExpanded)
  }

  const handleVarianceClick = (variance: VarianceRecord) => {
    setSelectedVariance(variance)
    setDrillDownOpen(true)
  }

  const handleDrillDownClose = () => {
    setDrillDownOpen(false)
    setSelectedVariance(null)
  }

  const renderSummaryCards = () => {
    if (!varianceData) return null

    const summary = varianceData.summary
    const varianceByType = summary.variance_by_type || {}

    // Extract counts from variance_by_type dictionary
    const allocationOver = varianceByType.allocation_over || 0
    const allocationUnder = varianceByType.allocation_under || 0
    const unplannedWork = varianceByType.unplanned_work || 0
    const unworkedAssignment = varianceByType.unworked_assignment || 0

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Total Variances
              </Typography>
              <Typography variant="h4">{summary.total_variances}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Over Allocated
              </Typography>
              <Typography variant="h4" color="error.main">
                {allocationOver}
              </Typography>
              <TrendingUpIcon color="error" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Under Allocated
              </Typography>
              <Typography variant="h4" color="warning.main">
                {allocationUnder}
              </Typography>
              <TrendingDownIcon color="warning" />
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Unplanned Work
              </Typography>
              <Typography variant="h4" color="info.main">
                {unplannedWork}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={2.4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom variant="body2">
                Unworked Assignments
              </Typography>
              <Typography variant="h4" color="text.secondary">
                {unworkedAssignment}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    )
  }

  const renderVarianceChart = () => {
    if (!varianceData) return null

    const summary = varianceData.summary
    const varianceByType = summary.variance_by_type || {}
    
    const allocationOver = varianceByType.allocation_over || 0
    const allocationUnder = varianceByType.allocation_under || 0
    const unplannedWork = varianceByType.unplanned_work || 0
    const unworkedAssignment = varianceByType.unworked_assignment || 0

    const chartData = [
      { name: 'Over Allocated', value: allocationOver, color: '#f44336' },
      { name: 'Under Allocated', value: allocationUnder, color: '#ff9800' },
      { name: 'Unplanned Work', value: unplannedWork, color: '#2196f3' },
      { name: 'Unworked', value: unworkedAssignment, color: '#9e9e9e' },
    ]

    return (
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Variance Distribution
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Variance Breakdown
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#8884d8">
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    )
  }

  const renderVarianceTable = () => {
    if (!varianceData || varianceData.variances.length === 0) {
      return (
        <Alert severity="info">
          No variances found for the selected period and thresholds.
        </Alert>
      )
    }

    return (
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
              <TableCell width={50} sx={{ fontWeight: 'bold' }}></TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Worker</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Forecast %</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actual %</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Variance</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {varianceData.variances.map((variance, index) => (
              <>
                <TableRow 
                  key={index} 
                  hover 
                  onClick={() => handleVarianceClick(variance)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <IconButton size="small" onClick={() => toggleRowExpansion(index)}>
                      {expandedRows.has(index) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </TableCell>
                  <TableCell>
                    {variance.worker_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {variance.worker_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{variance.date}</TableCell>
                  <TableCell align="right">{variance.forecast_allocation}%</TableCell>
                  <TableCell align="right">{variance.actual_allocation}%</TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                      {variance.allocation_variance > 0 ? (
                        <TrendingUpIcon color="error" fontSize="small" />
                      ) : (
                        <TrendingDownIcon color="warning" fontSize="small" />
                      )}
                      <Typography
                        color={variance.allocation_variance > 0 ? 'error' : 'warning.main'}
                        fontWeight="bold"
                      >
                        {variance.allocation_variance}%
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={variance.variance_type.replace('_', ' ')}
                      size="small"
                      color={
                        variance.variance_type.includes('over')
                          ? 'error'
                          : variance.variance_type.includes('under')
                          ? 'warning'
                          : 'info'
                      }
                    />
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={7}>
                    <Collapse in={expandedRows.has(index)} timeout="auto" unmountOnExit>
                      <Box sx={{ margin: 2 }}>
                        <Typography variant="subtitle2" gutterBottom>
                          Variance Details
                        </Typography>
                        <Grid container spacing={2}>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">
                              Variance Percentage:
                            </Typography>
                            <Typography variant="body1">
                              {variance.allocation_variance_percentage?.toFixed(2) || '0.00'}%
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="body2" color="text.secondary">
                              Variance Type:
                            </Typography>
                            <Typography variant="body1">
                              {variance.variance_type.replace('_', ' ').toUpperCase()}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                    </Collapse>
                  </TableCell>
                </TableRow>
              </>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    )
  }

  const renderExceptionsTable = () => {
    if (!exceptionsData || exceptionsData.total_exceptions === 0) {
      return (
        <Alert severity="success">
          No exceptional variances found. All variances are within acceptable thresholds.
        </Alert>
      )
    }

    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 3 }}>
          Found {exceptionsData.total_exceptions} exceptional variances that exceed high thresholds
          (Allocation: {exceptionsData.thresholds.allocation_threshold}%, Cost:{' '}
          {exceptionsData.thresholds.cost_threshold}%)
        </Alert>

        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Worker</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Variance</TableCell>
                <TableCell align="right">Variance %</TableCell>
                <TableCell>Severity</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {exceptionsData.exceptions.map((exception, index) => (
                <TableRow key={index}>
                  <TableCell>
                    {exception.worker_name}
                    <Typography variant="caption" display="block" color="text.secondary">
                      {exception.worker_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{exception.date}</TableCell>
                  <TableCell>
                    <Chip
                      label={exception.variance_type.replace('_', ' ')}
                      size="small"
                      color="error"
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Typography color="error" fontWeight="bold">
                      {exception.allocation_variance}%
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{exception.allocation_variance_percentage?.toFixed(2) || '0.00'}%</TableCell>
                  <TableCell>
                    <Chip
                      icon={<WarningIcon />}
                      label={exception.severity}
                      size="small"
                      color={exception.severity === 'HIGH' ? 'error' : 'warning'}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Variance Analysis
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Analysis Parameters
        </Typography>
        <LocalizationProvider dateAdapter={AdapterDateFns}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small" required>
                <InputLabel>Project</InputLabel>
                <Select
                  value={projectId}
                  label="Project"
                  onChange={(e) => setProjectId(e.target.value)}
                >
                  {projects.map((project) => (
                    <MenuItem key={project.id} value={project.id}>
                      {project.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="Start Date"
                value={startDate}
                onChange={setStartDate}
                slotProps={{ textField: { size: 'small', fullWidth: true, required: true } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <DatePicker
                label="End Date"
                value={endDate}
                onChange={setEndDate}
                slotProps={{ textField: { size: 'small', fullWidth: true, required: true } }}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Allocation Threshold %"
                type="number"
                value={allocationThreshold}
                onChange={(e) => setAllocationThreshold(Number(e.target.value))}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <TextField
                fullWidth
                label="Cost Threshold %"
                type="number"
                value={costThreshold}
                onChange={(e) => setCostThreshold(Number(e.target.value))}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={1}>
              <Button
                variant="contained"
                onClick={handleAnalyze}
                disabled={loading || !projectId || !startDate || !endDate}
                fullWidth
              >
                {loading ? <CircularProgress size={24} /> : 'Analyze'}
              </Button>
            </Grid>
          </Grid>
        </LocalizationProvider>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {varianceData && (
        <>
          {renderSummaryCards()}
          {renderVarianceChart()}

          <Paper sx={{ mb: 3 }}>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
              <Tab label="All Variances" />
              <Tab label="Exceptional Variances" />
            </Tabs>

            <Box sx={{ p: 3 }}>
              <TabPanel value={tabValue} index={0}>
                {renderVarianceTable()}
              </TabPanel>
              <TabPanel value={tabValue} index={1}>
                {renderExceptionsTable()}
              </TabPanel>
            </Box>
          </Paper>
        </>
      )}

      <VarianceDrillDown
        open={drillDownOpen}
        variance={selectedVariance}
        onClose={handleDrillDownClose}
      />
    </Box>
  )
}

export default VarianceAnalysisPage
