import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
  Chip,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { Add, Search } from '@mui/icons-material'
import { programsApi } from '../../api/programs'
import { Program } from '../../types'
import { format } from 'date-fns'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ScopeFilterBanner from '../../components/common/ScopeFilterBanner'
import PermissionButton from '../../components/common/PermissionButton'
import { usePermissions, useScopeFilter } from '../../hooks/usePermissions'

const ProgramsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { hasPermission, canAccessProgram } = usePermissions()
  const { filterPrograms } = useScopeFilter()

  const { data, isLoading } = useQuery({
    queryKey: ['programs', page, pageSize, search],
    queryFn: () =>
      programsApi.list({
        skip: page * pageSize,
        limit: pageSize,
        search: search || undefined,
      }),
  })

  // Filter programs based on user scope
  const filteredPrograms = useMemo(() => {
    if (!data?.items) return []
    return filterPrograms(data.items)
  }, [data?.items, filterPrograms])

  const columns: GridColDef<Program>[] = [
    {
      field: 'name',
      headerName: 'Program Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'business_sponsor',
      headerName: 'Business Sponsor',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'program_manager',
      headerName: 'Program Manager',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'start_date',
      headerName: 'Start Date',
      width: 120,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
    {
      field: 'end_date',
      headerName: 'End Date',
      width: 120,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params: GridRenderCellParams<Program>) => {
        const now = new Date()
        const startDate = new Date(params.row.start_date)
        const endDate = new Date(params.row.end_date)

        let status = 'Active'
        let color: 'success' | 'warning' | 'default' = 'success'

        if (now < startDate) {
          status = 'Planned'
          color = 'warning'
        } else if (now > endDate) {
          status = 'Completed'
          color = 'default'
        }

        return <Chip label={status} color={color} size="small" />
      },
    },
  ]

  const handleRowClick = (params: any) => {
    const programAccess = canAccessProgram(params.row.id)
    if (programAccess.hasPermission) {
      navigate(`/programs/${params.row.id}`)
    }
  }

  return (
    <Box>
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Portfolios', path: '/portfolios' },
          { label: 'Programs' },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Programs</Typography>
        <PermissionButton
          permission="create_programs"
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/programs/new')}
        >
          Create Program
        </PermissionButton>
      </Box>

      <ScopeFilterBanner entityType="programs" />

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search programs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredPrograms}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page)
            setPageSize(model.pageSize)
          }}
          rowCount={filteredPrograms.length}
          paginationMode="client"
          disableRowSelectionOnClick
          onRowClick={handleRowClick}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: '#A5C1D8',
              fontWeight: 'bold',
            },
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 'bold',
            },
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
    </Box>
  )
}

export default ProgramsListPage
