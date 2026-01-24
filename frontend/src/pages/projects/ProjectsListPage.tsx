import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
  Button,
  Paper,
  TextField,
  InputAdornment,
  IconButton,
  Chip,
} from '@mui/material'
import { DataGrid, GridColDef, GridRenderCellParams } from '@mui/x-data-grid'
import { Add, Search, Edit, Delete, Visibility } from '@mui/icons-material'
import { projectsApi } from '../../api/projects'
import { Project } from '../../types'
import { format } from 'date-fns'

const ProjectsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, pageSize, search],
    queryFn: () =>
      projectsApi.list({
        skip: page * pageSize,
        limit: pageSize,
        search: search || undefined,
      }),
  })

  const columns: GridColDef<Project>[] = [
    {
      field: 'name',
      headerName: 'Project Name',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'project_manager',
      headerName: 'Project Manager',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'cost_center_code',
      headerName: 'Cost Center',
      width: 120,
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
      renderCell: (params: GridRenderCellParams<Project>) => {
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
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      renderCell: (params: GridRenderCellParams<Project>) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => navigate(`/projects/${params.row.id}`)}
            title="View"
          >
            <Visibility fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => navigate(`/projects/${params.row.id}/edit`)}
            title="Edit"
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" title="Delete">
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ]

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Projects</Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/projects/new')}
        >
          Create Project
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search projects..."
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
          rows={data?.items || []}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page)
            setPageSize(model.pageSize)
          }}
          rowCount={data?.total || 0}
          paginationMode="server"
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  )
}

export default ProjectsListPage
