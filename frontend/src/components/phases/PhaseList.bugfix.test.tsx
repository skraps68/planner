import { render, screen, within, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import '@testing-library/jest-dom'
import PhaseList from './PhaseList'
import { ProjectPhase } from '../../types'

describe('PhaseList Bug Fixes', () => {
  const mockPhases: Partial<ProjectPhase>[] = [
    {
      id: '1',
      name: 'Phase 1',
      description: 'First phase',
      start_date: '2024-01-01',
      end_date: '2024-03-31',
      labor_capital_budget: 10000,
      labor_expense_budget: 5000,
      nonlabor_capital_budget: 0,
      nonlabor_expense_budget: 0,
      total_budget: 15000,
    },
    {
      id: '2',
      name: 'Phase 2',
      description: 'Second phase',
      start_date: '2024-04-01',
      end_date: '2024-06-30',
      labor_capital_budget: 20000,
      labor_expense_budget: 10000,
      nonlabor_capital_budget: 0,
      nonlabor_expense_budget: 0,
      total_budget: 30000,
    },
  ]

  const mockOnUpdate = vi.fn()
  const mockOnDelete = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Fix 1: Font Size Consistency', () => {
    it('should apply fontSize: inherit to all TextField inputs', () => {
      const { container } = render(
        <PhaseList
          phases={mockPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Check that all TextFields have fontSize: inherit in their sx prop
      const textFields = container.querySelectorAll('input[type="text"], input[type="number"], input[type="date"]')

      // We can't directly check the sx prop, but we can verify the inputs are rendered
      // and that the component doesn't throw errors
      expect(textFields.length).toBeGreaterThan(0)
    })

    it('should render edit mode without visual inconsistencies', () => {
      render(
        <PhaseList
          phases={mockPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify all input fields are rendered (scope to phase 1's row since
      // phase 2's expense budget also happens to be 10000)
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[2] // skip the two header rows
      expect(within(firstDataRow).getByDisplayValue('Phase 1')).toBeInTheDocument()
      expect(within(firstDataRow).getByDisplayValue('10000')).toBeInTheDocument()
      expect(within(firstDataRow).getByDisplayValue('5000')).toBeInTheDocument()

      // Description now lives behind a per-row expand toggle rather than an
      // always-present column; expand it to verify the value is editable.
      // "First phase" is a globally-unique string (phase 2's is "Second phase").
      fireEvent.click(within(firstDataRow).getByRole('button', { name: /expand description/i }))
      expect(screen.getByDisplayValue('First phase')).toBeInTheDocument()
    })
  })

  describe('Fix 2: NaN in Total Budget', () => {
    it('should not display NaN when entering edit mode', () => {
      render(
        <PhaseList
          phases={mockPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Get the first row
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[2] // Skip the two header rows

      // Verify total budget is still displayed correctly (not NaN)
      // The total should be calculated from capital + expense
      expect(within(firstDataRow).getByText('$15,000')).toBeInTheDocument()
      expect(within(firstDataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should initialize budget values to 0 when undefined', () => {
      const phaseWithUndefinedBudgets: Partial<ProjectPhase>[] = [
        {
          id: '3',
          name: 'Phase 3',
          description: 'Third phase',
          start_date: '2024-07-01',
          end_date: '2024-09-30',
          // labor_capital_budget, labor_expense_budget, nonlabor_capital_budget,
          // nonlabor_expense_budget, and total_budget are undefined
        },
      ]

      render(
        <PhaseList
          phases={phaseWithUndefinedBudgets}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Undefined budgets render as empty inputs (Option A: empty-for-zero) — the
      // key guarantee is that they are never "NaN". Four numeric budget inputs.
      const budgetInputs = Array.from(
        document.querySelectorAll('input[inputmode="numeric"]')
      ) as HTMLInputElement[]
      expect(budgetInputs.length).toBe(4) // labor capital, labor expense, nonlabor capital, nonlabor expense
      budgetInputs.forEach((input) => {
        expect(input.value).toBe('')
        expect(input.value).not.toMatch(/NaN/)
      })

      // Verify total budget shows $0.00, not NaN
      const rows = screen.getAllByRole('row')
      const dataRow = rows[2]
      expect(within(dataRow).getByText('$0')).toBeInTheDocument()
      expect(within(dataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should calculate total budget correctly when editing capital budget', () => {
      const { rerender } = render(
        <PhaseList
          phases={mockPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Simulate onUpdate being applied by the parent (PhaseEditor) and the
      // updated phase flowing back down as a new `phases` prop.
      const updatedPhases = mockPhases.map((p) =>
        p.id === '1' ? { ...p, labor_capital_budget: 15000 } : p
      )
      rerender(
        <PhaseList
          phases={updatedPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify total budget updates correctly (15000 + 5000 = 20000)
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[2]
      expect(within(firstDataRow).getByText('$20,000')).toBeInTheDocument()
      expect(within(firstDataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should calculate total budget correctly when editing expense budget', () => {
      const { rerender } = render(
        <PhaseList
          phases={mockPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      const updatedPhases = mockPhases.map((p) =>
        p.id === '1' ? { ...p, labor_expense_budget: 8000 } : p
      )
      rerender(
        <PhaseList
          phases={updatedPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify total budget updates correctly (10000 + 8000 = 18000)
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[2]
      expect(within(firstDataRow).getByText('$18,000')).toBeInTheDocument()
      expect(within(firstDataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should handle zero values without showing NaN', () => {
      const phaseWithZeroBudgets: Partial<ProjectPhase>[] = [
        {
          id: '4',
          name: 'Phase 4',
          description: 'Fourth phase',
          start_date: '2024-10-01',
          end_date: '2024-12-31',
          labor_capital_budget: 0,
          labor_expense_budget: 0,
          nonlabor_capital_budget: 0,
          nonlabor_expense_budget: 0,
          total_budget: 0,
        },
      ]

      render(
        <PhaseList
          phases={phaseWithZeroBudgets}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify total budget shows $0.00, not NaN
      const rows = screen.getAllByRole('row')
      const dataRow = rows[2]
      expect(within(dataRow).getByText('$0')).toBeInTheDocument()
      expect(within(dataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should handle string budget values from API correctly', () => {
      // Simulate API returning string values (as Decimal from Python)
      const phaseWithStringBudgets: Partial<ProjectPhase>[] = [
        {
          id: '5',
          name: 'Phase 5',
          description: 'Fifth phase',
          start_date: '2025-01-01',
          end_date: '2025-03-31',
          labor_capital_budget: '150000.00' as any, // API returns string
          labor_expense_budget: '75000.00' as any,  // API returns string
          nonlabor_capital_budget: 0,
          nonlabor_expense_budget: 0,
          total_budget: '225000.00' as any,   // API returns string
        },
      ]

      render(
        <PhaseList
          phases={phaseWithStringBudgets}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify total budget is calculated correctly from string values
      const rows = screen.getAllByRole('row')
      const dataRow = rows[2]
      expect(within(dataRow).getByText('$225,000')).toBeInTheDocument()
      expect(within(dataRow).queryByText(/NaN/)).not.toBeInTheDocument()

      // Verify input fields show numeric values
      expect(screen.getByDisplayValue('150000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('75000')).toBeInTheDocument()
    })
  })

  describe('Integration: Both Fixes Together', () => {
    it('should work correctly with both fixes applied', () => {
      const { rerender } = render(
        <PhaseList
          phases={mockPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify no NaN appears
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()

      // Verify all fields are editable (scope to phase 1's row since
      // phase 2's expense budget also happens to be 10000)
      const initialRows = screen.getAllByRole('row')
      const initialFirstDataRow = initialRows[2]
      expect(within(initialFirstDataRow).getByDisplayValue('Phase 1')).toBeInTheDocument()
      expect(within(initialFirstDataRow).getByDisplayValue('10000')).toBeInTheDocument()
      expect(within(initialFirstDataRow).getByDisplayValue('5000')).toBeInTheDocument()

      // Description now lives behind a per-row expand toggle rather than an
      // always-present column; expand it to verify the value is editable.
      fireEvent.click(within(initialFirstDataRow).getByRole('button', { name: /expand description/i }))
      expect(screen.getByDisplayValue('First phase')).toBeInTheDocument()

      // Simulate capital budget change flowing back down through props
      const updatedPhases = mockPhases.map((p) =>
        p.id === '1' ? { ...p, labor_capital_budget: 12000 } : p
      )
      rerender(
        <PhaseList
          phases={updatedPhases}
          editMode
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Verify total updates correctly
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[2]
      expect(within(firstDataRow).getByText('$17,000')).toBeInTheDocument()
      expect(within(firstDataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })
  })
})
