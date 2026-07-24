import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Box, Button, IconButton, Typography } from '@mui/material'
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { GridColDef, GridFilterModel } from '@mui/x-data-grid'
import { workersApi, workerTypesApi } from '../../api/workers'
import { Worker, WorkerType } from '../../types'
import { usePermissions } from '../../hooks/usePermissions'
import HighlightedLabel from '../../components/portfolio/HighlightedLabel'
import PageHeader from '../../components/common/PageHeader'
import DataTable from '../../components/common/DataTable'

const WorkersListPage = () => {
  const navigate = useNavigate()
  const { hasPermission } = usePermissions()
  const canEdit = hasPermission('manage_workers').hasPermission
  const [workers, setWorkers] = useState<Worker[]>([])
  const [workerTypes, setWorkerTypes] = useState<WorkerType[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Controlled filter model so the quick-filter term can drive match highlighting
  const [filterModel, setFilterModel] = useState<GridFilterModel>({ items: [], quickFilterValues: [] })

  // Load the full set once (all pages, since the API caps size at 100); the grid
  // sorts/filters/paginates client-side.
  const fetchWorkers = async () => {
    try {
      setLoading(true)
      setError(null)
      const PAGE_SIZE = 100
      const first = await workersApi.list({ page: 1, size: PAGE_SIZE })
      let all = first.items
      const totalPages = first.pages || 1
      for (let p = 2; p <= totalPages; p++) {
        const next = await workersApi.list({ page: p, size: PAGE_SIZE })
        all = all.concat(next.items)
      }
      setWorkers(all)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to load workers')
    } finally {
      setLoading(false)
    }
  }

  const fetchWorkerTypes = async () => {
    try {
      const data = await workerTypesApi.list()
      setWorkerTypes(data)
    } catch (err: any) {
      console.error('Failed to load worker types:', err)
    }
  }

  useEffect(() => {
    fetchWorkerTypes()
    fetchWorkers()
  }, [])

  const workerTypeMap = useMemo(
    () => new Map(workerTypes.map((type) => [type.id, type.type])),
    [workerTypes]
  )

  const handleDeleteWorker = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this worker?')) return
    try {
      await workersApi.delete(id)
      fetchWorkers()
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete worker')
    }
  }

  // The quick-filter term, used to highlight matches in the Name / External ID cells
  const term = (filterModel.quickFilterValues || []).join(' ')

  const columns: GridColDef<Worker>[] = [
    {
      field: 'name', headerName: 'Name', flex: 1.2, minWidth: 160,
      renderCell: (p) => (
        <Typography variant="body2" fontWeight="medium">
          <HighlightedLabel label={p.value} term={term} />
        </Typography>
      ),
    },
    {
      field: 'external_id', headerName: 'External ID', width: 120,
      renderCell: (p) => <HighlightedLabel label={p.value} term={term} />,
    },
    {
      field: 'worker_type_id', headerName: 'Worker Type', width: 170,
      valueGetter: (p) => workerTypeMap.get(p.value) || p.value,
    },
    {
      field: 'cost_center_code', headerName: 'Cost Center', width: 120,
      valueGetter: (p) => p.value || '—',
    },
    {
      field: 'current_rate', headerName: 'Rate', width: 110, align: 'right', headerAlign: 'right',
      valueFormatter: (p) => p.value
        ? `$${Number(p.value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—',
    },
    {
      field: 'created_at', headerName: 'Created', width: 110,
      valueFormatter: (p) => new Date(p.value as string).toLocaleDateString(),
    },
    {
      field: 'actions', headerName: '', width: 60, sortable: false, filterable: false, align: 'right',
      renderCell: (p) => (
        <IconButton
          size="small" sx={{ p: 0.25 }} aria-label="delete"
          onClick={(e) => { e.stopPropagation(); handleDeleteWorker(p.row.id) }}
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ]

  return (
    <Box>
      <PageHeader
        title="Workers"
        actions={canEdit ? (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/workers/new')}>
            Create Worker
          </Button>
        ) : undefined}
      />

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <DataTable
        rows={workers}
        columns={columns}
        loading={loading}
        getRowId={(r) => r.id}
        filterModel={filterModel}
        onFilterModelChange={setFilterModel}
        onRowClick={(p) => navigate(`/workers/${p.row.id}`)}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
      />
    </Box>
  )
}

export default WorkersListPage
