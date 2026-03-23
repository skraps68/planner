import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { truncateAtLoop } from '../../utils/breadcrumbs'
import {
  Box,
  Button,
  Card,
  CardContent,
  TextField,
  Typography,
  CircularProgress,
  Alert,
  Grid,
  Paper,
  Snackbar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material'
import { resourcesApi } from '../../api/resources'
import { assignmentsApi, BulkAssignmentUpdate } from '../../api/assignments'
import { Resource, ResourceAssignment } from '../../types'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../../contexts/AuthContext'
import { hasPermission } from '../../utils/permissions'
import { validatePercentage } from '../../utils/cellValidation'

// ─── Resource Allocation Calendar ───────────────────────────────────────────

interface ProjectRow {
  projectId: string
  projectName: string
}

/**
 * Generates a sorted, deduplicated list of UTC date strings from assignments
 */
function buildDateRange(assignments: ResourceAssignment[]): Date[] {
  const dateSet = new Set<string>()
  assignments.forEach((a) => dateSet.add(a.assignment_date))
  return Array.from(dateSet)
    .sort()
    .map((d) => {
      const [y, m, day] = d.split('-').map(Number)
      return new Date(Date.UTC(y, m - 1, day))
    })
}

function formatColDate(date: Date): string {
  return `${date.getUTCMonth() + 1}/${date.getUTCDate()}`
}

function dateKey(date: Date): string {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface BreadcrumbItem {
  label: string
  path?: string
  state?: any
}

// ─── Inline editable cell ────────────────────────────────────────────────────

// Shared fixed dimensions for all three cell states — never changes
const CELL_STYLE: React.CSSProperties = {
  display: 'inline-block',
  width: 46,
  boxSizing: 'border-box',
  textAlign: 'center',
  fontSize: '0.875rem',
  padding: '2px 4px',
  border: '1px solid transparent',
  borderRadius: '4px',
}

const AllocationCell: React.FC<{
  value: number
  isEditMode: boolean
  isEdited: boolean
  hasError: boolean
  errorMessage?: string
  onChange: (v: number) => void
}> = ({ value, isEditMode, isEdited, hasError, errorMessage, onChange }) => {
  const [focused, setFocused] = useState(false)
  const [inputValue, setInputValue] = useState(value.toString())
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!focused) setInputValue(value.toString())
  }, [value, focused])

  const commit = () => {
    const num = parseFloat(inputValue)
    if (!isNaN(num)) {
      const r = validatePercentage(num)
      if (r.isValid) onChange(num)
    } else if (inputValue.trim() === '') {
      onChange(0)
    }
  }

  const formatted = value === 0 ? '' : `${Math.round(value)}`
  const bg = isEdited ? 'rgba(255,182,193,0.3)' : 'transparent'
  const borderColor = hasError ? '#d32f2f' : '#e0e0e0'

  if (!isEditMode) {
    return <span style={CELL_STYLE}>{formatted}</span>
  }

  if (focused) {
    return (
      <input
        ref={inputRef}
        value={inputValue}
        autoFocus
        onChange={(e) => setInputValue(e.target.value)}
        onBlur={() => { commit(); setFocused(false) }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === 'Tab') { commit(); setFocused(false) }
          if (e.key === 'Escape') { setInputValue(value.toString()); setFocused(false) }
        }}
        style={{
          ...CELL_STYLE,
          border: `1px solid ${hasError ? '#d32f2f' : '#1976d2'}`,
          outline: 'none',
          backgroundColor: bg,
        }}
      />
    )
  }

  const span = (
    <Box
      component="span"
      tabIndex={0}
      onClick={() => { setInputValue(value === 0 ? '' : String(Math.round(value))); setFocused(true) }}
      onKeyDown={(e) => {
        if (e.key === 'Tab') return
        if (e.key.length === 1 || e.key === 'Backspace') {
          setInputValue(e.key.length === 1 ? e.key : '')
          setFocused(true)
        }
      }}
      sx={{
        ...CELL_STYLE,
        border: `1px solid ${borderColor}`,
        cursor: 'text',
        backgroundColor: bg,
        '&:focus': { outline: '2px solid #1976d2', outlineOffset: '1px' },
      }}
    >
      {formatted}
    </Box>
  )

  return hasError && errorMessage ? <Tooltip title={errorMessage} arrow>{span}</Tooltip> : span
}

