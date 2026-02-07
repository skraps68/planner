import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  Typography,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import {
  ArrowBack as ArrowBackIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material'
import { useNavigate, useParams } from 'react-router-dom'
import { auditApi, AuditLog, UserActivitySummary } from '../../api/audit'
import { usersApi } from '../../api/users'

interface TabPanelProps {
  children?: React.ReactNode
  index: number
  value: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  )
}

const UserAuditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [username, setUsername] = useState<string>('')
  const [allActivity, setAllActivity] = useState<AuditLog[]>([])
  const [permissionChanges, setPermissionChanges] = useState<AuditLog[]>([])
  const [summary, setSummary] = useState<UserActivitySummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tabValue, setTabValue] = useState(0)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(25)
  const [detailsDialog, setDetailsDialog] = useState<{
    open: boolean
    log: AuditLog | null
  }>({ open: false, log: null })

  useEffect(() => {
    const fetchData = async () => {
      if (!id) return

      try {
        setLoading(true)
        setError(null)
        const [user, activity, permissions, activitySummary] = await Promise.all([
          usersApi.getUser(id),
          auditApi.getUserActivity(id, 1000),
          auditApi.getPermissionChanges(id, 1000),
          auditApi.getUserActivitySummary(id),
        ])
        setUsername(user.username)
        setAllActivity(activity)
        setPermissionChanges(permissions)
        setSummary(activitySummary)
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load audit data')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [id])

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const handleViewDetails = (log: AuditLog) => {
    setDetailsDialog({ open: true, log })
  }

  const getOperationColor = (operation: string): 'success' | 'primary' | 'error' | 'warning' => {
    switch (operation) {
      case 'CREATE':
        return 'success'
      case 'UPDATE':
        return 'primary'
      case 'DELETE':
        return 'error'
      case 'ROLE_ASSIGNED':
      case 'ROLE_REMOVED':
      case 'SCOPE_ASSIGNED':
      case 'SCOPE_REMOVED':
        return 'warning'
      default:
        return 'primary'
    }
  }

  const renderAuditTable = (logs: AuditLog[]) => {
    const paginatedLogs = logs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)

    return (
      <>
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Timestamp</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Operation</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Entity Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Entity ID</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} align="center">
                    No audit logs found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedLogs.map((log) => (
                  <TableRow key={log.id} hover>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={log.operation}
                        size="small"
                        color={getOperationColor(log.operation)}
                      />
                    </TableCell>
                    <TableCell>{log.entity_type}</TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                        {log.entity_id.substring(0, 8)}...
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => handleViewDetails(log)}>
                        <VisibilityIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={logs.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />
        </TableContainer>
      </>
    )
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return (
      <Box>
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/admin/users/${id}`)}>
          Back to User
        </Button>
      </Box>
    )
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <IconButton onClick={() => navigate(`/admin/users/${id}`)}>
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h4">Audit Trail - {username}</Typography>
      </Box>

      {summary && (
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Activity Summary
            </Typography>
            <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mt: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Total Actions
                </Typography>
                <Typography variant="h5">{summary.total_actions}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  First Action
                </Typography>
                <Typography variant="body1">
                  {new Date(summary.first_action).toLocaleDateString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Last Action
                </Typography>
                <Typography variant="body1">
                  {new Date(summary.last_action).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Operations
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {Object.entries(summary.operations).map(([operation, count]) => (
                  <Chip
                    key={operation}
                    label={`${operation}: ${count}`}
                    size="small"
                    color={getOperationColor(operation)}
                  />
                ))}
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <Tabs value={tabValue} onChange={(_e, newValue) => setTabValue(newValue)}>
            <Tab label={`All Activity (${allActivity.length})`} />
            <Tab label={`Permission Changes (${permissionChanges.length})`} />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            {renderAuditTable(allActivity)}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            {renderAuditTable(permissionChanges)}
          </TabPanel>
        </CardContent>
      </Card>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialog.open}
        onClose={() => setDetailsDialog({ open: false, log: null })}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Audit Log Details</DialogTitle>
        <DialogContent>
          {detailsDialog.log && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Timestamp
                </Typography>
                <Typography variant="body1">
                  {new Date(detailsDialog.log.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Operation
                </Typography>
                <Typography variant="body1">{detailsDialog.log.operation}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Entity Type
                </Typography>
                <Typography variant="body1">{detailsDialog.log.entity_type}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Entity ID
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace' }}>
                  {detailsDialog.log.entity_id}
                </Typography>
              </Box>
              {detailsDialog.log.before_values && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Before Values
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(detailsDialog.log.before_values, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
              {detailsDialog.log.after_values && (
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    After Values
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.100', mt: 1 }}>
                    <pre style={{ margin: 0, fontSize: '0.875rem' }}>
                      {JSON.stringify(detailsDialog.log.after_values, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialog({ open: false, log: null })}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

export default UserAuditPage
