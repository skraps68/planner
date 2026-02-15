import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Paper,
  TextField,
  InputAdornment,
} from '@mui/material'
import { DataGrid, GridColDef } from '@mui/x-data-grid'
import { Add, Search } from '@mui/icons-material'
import { portfoliosApi } from '../../api/portfolios'
import { Portfolio } from '../../types/portfolio'
import { format } from 'date-fns'
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ScopeFilterBanner from '../../components/common/ScopeFilterBanner'
import PermissionButton from '../../components/common/PermissionButton'
import { usePermissions } from '../../hooks/usePermissions'

const PortfoliosListPage: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { hasPermission } = usePermissions()

  const { data, isLoading } = useQuery({
    queryKey: ['portfolios', page, pageSize, search],
    queryFn: () =>
      portfoliosApi.list({
        skip: page * pageSize,
        limit: pageSize,
        search: search || undefined,
      }),
  })

  // Filter portfolios based on search term (client-side filtering)
  const filteredPortfolios = useMemo(() => {
    if (!data?.items) return []
    if (!search) return data.items
    
    const searchLower = search.toLowerCase()
    return data.items.filter(
      (portfolio) =>
        portfolio.name.toLowerCase().includes(searchLower) ||
        portfolio.owner.toLowerCase().includes(searchLower) ||
        portfolio.description.toLowerCase().includes(searchLower)
    )
  }, [data?.items, search])

  const columns: GridColDef<Portfolio>[] = [
    {
      field: 'name',
      headerName: 'Portfolio Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'owner',
      headerName: 'Owner',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'reporting_start_date',
      headerName: 'Reporting Start',
      width: 150,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
    {
      field: 'reporting_end_date',
      headerName: 'Reporting End',
      width: 150,
      valueFormatter: (params) => format(new Date(params.value), 'MMM dd, yyyy'),
    },
  ]

  const handleRowClick = (params: any) => {
    navigate(`/portfolios/${params.row.id}`)
  }

  return (
    <Box>
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Portfolios' },
        ]}
      />

      <ScopeFilterBanner entityType="portfolios" />

      <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
        <Paper sx={{ p: 2, flex: '0 0 50%' }}>
          <TextField
            fullWidth
            placeholder="Search portfolios..."
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
        <PermissionButton
          permission="create_portfolios"
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/portfolios/new')}
        >
          Create Portfolio
        </PermissionButton>
      </Box>

      <Paper sx={{ height: 600, width: '100%' }}>
        <DataGrid
          rows={filteredPortfolios}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page)
            setPageSize(model.pageSize)
          }}
          rowCount={filteredPortfolios.length}
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

export default PortfoliosListPage
