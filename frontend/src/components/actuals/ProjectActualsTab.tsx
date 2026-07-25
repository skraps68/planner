import { useState } from 'react'
import { Paper } from '@mui/material'
import { GridColDef, GridPaginationModel, GridValueFormatterParams } from '@mui/x-data-grid'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { actualsApi } from '../../api/actuals'
import { prioritizeGridColumns } from '../common/DataTable'
import PersistentDataGrid from '../common/PersistentDataGrid'

interface ProjectActualsTabProps {
  projectId: string
}

const columns: GridColDef[] = prioritizeGridColumns([
  {
    field: 'actual_date',
    headerName: 'Date',
    width: 120,
    valueFormatter: (params: GridValueFormatterParams) =>
      format(new Date(params.value as string), 'yyyy-MM-dd'),
  },
  { field: 'worker_name', headerName: 'Worker', width: 180 },
  { field: 'external_worker_id', headerName: 'Worker ID', width: 120 },
  {
    field: 'allocation_percentage',
    headerName: 'Allocation %',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `${params.value}%`,
  },
  {
    field: 'actual_cost',
    headerName: 'Cost',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
  },
  {
    field: 'capital_amount',
    headerName: 'Capital',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
  },
  {
    field: 'expense_amount',
    headerName: 'Expense',
    width: 120,
    align: 'right',
    headerAlign: 'right',
    valueFormatter: (params: GridValueFormatterParams) => `$${Number(params.value).toLocaleString()}`,
  },
])

/** Actuals recorded against a single project — the contextual Actuals tab. */
const ProjectActualsTab: React.FC<ProjectActualsTabProps> = ({ projectId }) => {
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: 25,
  })

  const { data, isLoading } = useQuery({
    queryKey: ['actuals', 'project', projectId, paginationModel],
    queryFn: () =>
      actualsApi.listActuals({
        project_id: projectId,
        page: paginationModel.page + 1,
        size: paginationModel.pageSize,
      }),
  })

  return (
    <Paper sx={{ height: 'calc(100vh - 260px)', width: '100%' }}>
      <PersistentDataGrid
        persistenceKey="project-actuals"
        rows={data?.items || []}
        columns={columns}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50, 100]}
        rowCount={data?.total || 0}
        paginationMode="server"
        loading={isLoading}
        disableRowSelectionOnClick
      />
    </Paper>
  )
}

export default ProjectActualsTab
