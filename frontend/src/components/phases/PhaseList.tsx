import React, { useState } from 'react'
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
} from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon, Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { ProjectPhase } from '../../types'

interface PhaseListProps {
  phases: Partial<ProjectPhase>[]
  onAdd: () => void
  onUpdate: (phaseId: string, updates: Partial<ProjectPhase>) => void
  onDelete: (phaseId: string) => void
  readOnly?: boolean
}

const PhaseList: React.FC<PhaseListProps> = ({ phases, onAdd, onUpdate, onDelete, readOnly = false }) => {
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<ProjectPhase>>({})

  // Sort phases by start date
  const sortedPhases = [...phases].sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })

  const handleEdit = (phase: Partial<ProjectPhase>) => {
    if (!phase.id) return
    setEditingPhaseId(phase.id)
    setEditValues(phase)
  }

  const handleSave = () => {
    if (!editingPhaseId) return
    onUpdate(editingPhaseId, editValues)
    setEditingPhaseId(null)
    setEditValues({})
  }

  const handleCancel = () => {
    setEditingPhaseId(null)
    setEditValues({})
  }

  const handleChange = (field: keyof ProjectPhase, value: string | number) => {
    setEditValues((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value)
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">Project Phases</Typography>
        {!readOnly && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={onAdd}>
            Add Phase
          </Button>
        )}
      </Box>

      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Start Date</TableCell>
              <TableCell>End Date</TableCell>
              <TableCell align="right">Capital Budget</TableCell>
              <TableCell align="right">Expense Budget</TableCell>
              <TableCell align="right">Total Budget</TableCell>
              {!readOnly && <TableCell align="center">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPhases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={readOnly ? 7 : 8} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No phases defined
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedPhases.map((phase) => {
                const isEditing = editingPhaseId === phase.id

                return (
                  <TableRow key={phase.id || 'new'} hover>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          size="small"
                          value={editValues.name || ''}
                          onChange={(e) => handleChange('name', e.target.value)}
                          fullWidth
                          required
                        />
                      ) : (
                        phase.name || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          size="small"
                          value={editValues.description || ''}
                          onChange={(e) => handleChange('description', e.target.value)}
                          fullWidth
                          multiline
                          rows={1}
                        />
                      ) : (
                        phase.description || '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="date"
                          value={editValues.start_date || ''}
                          onChange={(e) => handleChange('start_date', e.target.value)}
                          fullWidth
                          required
                        />
                      ) : phase.start_date ? (
                        formatDate(phase.start_date)
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell>
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="date"
                          value={editValues.end_date || ''}
                          onChange={(e) => handleChange('end_date', e.target.value)}
                          fullWidth
                          required
                        />
                      ) : phase.end_date ? (
                        formatDate(phase.end_date)
                      ) : (
                        '-'
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editValues.capital_budget ?? 0}
                          onChange={(e) => handleChange('capital_budget', parseFloat(e.target.value) || 0)}
                          fullWidth
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      ) : (
                        formatCurrency(phase.capital_budget || 0)
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editValues.expense_budget ?? 0}
                          onChange={(e) => handleChange('expense_budget', parseFloat(e.target.value) || 0)}
                          fullWidth
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      ) : (
                        formatCurrency(phase.expense_budget || 0)
                      )}
                    </TableCell>
                    <TableCell align="right">
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="number"
                          value={editValues.total_budget ?? 0}
                          onChange={(e) => handleChange('total_budget', parseFloat(e.target.value) || 0)}
                          fullWidth
                          inputProps={{ min: 0, step: 0.01 }}
                        />
                      ) : (
                        formatCurrency(phase.total_budget || 0)
                      )}
                    </TableCell>
                    {!readOnly && (
                      <TableCell align="center">
                        {isEditing ? (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <IconButton size="small" color="primary" onClick={handleSave} aria-label="save">
                              <SaveIcon fontSize="small" />
                            </IconButton>
                            <IconButton size="small" onClick={handleCancel} aria-label="cancel">
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <IconButton size="small" color="primary" onClick={() => handleEdit(phase)} aria-label="edit">
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => phase.id && onDelete(phase.id)}
                              disabled={phases.length === 1}
                              aria-label="delete"
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default PhaseList
