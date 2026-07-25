import { useEffect } from 'react'
import { beforeEach, describe, it, expect } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { GridColDef, useGridApiRef } from '@mui/x-data-grid'
import DataTable, { prioritizeGridColumns } from './DataTable'

const columns: GridColDef[] = [{ field: 'name', headerName: 'Name', flex: 1 }]
const rows = [{ id: '1', name: 'North Star' }, { id: '2', name: 'Ledger' }]

describe('DataTable', () => {
  beforeEach(() => sessionStorage.clear())

  it('renders a grid with the standard quick-filter toolbar', () => {
    render(<DataTable persistenceKey="test-grid" rows={rows} columns={columns} height={320} disableVirtualization />)
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

  it('restores density and column configuration after remounting', async () => {
    type ApiRef = ReturnType<typeof useGridApiRef>
    let firstApiRef: ApiRef | null = null
    let restoredApiRef: ApiRef | null = null

    const Harness = ({ onApi }: { onApi: (apiRef: ApiRef) => void }) => {
      const apiRef = useGridApiRef()
      useEffect(() => onApi(apiRef), [apiRef, onApi])
      return (
        <DataTable
          persistenceKey="remount-grid"
          apiRef={apiRef}
          rows={[{ id: '1', name: 'North Star', role: 'Architect', description: 'Planning' }]}
          columns={[
            { field: 'name', headerName: 'Name', width: 160 },
            { field: 'role', headerName: 'Role', width: 140 },
            { field: 'description', headerName: 'Description', flex: 1 },
          ]}
          height={320}
          disableVirtualization
        />
      )
    }

    const first = render(<Harness onApi={(apiRef) => { firstApiRef = apiRef }} />)
    await waitFor(() => expect(firstApiRef?.current.getAllColumns()).toHaveLength(3))

    act(() => {
      firstApiRef!.current.setDensity('comfortable')
      firstApiRef!.current.setColumnVisibility('role', false)
      firstApiRef!.current.setColumnWidth('name', 260)
      firstApiRef!.current.restoreState({
        columns: { orderedFields: ['role', 'name', 'description'] },
      })
    })
    first.unmount()

    render(<Harness onApi={(apiRef) => { restoredApiRef = apiRef }} />)

    await waitFor(() => {
      expect(restoredApiRef?.current.state.density.value).toBe('comfortable')
      expect(restoredApiRef?.current.state.columns.columnVisibilityModel.role).toBe(false)
      expect(restoredApiRef?.current.state.columns.orderedFields).toEqual([
        'role',
        'name',
        'description',
      ])
      expect(restoredApiRef?.current.getColumn('name')?.width).toBe(260)
    })
  })
})
