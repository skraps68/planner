import React, { useState } from 'react'
import {
  Box, Button, IconButton, Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Typography, CircularProgress, Alert, Snackbar,
  Dialog, DialogActions, DialogContent, DialogTitle, Collapse, Tooltip, Grid,
  Chip, Switch, FormControlLabel,
} from '@mui/material'
import {
  Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon,
  KeyboardArrowDown as ExpandIcon, KeyboardArrowUp as CollapseIcon,
} from '@mui/icons-material'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { workerTypesApi } from '../../api/workers'
import { ratesApi } from '../../api/rates'
import { resourceRolesApi } from '../../api/resourceRoles'
import { externalReferenceTypesApi } from '../../api/externalReferenceTypes'
import { WorkerType, ResourceRole, ExternalReferenceType } from '../../types'

type Severity = 'success' | 'error'
type Notify = (message: string, severity: Severity) => void

const DEFAULT_ROLE_NAME = 'Default'
const descriptionHeaderSx = { fontWeight: 'bold', width: '100%' }
const descriptionCellSx = { width: '100%', maxWidth: 0 }
const contentCellSx = { whiteSpace: 'nowrap' }

const formatRate = (rate?: string | number | null) =>
  rate !== undefined && rate !== null && rate !== '' ? `$${rate}` : '—'
