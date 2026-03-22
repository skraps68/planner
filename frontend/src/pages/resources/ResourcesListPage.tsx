import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Paper,
  Tab,
  Tabs,
  TextField,
  InputAdornment,
  Alert,
} from '@mui/material'
import { Add, Search } from '@mui/icons-material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { resourcesApi } from '../../api/resources'
import { Resource } from '../../types'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import PermissionButton from '../../components/common/PermissionButton'

interface TabPanelProps {
  children?: React.ReactNode
  value: number
  index: number
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
  </div>
)

const ResourceTab: React.FC<{
  resourceType: 'LABOR' | 'NON_LABOR'
  onRowClick: (id: string) => void
}> = ({ resourceType, onRowClick }) => {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { data, isLoading, error } = useQuery({
    queryKey: ['resources', resourceType, page, pageSize, search],
    queryFn: () =>
      resourcesApi.list({
        page: page + 1,
        size: pageSize,
        resource_type: resourceType.toLowerCase() as any,
        search: search || undefined,
      }),
  })

  const rows = useMemo(() => {
    if (!data?.items) return []
    if (!search) return data.items
    const lower = search.toLowerCase()
    return data.items.filter(
      (r) =>
        r.name.toLowerCase().includes(lower) ||
        (r.description || '').toLowerCase().includes(lower)
    )
  }, [data?.items, search])

  const columns: GridColDef<Resource>[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 200 },
    { field: 'description', headerName: 'Description', flex: 2, minWidth: 200,
      valueGetter: (params) => params.value || '—' },
    { field: 'created_at', headerName: 'Created', width: 150,
      valueFormatter: (params) => new Date(params.value).toLocaleDateString() },
  ]

  if (error) {
    return <Alert severity="error">{(error as any).response?.data?.detail || 'Failed to load resources'}</Alert>
  }

  return (
    <>
      <Paper sx={{ p: 2, mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          placeholder={`Search ${resourceType === 'LABOR' ? 'labor' : 'non-labor'} resources...`}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0) }}
          size="small"
          sx={{ flex: '0 0 40%' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><Search /></InputAdornment>
            ),
          }}
        />
      </Paper>

      <Paper sx={{ height: 520, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => { setPage(model.page); setPageSize(model.pageSize) }}
          rowCount={data?.total ?? rows.length}
          paginationMode="server"
          disableRowSelectionOnClick
          onRowClick={(params) => onRowClick(params.row.id)}
          sx={{
            '& .MuiDataGrid-columnHeaders': { backgroundColor: '#A5C1D8', fontWeight: 'bold' },
            '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 'bold' },
            '& .MuiDataGrid-row': {
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                backgroundColor: 'action.hover',
                border: '2px solid',
                borderColor: 'primary.main',
              },
            },
          }}
        />
      </Paper>
    </>
  )
}

const ResourcesListPage: React.FC = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)

  const handleRowClick = (id: string) => navigate(`/resources/${id}`)

  return (
    <Box>
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Resources' },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <PermissionButton
          permission="manage_resources"
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/resources/new')}
        >
          Create Resource
        </PermissionButton>
      </Box>

      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Labor" />
          <Tab label="Non-Labor" />
        </Tabs>
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
