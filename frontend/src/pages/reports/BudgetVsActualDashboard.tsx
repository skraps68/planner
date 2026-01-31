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
  const [asOfDate, setAsOfDate] = useState<string>('2024-10-15') // Default to middle of project timeline
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
      const data = await reportsApi.getBudgetVsActualVsForecast(entityType, entityId, asOfDate)
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

  const renderSummaryCards = (summary: any) => {
    // Handle both old and new API response formats
    const budget = summary.budget || {}
    const actual = summary.actual || {}
    const forecast = summary.forecast || {}
    const variance = summary.variance || {}
    const analysis = summary.analysis || {}
    
    const totalBudget = budget.total_budget || budget.total || 0
    const capitalBudget = budget.capital_budget || budget.capital || 0
    const expenseBudget = budget.expense_budget || budget.expense || 0
    
    const totalActual = actual.total_actual || actual.total || 0
    const capitalActual = actual.capital_actual || actual.capital || 0
    const expenseActual = actual.expense_actual || actual.expense || 0
    
    const totalForecast = forecast.total_forecast || forecast.total || 0
    const capitalForecast = forecast.capital_forecast || forecast.capital || 0
    const expenseForecast = forecast.expense_forecast || forecast.expense || 0
    
    // Calculate variance if not provided
    const budgetVsActualVariance = variance.budget_vs_actual_variance || (totalBudget - totalActual)
    const budgetVsActualPercentage = variance.budget_vs_actual_percentage || 
      (totalBudget !== 0 ? ((totalActual - totalBudget) / totalBudget) * 100 : 0)
    
    const budgetVsForecastVariance = variance.budget_vs_forecast_variance || (totalBudget - totalForecast)
    const budgetVsForecastPercentage = variance.budget_vs_forecast_percentage || 
      (totalBudget !== 0 ? ((totalForecast - totalBudget) / totalBudget) * 100 : 0)
    
    const budgetData = [
      { name: 'Capital', value: capitalBudget },
      { name: 'Expense', value: expenseBudget }
    ]

    const actualData = [
      { name: 'Capital', value: capitalForecast },
      { name: 'Expense', value: expenseForecast }
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
                {formatCurrency(totalBudget)}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
                <Chip
                  label={`Capital: ${formatCurrency(capitalBudget)}`}
                  size="small"
                  color="primary"
                  variant="outlined"
                />
                <Chip
                  label={`Expense: ${formatCurrency(expenseBudget)}`}
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
                {formatCurrency(totalActual)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {getStatusIcon(budgetVsActualPercentage)}
                <Chip
                  label={formatPercentage(budgetVsActualPercentage)}
                  size="small"
                  color={getStatusColor(budgetVsActualPercentage)}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                vs Budget: {formatCurrency(budgetVsActualVariance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Forecast Card */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Forecast
              </Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ mb: 1 }}>
                (Actuals to date + Forecast for remaining period)
              </Typography>
              <Typography variant="h4" gutterBottom>
                {formatCurrency(totalForecast)}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                {getStatusIcon(budgetVsForecastPercentage)}
                <Chip
                  label={formatPercentage(budgetVsForecastPercentage)}
                  size="small"
                  color={getStatusColor(budgetVsForecastPercentage)}
                />
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                vs Budget: {formatCurrency(budgetVsForecastVariance)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Comparison Chart */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Budget vs Forecast
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
              Forecast stacks actuals to date (darker) with projected costs (lighter)
            </Typography>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={[
                  {
                    name: 'Budget',
                    'Capital Budget': capitalBudget,
                    'Expense Budget': expenseBudget
                  },
                  {
                    name: 'Forecast',
                    'Capital Actual': capitalActual,
                    'Expense Actual': expenseActual,
                    'Capital Forecast': capitalForecast - capitalActual,
                    'Expense Forecast': expenseForecast - expenseActual
                  }
                ]}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Legend />
                {/* Budget bars */}
                <Bar dataKey="Capital Budget" stackId="budget" fill="#0088FE" />
                <Bar dataKey="Expense Budget" stackId="budget" fill="#00C49F" />
                {/* Forecast stacked bars */}
                <Bar dataKey="Capital Actual" stackId="forecast" fill="#0066CC" />
                <Bar dataKey="Capital Forecast" stackId="forecast" fill="#66B3FF" />
                <Bar dataKey="Expense Actual" stackId="forecast" fill="#009973" />
                <Bar dataKey="Expense Forecast" stackId="forecast" fill="#66E6CC" />
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
                <Typography variant="subtitle2" align="center" display="block" gutterBottom>
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
                <Typography variant="subtitle2" align="center" display="block" gutterBottom>
                  Forecast
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
        <Box>
          <Typography variant="h4">Budget vs Forecast Dashboard</Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            Forecast = Actuals to date + Projected costs for remaining period
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
            "As of Date" determines the split: actuals before this date, forecast after
          </Typography>
        </Box>
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
          <Grid item xs={12} md={2}>
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
          <Grid item xs={12} md={4}>
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
            <FormControl fullWidth>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                As of Date (for forecast calculation)
              </Typography>
              <input
                type="date"
                value={asOfDate}
                onChange={(e) => setAsOfDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '16.5px 14px',
                  fontSize: '1rem',
                  fontFamily: 'inherit',
                  border: '1px solid rgba(0, 0, 0, 0.23)',
                  borderRadius: '4px',
                  outline: 'none'
                }}
              />
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
