import React from 'react'
import {
  Box,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material'
import { Delete as DeleteIcon } from '@mui/icons-material'
import { ProjectPhase } from '../../types'

interface PhaseListProps {
  phases: Partial<ProjectPhase>[]
  editMode: boolean
  onUpdate: (phaseId: string, updates: Partial<ProjectPhase>) => void
  onDelete: (phaseId: string) => void
  changedFields?: Record<string, Set<string>>
  deletedPhaseIds?: Set<string>
}

const PhaseList: React.FC<PhaseListProps> = ({ phases, editMode, onUpdate, onDelete, changedFields = {}, deletedPhaseIds = new Set() }) => {
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
        laborCapital: acc.laborCapital + toNumber(phase.labor_capital_budget),
        laborExpense: acc.laborExpense + toNumber(phase.labor_expense_budget),
        nonlaborCapital: acc.nonlaborCapital + toNumber(phase.nonlabor_capital_budget),
        nonlaborExpense: acc.nonlaborExpense + toNumber(phase.nonlabor_expense_budget),
        total:
          acc.total +
          toNumber(phase.labor_capital_budget) +
          toNumber(phase.labor_expense_budget) +
          toNumber(phase.nonlabor_capital_budget) +
          toNumber(phase.nonlabor_expense_budget),
      }),
      { laborCapital: 0, laborExpense: 0, nonlaborCapital: 0, nonlaborExpense: 0, total: 0 }
    )

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
    <Box>
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
              <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>Description</TableCell>
              <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
              <TableCell rowSpan={2} sx={{ fontWeight: 'bold' }}>End Date</TableCell>
              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Labor Budget</TableCell>
              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Non-Labor Budget</TableCell>
              <TableCell rowSpan={2} align="right" sx={{ fontWeight: 'bold' }}>Total Budget</TableCell>
              {editMode && <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Actions</TableCell>}
            </TableRow>
            <TableRow sx={{ backgroundColor: '#A5C1D8' }}>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Capital</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Expense</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Capital</TableCell>
              <TableCell align="right" sx={{ fontWeight: 'bold' }}>Expense</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPhases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={editMode ? 10 : 9} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No phases defined
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedPhases.map((phase) => {
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
                      {editMode ? (
                        <TextField
                          size="small"
                          fullWidth
                          value={phase.name || ''}
                          onChange={(e) => onUpdate(phase.id!, { name: e.target.value })}
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
                      {editMode ? (
                        <TextField
                          size="small"
                          fullWidth
                          value={phase.description || ''}
                          onChange={(e) => onUpdate(phase.id!, { description: e.target.value })}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      ) : (
                        phase.description || '-'
                      )}
                    </TableCell>
                    <TableCell sx={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>
                      {phase.start_date ? formatDate(phase.start_date) : '-'}
                    </TableCell>
                    <TableCell sx={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>
                      {phase.end_date ? formatDate(phase.end_date) : '-'}
                    </TableCell>
                    <TableCell align="right" sx={{
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'labor_capital_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {editMode ? (
                        <TextField
                          size="small"
                          type="number"
                          value={toNumber(phase.labor_capital_budget)}
                          onChange={(e) => onUpdate(phase.id!, { labor_capital_budget: parseFloat(e.target.value) || 0 })}
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }}
                        />
                      ) : (
                        formatCurrency(toNumber(phase.labor_capital_budget))
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'labor_expense_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {editMode ? (
                        <TextField
                          size="small"
                          type="number"
                          value={toNumber(phase.labor_expense_budget)}
                          onChange={(e) => onUpdate(phase.id!, { labor_expense_budget: parseFloat(e.target.value) || 0 })}
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }}
                        />
                      ) : (
                        formatCurrency(toNumber(phase.labor_expense_budget))
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'nonlabor_capital_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {editMode ? (
                        <TextField
                          size="small"
                          type="number"
                          value={toNumber(phase.nonlabor_capital_budget)}
                          onChange={(e) => onUpdate(phase.id!, { nonlabor_capital_budget: parseFloat(e.target.value) || 0 })}
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }}
                        />
                      ) : (
                        formatCurrency(toNumber(phase.nonlabor_capital_budget))
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'nonlabor_expense_budget')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      {editMode ? (
                        <TextField
                          size="small"
                          type="number"
                          value={toNumber(phase.nonlabor_expense_budget)}
                          onChange={(e) => onUpdate(phase.id!, { nonlabor_expense_budget: parseFloat(e.target.value) || 0 })}
                          inputProps={{ min: 0, step: 0.01 }}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' } }}
                        />
                      ) : (
                        formatCurrency(toNumber(phase.nonlabor_expense_budget))
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ textDecoration: isDeleted ? 'line-through' : 'none' }}>
                      {formatCurrency(
                        toNumber(phase.labor_capital_budget) +
                        toNumber(phase.labor_expense_budget) +
                        toNumber(phase.nonlabor_capital_budget) +
                        toNumber(phase.nonlabor_expense_budget)
                      )}
                    </TableCell>
                    {editMode && (
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => phase.id && onDelete(phase.id)}
                          disabled={activePhaseCount === 1 || isDeleted}
                          aria-label="delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </TableCell>
                    )}
                  </TableRow>
                )
              })
            )}
            {/* Totals Row */}
            {sortedPhases.length > 0 && (
              <TableRow sx={{
                backgroundColor: '#A5C1D8',
                borderTop: '2px solid',
                borderTopColor: 'grey.300',
              }}>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  Total
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell />
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.laborCapital)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.laborExpense)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.nonlaborCapital)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.nonlaborExpense)}
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 'bold' }}>
                  {formatCurrency(totals.total)}
                </TableCell>
                {editMode && <TableCell />}
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default PhaseList
