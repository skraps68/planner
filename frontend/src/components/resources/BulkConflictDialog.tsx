import React from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  Alert,
  Divider,
} from '@mui/material'
import { Warning, Refresh, Cancel } from '@mui/icons-material'
import { BulkUpdateFailure } from '../../api/assignments'

export interface BulkConflictDialogProps {
  open: boolean
  successCount: number
  failures: BulkUpdateFailure[]
  onRefreshAndRetry: () => void
  onCancel: () => void
}

const BulkConflictDialog: React.FC<BulkConflictDialogProps> = ({
  open,
  successCount,
  failures,
  onRefreshAndRetry,
  onCancel,
}) => {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth="md"
      fullWidth
      aria-labelledby="bulk-conflict-dialog-title"
    >
      <DialogTitle id="bulk-conflict-dialog-title">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Warning color="warning" />
          <Typography variant="h6">Partial Save - Some Assignments Failed</Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          {successCount > 0 && (
            <>
              {successCount} assignment{successCount > 1 ? 's' : ''} saved successfully, but{' '}
            </>
          )}
          {failures.length} assignment{failures.length > 1 ? 's' : ''} failed due to conflicts.
          These assignments were modified by another user while you were editing.
        </Alert>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          The following assignments could not be saved:
        </Typography>

        <List sx={{ maxHeight: 400, overflow: 'auto' }}>
          {failures.map((failure, index) => {
            const currentState = failure.current_state
            const resourceName = currentState?.resource_name || 'Unknown Resource'
            const assignmentDate = currentState?.assignment_date || 'Unknown Date'
            const currentVersion = currentState?.version || 'N/A'

            return (
              <React.Fragment key={failure.id}>
                {index > 0 && <Divider />}
                <ListItem alignItems="flex-start">
                  <ListItemText
                    primary={
                      <Typography variant="subtitle2" fontWeight="bold">
                        {resourceName} - {assignmentDate}
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          {failure.message}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Current version: {currentVersion}
                        </Typography>
                      </Box>
                    }
                  />
                </ListItem>
              </React.Fragment>
            )
          })}
        </List>

        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Click "Refresh & Retry" to reload the latest data and retry only the failed assignments,
          or "Cancel" to discard the failed changes.
        </Typography>
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
          Refresh & Retry Failed
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default BulkConflictDialog
