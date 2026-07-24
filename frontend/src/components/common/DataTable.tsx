import React from 'react'
import { Paper } from '@mui/material'
import {
  DataGrid, DataGridProps, GridToolbarContainer, GridToolbarQuickFilter,
  GridToolbarColumnsButton, GridToolbarFilterButton, GridToolbarDensitySelector, GridToolbarExport,
} from '@mui/x-data-grid'

/**
 * Standard list grid: a DataGrid with one consistent toolbar — a quick-filter
 * search plus the built-in Columns / Filter / Density / Export controls — and the
 * app's themed look. Pages pass `columns`/`rows`; sorting and filtering come free,
 * replacing the hand-rolled per-page search/Select filters.
 */
const Toolbar = () => (
  <GridToolbarContainer sx={{ p: 1, gap: 1, borderBottom: (t) => `1px solid ${t.palette.divider}` }}>
    <GridToolbarQuickFilter variant="outlined" size="small" placeholder="Search…" sx={{ flex: '0 0 260px' }} />
    <span style={{ flex: 1 }} />
    <GridToolbarColumnsButton />
    <GridToolbarFilterButton />
    <GridToolbarDensitySelector />
    <GridToolbarExport />
  </GridToolbarContainer>
)

const DataTable: React.FC<DataGridProps & { height?: number | string }> = ({ height = 'calc(100vh - 220px)', ...props }) => (
  <Paper sx={{ height, width: '100%' }}>
    <DataGrid
      slots={{ toolbar: Toolbar }}
      disableRowSelectionOnClick
      // jsdom has no layout, so virtualization would hide off-screen columns/rows in tests
      disableVirtualization={import.meta.env.MODE === 'test'}
      {...props}
    />
  </Paper>
)

export default DataTable
