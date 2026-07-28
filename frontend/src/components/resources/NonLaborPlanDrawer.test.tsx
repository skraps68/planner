import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { render } from '../../test/test-utils'
import type { NonLaborPlanLine } from '../../types'
import NonLaborPlanDrawer from './NonLaborPlanDrawer'
import { APP_HEADER_HEIGHT } from '../../theme'


const mocks = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  cancel: vi.fn(),
  listReferenceTypes: vi.fn(),
  listProjects: vi.fn(),
  listNonLaborResources: vi.fn(),
}))

vi.mock('../../api/nonlaborPlans', () => ({
  nonlaborPlansApi: {
    preview: mocks.preview,
    create: mocks.create,
    update: mocks.update,
    cancel: mocks.cancel,
  },
}))

vi.mock('../../api/externalReferenceTypes', () => ({
  externalReferenceTypesApi: {
    list: mocks.listReferenceTypes,
  },
}))

vi.mock('../../api/projects', () => ({
  projectsApi: {
    list: mocks.listProjects,
  },
}))

vi.mock('../../api/resources', () => ({
  resourcesApi: {
    listNonLabor: mocks.listNonLaborResources,
  },
}))

const plan: NonLaborPlanLine = {
  id: 'plan-1',
  project_id: 'project-1',
  project_name: 'ERP Replacement',
  project_start_date: '2026-01-01',
  project_end_date: '2026-12-31',
  resource_id: 'resource-1',
  resource_name: 'Software Subscription',
  name: 'Annual license',
  description: 'Current description',
  forecast_basis: 'CASH',
  method: 'STRAIGHT_LINE',
  cost_treatment: 'EXPENSE',
  currency_code: 'USD',
  total_amount: 1200,
  schedule_start: '2026-01-01',
  schedule_end: '2026-12-31',
  frequency: 'MONTHLY',
  period_placement: 'PERIOD_END',
  status: 'ACTIVE',
  occurrences: [
    {
      id: 'occurrence-1',
      occurrence_date: '2026-01-31',
      base_amount: 100,
      override_amount: null,
      effective_amount: 100,
      source: 'GENERATED',
      version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
  references: [
    {
      id: 'reference-1',
      reference_type_id: 'reference-type-1',
      reference_type_name: 'Contract ID',
      value: 'CONTRACT123',
      version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  ],
  warnings: [],
  version: 3,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

describe('NonLaborPlanDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.listReferenceTypes.mockResolvedValue([
      {
        id: 'reference-type-1',
        name: 'Contract ID',
        description: 'Contract identifier',
        is_active: true,
        reference_count: 1,
        version: 1,
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      },
    ])
    mocks.listProjects.mockResolvedValue({ items: [], total: 0 })
    mocks.listNonLaborResources.mockResolvedValue({ items: [], total: 0 })
    mocks.preview.mockResolvedValue({
      occurrences: [{ occurrence_date: '2026-01-31', amount: 1200 }],
      occurrence_count: 1,
      exact_total: 1200,
      warnings: [],
    })
    mocks.update.mockResolvedValue(plan)
    mocks.cancel.mockResolvedValue({ ...plan, status: 'CANCELLED', version: 4 })
  })

  it('loads an existing plan and saves its complete schedule definition', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onClose = vi.fn()

    render(
      <NonLaborPlanDrawer
        open
        onClose={onClose}
        onSaved={onSaved}
        initialPlan={plan}
      />,
    )

    expect(document.querySelector('.MuiDrawer-paper')).toHaveStyle({
      top: `${APP_HEADER_HEIGHT}px`,
      height: `calc(100% - ${APP_HEADER_HEIGHT}px)`,
    })
    expect(screen.getByRole('heading', { name: 'Edit Cost Plan' })).toBeInTheDocument()
    const nameInput = screen.getByRole('textbox', { name: /Forecast Line Name/ })
    expect(nameInput).toHaveValue('Annual license')
    expect(screen.getByRole('textbox', { name: 'Reference Value' })).toHaveValue('CONTRACT123')

    await user.clear(nameInput)
    await user.type(nameInput, 'Renewed license')
    await user.click(screen.getByRole('button', { name: 'Continue' }))
    await user.click(screen.getByRole('button', { name: 'Continue to Preview' }))
    await screen.findByRole('button', { name: 'Save Cost Plan' })
    expect(
      within(screen.getByRole('table')).getByText('$1,200.00'),
    ).toBeInTheDocument()
    expect(screen.queryByText('$1,200.0000')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save Cost Plan' }))

    await waitFor(() => {
      expect(mocks.update).toHaveBeenCalledWith(
        'plan-1',
        expect.objectContaining({
          version: 3,
          name: 'Renewed license',
          method: 'STRAIGHT_LINE',
          total_amount: 1200,
          schedule_start: '2026-01-01',
          schedule_end: '2026-12-31',
          frequency: 'MONTHLY',
          period_placement: 'PERIOD_END',
          references: [{
            reference_type_id: 'reference-type-1',
            value: 'CONTRACT123',
          }],
        }),
      )
    })
    expect(onSaved).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('prefills a new plan with its resource default references', async () => {
    render(
      <NonLaborPlanDrawer
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        fixedProject={{
          id: 'project-1',
          name: 'ERP Replacement',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          currency_code: 'USD',
        }}
        fixedResource={{
          id: 'resource-1',
          name: 'Software Subscription',
          external_references: plan.references,
        }}
      />,
    )

    expect(
      await screen.findByRole('textbox', { name: 'Reference Value' }),
    ).toHaveValue('CONTRACT123')
  })

  it('removes unnecessary leading zeroes from entered amounts', async () => {
    const user = userEvent.setup()
    render(
      <NonLaborPlanDrawer
        open
        onClose={vi.fn()}
        onSaved={vi.fn()}
        fixedProject={{
          id: 'project-1',
          name: 'ERP Replacement',
          start_date: '2026-01-01',
          end_date: '2026-12-31',
          currency_code: 'USD',
        }}
        fixedResource={{
          id: 'resource-1',
          name: 'Software Subscription',
        }}
      />,
    )

    await user.type(
      screen.getByRole('textbox', { name: /Forecast Line Name/ }),
      'License forecast',
    )
    await user.click(screen.getByRole('button', { name: 'Continue' }))

    const totalAmount = screen.getByRole('spinbutton', {
      name: 'Total Amount',
    })
    await user.type(totalAmount, '000125')
    expect(totalAmount).toHaveValue(125)

    await user.click(screen.getByRole('button', { name: 'Manual cash flow' }))
    const manualAmount = screen.getByRole('spinbutton', { name: 'Amount' })
    await user.type(manualAmount, '00080')
    expect(manualAmount).toHaveValue(80)
  })

  it('requires confirmation and retains history when cancelling a plan', async () => {
    const user = userEvent.setup()
    const onSaved = vi.fn()
    const onClose = vi.fn()

    render(
      <NonLaborPlanDrawer
        open
        onClose={onClose}
        onSaved={onSaved}
        initialPlan={plan}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Cancel Cost Plan' }))
    const dialog = screen.getByRole('dialog', { name: 'Cancel cost plan?' })
    expect(dialog).toHaveTextContent('Its history will be retained.')
    await user.click(within(dialog).getByRole('button', { name: 'Cancel Cost Plan' }))

    await waitFor(() => {
      expect(mocks.cancel).toHaveBeenCalledWith('plan-1', 3)
    })
    expect(onSaved).toHaveBeenCalledOnce()
    expect(onClose).toHaveBeenCalledOnce()
  })
})
