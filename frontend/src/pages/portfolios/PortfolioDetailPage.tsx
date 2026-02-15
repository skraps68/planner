import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Button,
  CircularProgress,
  TextField,
  Alert,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
} from '@mui/material'
import { Edit, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { Portfolio, PortfolioUpdate } from '../../types/portfolio'
import { Program } from '../../types'
import { format } from 'date-fns'
import { usePermissions } from '../../hooks/usePermissions'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'

const PortfolioDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { hasPermission } = usePermissions()
  const { conflictState, handleError, clearConflict } = useConflictHandler()
  const [isEditing, setIsEditing] = useState(false)
  const [editValues, setEditValues] = useState<PortfolioUpdate>({
    name: '',
    description: '',
    owner: '',
    reporting_start_date: '',
    reporting_end_date: '',
    version: 1,
  })
  const [snackbar, setSnackbar] = useState<{
    open: boolean
    message: string
    severity: 'success' | 'error'
  }>({
    open: false,
    message: '',
    severity: 'success',
  })
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Fetch portfolio data
  const { data: portfolio, isLoading } = useQuery<Portfolio>({
    queryKey: ['portfolio', id],
    queryFn: () => portfoliosApi.get(id!),
    enabled: !!id,
  })

  // Fetch programs for this portfolio
  const { data: programs = [], isLoading: programsLoading } = useQuery<Program[]>({
    queryKey: ['portfolio', id, 'programs'],
    queryFn: () => portfoliosApi.getPrograms(id!),
    enabled: !!id,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: (data: PortfolioUpdate) => portfoliosApi.update(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', id] })
      queryClient.invalidateQueries({ queryKey: ['portfolios'] })
      setSnackbar({
        open: true,
        message: 'Portfolio updated successfully',
        severity: 'success',
      })
      setIsEditing(false)
      setValidationErrors({})
    },
    onError: (error: any) => {
      // Try to handle as conflict error
      const isConflict = handleError(error, editValues)
      
      if (!isConflict) {
        // Not a conflict, show generic error
        const errorMessage = error.response?.data?.detail || 'Failed to update portfolio'
        setSnackbar({
          open: true,
          message: errorMessage,
          severity: 'error',
        })
      }
    },
  })

  // Check permissions
  const canEdit = hasPermission('edit_portfolios').hasPermission

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false })
  }

  const handleEdit = () => {
    if (portfolio) {
      setEditValues({
        name: portfolio.name,
        description: portfolio.description,
        owner: portfolio.owner,
        reporting_start_date: portfolio.reporting_start_date,
        reporting_end_date: portfolio.reporting_end_date,
        version: portfolio.version,
      })
      setIsEditing(true)
      setValidationErrors({})
    }
  }

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!editValues.name?.trim()) {
      errors.name = 'Name is required'
    } else if (editValues.name.length > 255) {
      errors.name = 'Name must be 255 characters or less'
    }

    if (!editValues.description?.trim()) {
      errors.description = 'Description is required'
    } else if (editValues.description.length > 1000) {
      errors.description = 'Description must be 1000 characters or less'
    }

    if (!editValues.owner?.trim()) {
      errors.owner = 'Owner is required'
    } else if (editValues.owner.length > 255) {
      errors.owner = 'Owner must be 255 characters or less'
    }

    if (!editValues.reporting_start_date) {
      errors.reporting_start_date = 'Reporting start date is required'
    }

    if (!editValues.reporting_end_date) {
      errors.reporting_end_date = 'Reporting end date is required'
    }

    if (
      editValues.reporting_start_date &&
      editValues.reporting_end_date &&
      editValues.reporting_start_date >= editValues.reporting_end_date
    ) {
      errors.reporting_end_date = 'Reporting end date must be after start date'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      setSnackbar({
        open: true,
        message: 'Please fix validation errors',
        severity: 'error',
      })
      return
    }

    updateMutation.mutate(editValues)
  }

  const handleCancel = () => {
    setIsEditing(false)
    setValidationErrors({})
  }

  const handleProgramRowClick = (program: Program) => {
    navigate(`/programs/${program.id}`, {
      state: {
        portfolioId: portfolio?.id,
        portfolioName: portfolio?.name,
      },
    })
  }

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    )
  }

  if (!portfolio) {
    return (
      <Box>
        <Typography variant="h5" gutterBottom>
          Portfolio not found
        </Typography>
        <Button onClick={() => navigate('/portfolios')}>
          Back to Portfolios
        </Button>
      </Box>
    )
  }

  // Determine portfolio status based on reporting dates
  const now = new Date()
  const reportingStartDate = new Date(portfolio.reporting_start_date)
  const reportingEndDate = new Date(portfolio.reporting_end_date)

  let status = 'Active'
  let statusColor: 'success' | 'warning' | 'default' = 'success'

  if (now < reportingStartDate) {
    status = 'Planned'
    statusColor = 'warning'
  } else if (now > reportingEndDate) {
    status = 'Completed'
    statusColor = 'default'
  }

  return (
    <Box>
      {/* Breadcrumbs with status chip */}
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Portfolios', path: '/portfolios' },
          { label: portfolio.name },
        ]}
        statusChip={<Chip label={status} color={statusColor} />}
      />

      {/* Portfolio Info Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            {/* Row 1: 4 fields */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Portfolio Name
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  size="small"
                  value={editValues.name}
                  onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                  error={!!validationErrors.name}
                  helperText={validationErrors.name}
                  sx={{ mt: 0.5 }}
                />
              ) : (
                <Typography variant="body1">{portfolio.name}</Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Owner
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  size="small"
                  value={editValues.owner}
                  onChange={(e) => setEditValues({ ...editValues, owner: e.target.value })}
                  error={!!validationErrors.owner}
                  helperText={validationErrors.owner}
                  sx={{ mt: 0.5 }}
                />
              ) : (
                <Typography variant="body1">{portfolio.owner}</Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Reporting Start Date
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={editValues.reporting_start_date}
                  onChange={(e) =>
                    setEditValues({ ...editValues, reporting_start_date: e.target.value })
                  }
                  error={!!validationErrors.reporting_start_date}
                  helperText={validationErrors.reporting_start_date}
                  sx={{ mt: 0.5 }}
                />
              ) : (
                <Typography variant="body1">
                  {format(new Date(portfolio.reporting_start_date), 'MMMM dd, yyyy')}
                </Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Reporting End Date
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  value={editValues.reporting_end_date}
                  onChange={(e) =>
                    setEditValues({ ...editValues, reporting_end_date: e.target.value })
                  }
                  error={!!validationErrors.reporting_end_date}
                  helperText={validationErrors.reporting_end_date}
                  sx={{ mt: 0.5 }}
                />
              ) : (
                <Typography variant="body1">
                  {format(new Date(portfolio.reporting_end_date), 'MMMM dd, yyyy')}
                </Typography>
              )}
            </Grid>

            {/* Row 2: 4 fields */}
            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Description
              </Typography>
              {isEditing ? (
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  size="small"
                  value={editValues.description}
                  onChange={(e) => setEditValues({ ...editValues, description: e.target.value })}
                  error={!!validationErrors.description}
                  helperText={validationErrors.description}
                  sx={{ mt: 0.5 }}
                />
              ) : (
                <Typography variant="body1">{portfolio.description}</Typography>
              )}
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Created At
              </Typography>
              <Typography variant="body1">
                {format(new Date(portfolio.created_at), 'MMMM dd, yyyy HH:mm')}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Typography variant="caption" color="text.secondary">
                Updated At
              </Typography>
              <Typography variant="body1">
                {format(new Date(portfolio.updated_at), 'MMMM dd, yyyy HH:mm')}
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} md={3} sx={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }}>
              {/* Edit/Save/Cancel buttons */}
              {(canEdit || isEditing) && (
                <>
                  {!isEditing ? (
                    <Button variant="outlined" size="small" startIcon={<Edit />} onClick={handleEdit}>
                      Edit
                    </Button>
                  ) : (
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<CancelIcon />}
                        onClick={handleCancel}
                      >
                        Cancel
                      </Button>
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        disabled={updateMutation.isPending}
                      >
                        {updateMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </Box>
                  )}
                </>
              )}
            </Grid>
          </Grid>
        </Paper>

      {/* Programs Section */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Programs
        </Typography>
        {programsLoading ? (
          <Box display="flex" justifyContent="center" py={4}>
            <CircularProgress />
          </Box>
        ) : programs.length === 0 ? (
          <Typography color="text.secondary">No programs in this portfolio</Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Program Name</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Business Sponsor</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Program Manager</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>End Date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {programs.map((program) => (
                  <TableRow
                    key={program.id}
                    hover
                    onClick={() => handleProgramRowClick(program)}
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        border: '2px solid',
                        borderColor: 'primary.main',
                      },
                    }}
                  >
                    <TableCell>{program.name}</TableCell>
                    <TableCell>{program.business_sponsor}</TableCell>
                    <TableCell>{program.program_manager}</TableCell>
                    <TableCell>{format(new Date(program.start_date), 'MMM dd, yyyy')}</TableCell>
                    <TableCell>{format(new Date(program.end_date), 'MMM dd, yyyy')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleSnackbarClose} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Conflict Dialog */}
      <ConflictDialog
        open={conflictState.isConflict}
        entityType={conflictState.entityType}
        attemptedChanges={conflictState.attemptedChanges}
        currentState={conflictState.currentState}
        onRefreshAndRetry={() => {
          // Reload the portfolio data
          queryClient.invalidateQueries({ queryKey: ['portfolio', id] })
          // Pre-fill form with attempted changes and new version
          setEditValues({
            ...conflictState.attemptedChanges,
            version: conflictState.currentState.version,
          })
          clearConflict()
        }}
        onCancel={() => {
          clearConflict()
          setIsEditing(false)
        }}
      />
    </Box>
  )
}

export default PortfolioDetailPage
