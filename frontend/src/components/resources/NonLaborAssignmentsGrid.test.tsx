import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { createTestQueryClient, render } from '../../test/test-utils'
import type { NonLaborPlanLine } from '../../types'
import NonLaborAssignmentsGrid from './NonLaborAssignmentsGrid'


const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  setOverride: vi.fn(),
  listReferenceTypes: vi.fn(),
}))

vi.mock('../../api/nonlaborPlans', () => ({
  nonlaborPlansApi: {
    list: mocks.list,
    setOverride: mocks.setOverride,
    preview: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    cancel: vi.fn(),
  },
}))

vi.mock('../../api/externalReferenceTypes', () => ({
  externalReferenceTypesApi: {
    list: mocks.listReferenceTypes,
  },
}))

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      username: 'admin',
      email: 'admin@example.com',
      roles: ['ADMIN'],
      permissions: [],
    },
  }),
}))

const occurrence = (
  id: string,
  amount: number,
): NonLaborPlanLine['occurrences'][number] => ({
  id,
  occurrence_date: '2026-01-05',
  base_amount: amount,
  override_amount: null,
  effective_amount: amount,
  source: 'MANUAL',
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const line = (
  id: string,
  name: string,
  treatment: 'CAPITAL' | 'EXPENSE',
  amount: number,
): NonLaborPlanLine => ({
  id,
  project_id: 'project-1',
  project_name: 'ERP Replacement',
  project_start_date: '2026-01-04',
  project_end_date: '2026-01-10',
  resource_id: 'resource-1',
  resource_name: 'Software Subscription',
  name,
  description: undefined,
  forecast_basis: 'CASH',
  method: 'MANUAL',
  cost_treatment: treatment,
  currency_code: 'USD',
  total_amount: amount,
  schedule_start: null,
  schedule_end: null,
  frequency: null,
  period_placement: null,
  status: 'ACTIVE',
  occurrences: [occurrence(`${id}-occurrence`, amount)],
  references: [],
  warnings: [],
  version: 1,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

describe('NonLaborAssignmentsGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.list.mockResolvedValue([
      line('capital-plan', 'Equipment', 'CAPITAL', 100),
      line('expense-plan', 'Subscription', 'EXPENSE', 200),
    ])
    mocks.listReferenceTypes.mockResolvedValue([])
  })

  it('sums cash flows by treatment across daily and weekly views', async () => {
    const user = userEvent.setup()
    render(
      <NonLaborAssignmentsGrid
        perspective="project"
        project={{
          id: 'project-1',
          name: 'ERP Replacement',
          start_date: '2026-01-04',
          end_date: '2026-01-10',
          currency_code: 'USD',
        }}
      />,
    )

    const grid = await screen.findByRole('grid', {
      name: 'Non-labor assignment calendar',
    })
    const totalRow = within(grid).getByText('Total Forecast').closest('tr')
    expect(totalRow).toHaveTextContent('300')
    const totalValue = within(totalRow as HTMLElement).getByText('300')
    expect(totalValue.closest('td')).toHaveStyle({
      backgroundColor: '#e8f5e9',
    })
    expect(totalValue).toHaveStyle({ fontWeight: 700 })
    expect(within(grid).getAllByText('Cap $')[0].closest('tr'))
      .toHaveTextContent('100')
    expect(within(grid).getAllByText('Exp $')[0].closest('tr'))
      .toHaveTextContent('200')
    expect(screen.getByText('Capital')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
    expect(screen.getByTestId('project-start-boundary')).toHaveAttribute('x1', '1')
    expect(screen.getByTestId('project-end-boundary')).toHaveAttribute('x1', '293')

    await user.click(screen.getByRole('button', { name: 'Weekly view' }))

    expect(await screen.findByRole('columnheader', {
      name: 'Week: January 4, 2026 through January 10, 2026',
    })).toHaveTextContent('1/4-1/10')
    expect(within(grid).getByText('Total Forecast').closest('tr'))
      .toHaveTextContent('300')
  })

  it('opens a selected line in the existing-plan drawer', async () => {
    const user = userEvent.setup()
    render(
      <NonLaborAssignmentsGrid
        perspective="project"
        project={{
          id: 'project-1',
          name: 'ERP Replacement',
          start_date: '2026-01-04',
          end_date: '2026-01-10',
          currency_code: 'USD',
        }}
      />,
    )

    await screen.findByText('Software Subscription')
    await user.click(screen.getByRole('button', {
      name: 'Expand Software Subscription',
    }))
    await user.click(screen.getByRole('button', {
      name: 'Edit cost plan Equipment',
    }))

    expect(await screen.findByRole('heading', {
      name: 'Edit Cost Plan',
    })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('textbox', {
        name: /Forecast Line Name/,
      })).toHaveValue('Equipment')
    })
  })

  it('disables bulk editing when plan lines have no editable occurrences', async () => {
    mocks.list.mockResolvedValue([
      {
        ...line('empty-plan', 'Empty Schedule', 'CAPITAL', 0),
        occurrences: [],
      },
    ])

    render(
      <NonLaborAssignmentsGrid
        perspective="project"
        project={{
          id: 'project-1',
          name: 'ERP Replacement',
          start_date: '2026-01-04',
          end_date: '2026-01-10',
          currency_code: 'USD',
        }}
      />,
    )

    await screen.findByText('Software Subscription')
    expect(screen.getByRole('button', { name: /^Edit$/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Add Cost Plan' })).toBeEnabled()
  })

  it('invalidates financial forecasts after saving occurrence overrides', async () => {
    const user = userEvent.setup()
    const queryClient = createTestQueryClient()
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
    mocks.setOverride.mockResolvedValue(
      line('capital-plan', 'Equipment', 'CAPITAL', 125),
    )

    render(
      <NonLaborAssignmentsGrid
        perspective="project"
        project={{
          id: 'project-1',
          name: 'ERP Replacement',
          start_date: '2026-01-04',
          end_date: '2026-01-10',
          currency_code: 'USD',
        }}
      />,
      { queryClient },
    )

    await screen.findByText('Software Subscription')
    await user.click(screen.getByRole('button', {
      name: 'Expand Software Subscription',
    }))
    await user.click(screen.getByRole('button', { name: /^Edit$/ }))

    const amount = screen.getByRole('spinbutton', {
      name: 'Equipment amount for Date: January 5, 2026',
    })
    await user.clear(amount)
    await user.type(amount, '125')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() => {
      expect(mocks.setOverride).toHaveBeenCalledWith(
        'capital-plan',
        'capital-plan-occurrence',
        125,
        1,
      )
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['forecast'] })
  })
})
