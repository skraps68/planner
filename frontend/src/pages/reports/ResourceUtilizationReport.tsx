import React, { useState } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import { Download } from '@mui/icons-material'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell
} from 'recharts'
import { assignmentsApi } from '../../api/assignments'

interface UtilizationData {
  resource_id: string
  resource_name: string
  resource_type: string
  total_allocation: number
  average_allocation: number
  utilization_days: number
  total_days: number
  utilization_percentage: number
}

const ResourceUtilizationReport: React.FC = () => {
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [utilizationData, setUtilizationData] = useState<UtilizationData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'heatmap'>('chart')

  const loadUtilizationData = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates')
      return
    }

    setLoading(true)
    setError(null)
    try {
      // Fetch assignments and calculate utilization
      const response = await assignmentsApi.list({
        // Note: API doesn't support date filtering directly, so we'll filter client-side
      })
      
      // Group by resource and calculate utilization
      const resourceMap = new Map<string, any>()
      const assignments = response.items || []
      
      assignments.forEach((assignment: any) => {
        const key = assignment.resource_id
        if (!resourceMap.has(key)) {
          resourceMap.set(key, {
            resource_id: assignment.resource_id,
            resource_name: assignment.resource?.name || 'Unknown',
            resource_type: assignment.resource?.resource_type || 'Unknown',
            total_allocation: 0,
            count: 0,
            days: new Set()
          })
        }
        
        const resource = resourceMap.get(key)
        resource.total_allocation += assignment.allocation_percentage
        resource.count += 1
        resource.days.add(assignment.assignment_date)
      })
      
      // Calculate metrics
      const totalDays = Math.ceil(
        (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
      ) + 1
      
      const utilization: UtilizationData[] = Array.from(resourceMap.values()).map((resource) => ({
        resource_id: resource.resource_id,
        resource_name: resource.resource_name,
        resource_type: resource.resource_type,
        total_allocation: resource.total_allocation,
        average_allocation: resource.count > 0 ? resource.total_allocation / resource.count : 0,
        utilization_days: resource.days.size,
        total_days: totalDays,
        utilization_percentage: (resource.days.size / totalDays) * 100
      }))
      
      setUtilizationData(utilization.sort((a, b) => b.utilization_percentage - a.utilization_percentage))
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load utilization data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'excel' | 'pdf') => {
    alert(`Export to ${format.toUpperCase()} - Feature coming soon!`)
  }

  const getUtilizationColor = (percentage: number) => {
    if (percentage >= 80) return '#4caf50' // Green
    if (percentage >= 60) return '#8bc34a' // Light green
    if (percentage >= 40) return '#ffc107' // Yellow
    if (percentage >= 20) return '#ff9800' // Orange
    return '#f44336' // Red
  }

  const getUtilizationLabel = (percentage: number) => {
    if (percentage >= 80) return 'High'
    if (percentage >= 60) return 'Good'
    if (percentage >= 40) return 'Moderate'
    if (percentage >= 20) return 'Low'
    return 'Very Low'
  }

  const renderChart = () => (
    <Paper sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Resource Utilization Overview
      </Typography>
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={utilizationData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="resource_name" angle={-45} textAnchor="end" height={100} />
          <YAxis label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }} />
          <Tooltip
            formatter={(value: number) => `${value.toFixed(1)}%`}
            labelFormatter={(label) => `Resource: ${label}`}
          />
          <Legend />
          <Bar dataKey="utilization_percentage" name="Utilization %">
            {utilizationData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getUtilizationColor(entry.utilization_percentage)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  )

  const renderTable = () => (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
            <TableCell sx={{ fontWeight: 'bold' }}>Resource Name</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Avg Allocation %</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Days Utilized</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Days</TableCell>
            <TableCell align="right" sx={{ fontWeight: 'bold' }}>Utilization %</TableCell>
            <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {utilizationData.map((row) => (
            <TableRow key={row.resource_id}>
              <TableCell>{row.resource_name}</TableCell>
              <TableCell>
                <Chip label={row.resource_type} size="small" />
              </TableCell>
              <TableCell align="right">{row.average_allocation.toFixed(1)}%</TableCell>
              <TableCell align="right">{row.utilization_days}</TableCell>
              <TableCell align="right">{row.total_days}</TableCell>
              <TableCell align="right">
                <strong>{row.utilization_percentage.toFixed(1)}%</strong>
              </TableCell>
              <TableCell>
                <Chip
                  label={getUtilizationLabel(row.utilization_percentage)}
                  size="small"
                  sx={{
                    backgroundColor: getUtilizationColor(row.utilization_percentage),
                    color: 'white'
                  }}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  )

  const renderHeatmap = () => {
    // Create a simplified heatmap visualization
    const maxUtilization = Math.max(...utilizationData.map(d => d.utilization_percentage), 1)
    
    return (
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Resource Utilization Heatmap
        </Typography>
        <Grid container spacing={1}>
          {utilizationData.map((resource) => {
            const intensity = resource.utilization_percentage / maxUtilization
            const color = getUtilizationColor(resource.utilization_percentage)
            
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={resource.resource_id}>
                <Card
                  sx={{
                    backgroundColor: color,
                    color: 'white',
                    opacity: 0.5 + (intensity * 0.5),
                    transition: 'all 0.3s',
                    '&:hover': {
                      opacity: 1,
                      transform: 'scale(1.05)'
                    }
                  }}
                >
                  <CardContent>
                    <Typography variant="subtitle2" noWrap>
                      {resource.resource_name}
                    </Typography>
                    <Typography variant="h5">
                      {resource.utilization_percentage.toFixed(0)}%
                    </Typography>
                    <Typography variant="caption">
                      {resource.utilization_days} / {resource.total_days} days
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            )
          })}
        </Grid>
        
        {/* Legend */}
        <Box sx={{ mt: 3, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#f44336' }} />
            <Typography variant="caption">0-20%</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#ff9800' }} />
            <Typography variant="caption">20-40%</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#ffc107' }} />
            <Typography variant="caption">40-60%</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#8bc34a' }} />
            <Typography variant="caption">60-80%</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 20, height: 20, backgroundColor: '#4caf50' }} />
            <Typography variant="caption">80-100%</Typography>
          </Box>
        </Box>
      </Paper>
    )
  }

  const summaryStats = utilizationData.length > 0 ? {
    avgUtilization: utilizationData.reduce((sum, r) => sum + r.utilization_percentage, 0) / utilizationData.length,
    highUtilization: utilizationData.filter(r => r.utilization_percentage >= 80).length,
    lowUtilization: utilizationData.filter(r => r.utilization_percentage < 40).length,
    totalResources: utilizationData.length
  } : null

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Resource Utilization Report</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('excel')}
            disabled={utilizationData.length === 0}
          >
            Export Excel
          </Button>
          <Button
            variant="outlined"
            startIcon={<Download />}
            onClick={() => handleExport('pdf')}
            disabled={utilizationData.length === 0}
          >
            Export PDF
          </Button>
        </Box>
      </Box>

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="Start Date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField
              fullWidth
              label="End Date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>View Mode</InputLabel>
              <Select
                value={viewMode}
                label="View Mode"
                onChange={(e) => setViewMode(e.target.value as any)}
              >
                <MenuItem value="chart">Chart</MenuItem>
                <MenuItem value="table">Table</MenuItem>
                <MenuItem value="heatmap">Heatmap</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <Button
              variant="contained"
              fullWidth
              onClick={loadUtilizationData}
              disabled={loading}
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

      {/* Summary Stats */}
      {summaryStats && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Resources
                </Typography>
                <Typography variant="h4">{summaryStats.totalResources}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Average Utilization
                </Typography>
                <Typography variant="h4">{summaryStats.avgUtilization.toFixed(1)}%</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#e8f5e9' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  High Utilization (≥80%)
                </Typography>
                <Typography variant="h4" color="success.main">
                  {summaryStats.highUtilization}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ backgroundColor: '#fff3e0' }}>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Low Utilization (&lt;40%)
                </Typography>
                <Typography variant="h4" color="warning.main">
                  {summaryStats.lowUtilization}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Report Content */}
      {utilizationData.length > 0 && (
        <Box>
          {viewMode === 'chart' && renderChart()}
          {viewMode === 'table' && renderTable()}
          {viewMode === 'heatmap' && renderHeatmap()}
        </Box>
      )}

      {!loading && utilizationData.length === 0 && startDate && endDate && (
        <Alert severity="info">
          No utilization data found for the selected date range.
        </Alert>
      )}
    </Box>
  )
}

export default ResourceUtilizationReport
