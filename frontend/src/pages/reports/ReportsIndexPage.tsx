import React from 'react'
import { Box, Typography, Grid, Card, CardContent, CardActionArea } from '@mui/material'
import {
  Assessment,
  Timeline,
  PieChart,
  TrendingUp,
  TableChart
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

interface ReportCard {
  title: string
  description: string
  icon: React.ReactNode
  path: string
  color: string
}

const ReportsIndexPage: React.FC = () => {
  const navigate = useNavigate()

  const reports: ReportCard[] = [
    {
      title: 'Budget vs Forecast',
      description: 'Comprehensive financial dashboard comparing budget with forecast (actuals + projections)',
      icon: <Assessment sx={{ fontSize: 48 }} />,
      path: '/reports/budget-vs-actual',
      color: '#1976d2'
    },
    {
      title: 'Time Series Cost Tracking',
      description: 'Track costs over time with customizable intervals and cumulative views',
      icon: <Timeline sx={{ fontSize: 48 }} />,
      path: '/reports/time-series',
      color: '#2e7d32'
    },
    {
      title: 'Resource Utilization',
      description: 'Analyze resource utilization with charts, tables, and heatmaps',
      icon: <PieChart sx={{ fontSize: 48 }} />,
      path: '/reports/resource-utilization',
      color: '#ed6c02'
    },
    {
      title: 'Drill-Down Analysis',
      description: 'Detailed breakdown by worker, date, or phase with expandable views',
      icon: <TableChart sx={{ fontSize: 48 }} />,
      path: '/reports/drill-down',
      color: '#9c27b0'
    },
    {
      title: 'Variance Analysis',
      description: 'Identify and analyze variances between planned and actual allocations',
      icon: <TrendingUp sx={{ fontSize: 48 }} />,
      path: '/actuals/variance',
      color: '#d32f2f'
    }
  ]

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Reports & Analytics
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Access comprehensive reports and analytics for your programs and projects
      </Typography>

      <Grid container spacing={3}>
        {reports.map((report) => (
          <Grid item xs={12} sm={6} md={4} key={report.path}>
            <Card
              sx={{
                height: '100%',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: 4
                }
              }}
            >
              <CardActionArea
                onClick={() => navigate(report.path)}
                sx={{ height: '100%', p: 2 }}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'center',
                      mb: 2,
                      color: report.color
                    }}
                  >
                    {report.icon}
                  </Box>
                  <Typography variant="h6" gutterBottom align="center">
                    {report.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" align="center">
                    {report.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Stats Section */}
      <Box sx={{ mt: 6 }}>
        <Typography variant="h5" gutterBottom>
          Quick Stats
        </Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Available Reports
                </Typography>
                <Typography variant="h4">{reports.length}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Export Formats
                </Typography>
                <Typography variant="h4">2</Typography>
                <Typography variant="caption" color="text.secondary">
                  Excel, PDF
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Visualization Types
                </Typography>
                <Typography variant="h4">5+</Typography>
                <Typography variant="caption" color="text.secondary">
                  Charts, Tables, Heatmaps
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Real-Time Data
                </Typography>
                <Typography variant="h4">✓</Typography>
                <Typography variant="caption" color="text.secondary">
                  Live updates
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Box>
  )
}

export default ReportsIndexPage
