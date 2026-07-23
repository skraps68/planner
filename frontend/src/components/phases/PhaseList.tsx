import React, { useState } from 'react'
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
  Tooltip,
  Typography,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  InfoOutlined as InfoOutlinedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { ProjectPhase } from '../../types'

interface PhaseListProps {
  phases: Partial<ProjectPhase>[]
  editMode: boolean
  onUpdate: (phaseId: string, updates: Partial<ProjectPhase>) => void
  onDelete: (phaseId: string) => void
  changedFields?: Record<string, Set<string>>
  deletedPhaseIds?: Set<string>
}

type BudgetField =
  | 'labor_capital_budget'
  | 'labor_expense_budget'
  | 'nonlabor_capital_budget'
  | 'nonlabor_expense_budget'

const PhaseList: React.FC<PhaseListProps> = ({ phases, editMode, onUpdate, onDelete, changedFields = {}, deletedPhaseIds = new Set() }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (phaseId: string | undefined) => {
    if (!phaseId) return
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(phaseId)) {
        next.delete(phaseId)
      } else {
        next.add(phaseId)
      }
      return next
    })
  }

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
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
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

  // Style for changed cells. Unchanged cells set NO background so the row's
  // hover highlight shows through as a single uniform layer across every column
  // (a `backgroundColor: 'inherit'` here would double the hover opacity and read
  // as a darker grey than the columns that leave the cell transparent).
  const getChangedCellStyle = (isChanged: boolean) =>
    isChanged
      ? { backgroundColor: 'warning.light', borderLeft: '3px solid', borderLeftColor: 'warning.main' }
      : {}

  // Read and edit rows are kept geometrically identical so clicking Edit does not
  // shift anything on screen: same cell padding in both modes, editable controls
  // and their read-only text counterparts share a fixed content height, the Name
  // cell reserves a fixed leading icon slot, and the Actions column is always
  // present (empty in read mode).
  const ROW_H = 30 // compact row height; edit inputs are trimmed to match (below)
  const cellSx = { py: 0.25 }
  const ACTIONS_W = 56
  const LEADING_W = 34
  const INPUT_PX = 1.75 // 14px — matches the small TextField's horizontal input padding
  // A read-only value matches the edit input's height and horizontal inset so
  // nothing moves (or re-aligns) when toggling between read and edit.
  const readValueSx = { minHeight: ROW_H, display: 'flex', alignItems: 'center' }
  // Trim the small TextField's vertical padding so edit rows match the compact
  // ROW_H (and the read-only text) rather than the taller default height.
  const editFieldSx = {
    '& .MuiInputBase-input': { fontSize: '0.875rem' },
    '& .MuiOutlinedInput-input': { paddingTop: '4px', paddingBottom: '4px' },
  }
  const editNumberFieldSx = {
    '& .MuiInputBase-input': { fontSize: '0.875rem', textAlign: 'right' as const },
    '& .MuiOutlinedInput-input': { paddingTop: '4px', paddingBottom: '4px' },
    // Hide the native number spinner arrows (keep type=number for semantics)
    '& input[type=number]': { MozAppearance: 'textfield' },
    '& input[type=number]::-webkit-outer-spin-button': { WebkitAppearance: 'none', margin: 0 },
    '& input[type=number]::-webkit-inner-spin-button': { WebkitAppearance: 'none', margin: 0 },
  }

  // Name, Start, End, 4 budgets, Total, Actions — Actions is reserved in both modes.
  const columnCount = 9

  const renderBudgetCell = (phase: Partial<ProjectPhase>, field: BudgetField) => {
    const isDeleted = isPhaseDeleted(phase.id)
    return (
      <TableCell align="right" sx={{
        ...cellSx,
        ...getChangedCellStyle(isFieldChanged(phase.id, field)),
        textDecoration: isDeleted ? 'line-through' : 'none',
      }}>
        {editMode ? (
          // Text input with a digit filter (not type="number"): lets the box be
          // empty and strips leading zeros, so a new phase's "0" is never sticky.
          // Display is decoupled from the stored number — 0 shows as an empty box
          // with a "0" placeholder; the value pushed up is always a whole number.
          <TextField
            size="small"
            type="text"
            placeholder="0"
            value={(() => {
              const n = Math.round(toNumber(phase[field]))
              return n === 0 ? '' : String(n)
            })()}
            onChange={(e) => {
              const digits = e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '')
              onUpdate(phase.id!, { [field]: digits === '' ? 0 : parseInt(digits, 10) } as Partial<ProjectPhase>)
            }}
            inputProps={{ inputMode: 'numeric', style: { textAlign: 'right' } }}
            sx={editNumberFieldSx}
          />
        ) : (
          <Box sx={{ ...readValueSx, justifyContent: 'flex-end', pr: INPUT_PX }}>
            {formatCurrency(toNumber(phase[field]))}
          </Box>
        )}
      </TableCell>
    )
  }

  return (
    <Box>
      <TableContainer>
        {/* Fixed table layout: column widths come from the colgroup below and are
            independent of cell content, so read text vs edit inputs (and the
            Actions icon vs empty cell) never resize or realign any column. */}
        <Table size="small" sx={{ tableLayout: 'fixed', minWidth: 1000, '& .MuiTableCell-root': { px: 1.25 } }}>
          <colgroup>
            <col />{/* Name — absorbs remaining width */}
            <col style={{ width: 104 }} />{/* Start Date */}
            <col style={{ width: 104 }} />{/* End Date */}
            <col style={{ width: 120 }} />{/* Labor Capital */}
            <col style={{ width: 120 }} />{/* Labor Expense */}
            <col style={{ width: 120 }} />{/* Non-Labor Capital */}
            <col style={{ width: 120 }} />{/* Non-Labor Expense */}
            <col style={{ width: 128 }} />{/* Total Budget */}
            <col style={{ width: ACTIONS_W }} />{/* Actions */}
          </colgroup>
          <TableHead>
            <TableRow>
              <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Name</TableCell>
              <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Start Date</TableCell>
              <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold' }}>End Date</TableCell>
              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Labor Budget</TableCell>
              <TableCell colSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Non-Labor Budget</TableCell>
              <TableCell rowSpan={2} align="center" sx={{ fontWeight: 'bold' }}>Total Budget</TableCell>
              <TableCell rowSpan={2} sx={{ width: ACTIONS_W }} />
            </TableRow>
            <TableRow>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Capital</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Expense</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Capital</TableCell>
              <TableCell align="center" sx={{ fontWeight: 'bold' }}>Expense</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedPhases.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columnCount} align="center">
                  <Typography variant="body2" color="text.secondary">
                    No phases defined
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedPhases.map((phase) => {
                const rowHasChanges = hasAnyChanges(phase.id)
                const isDeleted = isPhaseDeleted(phase.id)

                const isExpanded = !!phase.id && expandedIds.has(phase.id)

                return (
                  <React.Fragment key={phase.id || 'new'}>
                  <TableRow
                    hover={!isDeleted}
                    sx={{
                      borderLeft: rowHasChanges ? '4px solid' : isDeleted ? '4px solid' : 'none',
                      borderLeftColor: rowHasChanges ? 'warning.main' : isDeleted ? 'error.main' : 'transparent',
                      opacity: isDeleted ? 0.6 : 1,
                      ...(isDeleted ? { backgroundColor: 'error.lighter' } : {}),
                    }}
                  >
                    <TableCell sx={{
                      ...cellSx,
                      ...getChangedCellStyle(isFieldChanged(phase.id, 'name')),
                      textDecoration: isDeleted ? 'line-through' : 'none',
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: ROW_H }}>
                        {/* Fixed-width leading slot: chevron (edit) or description info (read) —
                            reserved in both modes so the name never shifts. */}
                        <Box sx={{ width: LEADING_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {editMode ? (
                            <IconButton
                              size="small"
                              onClick={() => toggleExpanded(phase.id)}
                              aria-label={isExpanded ? 'collapse description' : 'expand description'}
                            >
                              {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          ) : phase.description ? (
                            <Tooltip title={phase.description}>
                              <Box
                                component="span"
                                tabIndex={0}
                                aria-label={`description: ${phase.description}`}
                                sx={{ display: 'inline-flex', alignItems: 'center', cursor: 'help' }}
                              >
                                <InfoOutlinedIcon fontSize="small" color="action" aria-hidden />
                              </Box>
                            </Tooltip>
                          ) : null}
                        </Box>
                        {editMode ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={phase.name || ''}
                            onChange={(e) => onUpdate(phase.id!, { name: e.target.value })}
                            sx={editFieldSx}
                          />
                        ) : (
                          <Box sx={{ flex: 1, minWidth: 0, pl: INPUT_PX, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{phase.name || '-'}</Box>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell
                      data-changed={isFieldChanged(phase.id, 'start_date') ? 'true' : undefined}
                      sx={{
                        ...cellSx,
                        whiteSpace: 'nowrap',
                        ...getChangedCellStyle(isFieldChanged(phase.id, 'start_date')),
                        textDecoration: isDeleted ? 'line-through' : 'none',
                      }}
                    >
                      {phase.start_date ? formatDate(phase.start_date) : '-'}
                    </TableCell>
                    <TableCell
                      data-changed={isFieldChanged(phase.id, 'end_date') ? 'true' : undefined}
                      sx={{
                        ...cellSx,
                        whiteSpace: 'nowrap',
                        ...getChangedCellStyle(isFieldChanged(phase.id, 'end_date')),
                        textDecoration: isDeleted ? 'line-through' : 'none',
                      }}
                    >
                      {phase.end_date ? formatDate(phase.end_date) : '-'}
                    </TableCell>
                    {renderBudgetCell(phase, 'labor_capital_budget')}
                    {renderBudgetCell(phase, 'labor_expense_budget')}
                    {renderBudgetCell(phase, 'nonlabor_capital_budget')}
                    {renderBudgetCell(phase, 'nonlabor_expense_budget')}
                    <TableCell sx={{ ...cellSx, textDecoration: isDeleted ? 'line-through' : 'none' }}>
                      <Box sx={{ ...readValueSx, justifyContent: 'flex-end', pr: INPUT_PX }}>
                        {formatCurrency(
                          toNumber(phase.labor_capital_budget) +
                          toNumber(phase.labor_expense_budget) +
                          toNumber(phase.nonlabor_capital_budget) +
                          toNumber(phase.nonlabor_expense_budget)
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="center" sx={{ ...cellSx, width: ACTIONS_W }}>
                      {editMode && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => phase.id && onDelete(phase.id)}
                          disabled={activePhaseCount === 1 || isDeleted}
                          aria-label="delete"
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                  {editMode && isExpanded && (
                    <TableRow>
                      <TableCell colSpan={columnCount} sx={{
                        backgroundColor: isFieldChanged(phase.id, 'description') ? 'warning.light' : 'grey.50',
                        borderLeft: isFieldChanged(phase.id, 'description') ? '3px solid' : 'none',
                        borderLeftColor: isFieldChanged(phase.id, 'description') ? 'warning.main' : 'transparent',
                        transition: 'all 0.2s ease',
                      }}>
                        <TextField
                          label="Description"
                          size="small"
                          fullWidth
                          multiline
                          value={phase.description || ''}
                          onChange={(e) => onUpdate(phase.id!, { description: e.target.value })}
                          sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem' } }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  </React.Fragment>
                )
              })
            )}
            {/* Totals Row */}
            {sortedPhases.length > 0 && (
              <TableRow sx={{
                backgroundColor: 'grey.100',
                borderTop: '2px solid',
                borderTopColor: 'grey.300',
              }}>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  Total
                </TableCell>
                <TableCell />
                <TableCell />
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pr: INPUT_PX }}>{formatCurrency(totals.laborCapital)}</Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pr: INPUT_PX }}>{formatCurrency(totals.laborExpense)}</Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pr: INPUT_PX }}>{formatCurrency(totals.nonlaborCapital)}</Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pr: INPUT_PX }}>{formatCurrency(totals.nonlaborExpense)}</Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', pr: INPUT_PX }}>{formatCurrency(totals.total)}</Box>
                </TableCell>
                <TableCell sx={{ width: ACTIONS_W }} />
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  )
}

export default PhaseList
