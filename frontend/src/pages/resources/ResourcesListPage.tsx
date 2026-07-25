import React, { useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Tab,
  Tabs,
  Alert,
} from '@mui/material'
import { Add } from '@mui/icons-material'
import { GridColDef } from '@mui/x-data-grid'
import { resourcesApi } from '../../api/resources'
import { Resource } from '../../types'
import PermissionButton from '../../components/common/PermissionButton'
import PageHeader from '../../components/common/PageHeader'
import DataTable from '../../components/common/DataTable'

interface TabPanelProps {
  children?: React.ReactNode
  value: number
  index: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 1.5 }}>{children}</Box>}
  </div>
)

const ResourceTab: React.FC<{
  resourceType: 'LABOR' | 'NON_LABOR'
  onRowClick: (id: string) => void
}> = ({ resourceType, onRowClick }) => {
  // Load every page up front (the API caps size at 100); the grid then sorts,
  // filters, and paginates client-side so the toolbar search covers all rows.
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['resources', 'all', resourceType],
    queryFn: async () => {
      const PAGE_SIZE = 100
      const first = await resourcesApi.list({ page: 1, size: PAGE_SIZE, resource_type: resourceType })
      let all = first.items
      for (let p = 2; p <= (first.pages || 1); p++) {
        const next = await resourcesApi.list({ page: p, size: PAGE_SIZE, resource_type: resourceType })
        all = all.concat(next.items)
      }
      return all
    },
  })

  const columns: GridColDef<Resource>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 200,
      valueGetter: (params) => params.value || '—' },
    { field: 'resource_role_name', headerName: 'Role', width: 140,
      valueGetter: (params) => params.row.resource_role_name ?? '—' },
    { field: 'worker_type_name', headerName: 'Type', width: 140,
      valueGetter: (params) => params.row.worker_type_name ?? '—' },
    { field: 'current_rate', headerName: 'Rate', width: 120,
      valueGetter: (params) => params.row.current_rate
        ? `$${Number(params.row.current_rate).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : '—' },
    { field: 'created_at', headerName: 'Created', width: 150,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString() },
  ]

  if (error) {
    return <Alert severity="error">{(error as any).response?.data?.detail || 'Failed to load resources'}</Alert>
  }

  return (
    <DataTable
      persistenceKey={`resources-${resourceType.toLowerCase()}`}
      rows={rows}
      columns={columns}
      loading={isLoading}
      height="calc(100vh - 240px)"
      onRowClick={(params) => onRowClick(params.row.id)}
      sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
    />
  )
}

const ResourcesListPage: React.FC = () => {
  const navigate = useNavigate()
  // The URL is the single source of truth for the active tab (?tab=0|1), so
  // returning from a resource detail page via the browser back button restores
  // whichever tab (Labor/Non-Labor) the user left from.
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = useMemo(() => {
    const parsed = parseInt(searchParams.get('tab') ?? '', 10)
    return Math.min(Math.max(Number.isNaN(parsed) ? 0 : parsed, 0), 1)
  }, [searchParams])

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    const next = new URLSearchParams(searchParams)
    if (newValue === 0) next.delete('tab')
    else next.set('tab', String(newValue))
    // replace (not push) so switching tabs doesn't stack history entries
    setSearchParams(next, { replace: true })
  }

  const handleRowClick = (id: string) => navigate(`/resources/${id}`)

  return (
    <Box>
      <PageHeader title="Resources" />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={handleTabChange}>
          <Tab label="Labor" />
          <Tab label="Non-Labor" />
        </Tabs>
        <PermissionButton
          permission="manage_resources"
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/resources/new')}
        >
          Create Resource
        </PermissionButton>
      </Box>

      <TabPanel value={tab} index={0}>
        <ResourceTab resourceType="LABOR" onRowClick={handleRowClick} />
      </TabPanel>
      <TabPanel value={tab} index={1}>
        <ResourceTab resourceType="NON_LABOR" onRowClick={handleRowClick} />
      </TabPanel>
    </Box>
  )
}

export default ResourcesListPage
