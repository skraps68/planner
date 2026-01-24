import React, { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
  Chip,
  Tabs,
  Tab
} from '@mui/material'
import {
  TrendingUp,
  TrendingDown,
  Warning,
  CheckCircle,
  Download
} from '@mui/icons-material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { reportsApi, ProjectFinancialSummary, ProgramFinancialSummary } from '../../api/reports'
import { projectsApi } from '../../api/projects'
import { programsApi } from '../../api/programs'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index} style={{ paddingTop: 24 }}>
    {value === index && children}
  </div>
)

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

const BudgetVsActualDashboard: React.FC = () => {
  const [entityType, setEntityType] = useState<'project' | 'program'>('project')
  const [entityId, setEntityId] = useState<string>('')
  const [entities, setEntities] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)

  // Load entities based on type
  useEffect(() => {
    const loadEntities = async () => {
      try {
        if (entityType === 'project') {
          const response = await projectsApi.list()
          setEntities(response.items || [])
        } else {
          const response = await programsApi.list()
          setEntities(response.items || [])
        }
      } catch (err) {
        console.error('Failed to load entities:', err)
      }
    }
    loadEntities()
  }, [entityType])

  const loadReport = async () => {
    if (!entityId) return

    setLoading(true)
    setError(null)
    try {
      const data = await reportsApi.getBudgetVsActualVsForecast(entityType, entityId)
      setReportData(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load report')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async (format: 'pdf' | 'excel') => {
    // Placeholder for export functionality
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

  const formatPercentage = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getStatusColor = (percentage: number) => {
    if (Math.abs(percentage) < 5) return 'success'
    if (Math.abs(percentage) < 15) return 'warning'
    return 'error'
  }

  const getStatusIcon = (percentage: number) => {
    if (Math.abs(percentage) < 5) return <CheckCircle />
    if (Math.abs(percentage) < 15) return <Warning />
    return percentage > 0 ? <TrendingUp /> : <TrendingDown />
  }

  const renderSummaryCards = (summary: ProjectFinancialSummary | ProgramFinancialSummary) => {
    const budgetData = [
      { name: 'Capital', value: summary.budget.capital_budget },
      { name: 'Expense', value: summary.budget.expense_budget }
    ]

    const actualData = [
      { name: 'Capital', value: summary.actual.capital_actual },
      { name: 'Expense', value: summary.actual.expense_actual }
    ]

    return (
      <Grid container spacing={3}>
        {/* Budget Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Budget
              </Typography>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(summary.budget.total_budget)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Chip
                  label={`Capital: ${formatCurrency(summary.budget.capital_budget)}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`Expense: ${formatCurrency(summary.budget.expense_budget)}`}
                  size="small"
                  color="secondary"
                  variant="outlined"
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Actual Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Actual
              </Typography>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(summary.actual.total_actual)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {getStatusIcon(summary.variance.budget_vs_actual_percentage)}
                <Chip
                  label={formatPercentage(summary.variance.budget_vs_actual_percentage)}
                  size="small"
                  color={getStatusColor(summary.variance.budget_vs_actual_percentage)}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                vs Budget: {formatCurrency(summary.variance.budget_vs_actual_variance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Forecast Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Forecast
              </Typography>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(summary.forecast.total_forecast)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {getStatusIcon(summary.variance.budget_vs_forecast_percentage)}
                <Chip
                  label={formatPercentage(summary.variance.budget_vs_forecast_percentage)}
                  size="small"
                  color={getStatusColor(summary.variance.budget_vs_forecast_percentage)}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                vs Budget: {formatCurrency(summary.variance.budget_vs_forecast_variance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Comparison Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Budget vs Actual vs Forecast
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: 'Budget',
                    Capital: summary.budget.capital_budget,
                    Expense: summary.budget.expense_budget
                  },
                  {
                    name: 'Actual',
                    Capital: summary.actual.capital_actual,
                    Expense: summary.actual.expense_actual
                  },
                  {
                    name: 'Forecast',
                    Capital: summary.forecast.capital_forecast,
                    Expense: summary.forecast.expense_forecast
                  }
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                <Bar dataKey="Capital" fill="#0088FE" />
                <Bar dataKey="Expense" fill="#00C49F" />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        {/* Breakdown Pie Charts */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Capital vs Expense Breakdown
            </Typography>
            <Box sx={{ display: 'flex', justifyContent: 'space-around' }}>
              <Box>
                <Typography variant="caption" align="center" display="block" gutterBottom>
                  Budget
                </Typography>
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={budgetData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                    >
                      {budgetData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
              <Box>
                <Typography variant="caption" align="center" display="block" gutterBottom>
                  Actual
                </Typography>
                <ResponsiveContainer width={150} height={150}>
                  <PieChart>
                    <Pie
                      data={actualData}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={60}
                      dataKey="value"
                    >
                      {actualData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Budget vs Actual vs Forecast Dashboard</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('excel')}
            disabled={!reportData}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('pdf')}
            disabled={!reportData}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Entity Type</InputLabel>
              <Select
                value={entityType}
                label="Entity Type"
                onChange={(e) => {
                  setEntityType(e.target.value as 'project' | 'program')
                  setEntityId('')
                  setReportData(null)
                }}
              >
                <MenuItem value="project">Project</MenuItem>
                <MenuItem value="program">Program</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth>
              <InputLabel>{entityType === 'project' ? 'Project' : 'Program'}</InputLabel>
              <Select
                value={entityId}
                label={entityType === 'project' ? 'Project' : 'Program'}
                onChange={(e) => setEntityId(e.target.value)}
              >
                {entities.map((entity) => (
                  <MenuItem key={entity.id} value={entity.id}>
                    {entity.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              fullWidth
              onClick={loadReport}
              disabled={!entityId || loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Load Report'}
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

      {/* Report Content */}
      {reportData && (
        <Box>
          <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
            <Tab label="Summary" />
            {entityType === 'program' && reportData.projects && (
              <Tab label={`Projects (${reportData.projects.length})`} />
            )}
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {renderSummaryCards(reportData)}
          </TabPanel>

          {entityType === 'program' && reportData.projects && (
            <TabPanel value={tabValue} index={1}>
              <Grid container spacing={3}>
                {reportData.projects.map((project: ProjectFinancialSummary) => (
                  <Grid item xs={12} key={project.project_id}>
                    <Paper sx={{ p: 3 }}>
                      <Typography variant="h6" gutterBottom>
                        {project.project_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" gutterBottom>
                        Cost Center: {project.cost_center_code}
                      </Typography>
                      {renderSummaryCards(project)}
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </TabPanel>
          )}
        </Box>
      )}
    </Box>
  )
}

export default BudgetVsActualDashboard
