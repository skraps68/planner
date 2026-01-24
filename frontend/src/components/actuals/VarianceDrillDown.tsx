import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
} from '@mui/material'
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Info as InfoIcon,
} from '@mui/icons-material'
import { VarianceRecord } from '../../api/actuals'

interface VarianceDrillDownProps {
  open: boolean
  variance: VarianceRecord | null
  onClose: () => void
}

const VarianceDrillDown = ({ open, variance, onClose }: VarianceDrillDownProps) => {
  if (!variance) return null

  const getVarianceColor = () => {
    if (variance.variance_type.includes('over')) return 'error'
    if (variance.variance_type.includes('under')) return 'warning'
    return 'info'
  }

  const getVarianceIcon = () => {
    if (variance.allocation_variance > 0) {
      return <TrendingUpIcon color="error" />
    } else if (variance.allocation_variance < 0) {
      return <TrendingDownIcon color="warning" />
    }
    return <InfoIcon color="info" />
  }

  const getSeverity = () => {
    const absVariance = Math.abs(variance.variance_percentage)
    if (absVariance > 50) return 'HIGH'
    if (absVariance > 30) return 'MEDIUM'
    return 'LOW'
  }

  const getSeverityColor = () => {
    const severity = getSeverity()
    if (severity === 'HIGH') return 'error'
    if (severity === 'MEDIUM') return 'warning'
    return 'info'
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {getVarianceIcon()}
          <Typography variant="h6">Variance Details</Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          {/* Worker Information */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Worker Information
                </Typography>
                <Typography variant="h6">{variance.worker_name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  ID: {variance.worker_id}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Date: {variance.date}
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Allocation Comparison */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Forecast Allocation
                </Typography>
                <Typography variant="h4">{variance.forecast_allocation}%</Typography>
                <Typography variant="caption" color="text.secondary">
                  Planned allocation for this date
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Actual Allocation
                </Typography>
                <Typography variant="h4">{variance.actual_allocation}%</Typography>
                <Typography variant="caption" color="text.secondary">
                  Actual work performed
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Variance Metrics */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Variance Metrics
                </Typography>
                <Divider sx={{ my: 2 }} />
                <Grid container spacing={2}>
                  <Grid item xs={12} md={4}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Allocation Variance
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                        {getVarianceIcon()}
                        <Typography
                          variant="h5"
                          color={variance.allocation_variance > 0 ? 'error' : 'warning.main'}
                        >
                          {variance.allocation_variance > 0 ? '+' : ''}
                          {variance.allocation_variance}%
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Variance Percentage
                      </Typography>
                      <Typography variant="h5" sx={{ mt: 1 }}>
                        {variance.variance_percentage.toFixed(2)}%
                      </Typography>
                    </Box>
                  </Grid>
                  <Grid item xs={12} md={4}>
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Severity
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Chip label={getSeverity()} color={getSeverityColor()} />
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>

          {/* Variance Type */}
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Variance Type
                </Typography>
                <Chip
                  label={variance.variance_type.replace('_', ' ').toUpperCase()}
                  color={getVarianceColor()}
                  sx={{ mt: 1 }}
                />
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary">
                    {variance.variance_type === 'allocation_over' &&
                      'Worker was allocated more than forecasted. This may indicate scope creep or underestimation.'}
                    {variance.variance_type === 'allocation_under' &&
                      'Worker was allocated less than forecasted. This may indicate efficiency gains or incomplete work.'}
                    {variance.variance_type === 'unplanned_work' &&
                      'Worker performed work that was not in the original forecast. This requires investigation.'}
                    {variance.variance_type === 'unworked_assignment' &&
                      'Forecasted work was not performed. This may indicate delays or resource unavailability.'}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>

          {/* Recommendations */}
          <Grid item xs={12}>
            <Card variant="outlined" sx={{ bgcolor: 'info.lighter' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Recommended Actions
                </Typography>
                <Box component="ul" sx={{ pl: 2, mt: 1 }}>
                  {Math.abs(variance.variance_percentage) > 30 && (
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                      Review project scope and resource allocation with project manager
                    </Typography>
                  )}
                  {variance.variance_type === 'unplanned_work' && (
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                      Update resource forecast to include this work in future planning
                    </Typography>
                  )}
                  {variance.variance_type === 'allocation_over' && (
                    <Typography component="li" variant="body2" sx={{ mb: 1 }}>
                      Investigate reasons for over-allocation and adjust future estimates
                    </Typography>
                  )}
                  <Typography component="li" variant="body2">
                    Document variance explanation in project notes for future reference
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={onClose}>
          Mark as Reviewed
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default VarianceDrillDown
