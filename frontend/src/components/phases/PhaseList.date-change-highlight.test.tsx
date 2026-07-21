import { describe, it, expect, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1',
  name: 'P1',
  start_date: '2024-02-01',
  end_date: '2024-03-31',
  labor_capital_budget: 0,
  labor_expense_budget: 0,
  nonlabor_capital_budget: 0,
  nonlabor_expense_budget: 0,
  total_budget: 0,
}

// Cell order per row: [Name, Start, End, LaborCap, LaborExp, NonLaborCap, NonLaborExp, Total, Actions]
const cellsOfPhaseRow = () => {
  const row = screen.getByDisplayValue('P1').closest('tr') as HTMLElement
  return within(row).getAllByRole('cell')
}

describe('PhaseList date-change highlight', () => {
  it('marks the Start/End date cell as changed only when that date deviates', () => {
    render(
      <PhaseList
        phases={[phase as any]}
        editMode
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        changedFields={{ p1: new Set(['start_date']) }}
      />
    )
    const cells = cellsOfPhaseRow()
    // Start date deviated → highlighted; End date unchanged → not highlighted
    expect(cells[1]).toHaveAttribute('data-changed', 'true')
    expect(cells[2]).not.toHaveAttribute('data-changed')
  })

  it('removes the highlight when the date reverts to its original value', () => {
    const { rerender } = render(
      <PhaseList
        phases={[phase as any]}
        editMode
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        changedFields={{ p1: new Set(['start_date', 'end_date']) }}
      />
    )
    expect(cellsOfPhaseRow()[1]).toHaveAttribute('data-changed', 'true')
    expect(cellsOfPhaseRow()[2]).toHaveAttribute('data-changed', 'true')

    // Revert: changedFields no longer lists the dates
    rerender(
      <PhaseList
        phases={[phase as any]}
        editMode
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        changedFields={{}}
      />
    )
    expect(cellsOfPhaseRow()[1]).not.toHaveAttribute('data-changed')
    expect(cellsOfPhaseRow()[2]).not.toHaveAttribute('data-changed')
  })
})
