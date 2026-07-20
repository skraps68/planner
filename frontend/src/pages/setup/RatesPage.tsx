import React, { useState, useEffect } from 'react'
import {
  Box,
  Button,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Collapse,
} from '@mui/material'
import { KeyboardArrowDown as ExpandIcon, KeyboardArrowUp as CollapseIcon } from '@mui/icons-material'
import { workerTypesApi } from '../../api/workers'
import { ratesApi, RateHistory } from '../../api/rates'
import { WorkerType } from '../../types'

const formatRate = (rate?: string | number | null) =>
  rate !== undefined && rate !== null && rate !== '' ? `$${rate}` : '—'

const today = () => new Date().toISOString().slice(0, 10)

const RatesPage: React.FC = () => {
  const [workerTypes, setWorkerTypes] = useState<WorkerType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [targetWorkerType, setTargetWorkerType] = useState<WorkerType | null>(null)
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(today())
  const [saving, setSaving] = useState(false)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [historyByType, setHistoryByType] = useState<Record<string, RateHistory[]>>({})
  const [historyLoading, setHistoryLoading] = useState<string | null>(null)

  const fetchWorkerTypes = async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await workerTypesApi.list()
      setWorkerTypes(data)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load worker types')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchWorkerTypes()
  }, [])

  const openSetRateDialog = (workerType: WorkerType) => {
    setTargetWorkerType(workerType)
    setAmount('')
    setEffectiveDate(today())
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setTargetWorkerType(null)
    setAmount('')
    setEffectiveDate(today())
  }

  const handleSave = async () => {
    if (!targetWorkerType) return
    try {
      setSaving(true)
      await ratesApi.updateRate(targetWorkerType.id, Number(amount), effectiveDate)
      closeDialog()
      fetchWorkerTypes()
      if (historyByType[targetWorkerType.id]) {
        setHistoryByType((prev) => {
          const next = { ...prev }
          delete next[targetWorkerType.id]
          return next
        })
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to set rate')
    } finally {
      setSaving(false)
    }
  }

  const toggleExpand = async (workerType: WorkerType) => {
    if (expandedId === workerType.id) {
      setExpandedId(null)
      return
    }
    setExpandedId(workerType.id)
    if (!historyByType[workerType.id]) {
      try {
        setHistoryLoading(workerType.id)
        const data = await ratesApi.getRateHistory(workerType.id)
        setHistoryByType((prev) => ({ ...prev, [workerType.id]: data.rate_history }))
      } catch (err: any) {
        setError(err.response?.data?.detail || 'Failed to load rate history')
      } finally {
        setHistoryLoading(null)
      }
    }
  }

  const amountValid = Number(amount) > 0

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5">Rates</Typography>
      </Box>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Paper>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                  <TableCell sx={{ width: 48 }} />
                  <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Current Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workerTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center">
                      No worker types found
                    </TableCell>
                  </TableRow>
                ) : (
                  workerTypes.map((workerType) => (
                    <React.Fragment key={workerType.id}>
                      <TableRow hover>
                        <TableCell>
                          <IconButton
                            size="small"
                            aria-label={`Expand ${workerType.type}`}
                            onClick={() => toggleExpand(workerType)}
                          >
                            {expandedId === workerType.id ? <CollapseIcon /> : <ExpandIcon />}
                          </IconButton>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body1" fontWeight="medium">
                            {workerType.type}
                          </Typography>
                        </TableCell>
                        <TableCell>{formatRate(workerType.current_rate)}</TableCell>
                        <TableCell align="right">
                          <Button size="small" variant="outlined" onClick={() => openSetRateDialog(workerType)}>
                            Set Rate
                          </Button>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell colSpan={4} sx={{ py: 0, borderBottom: expandedId === workerType.id ? undefined : 'none' }}>
                          <Collapse in={expandedId === workerType.id} timeout="auto" unmountOnExit>
                            <Box sx={{ p: 2 }}>
                              {historyLoading === workerType.id ? (
                                <CircularProgress size={20} />
                              ) : (
                                <Table size="small">
                                  <TableHead>
                                    <TableRow>
                                      <TableCell>Rate</TableCell>
                                      <TableCell>Start Date</TableCell>
                                      <TableCell>End Date</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {(historyByType[workerType.id] || []).length === 0 ? (
                                      <TableRow>
                                        <TableCell colSpan={3} align="center">
                                          No rate history
                                        </TableCell>
                                      </TableRow>
                                    ) : (
                                      (historyByType[workerType.id] || []).map((rate) => (
                                        <TableRow key={rate.id}>
                                          <TableCell>{formatRate(rate.rate_amount)}</TableCell>
                                          <TableCell>{rate.start_date}</TableCell>
                                          <TableCell>{rate.end_date || '—'}</TableCell>
                                        </TableRow>
                                      ))
                                    )}
                                  </TableBody>
                                </Table>
                              )}
                            </Box>
                          </Collapse>
                        </TableCell>
                      </TableRow>
                    </React.Fragment>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Set Rate{targetWorkerType ? ` — ${targetWorkerType.type}` : ''}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              fullWidth
              inputProps={{ min: 0, step: '0.01' }}
            />
            <TextField
              label="Effective Date"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!amountValid || !effectiveDate || saving}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={() => setError(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setError(null)} severity="error" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default RatesPage
