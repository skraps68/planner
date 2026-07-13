import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import ProjectActualsTab from './ProjectActualsTab'
import { actualsApi } from '../../api/actuals'

vi.mock('../../api/actuals', () => ({ actualsApi: { listActuals: vi.fn() } }))

const makeStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'admin', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('ProjectActualsTab', () => {
  beforeEach(() => {
    vi.mocked(actualsApi.listActuals).mockResolvedValue({
      items: [
        {
          id: 'a1',
          project_id: 'pj1',
          project_name: 'CRM',
          external_worker_id: 'EMP001',
          worker_name: 'John Smith',
          actual_date: '2026-01-15',
          allocation_percentage: 50,
          actual_cost: 625,
          capital_amount: 375,
          expense_amount: 250,
        },
      ],
      total: 1,
      page: 1,
      size: 25,
      pages: 1,
    } as any)
  })

  it('fetches actuals scoped to the project and renders rows', async () => {
    render(<ProjectActualsTab projectId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('John Smith')).toBeInTheDocument())
    expect(vi.mocked(actualsApi.listActuals)).toHaveBeenCalledWith(
      expect.objectContaining({ project_id: 'pj1' })
    )
    // No Project column — the whole tab is scoped to one project
    expect(screen.queryByText('Project')).not.toBeInTheDocument()
  })
})
