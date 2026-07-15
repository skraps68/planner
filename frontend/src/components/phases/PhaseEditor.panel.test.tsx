import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent, within } from '../../test/test-utils'

// edit permission
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('../../utils/permissions', () => ({ hasPermission: () => ({ hasPermission: true }) }))

const listMock = vi.fn()
const batchMock = vi.fn()
vi.mock('../../api/phases', () => ({
  phasesApi: {
    list: (...a: any[]) => listMock(...a),
    batchUpdate: (...a: any[]) => batchMock(...a),
  },
}))

import PhaseEditor from './PhaseEditor'

const phases = [{
  id: 'p1', project_id: 'proj1', name: 'Design',
  start_date: '2026-01-01', end_date: '2026-12-31', description: '',
  labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}]

const renderEditor = () => render(
  <PhaseEditor projectId="proj1" projectStartDate="2026-01-01" projectEndDate="2026-12-31"
    onSaveSuccess={vi.fn()} onSaveError={vi.fn()} />
)

describe('PhaseEditor merged panel', () => {
  beforeEach(() => {
    listMock.mockReset(); batchMock.mockReset()
    listMock.mockResolvedValue(phases)
    batchMock.mockResolvedValue(phases)
  })

  // "Design" appears in both the embedded timeline bar and the PhaseList
  // name cell, so we wait on getAllByText rather than getByText (which
  // throws on multiple matches).
  const waitForLoaded = () => waitFor(() => expect(screen.getAllByText('Design').length).toBeGreaterThan(0))

  it('read mode: one Edit button, no inputs', async () => {
    renderEditor()
    await waitForLoaded()
    expect(screen.getByRole('button', { name: /^edit$/i })).toBeTruthy()
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)
  })

  it('Edit reveals inputs + Add/Cancel/Save; dates stay read-only', async () => {
    renderEditor()
    await waitForLoaded()
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByRole('button', { name: /add phase/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /cancel/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /save changes/i })).toBeTruthy()
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4)   // four budgets
    expect(document.querySelectorAll('input[type="date"]').length).toBe(0)  // dates read-only
  })

  it('one Save issues a single batchUpdate', async () => {
    renderEditor()
    await waitForLoaded()
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }))
    const budget = screen.getAllByRole('spinbutton')[0]
    fireEvent.change(budget, { target: { value: '150' } })
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }))
    await waitFor(() => expect(batchMock).toHaveBeenCalledTimes(1))
    const [, payload] = batchMock.mock.calls[0]
    expect(payload.phases[0]).toEqual(expect.objectContaining({
      labor_capital_budget: 150, nonlabor_capital_budget: 30,
      total_budget: 250,  // 150 + 50 + 30 + 20
    }))
  })
})
