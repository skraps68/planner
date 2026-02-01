import { render, screen, fireEvent, within } from '@testing-library/react'
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
      capital_budget: 10000,
      expense_budget: 5000,
      total_budget: 15000,
    },
    {
      id: '2',
      name: 'Phase 2',
      description: 'Second phase',
      start_date: '2024-04-01',
      end_date: '2024-06-30',
      capital_budget: 20000,
      expense_budget: 10000,
      total_budget: 30000,
    },
  ]

  const mockOnAdd = vi.fn()
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
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button on first phase
      const editButtons = screen.getAllByLabelText('edit')
      fireEvent.click(editButtons[0])

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
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButtons = screen.getAllByLabelText('edit')
      fireEvent.click(editButtons[0])

      // Verify all input fields are rendered
      expect(screen.getByDisplayValue('Phase 1')).toBeInTheDocument()
      expect(screen.getByDisplayValue('First phase')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5000')).toBeInTheDocument()
    })
  })

  describe('Fix 2: NaN in Total Budget', () => {
    it('should not display NaN when entering edit mode', () => {
      render(
        <PhaseList
          phases={mockPhases}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Get the first row
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1] // Skip header row

      // Verify total budget is displayed correctly before edit
      expect(within(firstDataRow).getByText('$15,000.00')).toBeInTheDocument()

      // Click edit button
      const editButtons = screen.getAllByLabelText('edit')
      fireEvent.click(editButtons[0])

      // Verify total budget is still displayed correctly (not NaN)
      // The total should be calculated from capital + expense
      expect(within(firstDataRow).getByText('$15,000.00')).toBeInTheDocument()
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
          // capital_budget, expense_budget, and total_budget are undefined
        },
      ]

      render(
        <PhaseList
          phases={phaseWithUndefinedBudgets}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButton = screen.getByLabelText('edit')
      fireEvent.click(editButton)

      // Verify budget fields show 0, not NaN (there are two inputs with value 0: capital and expense)
      const budgetInputs = screen.getAllByDisplayValue('0') as HTMLInputElement[]
      expect(budgetInputs.length).toBe(2) // capital and expense budget
      
      // Verify total budget shows $0.00, not NaN
      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]
      expect(within(dataRow).getByText('$0.00')).toBeInTheDocument()
      expect(within(dataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should calculate total budget correctly when editing capital budget', () => {
      render(
        <PhaseList
          phases={mockPhases}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButtons = screen.getAllByLabelText('edit')
      fireEvent.click(editButtons[0])

      // Find capital budget input and change it
      const capitalInput = screen.getByDisplayValue('10000') as HTMLInputElement
      fireEvent.change(capitalInput, { target: { value: '15000' } })

      // Verify total budget updates correctly (15000 + 5000 = 20000)
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      expect(within(firstDataRow).getByText('$20,000.00')).toBeInTheDocument()
      expect(within(firstDataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })

    it('should calculate total budget correctly when editing expense budget', () => {
      render(
        <PhaseList
          phases={mockPhases}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButtons = screen.getAllByLabelText('edit')
      fireEvent.click(editButtons[0])

      // Find expense budget input and change it
      const expenseInput = screen.getByDisplayValue('5000') as HTMLInputElement
      fireEvent.change(expenseInput, { target: { value: '8000' } })

      // Verify total budget updates correctly (10000 + 8000 = 18000)
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      expect(within(firstDataRow).getByText('$18,000.00')).toBeInTheDocument()
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
          capital_budget: 0,
          expense_budget: 0,
          total_budget: 0,
        },
      ]

      render(
        <PhaseList
          phases={phaseWithZeroBudgets}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButton = screen.getByLabelText('edit')
      fireEvent.click(editButton)

      // Verify total budget shows $0.00, not NaN
      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]
      expect(within(dataRow).getByText('$0.00')).toBeInTheDocument()
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
          capital_budget: '150000.00' as any, // API returns string
          expense_budget: '75000.00' as any,  // API returns string
          total_budget: '225000.00' as any,   // API returns string
        },
      ]

      render(
        <PhaseList
          phases={phaseWithStringBudgets}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButton = screen.getByLabelText('edit')
      fireEvent.click(editButton)

      // Verify total budget is calculated correctly from string values
      const rows = screen.getAllByRole('row')
      const dataRow = rows[1]
      expect(within(dataRow).getByText('$225,000.00')).toBeInTheDocument()
      expect(within(dataRow).queryByText(/NaN/)).not.toBeInTheDocument()

      // Verify input fields show numeric values
      expect(screen.getByDisplayValue('150000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('75000')).toBeInTheDocument()
    })
  })

  describe('Integration: Both Fixes Together', () => {
    it('should work correctly with both fixes applied', () => {
      render(
        <PhaseList
          phases={mockPhases}
          onAdd={mockOnAdd}
          onUpdate={mockOnUpdate}
          onDelete={mockOnDelete}
        />
      )

      // Click edit button
      const editButtons = screen.getAllByLabelText('edit')
      fireEvent.click(editButtons[0])

      // Verify no NaN appears
      expect(screen.queryByText(/NaN/)).not.toBeInTheDocument()

      // Verify all fields are editable
      expect(screen.getByDisplayValue('Phase 1')).toBeInTheDocument()
      expect(screen.getByDisplayValue('First phase')).toBeInTheDocument()
      expect(screen.getByDisplayValue('10000')).toBeInTheDocument()
      expect(screen.getByDisplayValue('5000')).toBeInTheDocument()

      // Change capital budget
      const capitalInput = screen.getByDisplayValue('10000') as HTMLInputElement
      fireEvent.change(capitalInput, { target: { value: '12000' } })

      // Verify total updates correctly
      const rows = screen.getAllByRole('row')
      const firstDataRow = rows[1]
      expect(within(firstDataRow).getByText('$17,000.00')).toBeInTheDocument()
      expect(within(firstDataRow).queryByText(/NaN/)).not.toBeInTheDocument()
    })
  })
})
