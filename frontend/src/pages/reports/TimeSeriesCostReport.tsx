import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Card,
  CardContent,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material'
import { Download, ShowChart } from '@mui/icons-material'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import { reportsApi, TimeSeriesDataPoint } from '../../api/reports'
import { projectsApi } from '../../api/projects'
import { format, parseISO } from 'date-fns'

const TimeSeriesCostReport: React.FC = () => {
  const [projectId, setProjectId] = useState<string>('')
  const [projects, setProjects] = useState<any[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [interval, setInterval] = useState<'daily' | 'weekly' | 'monthly'>('monthly')
  const [chartType, setChartType] = useState<'line' | 'area'>('line')
  const [showCumulative, setShowCumulative] = useState(false)
  const [loading, setLoading] = useState(false)
  const [timeSeriesData, setTimeSeriesData] = useState<TimeSeriesDataPoint[]>([])
  const [error, setError] = useState<string | null>(null)

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
        setStartDate(selectedProject.start_date)
        setEndDate(selectedProject.end_date)
      }
    }
  }, [projectId, projects])

  const loadTimeSeriesData = async () => {
    if (!projectId || !startDate || !endDate) {
      setError('Please select project and date range')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await reportsApi.getTimeSeriesReport(
        projectId,
        startDate,
        endDate,
        interval
      )
      setTimeSeriesData(response.time_series || [])
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load time series data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'excel' | 'pdf') => {
    alert(`Export to ${format.toUpperCase()} - Feature coming soon!`)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy')
    } catch {
      return dateString
    }
  }

  const chartData = timeSeriesData.map((point) => ({
    date: formatDate(point.data_date),
    Budget: showCumulative ? point.cumulative_budget : point.budget,
    Actual: showCumulative ? point.cumulative_actual : point.actual,
    Forecast: showCumulative ? point.cumulative_forecast : point.forecast
  }))

  const summaryStats = timeSeriesData.length > 0 ? {
    totalBudget: timeSeriesData[timeSeriesData.length - 1]?.cumulative_budget || 0,
    totalActual: timeSeriesData[timeSeriesData.length - 1]?.cumulative_actual || 0,
    totalForecast: timeSeriesData[timeSeriesData.length - 1]?.cumulative_forecast || 0,
    variance: 0
  } : null

  if (summaryStats) {
    summaryStats.variance = summaryStats.totalBudget - summaryStats.totalActual
  }

  const renderChart = () => {
    const ChartComponent = chartType === 'area' ? AreaChart : LineChart

    return (
      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            {showCumulative ? 'Cumulative' : 'Period'} Cost Tracking
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(_, value) => value && setChartType(value)}
              size="small"
            >
              <ToggleButton value="line">Line</ToggleButton>
              <ToggleButton value="area">Area</ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              value={showCumulative}
              exclusive
              onChange={(_, value) => setShowCumulative(value)}
              size="small"
            >
              <ToggleButton value={false}>Period</ToggleButton>
              <ToggleButton value={true}>Cumulative</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>
        <ResponsiveContainer width="100%" height={400}>
          <ChartComponent data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              angle={-45}
              textAnchor="end"
              height={80}
              tick={{ fontSize: 12 }}
            />
            <YAxis tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ color: '#000' }}
            />
            <Legend />
            {chartType === 'area' ? (
              <>
                <Area
                  type="monotone"
                  dataKey="Budget"
                  stroke="#8884d8"
                  fill="#8884d8"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Actual"
                  stroke="#82ca9d"
                  fill="#82ca9d"
                  fillOpacity={0.3}
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="Forecast"
                  stroke="#ffc658"
                  fill="#ffc658"
                  fillOpacity={0.3}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </>
            ) : (
              <>
                <Line
                  type="monotone"
                  dataKey="Budget"
                  stroke="#8884d8"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Actual"
                  stroke="#82ca9d"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="Forecast"
                  stroke="#ffc658"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                />
              </>
            )}
          </ChartComponent>
        </ResponsiveContainer>
      </Paper>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Time Series Cost Tracking</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('excel')}
            disabled={timeSeriesData.length === 0}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('pdf')}
            disabled={timeSeriesData.length === 0}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={4}>
            <FormControl fullWidth>
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
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={2}>
            <FormControl fullWidth>
              <InputLabel>Interval</InputLabel>
              <Select
                value={interval}
                label="Interval"
                onChange={(e) => setInterval(e.target.value as any)}
              >
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={loadTimeSeriesData}
              disabled={loading}
              startIcon={<ShowChart />}
            >
              {loading ? <CircularProgress size={24} /> : 'Load'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Summary Stats */}
      {summaryStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Budget
                </Typography>
                <Typography variant="h5">{formatCurrency(summaryStats.totalBudget)}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Actual
                </Typography>
                <Typography variant="h5">{formatCurrency(summaryStats.totalActual)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {((summaryStats.totalActual / summaryStats.totalBudget) * 100).toFixed(1)}% of
                  budget
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Forecast
                </Typography>
                <Typography variant="h5">{formatCurrency(summaryStats.totalForecast)}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {((summaryStats.totalForecast / summaryStats.totalBudget) * 100).toFixed(1)}% of
                  budget
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card
              sx={{
                backgroundColor: summaryStats.variance >= 0 ? '#e8f5e9' : '#ffebee'
              }}
            >
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Variance
                </Typography>
                <Typography
                  variant="h5"
                  color={summaryStats.variance >= 0 ? 'success.main' : 'error.main'}
                >
                  {formatCurrency(Math.abs(summaryStats.variance))}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summaryStats.variance >= 0 ? 'Under' : 'Over'} budget
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Chart */}
      {timeSeriesData.length > 0 && renderChart()}

      {!loading && timeSeriesData.length === 0 && projectId && startDate && endDate && (
        <Alert severity="info">
          No time series data found for the selected project and date range.
        </Alert>
      )}
    </Box>
  )
}

export default TimeSeriesCostReport
