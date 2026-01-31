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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Chip,
  Collapse,
  IconButton
} from '@mui/material'
import { Download, KeyboardArrowDown, KeyboardArrowUp, FilterList } from '@mui/icons-material'
import { reportsApi } from '../../api/reports'
import { projectsApi } from '../../api/projects'

interface DrillDownRow {
  id: string
  name: string
  type: string
  budget: number
  actual: number
  forecast: number
  variance: number
  variance_percentage: number
  details?: any[]
}

const DrillDownReport: React.FC = () => {
  const [projectId, setProjectId] = useState<string>('')
  const [projects, setProjects] = useState<any[]>([])
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [groupBy, setGroupBy] = useState<'worker' | 'date' | 'phase'>('worker')
  const [loading, setLoading] = useState(false)
  const [reportData, setReportData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [orderBy, setOrderBy] = useState<keyof DrillDownRow>('variance_percentage')
  const [order, setOrder] = useState<'asc' | 'desc'>('desc')

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

  const loadDrillDownData = async () => {
    if (!projectId || !startDate || !endDate) {
      setError('Please select project and date range')
      return
    }

    setLoading(true)
    setError(null)
    try {
      const response = await reportsApi.getDrillDownReport(
        projectId,
        startDate,
        endDate,
        groupBy
      )
      setReportData(response)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load drill-down data')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = (format: 'excel' | 'pdf') => {
    alert(`Export to ${format.toUpperCase()} - Feature coming soon!`)
  }

  const handleSort = (property: keyof DrillDownRow) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const toggleRow = (rowId: string) => {
    const newExpanded = new Set(expandedRows)
    if (newExpanded.has(rowId)) {
      newExpanded.delete(rowId)
    } else {
      newExpanded.add(rowId)
    }
    setExpandedRows(newExpanded)
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

  const getVarianceColor = (percentage: number) => {
    if (Math.abs(percentage) < 5) return 'success'
    if (Math.abs(percentage) < 15) return 'warning'
    return 'error'
  }

  const sortData = (data: DrillDownRow[]) => {
    return [...data].sort((a, b) => {
      const aValue = a[orderBy]
      const bValue = b[orderBy]
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return order === 'asc' ? aValue - bValue : bValue - aValue
      }
      
      return order === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue))
    })
  }

  const renderRow = (row: DrillDownRow, level = 0) => {
    const hasDetails = row.details && row.details.length > 0
    const isExpanded = expandedRows.has(row.id)

    return (
      <React.Fragment key={row.id}>
        <TableRow hover>
          <TableCell>
            {hasDetails && (
              <IconButton size="small" onClick={() => toggleRow(row.id)}>
                {isExpanded ? <KeyboardArrowUp /> : <KeyboardArrowDown />}
              </IconButton>
            )}
          </TableCell>
          <TableCell sx={{ pl: level * 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2">{row.name}</Typography>
              {row.type && <Chip label={row.type} size="small" />}
            </Box>
          </TableCell>
          <TableCell align="right">{formatCurrency(row.budget)}</TableCell>
          <TableCell align="right">{formatCurrency(row.actual)}</TableCell>
          <TableCell align="right">{formatCurrency(row.forecast)}</TableCell>
          <TableCell align="right">
            <Typography
              color={row.variance >= 0 ? 'success.main' : 'error.main'}
              fontWeight="bold"
            >
              {formatCurrency(Math.abs(row.variance))}
            </Typography>
          </TableCell>
          <TableCell align="right">
            <Chip
              label={formatPercentage(row.variance_percentage)}
              size="small"
              color={getVarianceColor(row.variance_percentage)}
            />
          </TableCell>
        </TableRow>
        {hasDetails && (
          <TableRow>
            <TableCell colSpan={7} sx={{ py: 0, borderBottom: 'none' }}>
              <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                <Box sx={{ py: 2, pl: 4, backgroundColor: 'action.hover' }}>
                  {row.details && row.details.map((detail: any) => renderRow(detail, level + 1))}
                </Box>
              </Collapse>
            </TableCell>
          </TableRow>
        )}
      </React.Fragment>
    )
  }

  const drillDownRows: DrillDownRow[] = reportData?.breakdown || []
  const sortedRows = sortData(drillDownRows)

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Drill-Down Report</Typography>
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
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Group By</InputLabel>
              <Select
                value={groupBy}
                label="Group By"
                onChange={(e) => setGroupBy(e.target.value as any)}
              >
                <MenuItem value="worker">Worker</MenuItem>
                <MenuItem value="date">Date</MenuItem>
                <MenuItem value="phase">Phase</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              fullWidth
              onClick={loadDrillDownData}
              disabled={loading}
              startIcon={<FilterList />}
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

      {/* Summary */}
      {reportData?.summary && (
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            Summary
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Total Budget
              </Typography>
              <Typography variant="h6">
                {formatCurrency(reportData.summary.total_budget)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Total Actual
              </Typography>
              <Typography variant="h6">
                {formatCurrency(reportData.summary.total_actual)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Total Forecast
              </Typography>
              <Typography variant="h6">
                {formatCurrency(reportData.summary.total_forecast)}
              </Typography>
            </Grid>
            <Grid item xs={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Variance
              </Typography>
              <Typography
                variant="h6"
                color={reportData.summary.variance >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(Math.abs(reportData.summary.variance))}
              </Typography>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Drill-Down Table */}
      {sortedRows.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width={50} />
                <TableCell>
                  <TableSortLabel
                    active={orderBy === 'name'}
                    direction={orderBy === 'name' ? order : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    {groupBy === 'worker' ? 'Worker' : groupBy === 'date' ? 'Date' : 'Phase'}
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'budget'}
                    direction={orderBy === 'budget' ? order : 'asc'}
                    onClick={() => handleSort('budget')}
                  >
                    Budget
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'actual'}
                    direction={orderBy === 'actual' ? order : 'asc'}
                    onClick={() => handleSort('actual')}
                  >
                    Actual
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'forecast'}
                    direction={orderBy === 'forecast' ? order : 'asc'}
                    onClick={() => handleSort('forecast')}
                  >
                    Forecast
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'variance'}
                    direction={orderBy === 'variance' ? order : 'asc'}
                    onClick={() => handleSort('variance')}
                  >
                    Variance
                  </TableSortLabel>
                </TableCell>
                <TableCell align="right">
                  <TableSortLabel
                    active={orderBy === 'variance_percentage'}
                    direction={orderBy === 'variance_percentage' ? order : 'asc'}
                    onClick={() => handleSort('variance_percentage')}
                  >
                    Variance %
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>{sortedRows.map((row) => renderRow(row))}</TableBody>
          </Table>
        </TableContainer>
      )}

      {!loading && sortedRows.length === 0 && projectId && startDate && endDate && (
        <Alert severity="info">
          No drill-down data found for the selected project and date range.
        </Alert>
      )}
    </Box>
  )
}

export default DrillDownReport
