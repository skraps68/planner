import { describe, it, expect, vi } from 'vitest'
import { render, screen, within, fireEvent } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1',
  name: 'P1',
  start_date: '2024-01-01',
  end_date: '2024-03-31',
  labor_capital_budget: 0,
  labor_expense_budget: 5000,
  nonlabor_capital_budget: 0,
  nonlabor_expense_budget: 0,
  total_budget: 5000,
}

// Row cells: [Name, Start, End, LaborCap, LaborExp, NonLaborCap, NonLaborExp, Total, Actions]
const budgetCells = () => {
  const row = screen.getByDisplayValue('P1').closest('tr') as HTMLElement
  const cells = within(row).getAllByRole('cell')
  return { laborCapital: cells[3], laborExpense: cells[4] }
}

describe('PhaseList budget input (Option A: empty-for-zero, no leading zeros)', () => {
  it('renders a zero budget as an empty input (not a literal "0")', () => {
    render(<PhaseList phases={[phase as any]} editMode onUpdate={vi.fn()} onDelete={vi.fn()} />)
    const input = within(budgetCells().laborCapital).getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('')
    expect(input).toHaveAttribute('placeholder', '0')
  })

  it('renders a non-zero budget as its plain integer string', () => {
    render(<PhaseList phases={[phase as any]} editMode onUpdate={vi.fn()} onDelete={vi.fn()} />)
    const input = within(budgetCells().laborExpense).getByRole('textbox') as HTMLInputElement
    expect(input.value).toBe('5000')
  })

  it('strips a leading zero when typing into a zero field', () => {
    const onUpdate = vi.fn()
    render(<PhaseList phases={[phase as any]} editMode onUpdate={onUpdate} onDelete={vi.fn()} />)
    const input = within(budgetCells().laborCapital).getByRole('textbox')
    fireEvent.change(input, { target: { value: '05000' } })
    expect(onUpdate).toHaveBeenCalledWith('p1', { labor_capital_budget: 5000 })
  })

  it('allows clearing the field to empty (updates the value to 0)', () => {
    const onUpdate = vi.fn()
    render(<PhaseList phases={[phase as any]} editMode onUpdate={onUpdate} onDelete={vi.fn()} />)
    const input = within(budgetCells().laborExpense).getByRole('textbox')
    fireEvent.change(input, { target: { value: '' } })
    expect(onUpdate).toHaveBeenCalledWith('p1', { labor_expense_budget: 0 })
  })

  it('ignores non-digit characters', () => {
    const onUpdate = vi.fn()
    render(<PhaseList phases={[phase as any]} editMode onUpdate={onUpdate} onDelete={vi.fn()} />)
    const input = within(budgetCells().laborCapital).getByRole('textbox')
    fireEvent.change(input, { target: { value: '1a2b3' } })
    expect(onUpdate).toHaveBeenCalledWith('p1', { labor_capital_budget: 123 })
  })
})
