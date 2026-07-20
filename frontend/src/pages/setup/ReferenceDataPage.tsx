import React, { useState } from 'react'
import {
  Box, Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, CircularProgress, Alert, Snackbar,
  Dialog, DialogActions, DialogContent, DialogTitle, Collapse, Tooltip, Grid,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  KeyboardArrowDown as ExpandIcon, KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { workerTypesApi } from '../../api/workers'
import { ratesApi } from '../../api/rates'
import { WorkerType } from '../../types'

type Severity = 'success' | 'error'
type Notify = (message: string, severity: Severity) => void

const formatRate = (rate?: string | number | null) =>
  rate !== undefined && rate !== null && rate !== '' ? `$${rate}` : '—'
const today = () => format(new Date(), 'yyyy-MM-dd')
const errText = (e: any, fallback: string) => e?.response?.data?.detail || fallback

// ---------- Worker Types panel ----------
const WorkerTypesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: workerTypes = [], isLoading } = useQuery({
    queryKey: ['worker-types'],
    queryFn: () => workerTypesApi.list(),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<WorkerType | null>(null)
  const [form, setForm] = useState({ type: '', description: '' })

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? workerTypesApi.update(editing.id, { type: form.type, description: form.description, version: editing.version })
        : workerTypesApi.create({ type: form.type, description: form.description }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-types'] })
      setDialogOpen(false)
    },
    onError: (e: any) => notify(errText(e, 'Failed to save worker type'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (wt: WorkerType) => workerTypesApi.delete(wt.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['worker-types'] }),
    onError: (e: any) => notify(errText(e, 'Failed to delete worker type'), 'error'),
  })

  const openCreate = () => { setEditing(null); setForm({ type: '', description: '' }); setDialogOpen(true) }
  const openEdit = (wt: WorkerType) => { setEditing(wt); setForm({ type: wt.type, description: wt.description || '' }); setDialogOpen(true) }
  const handleDelete = (wt: WorkerType) => {
    if ((wt.worker_count ?? 0) > 0) return
    if (!window.confirm(`Are you sure you want to delete the "${wt.type}" worker type?`)) return
    deleteMut.mutate(wt)
  }

  return (
    <Paper component="section" role="region" aria-label="Worker Types" sx={{ p: 2, height: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Worker Types</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          Add Worker Type
        </Button>
      </Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Workers</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workerTypes.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No worker types found</TableCell></TableRow>
              ) : (
                workerTypes.map((wt) => {
                  const inUse = (wt.worker_count ?? 0) > 0
                  return (
                    <TableRow key={wt.id} hover>
                      <TableCell><Typography variant="body2" fontWeight="medium">{wt.type}</Typography></TableCell>
                      <TableCell>{wt.description}</TableCell>
                      <TableCell>{wt.worker_count ?? 0}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" aria-label={`Edit ${wt.type}`} onClick={() => openEdit(wt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={inUse ? `Can't delete — ${wt.worker_count} worker(s) still use this type. Reassign them first.` : ''}>
                          <span>
                            <IconButton size="small" aria-label={`Delete ${wt.type}`} disabled={inUse} onClick={() => handleDelete(wt)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Worker Type' : 'Add Worker Type'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField label="Type" value={form.type} fullWidth
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
            <TextField label="Description" value={form.description} fullWidth multiline rows={3}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.type || !form.description || saveMut.isPending}
            onClick={() => saveMut.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

// ---------- Rates panel ----------
const RateHistoryRows: React.FC<{ workerTypeId: string; open: boolean }> = ({ workerTypeId, open }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['rates', workerTypeId, 'history'],
    queryFn: () => ratesApi.getRateHistory(workerTypeId),
    enabled: open,
  })
  const history = data?.rate_history ?? []
  if (isLoading) return <CircularProgress size={20} />
  return (
    <Table size="small">
      <TableHead>
        <TableRow><TableCell>Rate</TableCell><TableCell>Start Date</TableCell><TableCell>End Date</TableCell></TableRow>
      </TableHead>
      <TableBody>
        {history.length === 0 ? (
          <TableRow><TableCell colSpan={3} align="center">No rate history</TableCell></TableRow>
        ) : (
          history.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{formatRate(Number(r.rate_amount).toFixed(2))}</TableCell>
              <TableCell>{r.start_date}</TableCell>
              <TableCell>{r.end_date || '—'}</TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )
}

const RatesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: workerTypes = [], isLoading } = useQuery({
    queryKey: ['worker-types'],
    queryFn: () => workerTypesApi.list(),
  })

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [target, setTarget] = useState<WorkerType | null>(null)
  const [amount, setAmount] = useState('')
  const [effectiveDate, setEffectiveDate] = useState(today())

  const setRateMut = useMutation({
    mutationFn: () => ratesApi.updateRate(target!.id, Number(amount), effectiveDate),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['worker-types'] })
      qc.invalidateQueries({ queryKey: ['rates'] })
      setDialogOpen(false)
    },
    onError: (e: any) => notify(errText(e, 'Failed to set rate'), 'error'),
  })

  const openSetRate = (wt: WorkerType) => {
    setTarget(wt); setAmount(''); setEffectiveDate(today()); setDialogOpen(true)
  }

  return (
    <Paper component="section" role="region" aria-label="Rates" sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 1.5 }}>Rates</Typography>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
                <TableCell sx={{ width: 40 }} />
                <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Current Rate</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {workerTypes.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No worker types found</TableCell></TableRow>
              ) : (
                workerTypes.map((wt) => (
                  <React.Fragment key={wt.id}>
                    <TableRow hover>
                      <TableCell>
                        <IconButton size="small" aria-label={`Expand ${wt.type}`}
                          onClick={() => setExpandedId(expandedId === wt.id ? null : wt.id)}>
                          {expandedId === wt.id ? <CollapseIcon /> : <ExpandIcon />}
                        </IconButton>
                      </TableCell>
                      <TableCell><Typography variant="body2" fontWeight="medium">{wt.type}</Typography></TableCell>
                      <TableCell>{formatRate(wt.current_rate)}</TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => openSetRate(wt)}>Set Rate</Button>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={4} sx={{ py: 0, borderBottom: expandedId === wt.id ? undefined : 'none' }}>
                        <Collapse in={expandedId === wt.id} timeout="auto" unmountOnExit>
                          <Box sx={{ p: 2 }}>
                            <RateHistoryRows workerTypeId={wt.id} open={expandedId === wt.id} />
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
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Set Rate{target ? ` — ${target.type}` : ''}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField label="Amount" type="number" value={amount} fullWidth
              inputProps={{ min: 0, step: '0.01' }}
              onChange={(e) => setAmount(e.target.value)} />
            <TextField label="Effective Date" type="date" value={effectiveDate} fullWidth
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setEffectiveDate(e.target.value)} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!(Number(amount) > 0) || !effectiveDate || setRateMut.isPending}
            onClick={() => setRateMut.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

// ---------- Page ----------
const ReferenceDataPage: React.FC = () => {
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: Severity }>({
    open: false, message: '', severity: 'error',
  })
  const notify: Notify = (message, severity) => setSnackbar({ open: true, message, severity })

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 1.5 }}>Reference Data</Typography>
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}><WorkerTypesPanel notify={notify} /></Grid>
        <Grid item xs={12} md={6}><RatesPanel notify={notify} /></Grid>
      </Grid>

      <Snackbar open={snackbar.open} autoHideDuration={6000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSnackbar((s) => ({ ...s, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  )
}

export default ReferenceDataPage
