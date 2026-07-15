import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import PhaseList from './PhaseList'
import { ProjectPhase } from '../../types'

describe('PhaseList Boundary Date Editing', () => {
  const mockPhases: Partial<ProjectPhase>[] = [
    {
      id: 'phase-1',
      name: 'Planning',
      description: 'Planning phase',
      start_date: '2024-01-01',
      end_date: '2024-03-31',
      labor_capital_budget: 6000,
      labor_expense_budget: 4000,
      nonlabor_capital_budget: 3000,
      nonlabor_expense_budget: 2000,
      total_budget: 15000,
    },
    {
      id: 'phase-2',
      name: 'Execution',
      description: 'Execution phase',
      start_date: '2024-04-01',
      end_date: '2024-06-30',
      labor_capital_budget: 12000,
      labor_expense_budget: 8000,
      nonlabor_capital_budget: 6000,
      nonlabor_expense_budget: 4000,
      total_budget: 30000,
    },
    {
      id: 'phase-3',
      name: 'Closure',
      description: 'Closure phase',
      start_date: '2024-07-01',
      end_date: '2024-09-30',
      labor_capital_budget: 3000,
      labor_expense_budget: 2000,
      nonlabor_capital_budget: 1500,
      nonlabor_expense_budget: 1000,
      total_budget: 7500,
    },
  ]

  it('renders all date columns read-only in edit mode', () => {
    render(<PhaseList phases={mockPhases} editMode onUpdate={vi.fn()} onDelete={vi.fn()} />)
    expect(document.querySelectorAll('input[type="date"]').length).toBe(0)
  })
})
