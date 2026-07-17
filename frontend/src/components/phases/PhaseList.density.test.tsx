import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1', project_id: 'x', name: 'Design', start_date: '2026-01-01', end_date: '2026-06-30',
  description: 'kickoff', labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}

describe('PhaseList density', () => {
  it('read mode has no Description column header', () => {
    render(<PhaseList phases={[phase as any]} editMode={false} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.queryByText('Description')).toBeNull()
  })
  it('read mode exposes the description via an info affordance', () => {
    render(<PhaseList phases={[phase as any]} editMode={false} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    const affordance = screen.getByLabelText(/description/i)
    expect(affordance).toBeTruthy()  // info icon button/tooltip trigger
    expect(affordance).toHaveAttribute('tabindex', '0')  // focusable for keyboard
    expect(affordance).not.toHaveAttribute('aria-hidden')  // not hidden from screen readers
  })
})
