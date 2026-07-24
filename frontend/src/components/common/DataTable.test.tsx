import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { GridColDef } from '@mui/x-data-grid'
import DataTable from './DataTable'

const columns: GridColDef[] = [{ field: 'name', headerName: 'Name', flex: 1 }]
const rows = [{ id: '1', name: 'North Star' }, { id: '2', name: 'Ledger' }]

describe('DataTable', () => {
  it('renders a grid with the standard quick-filter toolbar', () => {
    render(<DataTable rows={rows} columns={columns} height={320} disableVirtualization />)
    // The shared toolbar provides a quick-filter search regardless of virtualization.
    expect(screen.getByPlaceholderText('Search…')).toBeInTheDocument()
  })
})
