import React from 'react'
import { Alert, AlertTitle, Box, Chip } from '@mui/material'
import { FilterList, Info } from '@mui/icons-material'
import { usePermissions } from '../../hooks/usePermissions'

interface ScopeFilterBannerProps {
  entityType?: 'programs' | 'projects' | 'resources' | 'data'
  showDetails?: boolean
}

const ScopeFilterBanner: React.FC<ScopeFilterBannerProps> = ({ 
  entityType = 'data',
  showDetails = true 
}) => {
  const { scopeContext, accessibleProgramIds, accessibleProjectIds } = usePermissions()

  // Don't show banner if user has global access
  if (accessibleProgramIds === 'all' && accessibleProjectIds === 'all') {
    return null
  }

  // Don't show if no scope context
  if (scopeContext.length === 0) {
    return null
  }

  const getEntityMessage = () => {
    switch (entityType) {
      case 'programs':
        return 'programs'
      case 'projects':
        return 'projects'
      case 'resources':
        return 'resources'
      default:
        return 'data'
    }
  }

  return (
    <Alert 
      severity="info" 
      icon={<FilterList />}
      sx={{ mb: 2 }}
    >
      <AlertTitle>Filtered View</AlertTitle>
      <Box>
        You are viewing {getEntityMessage()} within your assigned scope.
        {showDetails && scopeContext.length > 0 && (
          <Box sx={{ mt: 1, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Info fontSize="small" />
            <span>Your access:</span>
            {scopeContext.map((scope, index) => (
              <Chip
                key={index}
                label={scope}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </Box>
        )}
      </Box>
    </Alert>
  )
}

export default ScopeFilterBanner
