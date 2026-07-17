import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1', project_id: 'x', name: 'Design', start_date: '2026-01-01', end_date: '2026-06-30',
  description: '', labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}

describe('PhaseList', () => {
  it('read mode: labor/non-labor headers, currency text, no inputs', () => {
    render(<PhaseList phases={[phase as any]} editMode={false} onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(screen.getByText('Labor Budget')).toBeInTheDocument()
    expect(screen.getByText('Non-Labor Budget')).toBeInTheDocument()
    expect(screen.getAllByText('$200.00')).toHaveLength(2)  // one per-row Total + one footer
    const lastRow = screen.getAllByRole('row')[screen.getAllByRole('row').length - 1]
    expect(within(lastRow).getByText('$200.00')).toBeInTheDocument()
    expect(screen.queryAllByRole('spinbutton')).toHaveLength(0)  // no number inputs
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)     // no text inputs
  })

  it('edit mode: name + four budget inputs, dates stay read-only text', () => {
    render(<PhaseList phases={[phase as any]} editMode onUpdate={vi.fn()} onDelete={vi.fn()} />)
    // four numeric budget inputs
    expect(screen.getAllByRole('spinbutton')).toHaveLength(4)
    // a name text input
    expect(screen.getAllByRole('textbox').length).toBeGreaterThanOrEqual(1)
    // dates are NOT inputs (no type=date fields)
    const dateInputs = document.querySelectorAll('input[type="date"]')
    expect(dateInputs.length).toBe(0)
  })

  it('edit mode: editing a budget calls onUpdate with that field', () => {
    const onUpdate = vi.fn()
    render(<PhaseList phases={[phase as any]} editMode onUpdate={onUpdate} onDelete={vi.fn()} />)
    const inputs = screen.getAllByRole('spinbutton')  // first budget input is labor_capital
    fireEvent.change(inputs[0], { target: { value: '150' } })
    expect(onUpdate).toHaveBeenCalledWith('p1', expect.objectContaining({ labor_capital_budget: 150 }))
  })
})
