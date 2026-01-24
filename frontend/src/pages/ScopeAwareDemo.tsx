import React from 'react'
import { Box, Typography, Paper, Grid, Divider } from '@mui/material'
import { Add, Edit, Delete, Visibility } from '@mui/icons-material'
import ScopeBreadcrumbs from '../components/common/ScopeBreadcrumbs'
import ScopeFilterBanner from '../components/common/ScopeFilterBanner'
import PermissionButton from '../components/common/PermissionButton'
import PermissionGuard from '../components/common/PermissionGuard'
import { usePermissions } from '../hooks/usePermissions'

/**
 * Demo page showcasing scope-aware navigation and filtering features
 * This page demonstrates all the implemented components and their usage
 */
const ScopeAwareDemo: React.FC = () => {
  const { hasPermission, scopeContext, activeRoleType } = usePermissions()

  return (
    <Box>
      {/* Breadcrumbs with scope indicator */}
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Demo', path: '/demo' },
          { label: 'Scope-Aware Features' },
        ]}
        showScopeIndicator={true}
      />

      <Typography variant="h4" gutterBottom>
        Scope-Aware UI Demo
      </Typography>

      <Typography variant="body1" color="text.secondary" paragraph>
        This page demonstrates the scope-aware navigation and filtering features.
      </Typography>

      {/* Scope Filter Banner */}
      <ScopeFilterBanner entityType="data" showDetails={true} />

      <Grid container spacing={3}>
        {/* User Context Section */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Current Context
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Active Role:
              </Typography>
              <Typography variant="body1" fontWeight="bold">
                {activeRoleType || 'No role assigned'}
              </Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Scope Context:
              </Typography>
              {scopeContext.length > 0 ? (
                scopeContext.map((scope, index) => (
                  <Typography key={index} variant="body1">
                    • {scope}
                  </Typography>
                ))
              ) : (
                <Typography variant="body1" color="text.secondary">
                  No scope assigned
                </Typography>
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Permission Buttons Demo */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Permission-Based Buttons
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <PermissionButton
                permission="create_programs"
                variant="contained"
                startIcon={<Add />}
                onClick={() => alert('Create Program')}
              >
                Create Program
              </PermissionButton>

              <PermissionButton
                permission="edit_programs"
                variant="outlined"
                startIcon={<Edit />}
                onClick={() => alert('Edit Program')}
              >
                Edit Program
              </PermissionButton>

              <PermissionButton
                permission="delete_programs"
                variant="outlined"
                color="error"
                startIcon={<Delete />}
                onClick={() => alert('Delete Program')}
              >
                Delete Program
              </PermissionButton>

              <PermissionButton
                permission="manage_users"
                variant="contained"
                color="secondary"
                onClick={() => alert('Manage Users')}
              >
                Manage Users (Admin Only)
              </PermissionButton>
            </Box>
          </Paper>
        </Grid>

        {/* Permission Checks Display */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Your Permissions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Grid container spacing={2}>
              {[
                'view_programs',
                'create_programs',
                'edit_programs',
                'delete_programs',
                'view_projects',
                'create_projects',
                'edit_projects',
                'manage_resources',
                'manage_workers',
                'import_actuals',
                'view_reports',
                'manage_users',
              ].map((permission) => {
                const check = hasPermission(permission as any)
                return (
                  <Grid item xs={12} sm={6} md={4} key={permission}>
                    <Box
                      sx={{
                        p: 2,
                        border: 1,
                        borderColor: check.hasPermission ? 'success.main' : 'error.main',
                        borderRadius: 1,
                        bgcolor: check.hasPermission ? 'success.light' : 'error.light',
                        opacity: check.hasPermission ? 1 : 0.5,
                      }}
                    >
                      <Typography variant="body2" fontWeight="bold">
                        {permission.replace(/_/g, ' ').toUpperCase()}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {check.hasPermission ? '✓ Allowed' : '✗ Denied'}
                      </Typography>
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          </Paper>
        </Grid>

        {/* Permission Guard Demo */}
        <Grid item xs={12}>
          <PermissionGuard permission="view_programs">
            <Paper sx={{ p: 3, bgcolor: 'success.light' }}>
              <Typography variant="h6" gutterBottom>
                Protected Content (view_programs required)
              </Typography>
              <Typography variant="body1">
                This content is only visible to users with the "view_programs" permission.
                If you can see this, you have the required permission!
              </Typography>
            </Paper>
          </PermissionGuard>
        </Grid>

        <Grid item xs={12}>
          <PermissionGuard permission="manage_users">
            <Paper sx={{ p: 3, bgcolor: 'warning.light' }}>
              <Typography variant="h6" gutterBottom>
                Admin-Only Content (manage_users required)
              </Typography>
              <Typography variant="body1">
                This content is only visible to administrators with the "manage_users" permission.
                If you can see this, you are an admin!
              </Typography>
            </Paper>
          </PermissionGuard>
        </Grid>
      </Grid>
    </Box>
  )
}

export default ScopeAwareDemo
