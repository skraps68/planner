import { test, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import PhaseList from './PhaseList'

const phase = {
  id: 'p1', project_id: 'x', name: 'Ph', start_date: '2026-01-01', end_date: '2026-06-30',
  description: '', labor_capital_budget: 100, labor_expense_budget: 50,
  nonlabor_capital_budget: 30, nonlabor_expense_budget: 20, total_budget: 200,
}

test('renders labor and non-labor budget headers', () => {
  render(<PhaseList phases={[phase as any]} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('Labor Budget')).toBeInTheDocument()
  expect(screen.getByText('Non-Labor Budget')).toBeInTheDocument()
})

test('total column shows sum of four category budgets', () => {
  render(<PhaseList phases={[phase as any]} onAdd={() => {}} onUpdate={() => {}} onDelete={() => {}} />)
  expect(screen.getByText('$200.00')).toBeInTheDocument()
})
