import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material'
import { Warning, Refresh, Cancel } from '@mui/icons-material'

export interface ConflictDialogProps {
  open: boolean
  entityType: string
  attemptedChanges: Record<string, any>
  currentState: Record<string, any>
  onRefreshAndRetry: () => void
  onCancel: () => void
}

const ConflictDialog: React.FC<ConflictDialogProps> = ({
  open,
  entityType,
  attemptedChanges,
  currentState,
  onRefreshAndRetry,
  onCancel,
}) => {
  // Get fields that were attempted to be changed
  const changedFields = Object.keys(attemptedChanges).filter(
    (key) => key !== 'version' && attemptedChanges[key] !== undefined
  )

  // Format field names for display
  const formatFieldName = (field: string): string => {
    return field
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Format field values for display
  const formatValue = (value: any): string => {
    if (value === null || value === undefined) {
      return 'N/A'
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No'
    }
    if (typeof value === 'object') {
      return JSON.stringify(value)
    }
    return String(value)
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="conflict-dialog-title"
    >
      <DialogTitle id="conflict-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6">Update Conflict Detected</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          The {entityType} was modified by another user while you were editing. Your changes were
          not saved to prevent data loss.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Below is a comparison of your attempted changes and the current state of the {entityType}.
          Click "Refresh & Retry" to reload the latest data and reapply your changes, or "Cancel" to
          discard your changes.
        </Typography>

        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'grey.100' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Field</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Your Changes</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Current Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {changedFields.map((field) => {
                const yourValue = attemptedChanges[field]
                const currentValue = currentState[field]
                const isDifferent = yourValue !== currentValue

                return (
                  <TableRow
                    key={field}
                    sx={{
                      backgroundColor: isDifferent ? 'warning.light' : 'inherit',
                      opacity: isDifferent ? 1 : 0.7,
                    }}
                  >
                    <TableCell sx={{ fontWeight: isDifferent ? 'bold' : 'normal' }}>
                      {formatFieldName(field)}
                    </TableCell>
                    <TableCell>{formatValue(yourValue)}</TableCell>
                    <TableCell>{formatValue(currentValue)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {currentState.version && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Current version: {currentState.version}
          </Typography>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} startIcon={<Cancel />} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={onRefreshAndRetry}
          startIcon={<Refresh />}
          variant="contained"
          color="primary"
          autoFocus
        >
          Refresh & Retry
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default ConflictDialog
