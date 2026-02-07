import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Alert,
  Box,
  Chip,
} from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'
import { AllocationConflict } from '../../api/actuals'

interface AllocationConflictDialogProps {
  open: boolean
  conflicts: AllocationConflict[]
  onClose: () => void
  onResolve?: () => void
}

const AllocationConflictDialog = ({
  open,
  conflicts,
  onClose,
  onResolve,
}: AllocationConflictDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          <Typography variant="h6">Allocation Conflicts Detected</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Alert severity="warning" sx={{ mb: 3 }}>
          The following workers would exceed 100% allocation on specific dates if these actuals are
          imported. Please review and resolve these conflicts before proceeding.
        </Alert>

        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Worker</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Existing Allocation</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>New Allocation</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {conflicts.map((conflict, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Typography variant="body2">{conflict.worker_name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {conflict.external_worker_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{conflict.actual_date}</TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{conflict.existing_allocation}%</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{conflict.new_allocation}%</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" color="error" fontWeight="bold">
                      {conflict.total_allocation}%
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={conflict.conflict_type.replace('_', ' ')}
                      size="small"
                      color="error"
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Resolution Options:
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • Review the CSV file and adjust allocation percentages to ensure totals don't exceed
            100%
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            • Remove conflicting entries from existing actuals before importing
          </Typography>
          <Typography variant="body2" color="text.secondary">
            • Split work across multiple days to distribute allocation
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {onResolve && (
          <Button variant="contained" onClick={onResolve}>
            View Existing Actuals
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

export default AllocationConflictDialog
