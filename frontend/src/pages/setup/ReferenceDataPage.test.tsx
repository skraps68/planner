import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render } from '../../test/test-utils'
import ReferenceDataPage from './ReferenceDataPage'
import { workerTypesApi } from '../../api/workers'
import { ratesApi } from '../../api/rates'
import { resourceRolesApi } from '../../api/resourceRoles'

vi.mock('../../api/workers', () => ({
  workerTypesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('../../api/rates', () => ({
  ratesApi: {
    updateRate: vi.fn(),
    getRateHistory: vi.fn(),
  },
}))
vi.mock('../../api/resourceRoles', () => ({
  resourceRolesApi: {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}))

const employee = {
  id: 'wt1', type: 'Employee', description: 'Perm staff',
  worker_count: 5, current_rate: '1000.00', version: 1,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}
const contractor = {
  id: 'wt2', type: 'Full-Time Contractor', description: 'FTC',
  worker_count: 0, current_rate: '1300.00', version: 1,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
}

describe('ReferenceDataPage — Worker Types & Rates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerTypesApi.list).mockResolvedValue([employee, contractor] as any)
    vi.mocked(ratesApi.getRateHistory).mockResolvedValue({
      worker_type_id: 'wt1', worker_type_name: 'Employee', current_rate: 1000,
      rate_history: [{ id: 'r1', rate_amount: 1000, start_date: '2024-01-01', end_date: undefined, is_current: true, created_at: '2024-01-01T00:00:00Z' }],
    } as any)
  })

  it('shows Workers (not rate) in the Worker Types panel and Current Rate in the Rates panel', async () => {
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    const wt = within(screen.getByRole('region', { name: 'Worker Types' }))
    expect(wt.getByText('Workers')).toBeInTheDocument()
    expect(wt.queryByText('Current Rate')).toBeNull()

    const rates = within(screen.getByRole('region', { name: 'Rates' }))
    expect(rates.getByText('Current Rate')).toBeInTheDocument()
    expect(rates.getByText('$1000.00')).toBeInTheDocument()
  })

  it('disables Worker Type delete when the type still has workers', async () => {
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    expect(screen.getByRole('button', { name: /Delete Employee/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Delete Full-Time Contractor/i })).toBeEnabled()
  })

  it('edits a worker type via update (type/description only)', async () => {
    const user = userEvent.setup()
    vi.mocked(workerTypesApi.update).mockResolvedValue(employee as any)
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    await user.click(screen.getByRole('button', { name: /Edit Employee/i }))
    const desc = await screen.findByLabelText('Description')
    await user.clear(desc)
    await user.type(desc, 'Updated desc')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => expect(workerTypesApi.update).toHaveBeenCalledWith(
      'wt1', expect.objectContaining({ type: 'Employee', description: 'Updated desc', version: 1 }),
    ))
    expect(ratesApi.updateRate).not.toHaveBeenCalled()
  })

  it('sets a rate via ratesApi.updateRate with id, amount, and date', async () => {
    const user = userEvent.setup()
    vi.mocked(ratesApi.updateRate).mockResolvedValue({} as any)
    render(<ReferenceDataPage />)
    await waitFor(() => expect(screen.getAllByText('Employee').length).toBeGreaterThan(0))

    const rates = within(screen.getByRole('region', { name: 'Rates' }))
    await user.click(rates.getAllByRole('button', { name: /Set Rate/i })[0])
    const amount = await screen.findByLabelText('Amount')
    await user.type(amount, '1100')
    await user.click(screen.getByRole('button', { name: /^Save$/i }))

    await waitFor(() => expect(ratesApi.updateRate).toHaveBeenCalledWith(
      'wt1', 1100, expect.any(String),
    ))
  })
})

const defaultRole = { id: 'rr0', name: 'Default', description: 'Fallback', resource_count: 2, version: 1 }
const architect = { id: 'rr1', name: 'Architect', description: 'Designs', resource_count: 3, version: 1 }
const analyst = { id: 'rr2', name: 'Analyst', description: 'Analysis', resource_count: 0, version: 1 }

describe('ReferenceDataPage — Resource Roles', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workerTypesApi.list).mockResolvedValue([] as any)
    vi.mocked(resourceRolesApi.list).mockResolvedValue([defaultRole, architect, analyst] as any)
  })

  it('renders the roles with resource counts', async () => {
    render(<ReferenceDataPage />)
    const roles = within(await screen.findByRole('region', { name: 'Resource Roles' }))
    expect(await roles.findByText('Architect')).toBeInTheDocument()
    expect(roles.getByText('Resources')).toBeInTheDocument()
  })

  it('disables delete for Default and for in-use roles, enables for unused', async () => {
    render(<ReferenceDataPage />)
    await screen.findByRole('region', { name: 'Resource Roles' })
    expect(await screen.findByRole('button', { name: /Delete Default/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Delete Architect/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Delete Analyst/i })).toBeEnabled()
  })
})
