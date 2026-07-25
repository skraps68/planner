import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GridColDef } from '@mui/x-data-grid'
import DataTable, { prioritizeGridColumns } from './DataTable'

const columns: GridColDef[] = [{ field: 'name', headerName: 'Name', flex: 1 }]
const rows = [{ id: '1', name: 'North Star' }, { id: '2', name: 'Ledger' }]

describe('DataTable', () => {
  it('renders a grid with the standard quick-filter toolbar', () => {
    render(<DataTable rows={rows} columns={columns} height={320} disableVirtualization />)
    // The shared toolbar provides a quick-filter search regardless of virtualization.
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })

  it('gives ordinary text columns priority over descriptions', () => {
    const prioritized = prioritizeGridColumns(
      [
        { field: 'name', headerName: 'Name', flex: 1, minWidth: 160 },
        { field: 'description', headerName: 'Description', flex: 2, minWidth: 200 },
        { field: 'role', headerName: 'Role', width: 140 },
        { field: 'created_at', headerName: 'Created', width: 150 },
      ],
      [{
        id: '1',
        name: 'North Star',
        description: 'A description that should use whatever space remains',
        role: 'Enterprise Solutions Architect',
        created_at: '2026-01-01',
      }]
    )

    expect(prioritized[1]).toMatchObject({
      field: 'description',
      flex: 1,
      minWidth: 96,
    })
    expect(prioritized[1].width).toBeUndefined()

    expect(prioritized[2].field).toBe('role')
    expect(prioritized[2].width).toBeGreaterThan(140)
    expect(prioritized[2].minWidth).toBe(prioritized[2].width)
    expect(prioritized[2].flex).toBeUndefined()

    expect(prioritized[3]).toMatchObject({
      field: 'created_at',
      width: 150,
    })
  })
})
