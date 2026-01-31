import React from 'react'
import { Alert, AlertTitle, Box, List, ListItem, ListItemText } from '@mui/material'
import { PhaseValidationError } from '../../types'

interface ValidationErrorDisplayProps {
  errors: PhaseValidationError[]
}

const ValidationErrorDisplay: React.FC<ValidationErrorDisplayProps> = ({ errors }) => {
  if (errors.length === 0) {
    return null
  }

  // Group errors by phase
  const errorsByPhase = errors.reduce((acc, error) => {
    const key = error.phase_id || 'general'
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(error)
    return acc
  }, {} as Record<string, PhaseValidationError[]>)

  return (
    <Box sx={{ mb: 3 }}>
      <Alert severity="error">
        <AlertTitle>Validation Errors</AlertTitle>
        {Object.entries(errorsByPhase).map(([phaseId, phaseErrors]) => (
          <Box key={phaseId} sx={{ mb: 1 }}>
            {phaseId !== 'general' && (
              <Box sx={{ fontWeight: 'bold', mb: 0.5 }}>Phase-specific errors:</Box>
            )}
            <List dense disablePadding>
              {phaseErrors.map((error, index) => (
                <ListItem key={index} disablePadding>
                  <ListItemText
                    primary={error.message}
                    secondary={error.field !== 'timeline' ? `Field: ${error.field}` : undefined}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        ))}
      </Alert>
    </Box>
  )
}

export default ValidationErrorDisplay
