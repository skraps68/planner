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
} from '@mui/material'
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { workerTypesApi } from '../../api/workers'
import { WorkerType } from '../../types'

interface WorkerTypeFormState {
  type: string
  description: string
}

const emptyForm: WorkerTypeFormState = { type: '', description: '' }

const formatRate = (rate?: string) => (rate ? `$${rate}` : '—')

const WorkerTypesPage: React.FC = () => {
  const [workerTypes, setWorkerTypes] = useState<WorkerType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingWorkerType, setEditingWorkerType] = useState<WorkerType | null>(null)
  const [form, setForm] = useState<WorkerTypeFormState>(emptyForm)
  const [saving, setSaving] = useState(false)

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

  const openCreateDialog = () => {
    setEditingWorkerType(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEditDialog = (workerType: WorkerType) => {
    setEditingWorkerType(workerType)
    setForm({ type: workerType.type, description: workerType.description || '' })
    setDialogOpen(true)
  }

  const closeDialog = () => {
    setDialogOpen(false)
    setEditingWorkerType(null)
    setForm(emptyForm)
  }

  const handleSave = async () => {
    try {
      setSaving(true)
      if (editingWorkerType) {
        await workerTypesApi.update(editingWorkerType.id, {
          type: form.type,
          description: form.description,
          version: editingWorkerType.version,
        })
      } else {
        await workerTypesApi.create({
          type: form.type,
          description: form.description,
        })
      }
      closeDialog()
      fetchWorkerTypes()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save worker type')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (workerType: WorkerType) => {
    if (!window.confirm(`Are you sure you want to delete the "${workerType.type}" worker type?`)) {
      return
    }

    try {
      await workerTypesApi.delete(workerType.id)
      fetchWorkerTypes()
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to delete worker type')
    }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="h5">Worker Types</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
          Add Worker Type
        </Button>
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
                  <TableCell sx={{ fontWeight: 'bold' }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Workers</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Current Rate</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 'bold' }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {workerTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      No worker types found
                    </TableCell>
                  </TableRow>
                ) : (
                  workerTypes.map((workerType) => (
                    <TableRow key={workerType.id} hover>
                      <TableCell>
                        <Typography variant="body1" fontWeight="medium">
                          {workerType.type}
                        </Typography>
                      </TableCell>
                      <TableCell>{workerType.description}</TableCell>
                      <TableCell>{workerType.worker_count ?? 0}</TableCell>
                      <TableCell>{formatRate(workerType.current_rate)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          size="small"
                          aria-label={`Edit ${workerType.type}`}
                          onClick={() => openEditDialog(workerType)}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          size="small"
                          aria-label={`Delete ${workerType.type}`}
                          onClick={() => handleDelete(workerType)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      <Dialog open={dialogOpen} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingWorkerType ? 'Edit Worker Type' : 'Add Worker Type'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, mt: 2 }}>
            <TextField
              label="Type"
              value={form.type}
              onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
              required
              fullWidth
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              required
              fullWidth
              multiline
              rows={3}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDialog}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={!form.type || !form.description || saving}>
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

export default WorkerTypesPage
