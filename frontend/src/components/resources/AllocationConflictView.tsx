import { useState, useEffect } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  TextField,
  Button,
} from '@mui/material'
import { Warning as WarningIcon } from '@mui/icons-material'
import { assignmentsApi, AssignmentConflict } from '../../api/assignments'

interface AllocationConflictViewProps {
  resourceId: string
}

const AllocationConflictView = ({ resourceId }: AllocationConflictViewProps) => {
  const [conflicts, setConflicts] = useState<AssignmentConflict[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [startDate, setStartDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]
  )
  const [endDate, setEndDate] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]
  )

  const checkConflicts = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await assignmentsApi.checkConflicts(resourceId, startDate, endDate)
      setConflicts(data.conflicts)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to check conflicts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (resourceId) {
      checkConflicts()
    }
  }, [resourceId])

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningIcon color="warning" />
          Allocation Conflicts
        </Typography>

        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <TextField
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            size="small"
          />
          <Button variant="contained" onClick={checkConflicts} disabled={loading}>
            Check Conflicts
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : conflicts.length === 0 ? (
          <Alert severity="success">No allocation conflicts found in the selected date range.</Alert>
        ) : (
          <>
            <Alert severity="warning" sx={{ mb: 2 }}>
              Found {conflicts.length} conflict(s) where allocation exceeds 100%
            </Alert>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                    <TableCell sx={{ fontWeight: 'bold' }}>Date</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Resource</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 'bold' }}>Total Allocation</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Conflict Type</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {conflicts.map((conflict, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        {new Date(conflict.assignment_date).toLocaleDateString()}
                      </TableCell>
                      <TableCell>{conflict.resource_name}</TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${conflict.total_allocation}%`}
                          color="error"
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={conflict.conflict_type.replace('_', ' ')}
                          color="warning"
                          size="small"
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default AllocationConflictView
