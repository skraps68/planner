import React from 'react'
import { Box, Typography, Grid, Card, CardContent, Paper, CircularProgress, Alert } from '@mui/material'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '../contexts/AuthContext'
import { programsApi } from '../api/programs'
import { projectsApi } from '../api/projects'
import { resourcesApi } from '../api/resources'

const DashboardPage: React.FC = () => {
  const { user } = useAuth()

  const { data: programsData, isLoading: programsLoading, error: programsError } = useQuery({
    queryKey: ['programs', 'dashboard'],
    queryFn: () => programsApi.list({ limit: 1000 }),
  })

  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['projects', 'dashboard'],
    queryFn: () => projectsApi.list({ limit: 1000 }),
  })

  const { data: resourcesData, isLoading: resourcesLoading, error: resourcesError } = useQuery({
    queryKey: ['resources', 'dashboard'],
    queryFn: () => resourcesApi.list({ page: 1, size: 100 }),
  })

  const isLoading = programsLoading || projectsLoading || resourcesLoading
  const hasError = programsError || projectsError || resourcesError

  const programCount = programsData?.total || 0
  const projectCount = projectsData?.total || 0
  const resourceCount = resourcesData?.total || 0

  // Budget utilization would require fetching project phases separately
  // For now, we'll show 0% or remove this metric
  const budgetUtilization = 0

  if (hasError) {
    return (
      <Box>
        <Typography variant="h4" gutterBottom>
          Dashboard
        </Typography>
        <Alert severity="error">
          Failed to load dashboard data. Please try refreshing the page.
        </Alert>
      </Box>
    )
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Welcome back, {user?.username}!
      </Typography>

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="200px">
          <CircularProgress />
        </Box>
      ) : (
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Programs
                </Typography>
                <Typography variant="h4">{programCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Active Projects
                </Typography>
                <Typography variant="h4">{projectCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Total Resources
                </Typography>
                <Typography variant="h4">{resourceCount}</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card>
              <CardContent>
                <Typography color="text.secondary" gutterBottom>
                  Budget Utilization
                </Typography>
                <Typography variant="h4">{budgetUtilization}%</Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Recent Activity
              </Typography>
              <Typography color="text.secondary">
                {programCount > 0 || projectCount > 0 
                  ? `You have ${programCount} active programs and ${projectCount} active projects.`
                  : 'No recent activity'}
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
    </Box>
  )
}

export default DashboardPage
