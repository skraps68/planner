import React from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  List,
  ListItem,
  ListItemIcon,
  Typography,
} from '@mui/material'
import {
  Cancel as FailIcon,
  CheckCircle as PassIcon,
} from '@mui/icons-material'
import { format } from 'date-fns'

import {
  ProjectDateChangePreview,
  ProjectDateConstraintTarget,
} from '../../api/projects'
import { parseDateOnly } from '../../utils/dateOnly'

interface ProjectDateConstraintDialogProps {
  open: boolean
  preview: ProjectDateChangePreview | null
  loading: boolean
  saving: boolean
  onClose: () => void
  onRecheck: () => void
  onProceed: () => void
  onResolve: (target: ProjectDateConstraintTarget) => void
}

const resolutionLabels: Partial<Record<ProjectDateConstraintTarget, string>> = {
  project: 'Adjust Dates',
  program: 'View Program',
  phases: 'Resolve in Phases',
  labor: 'Resolve Labor Assignments',
  non_labor: 'Resolve Cost Plans',
  actuals: 'Review Actuals',
}

const formatDate = (value: string) =>
  format(parseDateOnly(value), 'MMM d, yyyy')

const ProjectDateConstraintDialog: React.FC<ProjectDateConstraintDialogProps> = ({
  open,
  preview,
  loading,
  saving,
  onClose,
  onRecheck,
  onProceed,
  onResolve,
}) => (
  <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth maxWidth="sm">
    <DialogTitle>Review project date constraints</DialogTitle>
    <DialogContent>
      {loading || !preview ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
          <CircularProgress aria-label="Checking project date constraints" />
        </Box>
      ) : (
        <>
          <Alert severity={preview.can_proceed ? 'success' : 'error'} sx={{ mb: 2 }}>
            {preview.can_proceed
              ? 'All constraints are satisfied. The proposed dates are ready to save.'
              : `Resolve the ${preview.blocking_count} conflicting constraint${preview.blocking_count === 1 ? '' : 's'} before trying to set the proposed dates.`}
          </Alert>

          {!preview.can_proceed && (
            <Typography variant="body2" sx={{ mb: 1.5 }}>
              The proposed dates have not been saved. After resolving an item,
              return to Details and select Save to run this checklist again.
            </Typography>
          )}

          <Typography variant="body2" color="text.secondary">
            Current: {formatDate(preview.current_start_date)}–{formatDate(preview.current_end_date)}
          </Typography>
          <Typography variant="body2" sx={{ mb: 1.5 }}>
            Proposed: {formatDate(preview.proposed_start_date)}–{formatDate(preview.proposed_end_date)}
          </Typography>

          <List disablePadding aria-label="Project date constraints">
            {preview.constraints.map((constraint) => {
              const passed = constraint.status === 'pass'
              const target = constraint.resolution_target
              return (
                <ListItem
                  key={constraint.id}
                  disableGutters
                  sx={{
                    alignItems: 'flex-start',
                    borderTop: 1,
                    borderColor: 'divider',
                    py: 1.25,
                    gap: 1,
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 32, mt: 0.15 }}>
                    {passed ? (
                      <PassIcon color="success" aria-label="Passed" />
                    ) : (
                      <FailIcon color="error" aria-label="Failed" />
                    )}
                  </ListItemIcon>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="subtitle2">{constraint.label}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {constraint.message}
                    </Typography>
                  </Box>
                  {!passed && target && resolutionLabels[target] && (
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => onResolve(target)}
                      sx={{ flexShrink: 0 }}
                    >
                      {resolutionLabels[target]}
                    </Button>
                  )}
                </ListItem>
              )
            })}
          </List>
        </>
      )}
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={saving}>Continue Editing</Button>
      <Button onClick={onRecheck} disabled={loading || saving}>Recheck</Button>
      <Button
        variant="contained"
        onClick={onProceed}
        disabled={!preview?.can_proceed || loading || saving}
      >
        {saving ? 'Saving…' : 'Proceed with Save'}
      </Button>
    </DialogActions>
  </Dialog>
)

export default ProjectDateConstraintDialog
