import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { useGridApiRef } from '@mui/x-data-grid'
import DataTable from './DataTable'

const updateSettings = vi.fn()

vi.mock('../../contexts/UserSettingsContext', () => ({
  useUserSettings: () => ({
    settings: {
      grids: {
        'profile-grid': {
          density: 'comfortable',
          columnOrder: ['role', 'name'],
          columnVisibility: { role: false },
          columnWidths: { name: 275 },
        },
      },
    },
    isServerBacked: true,
    resetCounter: 0,
    updateSettings,
  }),
}))

describe('PersistentDataGrid user settings', () => {
  beforeEach(() => updateSettings.mockClear())

  it('restores a grid layout from the user profile document', async () => {
    type ApiRef = ReturnType<typeof useGridApiRef>
    let apiRef: ApiRef | null = null
    const Harness = () => {
      const ref = useGridApiRef()
      useEffect(() => {
        apiRef = ref
      }, [ref])
      return (
        <DataTable
          persistenceKey="profile-grid"
          apiRef={ref}
          rows={[{ id: '1', name: 'North Star', role: 'Architect' }]}
          columns={[
            { field: 'name', headerName: 'Name', width: 160 },
            { field: 'role', headerName: 'Role', width: 140 },
          ]}
          height={320}
          disableVirtualization
        />
      )
    }

    render(<Harness />)

    await waitFor(() => {
      expect(apiRef?.current.state.density.value).toBe('comfortable')
      expect(apiRef?.current.state.columns.orderedFields).toEqual(['role', 'name'])
      expect(apiRef?.current.state.columns.columnVisibilityModel.role).toBe(false)
      expect(apiRef?.current.getColumn('name')?.width).toBe(275)
    })
  })
})
