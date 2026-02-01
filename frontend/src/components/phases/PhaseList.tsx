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
  onBoundaryDateChange?: (phaseId: string, field: 'start_date' | 'end_date', newDate: string) => void
  readOnly?: boolean
  changedFields?: Record<string, Set<string>>
  deletedPhaseIds?: Set<string>
}

const PhaseList: React.FC<PhaseListProps> = ({ phases, onAdd, onUpdate, onDelete, onBoundaryDateChange, readOnly = false, changedFields = {}, deletedPhaseIds = new Set() }) => {
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Partial<ProjectPhase>>({})

  // Sort phases by start date
  const sortedPhases = [...phases].sort((a, b) => {
    if (!a.start_date || !b.start_date) return 0
    return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
  })

  // Count active (non-deleted) phases
  const activePhaseCount = phases.filter(p => !deletedPhaseIds.has(p.id || '')).length

  // Helper function to safely convert budget values to numbers
  const toNumber = (value: string | number | undefined): number => {
    if (value === undefined || value === null) return 0
    if (typeof value === 'string') return parseFloat(value) || 0
    return value
  }

  // Calculate totals for active (non-deleted) phases
  const totals = phases
    .filter(p => !deletedPhaseIds.has(p.id || ''))
    .reduce(
      (acc, phase) => ({
        capital: acc.capital + toNumber(phase.capital_budget),
        expense: acc.expense + toNumber(phase.expense_budget),
        total: acc.total + toNumber(phase.total_budget),
      }),
      { capital: 0, expense: 0, total: 0 }
    )

  const handleEdit = (phase: Partial<ProjectPhase>) => {
    if (!phase.id) return
    setEditingPhaseId(phase.id)
    
    // Store original values without type conversion to avoid false change detection
    // Only convert strings to numbers for display/calculation purposes
    setEditValues({
      ...phase,
    })
  }

  const handleSave = () => {
    if (!editingPhaseId) return
    
    // Check if this is a boundary phase and if boundary dates changed
    const sortedPhases = [...phases].sort((a, b) => {
      if (!a.start_date || !b.start_date) return 0
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
    })
    const isFirstPhase = sortedPhases[0]?.id === editingPhaseId
    const isLastPhase = sortedPhases[sortedPhases.length - 1]?.id === editingPhaseId
    const originalPhase = phases.find(p => p.id === editingPhaseId)
    
    // Call onBoundaryDateChange if boundary dates changed
    if (onBoundaryDateChange && originalPhase) {
      if (isFirstPhase && editValues.start_date && editValues.start_date !== originalPhase.start_date) {
        onBoundaryDateChange(editingPhaseId, 'start_date', editValues.start_date)
      }
      if (isLastPhase && editValues.end_date && editValues.end_date !== originalPhase.end_date) {
        onBoundaryDateChange(editingPhaseId, 'end_date', editValues.end_date)
      }
    }
    
    // Only send fields that actually changed to avoid false change detection
    const updateData: Partial<ProjectPhase> = {}
    
    if (originalPhase) {
      // Check each field for actual changes
      if (editValues.name !== undefined && editValues.name !== originalPhase.name) {
        updateData.name = editValues.name
      }
      if (editValues.description !== undefined && editValues.description !== originalPhase.description) {
        updateData.description = editValues.description
      }
      if (editValues.start_date !== undefined && editValues.start_date !== originalPhase.start_date) {
        updateData.start_date = editValues.start_date
      }
      if (editValues.end_date !== undefined && editValues.end_date !== originalPhase.end_date) {
        updateData.end_date = editValues.end_date
      }
      
      // For budgets, compare numeric values but only include if changed
      const originalCapital = toNumber(originalPhase.capital_budget)
      const editCapital = toNumber(editValues.capital_budget)
      const originalExpense = toNumber(originalPhase.expense_budget)
      const editExpense = toNumber(editValues.expense_budget)
      
      if (editCapital !== originalCapital) {
        updateData.capital_budget = editCapital
      }
      if (editExpense !== originalExpense) {
        updateData.expense_budget = editExpense
      }
      
      // Only include total_budget if either capital or expense changed
      if (updateData.capital_budget !== undefined || updateData.expense_budget !== undefined) {
        updateData.total_budget = editCapital + editExpense
      }
    }
    
    console.log('[PhaseList v9.0] Saving only changed fields:', {
      editingPhaseId,
      updateData,
      hasChanges: Object.keys(updateData).length > 0
    })
    
    // Only call onUpdate if there are actual changes
    if (Object.keys(updateData).length > 0) {
      onUpdate(editingPhaseId, updateData)
    }
    
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
        const capital = field === 'capital_budget' ? toNumber(value) : toNumber(prev.capital_budget)
        const expense = field === 'expense_budget' ? toNumber(value) : toNumber(prev.expense_budget)
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
      {/* BUGFIX MARKER: v8.0 - Calculates and sends total_budget to satisfy backend validation */}
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
              sortedPhases.map((phase, index) => {
                const isEditing = editingPhaseId === phase.id
                const rowHasChanges = hasAnyChanges(phase.id)
                const isDeleted = isPhaseDeleted(phase.id)
                const isFirstPhase = index === 0
                const isLastPhase = index === sortedPhases.length - 1

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
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
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
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        phase.description || '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'start_date')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {isEditing && isFirstPhase ? (
                        <TextField
                          size="small"
                          type="date"
                          value={editValues.start_date || ''}
                          onChange={(e) => handleChange('start_date', e.target.value)}
                          fullWidth
                          required
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        phase.start_date ? formatDate(phase.start_date) : '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'end_date')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {isEditing && isLastPhase ? (
                        <TextField
                          size="small"
                          type="date"
                          value={editValues.end_date || ''}
                          onChange={(e) => handleChange('end_date', e.target.value)}
                          fullWidth
                          required
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        phase.end_date ? formatDate(phase.end_date) : '-'
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ 
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'capital_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {isEditing ? (
                        <TextField
                          size="small"
                          type="number"
                          value={toNumber(editValues.capital_budget)}
                          onChange={(e) => handleChange('capital_budget', parseFloat(e.target.value) || 0)}
                          fullWidth
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }}
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
                          value={toNumber(editValues.expense_budget)}
                          onChange={(e) => handleChange('expense_budget', parseFloat(e.target.value) || 0)}
                          fullWidth
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }}
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
                        formatCurrency(toNumber(editValues.capital_budget) + toNumber(editValues.expense_budget))
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
            {/* Totals Row */}
            {sortedPhases.length > 0 && (
              <TableRow sx={{ 
                backgroundColor: 'grey.50',
                borderTop: '2px solid',
                borderTopColor: 'grey.300',
              }}>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  Totals
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.capital)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.expense)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.total)}
                </TableCell>
                {!readOnly && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  )
}

export default PhaseList
