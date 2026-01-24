import React, { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Box,
  Typography,
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
import ScopeBreadcrumbs from '../../components/common/ScopeBreadcrumbs'
import ScopeFilterBanner from '../../components/common/ScopeFilterBanner'
import PermissionButton from '../../components/common/PermissionButton'
import { usePermissions, useScopeFilter } from '../../hooks/usePermissions'

const ProjectsListPage: React.FC = () => {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(25)

  const { hasPermission, canAccessProject } = usePermissions()
  const { filterProjects } = useScopeFilter()

  const { data, isLoading } = useQuery({
    queryKey: ['projects', page, pageSize, search],
    queryFn: () =>
      projectsApi.list({
        skip: page * pageSize,
        limit: pageSize,
        search: search || undefined,
      }),
  })

  // Filter projects based on user scope
  const filteredProjects = useMemo(() => {
    if (!data?.items) return []
    return filterProjects(data.items)
  }, [data?.items, filterProjects])

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
      renderCell: (params: GridRenderCellParams<Project>) => {
        const projectAccess = canAccessProject(params.row.id, params.row.program_id)
        const canEdit = hasPermission('edit_projects')

        return (
          <Box>
            <IconButton
              size="small"
              onClick={() => navigate(`/projects/${params.row.id}`)}
              disabled={!projectAccess.hasPermission}
              title={projectAccess.hasPermission ? 'View' : projectAccess.reason}
            >
              <Visibility fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => navigate(`/projects/${params.row.id}/edit`)}
              disabled={!projectAccess.hasPermission || !canEdit.hasPermission}
              title={
                !projectAccess.hasPermission
                  ? projectAccess.reason
                  : !canEdit.hasPermission
                  ? canEdit.reason
                  : 'Edit'
              }
            >
              <Edit fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              disabled={!projectAccess.hasPermission || !hasPermission('delete_projects').hasPermission}
              title={
                !projectAccess.hasPermission
                  ? projectAccess.reason
                  : 'Delete'
              }
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
        )
      },
    },
  ]

  return (
    <Box>
      <ScopeBreadcrumbs
        items={[
          { label: 'Home', path: '/dashboard' },
          { label: 'Projects' },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4">Projects</Typography>
        <PermissionButton
          permission="create_projects"
          variant="contained"
          startIcon={<Add />}
          onClick={() => navigate('/projects/new')}
        >
          Create Project
        </PermissionButton>
      </Box>

      <ScopeFilterBanner entityType="projects" />

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
          rows={filteredProjects}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50, 100]}
          paginationModel={{ page, pageSize }}
          onPaginationModelChange={(model) => {
            setPage(model.page)
            setPageSize(model.pageSize)
          }}
          rowCount={filteredProjects.length}
          paginationMode="client"
          disableRowSelectionOnClick
        />
      </Paper>
    </Box>
  )
}

export default ProjectsListPage