const today = () => format(new Date(), 'yyyy-MM-dd')
const errText = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { detail?: string } } })
    ?.response?.data?.detail
    || fallback

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
    onError: (e) => notify(errText(e, 'Failed to save worker type'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (wt: WorkerType) => workerTypesApi.delete(wt.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['worker-types'] }),
    onError: (e) => notify(errText(e, 'Failed to delete worker type'), 'error'),
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
          <Table size="small" sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', ...contentCellSx }}>Type</TableCell>
                <TableCell sx={descriptionHeaderSx}>Description</TableCell>
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
                      <TableCell sx={contentCellSx}><Typography variant="body2" fontWeight="medium">{wt.type}</Typography></TableCell>
                      <TableCell sx={descriptionCellSx}>
                        <Typography variant="body2" noWrap title={wt.description}>
                          {wt.description}
                        </Typography>
                      </TableCell>
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
            <TextField label="Type" value={form.type} fullWidth required
              InputLabelProps={{ required: false }}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} />
            <TextField label="Description" value={form.description} fullWidth multiline rows={3} required
              InputLabelProps={{ required: false }}
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
    onError: (e) => notify(errText(e, 'Failed to set rate'), 'error'),
  })

  const openSetRate = (wt: WorkerType) => {
    const current = wt.current_rate != null && wt.current_rate !== '' ? String(Math.round(Number(wt.current_rate))) : ''
    setTarget(wt); setAmount(current); setEffectiveDate(today()); setDialogOpen(true)
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
              <TableRow>
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
                        <IconButton size="small" aria-label={`Edit rate for ${wt.type}`} onClick={() => openSetRate(wt)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
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
            <TextField label="Amount" type="number" value={amount} fullWidth required
              inputProps={{ min: 0, step: 1 }}
              InputLabelProps={{ required: false }}
              sx={{
                '& input[type=number]': { MozAppearance: 'textfield' },
                '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
                '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
              }}
              onChange={(e) => setAmount(e.target.value)} />
            <TextField label="Effective Date" type="date" value={effectiveDate} fullWidth required
              InputLabelProps={{ shrink: true, required: false }}
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

// ---------- Resource Roles panel ----------
const ResourceRolesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['resource-roles'],
    queryFn: () => resourceRolesApi.list(),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ResourceRole | null>(null)
  const [form, setForm] = useState({ name: '', description: '' })

  const saveMut = useMutation({
    mutationFn: () =>
      editing
        ? resourceRolesApi.update(editing.id, { name: form.name, description: form.description || undefined, version: editing.version })
        : resourceRolesApi.create({ name: form.name, description: form.description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['resource-roles'] })
      setDialogOpen(false)
    },
    onError: (e) => notify(errText(e, 'Failed to save resource role'), 'error'),
  })

  const deleteMut = useMutation({
    mutationFn: (role: ResourceRole) => resourceRolesApi.delete(role.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resource-roles'] }),
    onError: (e) => notify(errText(e, 'Failed to delete resource role'), 'error'),
  })

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setDialogOpen(true) }
  const openEdit = (role: ResourceRole) => { setEditing(role); setForm({ name: role.name, description: role.description || '' }); setDialogOpen(true) }
  const handleDelete = (role: ResourceRole) => {
    if (role.name === DEFAULT_ROLE_NAME || (role.resource_count ?? 0) > 0) return
    if (!window.confirm(`Are you sure you want to delete the "${role.name}" role?`)) return
    deleteMut.mutate(role)
  }

  return (
    <Paper component="section" role="region" aria-label="Resource Roles" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h6">Resource Roles</Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>Add Role</Button>
      </Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small" sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', ...contentCellSx }}>Name</TableCell>
                <TableCell sx={descriptionHeaderSx}>Description</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Resources</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {roles.length === 0 ? (
                <TableRow><TableCell colSpan={4} align="center">No resource roles found</TableCell></TableRow>
              ) : (
                roles.map((role) => {
                  const isDefault = role.name === DEFAULT_ROLE_NAME
                  const inUse = (role.resource_count ?? 0) > 0
                  const disabled = isDefault || inUse
                  const title = isDefault
                    ? 'Default role cannot be deleted'
                    : inUse
                      ? `Can't delete — ${role.resource_count} resource(s) still use this role. Reassign them first.`
                      : ''
                  return (
                    <TableRow key={role.id} hover>
                      <TableCell sx={contentCellSx}><Typography variant="body2" fontWeight="medium">{role.name}</Typography></TableCell>
                      <TableCell sx={descriptionCellSx}>
                        <Typography variant="body2" noWrap title={role.description}>
                          {role.description}
                        </Typography>
                      </TableCell>
                      <TableCell>{role.resource_count ?? 0}</TableCell>
                      <TableCell align="right">
                        <IconButton size="small" aria-label={`Edit ${role.name}`} onClick={() => openEdit(role)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <Tooltip title={title}>
                          <span>
                            <IconButton size="small" aria-label={`Delete ${role.name}`} disabled={disabled} onClick={() => handleDelete(role)}>
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
        <DialogTitle>{editing ? 'Edit Role' : 'Add Role'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField label="Name" value={form.name} required fullWidth
              InputLabelProps={{ required: false }}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            <TextField label="Description" value={form.description} fullWidth multiline rows={3}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" disabled={!form.name || saveMut.isPending} onClick={() => saveMut.mutate()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  )
}

// ---------- External Reference Types panel ----------
const ExternalReferenceTypesPanel: React.FC<{ notify: Notify }> = ({ notify }) => {
  const qc = useQueryClient()
  const { data: types = [], isLoading } = useQuery({
    queryKey: ['external-reference-types'],
    queryFn: () => externalReferenceTypesApi.list(),
  })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ExternalReferenceType | null>(null)
  const [form, setForm] = useState({ name: '', description: '', is_active: true })

  const saveMut = useMutation({
    mutationFn: () => editing
      ? externalReferenceTypesApi.update(editing.id, {
          name: form.name,
          description: form.description,
          is_active: form.is_active,
          version: editing.version,
        })
      : externalReferenceTypesApi.create({
          name: form.name,
          description: form.description,
        }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['external-reference-types'] })
      setDialogOpen(false)
    },
    onError: (e) => notify(errText(e, 'Failed to save external reference type'), 'error'),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', is_active: true })
    setDialogOpen(true)
  }
  const openEdit = (item: ExternalReferenceType) => {
    setEditing(item)
    setForm({
      name: item.name,
      description: item.description,
      is_active: item.is_active,
    })
    setDialogOpen(true)
  }

  return (
    <Paper component="section" role="region" aria-label="External Reference Types" sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
        <Box>
          <Typography variant="h6">External Reference Types</Typography>
          <Typography variant="body2" color="text.secondary">
            Types available for non-labor resources and cost plans.
          </Typography>
        </Box>
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
          Add Reference Type
        </Button>
      </Box>
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
      ) : (
        <TableContainer>
          <Table size="small" sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', ...contentCellSx }}>Type</TableCell>
                <TableCell sx={descriptionHeaderSx}>Description</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>References</TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {types.length === 0 ? (
                <TableRow><TableCell colSpan={5} align="center">No external reference types found</TableCell></TableRow>
              ) : types.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell sx={contentCellSx}>
                    <Typography variant="body2" fontWeight="medium">{item.name}</Typography>
                  </TableCell>
                  <TableCell sx={descriptionCellSx}>
                    <Typography variant="body2" noWrap title={item.description}>
                      {item.description}
                    </Typography>
                  </TableCell>
                  <TableCell>{item.reference_count}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={item.is_active ? 'Active' : 'Inactive'}
                      color={item.is_active ? 'success' : 'default'}
                      variant={item.is_active ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>
        Reference values accept 1–32 alphanumeric characters. Internal IDs are generated automatically.
      </Typography>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Reference Type' : 'Add Reference Type'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Name"
              value={form.name}
              required
              fullWidth
              InputLabelProps={{ required: false }}
              onChange={(e) => setForm((previous) => ({ ...previous, name: e.target.value }))}
            />
            <TextField
              label="Description"
              value={form.description}
              required
              fullWidth
              multiline
              rows={3}
              InputLabelProps={{ required: false }}
              onChange={(e) => setForm((previous) => ({ ...previous, description: e.target.value }))}
            />
            {editing && (
              <FormControlLabel
                control={
                  <Switch
                    checked={form.is_active}
                    onChange={(e) => setForm((previous) => ({
                      ...previous,
                      is_active: e.target.checked,
                    }))}
                  />
                }
                label="Active"
              />
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!form.name || !form.description || saveMut.isPending}
            onClick={() => saveMut.mutate()}
          >
            Save
          </Button>
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
        <Grid item xs={12}><ResourceRolesPanel notify={notify} /></Grid>
        <Grid item xs={12}><ExternalReferenceTypesPanel notify={notify} /></Grid>
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
