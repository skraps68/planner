import React, { useMemo } from 'react'
import { Paper } from '@mui/material'
import {
  DataGrid, DataGridProps, GridToolbarContainer, GridToolbarQuickFilter,
  GridToolbarColumnsButton, GridToolbarFilterButton, GridToolbarDensitySelector, GridToolbarExport,
  GridColDef, GridValidRowModel,
} from '@mui/x-data-grid'

const DESCRIPTION_MIN_WIDTH = 96
const DESCRIPTION_FLEX = 1
const MAX_CONTENT_WIDTH = 480
const CELL_HORIZONTAL_CHROME = 32
const APPROX_CHARACTER_WIDTH = 7.5

const isDescriptionColumn = (column: GridColDef) => {
  const label = `${column.field} ${column.headerName || ''}`.toLowerCase()
  return label.includes('description')
}

const shouldRemainFixed = (column: GridColDef) => {
  const field = column.field.toLowerCase()
  return (
    !column.headerName ||
    field === 'actions' ||
    field === 'status' ||
    field.endsWith('_date') ||
    field.endsWith('_at') ||
    column.type === 'number' ||
    column.type === 'boolean' ||
    column.align === 'right'
  )
}

type DisplayValueParams<R extends GridValidRowModel> = {
  id: R['id']
  field: string
  row: R
  value: unknown
}

const displayedValue = <R extends GridValidRowModel>(
  column: GridColDef<R>,
  row: R
) => {
  const rawValue = row[column.field]
  const params: DisplayValueParams<R> = {
    id: row.id,
    field: column.field,
    row,
    value: rawValue,
  }

  try {
    const value = column.valueGetter
      ? (column.valueGetter as unknown as (params: DisplayValueParams<R>) => unknown)(params)
      : rawValue
    const formatted = column.valueFormatter
      ? (column.valueFormatter as unknown as (params: DisplayValueParams<R>) => unknown)({
          ...params,
          value,
        })
      : value

    if (Array.isArray(formatted)) return formatted.join(', ')
    if (formatted === null || formatted === undefined) return ''
    if (typeof formatted === 'object') return ''
    return String(formatted)
  } catch {
    return rawValue === null || rawValue === undefined ? '' : String(rawValue)
  }
}

const preferredContentWidth = <R extends GridValidRowModel>(
  column: GridColDef<R>,
  rows: readonly R[]
) => {
  const longestText = rows.reduce(
    (longest, row) => {
      const value = displayedValue(column, row)
      return value.length > longest.length ? value : longest
    },
    column.headerName || ''
  )
  const measuredWidth = Math.ceil(
    longestText.length * APPROX_CHARACTER_WIDTH + CELL_HORIZONTAL_CHROME
  )

  return Math.min(
    MAX_CONTENT_WIDTH,
    Math.max(column.minWidth ?? 0, column.width ?? 100, measuredWidth)
  )
}

/**
 * Gives descriptive prose the smallest share of flexible space. Ordinary text
 * columns size to their displayed content first. Description then receives all
 * remaining width and is only truncated when the grid genuinely runs out of
 * room.
 */
export const prioritizeGridColumns = <R extends GridValidRowModel>(
  columns: readonly GridColDef<R>[],
  rows: readonly R[] = []
): GridColDef<R>[] => {
  const hasDescription = columns.some(isDescriptionColumn)

  return columns.map((column) => {
    if (isDescriptionColumn(column)) {
      return {
        ...column,
        width: undefined,
        minWidth: DESCRIPTION_MIN_WIDTH,
        maxWidth: undefined,
        flex: DESCRIPTION_FLEX,
      }
    }

    if (shouldRemainFixed(column)) return column

    if (hasDescription) {
      const preferredWidth = preferredContentWidth(column, rows)
      return {
        ...column,
        width: preferredWidth,
        minWidth: preferredWidth,
        maxWidth: undefined,
        flex: undefined,
      }
    }

    if (column.flex !== undefined) {
      return column
    }

    const baseWidth = column.minWidth ?? column.width ?? 120
    return {
      ...column,
      width: undefined,
      minWidth: baseWidth,
      flex: Math.max(0.75, Math.min(1.5, baseWidth / 160)),
    }
  })
}

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

const DataTable: React.FC<DataGridProps & { height?: number | string }> = ({
  height = 'calc(100vh - 220px)',
  columns,
  rows,
  ...props
}) => {
  const prioritizedColumns = useMemo(
    () => prioritizeGridColumns(columns, rows),
    [columns, rows]
  )

  return (
    <Paper sx={{ height, width: '100%' }}>
      <DataGrid
        slots={{ toolbar: Toolbar }}
        disableRowSelectionOnClick
        // jsdom has no layout, so virtualization would hide off-screen columns/rows in tests
        disableVirtualization={import.meta.env.MODE === 'test'}
        {...props}
        rows={rows}
        columns={prioritizedColumns}
      />
    </Paper>
  )
}

export default DataTable
