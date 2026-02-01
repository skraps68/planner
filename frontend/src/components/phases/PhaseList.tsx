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
  changedFields?: Record<string, Set<string>>
  deletedPhaseIds?: Set<string>
}

const PhaseList: React.FC<PhaseListProps> = ({ phases, onAdd, onUpdate, onDelete, readOnly = false, changedFields = {}, deletedPhaseIds = new Set() }) => {
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<ProjectPhase>>({})

  // Sort phases by start date
  const sortedPhases = [...phases].sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })

  // Count active (non-deleted) phases
  const activePhaseCount = phases.filter(p => !deletedPhaseIds.has(p.id || '')).length

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
    setEditValues((prev) => {
      const updated = {
        ...prev,
        [field]: value,
      }
      
      // Auto-calculate total_budget when capital or expense changes
      if (field === 'capital_budget' || field === 'expense_budget') {
        const capital = field === 'capital_budget' ? (typeof value === 'number' ? value : parseFloat(value as string) || 0) : (prev.capital_budget || 0)
        const expense = field === 'expense_budget' ? (typeof value === 'number' ? value : parseFloat(value as string) || 0) : (prev.expense_budget || 0)
        updated.total_budget = capital + expense
      }
      
      return updated
    })
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

  // Check if a phase is marked for deletion
  const isPhaseDeleted = (phaseId: string | undefined): boolean => {
    if (!phaseId) return false
    return deletedPhaseIds.has(phaseId)
  }

  // Check if a specific field has changed for a phase
  const isFieldChanged = (phaseId: string | undefined, fieldName: string): boolean => {
    if (!phaseId || !changedFields[phaseId]) return false
    return changedFields[phaseId].has(fieldName)
  }

  // Check if any field has changed for a phase (row-level indicator)
  const hasAnyChanges = (phaseId: string | undefined): boolean => {
    if (!phaseId || !changedFields[phaseId]) return false
    return changedFields[phaseId].size > 0
  }

  // Style for changed cells
  const getChangedCellStyle = (isChanged: boolean) => ({
    backgroundColor: isChanged ? 'warning.light' : 'inherit',
    borderLeft: isChanged ? '3px solid' : 'none',
    borderLeftColor: isChanged ? 'warning.main' : 'transparent',
    transition: 'all 0.2s ease',
  })

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
                const rowHasChanges = hasAnyChanges(phase.id)
                const isDeleted = isPhaseDeleted(phase.id)

                return (
                  <TableRow 
                    key={phase.id || 'new'} 
                    hover={!isDeleted}
                    sx={{
                      borderLeft: rowHasChanges ? '4px solid' : isDeleted ? '4px solid' : 'none',
                      borderLeftColor: rowHasChanges ? 'warning.main' : isDeleted ? 'error.main' : 'transparent',
                      opacity: isDeleted ? 0.6 : 1,
                      backgroundColor: isDeleted ? 'error.lighter' : 'inherit',
                    }}
                  >
                    <TableCell sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'name')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
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
                    <TableCell sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'description')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
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
                    <TableCell sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'start_date')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {phase.start_date ? formatDate(phase.start_date) : '-'}
                    </TableCell>
                    <TableCell sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'end_date')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {phase.end_date ? formatDate(phase.end_date) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'capital_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
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
                    <TableCell align="right" sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'expense_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
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
                    <TableCell align="right" sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'total_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {isEditing ? (
                        formatCurrency((editValues.capital_budget || 0) + (editValues.expense_budget || 0))
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
                            <IconButton 
                              size="small" 
                              color="primary" 
                              onClick={() => handleEdit(phase)} 
                              aria-label="edit"
                              disabled={isDeleted}
                            >
                              <EditIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => phase.id && onDelete(phase.id)}
                              disabled={activePhaseCount === 1 || isDeleted}
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
