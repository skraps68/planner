import React from 'react'
import { Box, Paper, Typography, Button } from '@mui/material'
import { Lock, ArrowBack } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { RootState } from '../../store'
import { hasPermission, Permission } from '../../utils/permissions'

interface PermissionGuardProps {
  permission?: Permission
  customCheck?: () => { hasPermission: boolean; reason?: string }
  fallback?: React.ReactNode
  children: React.ReactNode
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permission,
  customCheck,
  fallback,
  children,
}) => {
  const navigate = useNavigate()
  const user = useSelector((state: RootState) => state.auth.user)

  // Determine permission status
  let permissionCheck: { hasPermission: boolean; reason?: string } = { hasPermission: true, reason: undefined }
  
  if (customCheck) {
    permissionCheck = customCheck()
  } else if (permission) {
    permissionCheck = hasPermission(user, permission)
  }

  if (!permissionCheck.hasPermission) {
    if (fallback) {
      return <>{fallback}</>
    }

    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          p: 3,
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            maxWidth: 500,
            textAlign: 'center',
          }}
        >
          <Lock sx={{ fontSize: 64, color: 'error.main', mb: 2 }} />
          <Typography variant="h5" gutterBottom>
            Access Denied
          </Typography>
          <Typography variant="body1" color="text.secondary" paragraph>
            {permissionCheck.reason || 'You do not have permission to access this resource.'}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            If you believe you should have access, please contact your administrator.
          </Typography>
          <Button
            variant="contained"
            startIcon={<ArrowBack />}
            onClick={() => navigate('/dashboard')}
            sx={{ mt: 2 }}
          >
            Return to Dashboard
          </Button>
        </Paper>
      </Box>
    )
  }

  return <>{children}</>
}

export default PermissionGuard
