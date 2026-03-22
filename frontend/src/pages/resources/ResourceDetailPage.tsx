import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material'
import { Edit as EditIcon } from '@mui/icons-material'
import { resourcesApi } from '../../api/resources'
import { assignmentsApi } from '../../api/assignments'
import { Resource, ResourceAssignment } from '../../types'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ConflictDialog from '../../components/common/ConflictDialog'
import { useConflictHandler } from '../../hooks/useConflictHandler'
import { useQuery } from '@tanstack/react-query'

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

const ResourceAllocationCalendar: React.FC<{ resourceId: string }> = ({ resourceId }) => {
  const { data: assignments = [], isLoading, error } = useQuery({
    queryKey: ['assignments', 'resource', resourceId],
    queryFn: () => assignmentsApi.getByResource(resourceId),
    staleTime: 5 * 60 * 1000,
  })

  const { dates, projects, cellMap } = useMemo(() => {
    const dates = buildDateRange(assignments)

    // Deduplicate projects
    const projectMap = new Map<string, string>()
    assignments.forEach((a) => {
      if (!projectMap.has(a.project_id)) {
        projectMap.set(a.project_id, (a as any).project_name || a.project_id)
      }
    })
    const projects: ProjectRow[] = Array.from(projectMap.entries()).map(([id, name]) => ({
      projectId: id,
      projectName: name,
    }))

    // Build lookup: projectId + dateStr → { capital, expense }
    const cellMap = new Map<string, { capital: number; expense: number }>()
    assignments.forEach((a) => {
      const key = `${a.project_id}::${a.assignment_date}`
      cellMap.set(key, {
        capital: Math.round(Number(a.capital_percentage)),
        expense: Math.round(Number(a.expense_percentage)),
      })
    })

    return { dates, projects, cellMap }
  }, [assignments])

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    )
  }

  if (error) {
    return <Alert severity="error">Failed to load assignments</Alert>
  }

  if (assignments.length === 0) {
    return (
      <Alert severity="info">
        This resource has no assignments yet.
      </Alert>
    )
  }

  const getCell = (projectId: string, date: Date, type: 'capital' | 'expense'): number => {
    const cell = cellMap.get(`${projectId}::${dateKey(date)}`)
    return cell ? cell[type] : 0
  }

  return (
    <Box sx={{ overflowX: 'auto', width: '100%' }}>
      <TableContainer component={Paper}>
        <Table size="small" stickyHeader sx={{ tableLayout: 'auto' }}>
          <TableHead>
            <TableRow>
              {/* Project column header */}
              <TableCell
                sx={{
                  position: 'sticky', left: 0, zIndex: 4,
                  backgroundColor: '#A5C1D8', fontWeight: 'bold', minWidth: 200,
                }}
              >
                Project
              </TableCell>
              {/* Type column header */}
              <TableCell
                sx={{
                  position: 'sticky', left: 200, zIndex: 4,
                  backgroundColor: '#A5C1D8', fontWeight: 'bold', minWidth: 60,
                }}
              >
                Type
              </TableCell>
              {/* Date column headers */}
              {dates.map((date, i) => {
                const isSaturday = date.getUTCDay() === 6
                return (
                  <TableCell
                    key={i}
                    align="center"
                    sx={{
                      backgroundColor: '#A5C1D8', fontWeight: 'bold',
                      minWidth: 50, padding: '6px 4px',
                      ...(isSaturday && { borderRight: '2px solid #bdbdbd' }),
                    }}
                  >
                    {formatColDate(date)}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Total Allocation row */}
            <TableRow>
              <TableCell
                sx={{
                  position: 'sticky', left: 0, zIndex: 2,
                  backgroundColor: '#e8f5e9', fontWeight: 'bold',
                  borderRight: '2px solid', borderColor: 'divider',
                }}
              >
                Total Allocation
              </TableCell>
              <TableCell
                sx={{
                  position: 'sticky', left: 200, zIndex: 2,
                  backgroundColor: '#e8f5e9', fontWeight: 'bold',
                  borderRight: '2px solid', borderColor: 'divider',
                }}
              >
                %
              </TableCell>
              {dates.map((date, i) => {
                const total = projects.reduce((sum, p) => {
                  return sum + getCell(p.projectId, date, 'capital') + getCell(p.projectId, date, 'expense')
                }, 0)
                const isSaturday = date.getUTCDay() === 6
                return (
                  <TableCell
                    key={i}
                    align="center"
                    sx={{
                      backgroundColor: '#e8f5e9', fontWeight: 'bold', padding: '6px 4px',
                      ...(isSaturday && { borderRight: '2px solid #bdbdbd' }),
                    }}
                  >
                    {total > 0 ? Math.round(total) : ''}
                  </TableCell>
                )
              })}
            </TableRow>

            {/* One pair of rows per project */}
            {projects.map((project) => (
              <React.Fragment key={project.projectId}>
                {/* Capital row */}
                <TableRow>
                  <TableCell
                    rowSpan={2}
                    sx={{
                      position: 'sticky', left: 0, zIndex: 2,
                      backgroundColor: 'background.paper', fontWeight: 'medium',
                      borderRight: '2px solid', borderColor: 'divider',
                      borderBottom: '2px solid', verticalAlign: 'middle',
                    }}
                  >
                    <Typography variant="body2" fontWeight="medium">
                      {project.projectName}
                    </Typography>
                  </TableCell>
                  <TableCell
                    sx={{
                      position: 'sticky', left: 200, zIndex: 2,
                      backgroundColor: 'background.paper',
                      borderRight: '2px solid', borderColor: 'divider',
                      minWidth: 60, padding: '6px 8px',
                    }}
                  >
                    <Typography variant="caption" color="primary">Cap %</Typography>
                  </TableCell>
                  {dates.map((date, i) => {
                    const val = getCell(project.projectId, date, 'capital')
                    const isSaturday = date.getUTCDay() === 6
                    return (
                      <TableCell
                        key={i}
                        align="center"
                        sx={{
                          backgroundColor: val > 0 ? 'action.hover' : 'background.paper',
                          padding: '6px 4px',
                          ...(isSaturday && { borderRight: '2px solid #bdbdbd' }),
                        }}
                      >
                        <span style={{ fontSize: '0.875rem' }}>{val > 0 ? val : ''}</span>
                      </TableCell>
                    )
                  })}
                </TableRow>
                {/* Expense row */}
                <TableRow>
                  <TableCell
                    sx={{
                      position: 'sticky', left: 200, zIndex: 2,
                      backgroundColor: 'background.paper',
                      borderRight: '2px solid', borderColor: 'divider',
                      borderBottom: '2px solid', minWidth: 60, padding: '6px 8px',
                    }}
                  >
                    <Typography variant="caption" color="secondary">Exp %</Typography>
                  </TableCell>
                  {dates.map((date, i) => {
                    const val = getCell(project.projectId, date, 'expense')
                    const isSaturday = date.getUTCDay() === 6
                    return (
                      <TableCell
                        key={i}
                        align="center"
                        sx={{
                          backgroundColor: val > 0 ? 'action.hover' : 'background.paper',
                          borderBottom: '2px solid', borderColor: 'divider',
                          padding: '6px 4px',
                          ...(isSaturday && { borderRight: '2px solid #bdbdbd' }),
                        }}
                      >
                        <span style={{ fontSize: '0.875rem' }}>{val > 0 ? val : ''}</span>
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
  )
}

// ─── Resource Detail Page ────────────────────────────────────────────────────

const ResourceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const fromProjectBreadcrumbs = (location.state as any)?.fromProjectBreadcrumbs as Array<{ label: string; path?: string; state?: any }> | undefined
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
      <ResourceAllocationCalendar resourceId={id!} />

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