// ─── Resource Allocation Calendar ────────────────────────────────────────────

const ResourceAllocationCalendar: React.FC<{
  resourceId: string
  resourceBreadcrumbItems?: BreadcrumbItem[]
}> = ({ resourceId, resourceBreadcrumbItems }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const canEdit = useMemo(() => hasPermission(user, 'manage_resources').hasPermission, [user])

  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['assignments', 'resource', resourceId],
    queryFn: () => assignmentsApi.getByResource(resourceId),
    staleTime: 5 * 60 * 1000,
  })

  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  // editedCells key: "${projectId}:${dateStr}:capital|expense"
  const [editedCells, setEditedCells] = useState<Map<string, number>>(new Map())
  const [validationErrors, setValidationErrors] = useState<Map<string, string>>(new Map())
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const ck = (projectId: string, dateStr: string, type: 'capital' | 'expense') =>
    `${projectId}:${dateStr}:${type}`

  const { dates, projects, cellMap } = useMemo(() => {
    const dates = buildDateRange(assignments)
    const projectMap = new Map<string, string>()
    assignments.forEach((a) => {
      if (!projectMap.has(a.project_id))
        projectMap.set(a.project_id, (a as any).project_name || a.project_id)
    })
    const projects: ProjectRow[] = Array.from(projectMap.entries()).map(([id, name]) => ({
      projectId: id,
      projectName: name,
    }))
    const cellMap = new Map<string, { capital: number; expense: number }>()
    assignments.forEach((a) => {
      cellMap.set(`${a.project_id}::${a.assignment_date}`, {
        capital: Math.round(Number(a.capital_percentage)),
        expense: Math.round(Number(a.expense_percentage)),
      })
    })
    return { dates, projects, cellMap }
  }, [assignments])

  const getStored = (projectId: string, date: Date, type: 'capital' | 'expense'): number => {
    const cell = cellMap.get(`${projectId}::${dateKey(date)}`)
    return cell ? cell[type] : 0
  }

  const getCell = (projectId: string, date: Date, type: 'capital' | 'expense'): number => {
    const key = ck(projectId, dateKey(date), type)
    return editedCells.has(key) ? editedCells.get(key)! : getStored(projectId, date, type)
  }

  const handleCellChange = useCallback((projectId: string, dateStr: string, type: 'capital' | 'expense', value: number) => {
    const key = ck(projectId, dateStr, type)
    setEditedCells((prev) => {
      const next = new Map(prev)
      const cell = cellMap.get(`${projectId}::${dateStr}`)
      const old = cell ? cell[type] : 0
      if (Math.round(value) === old) { next.delete(key) } else { next.set(key, value) }
      return next
    })
    setValidationErrors((prev) => { const next = new Map(prev); next.delete(key); return next })
  }, [cellMap])

  const handleCancel = useCallback(() => {
    setEditedCells(new Map())
    setValidationErrors(new Map())
    setIsEditMode(false)
    setSaveError(null)
  }, [])

  const handleSave = useCallback(async () => {
    if (editedCells.size === 0) { setIsEditMode(false); return }

    const errors = new Map<string, string>()

    // 1. Basic range validation (0–100 per cell)
    for (const [key, value] of editedCells) {
      const r = validatePercentage(value)
      if (!r.isValid) errors.set(key, r.errorMessage || 'Invalid')
    }

    // 2. Per-project: capital + expense ≤ 100 per project-date
    //    Build effective values (stored + edits) for every project × date we might touch
    const effectiveByProjectDate = new Map<string, { capital: number; expense: number }>()
    for (const date of dates) {
      const dStr = dateKey(date)
      for (const project of projects) {
        const capKey = ck(project.projectId, dStr, 'capital')
        const expKey = ck(project.projectId, dStr, 'expense')
        const stored = cellMap.get(`${project.projectId}::${dStr}`)
        const cap = editedCells.has(capKey) ? editedCells.get(capKey)! : (stored?.capital ?? 0)
        const exp = editedCells.has(expKey) ? editedCells.get(expKey)! : (stored?.expense ?? 0)
        effectiveByProjectDate.set(`${project.projectId}:${dStr}`, { capital: cap, expense: exp })
        if (cap + exp > 100) {
          const msg = `Capital + expense cannot exceed 100% for "${project.projectName}" on this date (would be ${Math.round(cap + exp)}%)`
          if (editedCells.has(capKey)) errors.set(capKey, msg)
          if (editedCells.has(expKey)) errors.set(expKey, msg)
        }
      }
    }

    // 3. Cross-project: total across all projects ≤ 100 per date
    for (const date of dates) {
      const dStr = dateKey(date)
      const total = projects.reduce((sum, p) => {
        const v = effectiveByProjectDate.get(`${p.projectId}:${dStr}`) ?? { capital: 0, expense: 0 }
        return sum + v.capital + v.expense
      }, 0)
      if (total > 100) {
        const msg = `Total allocation across all projects exceeds 100% on this date (would be ${Math.round(total)}%)`
        for (const project of projects) {
          const capKey = ck(project.projectId, dStr, 'capital')
          const expKey = ck(project.projectId, dStr, 'expense')
          if (editedCells.has(capKey) && !errors.has(capKey)) errors.set(capKey, msg)
          if (editedCells.has(expKey) && !errors.has(expKey)) errors.set(expKey, msg)
        }
      }
    }

    if (errors.size > 0) { setValidationErrors(errors); return }

    setIsSaving(true)
    try {
      // Group edits by project:date
      const grouped = new Map<string, { capital?: number; expense?: number }>()
      for (const [key, value] of editedCells) {
        const [projectId, dateStr, type] = key.split(':')
        const gk = `${projectId}:${dateStr}`
        if (!grouped.has(gk)) grouped.set(gk, {})
        grouped.get(gk)![type as 'capital' | 'expense'] = value
      }

      const bulkUpdates: BulkAssignmentUpdate[] = []
      for (const [gk, edits] of grouped) {
        const [projectId, dateStr] = gk.split(':')
        const existing = assignments.find(
          (a) => a.project_id === projectId && a.assignment_date === dateStr
        )
        if (!existing) continue
        const cell = cellMap.get(`${projectId}::${dateStr}`)
        bulkUpdates.push({
          id: existing.id,
          capital_percentage: Math.round(edits.capital ?? cell?.capital ?? 0),
          expense_percentage: Math.round(edits.expense ?? cell?.expense ?? 0),
          version: existing.version,
        })
      }

      if (bulkUpdates.length > 0) await assignmentsApi.bulkUpdate(bulkUpdates)

      await queryClient.invalidateQueries({ queryKey: ['assignments', 'resource', resourceId] })
      setEditedCells(new Map())
      setValidationErrors(new Map())
      setIsEditMode(false)
      setSaveSuccess(true)
    } catch (err: any) {
      setSaveError(err.response?.data?.detail || 'Failed to save assignments')
    } finally {
      setIsSaving(false)
    }
  }, [editedCells, assignments, cellMap, dates, projects, queryClient, resourceId])

  if (isLoading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>
  if (error) return <Alert severity="error">Failed to load assignments</Alert>
  if (assignments.length === 0) return <Alert severity="info">This resource has no assignments yet.</Alert>

  const hasEdits = editedCells.size > 0

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ overflowX: 'auto', width: '100%' }}>
        <TableContainer>
          <Table size="small" stickyHeader sx={{ tableLayout: 'auto' }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 4, backgroundColor: '#A5C1D8', fontWeight: 'bold', minWidth: 200 }}>
                  Project
                </TableCell>
                <TableCell sx={{ position: 'sticky', left: 200, zIndex: 4, backgroundColor: '#A5C1D8', fontWeight: 'bold', minWidth: 60 }}>
                  Type
                </TableCell>
                {dates.map((date, i) => (
                  <TableCell key={i} align="center" sx={{
                    backgroundColor: '#A5C1D8', fontWeight: 'bold', minWidth: 50, padding: '6px 4px',
                    ...(date.getUTCDay() === 6 && { borderRight: '2px solid #bdbdbd' }),
                  }}>
                    {formatColDate(date)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {/* Total Allocation row */}
              <TableRow>
                <TableCell sx={{ position: 'sticky', left: 0, zIndex: 2, backgroundColor: '#e8f5e9', fontWeight: 'bold', borderRight: '2px solid', borderColor: 'divider' }}>
                  Total Allocation
                </TableCell>
                <TableCell sx={{ position: 'sticky', left: 200, zIndex: 2, backgroundColor: '#e8f5e9', fontWeight: 'bold', borderRight: '2px solid', borderColor: 'divider' }}>
                  %
                </TableCell>
                {dates.map((date, i) => {
                  const total = projects.reduce(
                    (sum, p) => sum + getCell(p.projectId, date, 'capital') + getCell(p.projectId, date, 'expense'),
                    0
                  )
                  const rounded = Math.round(total)
                  const color = rounded >= 100 ? '#d32f2f' : rounded > 0 ? '#2e7d32' : undefined
                  return (
                    <TableCell key={i} align="center" sx={{
                      backgroundColor: '#e8f5e9', fontWeight: 'bold', padding: '6px 4px',
                      ...(date.getUTCDay() === 6 && { borderRight: '2px solid #bdbdbd' }),
                    }}>
                      {rounded > 0 && <span style={{ fontSize: '0.875rem', color }}>{rounded}</span>}
                    </TableCell>
                  )
                })}
              </TableRow>

              {/* One pair of rows per project */}
              {projects.map((project) => (
                <React.Fragment key={project.projectId}>
                  <TableRow>
                    <TableCell rowSpan={2} sx={{
                      position: 'sticky', left: 0, zIndex: 2,
                      backgroundColor: 'background.paper', fontWeight: 'medium',
                      borderRight: '2px solid', borderColor: 'divider',
                      borderBottom: '2px solid', verticalAlign: 'middle',
                    }}>
                      <Typography variant="body2" fontWeight="medium" component="a"
                        onClick={() => navigate(`/projects/${project.projectId}?tab=1`, {
                          state: resourceBreadcrumbItems ? { fromResourceBreadcrumbs: resourceBreadcrumbItems } : undefined,
                        })}
                        sx={{ color: 'primary.main', textDecoration: 'underline', cursor: 'pointer' }}
                      >
                        {project.projectName}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ position: 'sticky', left: 200, zIndex: 2, backgroundColor: 'background.paper', borderRight: '2px solid', borderColor: 'divider', minWidth: 60, padding: '6px 8px' }}>
                      <Typography variant="caption" color="primary">Cap %</Typography>
                    </TableCell>
                    {dates.map((date, i) => {
                      const dStr = dateKey(date)
                      const val = getCell(project.projectId, date, 'capital')
                      const key = ck(project.projectId, dStr, 'capital')
                      return (
                        <TableCell key={i} align="center" sx={{
                          backgroundColor: val > 0 ? 'action.hover' : 'background.paper', padding: '6px 4px',
                          ...(date.getUTCDay() === 6 && { borderRight: '2px solid #bdbdbd' }),
                        }}>
                          <AllocationCell
                            value={val}
                            isEditMode={isEditMode}
                            isEdited={editedCells.has(key)}
                            hasError={validationErrors.has(key)}
                            errorMessage={validationErrors.get(key)}
                            onChange={(v) => handleCellChange(project.projectId, dStr, 'capital', v)}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                  <TableRow>
                    <TableCell sx={{ position: 'sticky', left: 200, zIndex: 2, backgroundColor: 'background.paper', borderRight: '2px solid', borderColor: 'divider', borderBottom: '2px solid', minWidth: 60, padding: '6px 8px' }}>
                      <Typography variant="caption" color="secondary">Exp %</Typography>
                    </TableCell>
                    {dates.map((date, i) => {
                      const dStr = dateKey(date)
                      const val = getCell(project.projectId, date, 'expense')
                      const key = ck(project.projectId, dStr, 'expense')
                      return (
                        <TableCell key={i} align="center" sx={{
                          backgroundColor: val > 0 ? 'action.hover' : 'background.paper',
                          borderBottom: '2px solid', borderColor: 'divider', padding: '6px 4px',
                          ...(date.getUTCDay() === 6 && { borderRight: '2px solid #bdbdbd' }),
                        }}>
                          <AllocationCell
                            value={val}
                            isEditMode={isEditMode}
                            isEdited={editedCells.has(key)}
                            hasError={validationErrors.has(key)}
                            errorMessage={validationErrors.get(key)}
                            onChange={(v) => handleCellChange(project.projectId, dStr, 'expense', v)}
                          />
                        </TableCell>
                      )
                    })}
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Controls */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
        {!isEditMode ? (
          canEdit && (
            <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setIsEditMode(true)}>
              Edit
            </Button>
          )
        ) : (
          <>
            <Button variant="outlined" size="small" startIcon={<CancelIcon />} onClick={handleCancel} disabled={isSaving}>
              Cancel
            </Button>
            <Button variant="contained" size="small" startIcon={isSaving ? <CircularProgress size={14} /> : <SaveIcon />}
              onClick={handleSave} disabled={isSaving || !hasEdits}>
              Save Changes
            </Button>
          </>
        )}
      </Box>

      {saveError && <Alert severity="error" sx={{ mt: 1 }} onClose={() => setSaveError(null)}>{saveError}</Alert>}
      <Snackbar open={saveSuccess} autoHideDuration={3000} onClose={() => setSaveSuccess(false)}
        message="Assignments saved successfully" anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} />
    </Paper>
  )
}

// ─── Resource Detail Page ────────────────────────────────────────────────────

const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const rawFromProjectBreadcrumbs = (location.state as any)?.fromProjectBreadcrumbs as Array<{ label: string; path?: string; state?: any }> | undefined
  const fromProjectBreadcrumbs = rawFromProjectBreadcrumbs
    ? truncateAtLoop(rawFromProjectBreadcrumbs, location.pathname)
    : undefined
  const { conflictState, handleError, clearConflict } = useConflictHandler()

  const isNew = id === 'new'

  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(isNew)

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    resource_type: 'LABOR' as 'LABOR' | 'NON_LABOR',
    version: 1,
  })

  const fetchResource = useCallback(async () => {
    if (!id || isNew) return
    try {
      setLoading(true)
      setError(null)
      const data = await resourcesApi.get(id)
      setResource(data)
      setFormData({
        name: data.name,
        description: data.description || '',
        resource_type: data.resource_type,
        version: data.version,
      })
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load resource')
    } finally {
      setLoading(false)
    }
  }, [id, isNew])

  useEffect(() => {
    fetchResource()
  }, [fetchResource])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      if (isNew) {
        await resourcesApi.create({
          name: formData.name,
          resource_type: formData.resource_type,
          description: formData.description || undefined,
        })
        navigate('/resources')
      } else {
        const updated = await resourcesApi.update(id!, {
          name: formData.name,
          description: formData.description || undefined,
          version: formData.version,
        })
        setResource(updated)
        setFormData({ ...formData, version: updated.version })
        setIsEditing(false)
      }
    } catch (err: any) {
      const isConflict = handleError(err, formData)
      if (!isConflict) setError(err.response?.data?.detail || 'Failed to save resource')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelEdit = () => {
    if (resource) {
      setFormData({
        name: resource.name,
        description: resource.description || '',
        resource_type: resource.resource_type,
        version: resource.version,
      })
    }
    setIsEditing(false)
    setError(null)
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  // ── New resource form ──
  if (isNew) {
    return (
      <Box>
        <ScopeBreadcrumbs
          items={[
            { label: 'Home', path: '/dashboard' },
            { label: 'Resources', path: '/resources' },
            { label: 'New Resource' },
          ]}
        />
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Card>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth label="Name" required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth label="Type" select SelectProps={{ native: true }}
                  value={formData.resource_type}
                  onChange={(e) => setFormData({ ...formData, resource_type: e.target.value as 'LABOR' | 'NON_LABOR' })}
                >
                  <option value="LABOR">Labor</option>
                  <option value="NON_LABOR">Non-Labor</option>
                </TextField>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth label="Description" multiline rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </Grid>
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button variant="contained" onClick={handleSave} disabled={saving}>
                    {saving ? 'Creating...' : 'Create'}
                  </Button>
                  <Button variant="outlined" onClick={() => navigate('/resources')}>Cancel</Button>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      </Box>
    )
  }

  // ── Existing resource detail ──
  return (
    <Box>
      <ScopeBreadcrumbs
        items={
          fromProjectBreadcrumbs
            ? [...fromProjectBreadcrumbs, { label: resource?.name || '…' }]
            : [
                { label: 'Home', path: '/dashboard' },
                { label: 'Resources', path: '/resources' },
                { label: resource?.name || '…' },
              ]
        }
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Details panel */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth label="Name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                disabled={!isEditing}
                InputProps={!isEditing ? { readOnly: true } : undefined}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                fullWidth label="Type"
                value={formData.resource_type === 'LABOR' ? 'Labor' : 'Non-Labor'}
                disabled
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth label="Description" multiline rows={3}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!isEditing}
                InputProps={!isEditing ? { readOnly: true } : undefined}
              />
            </Grid>
          </Grid>

          {/* Edit / Save buttons aligned bottom-right of panel */}
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 2 }}>
            {isEditing ? (
              <>
                <Button variant="outlined" onClick={handleCancelEdit} disabled={saving}>
                  Cancel
                </Button>
                <Button variant="contained" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </Button>
              </>
            ) : (
              <Button
                variant="outlined"
                startIcon={<EditIcon />}
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      {/* Allocation calendar */}
      <Typography variant="h6" sx={{ mb: 1 }}>Assignments</Typography>
      <ResourceAllocationCalendar
        resourceId={id!}
        resourceBreadcrumbItems={
          fromProjectBreadcrumbs
            ? [...fromProjectBreadcrumbs, { label: resource?.name || '…', path: `/resources/${id}`, state: { fromProjectBreadcrumbs } }]
            : [
                { label: 'Home', path: '/dashboard' },
                { label: 'Resources', path: '/resources' },
                { label: resource?.name || '…', path: `/resources/${id}` },
              ]
        }
      />

      {/* Conflict Dialog */}
      <ConflictDialog
        open={conflictState.isConflict}
        entityType={conflictState.entityType}
        attemptedChanges={conflictState.attemptedChanges}
        currentState={conflictState.currentState}
        onRefreshAndRetry={() => {
          fetchResource()
          if (conflictState.attemptedChanges && conflictState.currentState) {
            setFormData({
              name: conflictState.attemptedChanges.name || formData.name,
              description: conflictState.attemptedChanges.description || formData.description,
              resource_type: formData.resource_type,
              version: conflictState.currentState.version,
            })
          }
          clearConflict()
        }}
        onCancel={clearConflict}
      />
    </Box>
  )
}

export default ResourceDetailPage
