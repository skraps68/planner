import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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
      capital_budget: 10000,
      expense_budget: 5000,
      total_budget: 15000,
    },
    {
      id: 'phase-2',
      name: 'Execution',
      description: 'Execution phase',
      start_date: '2024-04-01',
      end_date: '2024-06-30',
      capital_budget: 20000,
      expense_budget: 10000,
      total_budget: 30000,
    },
    {
      id: 'phase-3',
      name: 'Closure',
      description: 'Closure phase',
      start_date: '2024-07-01',
      end_date: '2024-09-30',
      capital_budget: 5000,
      expense_budget: 2500,
      total_budget: 7500,
    },
  ]

  it('displays first phase start date as text by default', () => {
    const onBoundaryDateChange = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // First phase start date should be displayed as formatted text
    expect(screen.getByText(/Dec 31, 2023/)).toBeInTheDocument()
  })

  it('displays last phase end date as text by default', () => {
    const onBoundaryDateChange = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Last phase end date should be displayed as formatted text
    expect(screen.getByText(/Sep 29, 2024/)).toBeInTheDocument()
  })

  it('shows editable start date field for first phase when edit is clicked', async () => {
    const onBoundaryDateChange = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Find and click the edit button for the first phase
    const editButtons = screen.getAllByLabelText('edit')
    fireEvent.click(editButtons[0])

    // Now the start date should be editable
    const startDateInput = screen.getByDisplayValue('2024-01-01')
    expect(startDateInput).toBeInTheDocument()
    expect(startDateInput.tagName).toBe('INPUT')
  })

  it('shows editable end date field for last phase when edit is clicked', async () => {
    const onBoundaryDateChange = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Find and click the edit button for the last phase
    const editButtons = screen.getAllByLabelText('edit')
    fireEvent.click(editButtons[2]) // Third phase (last)

    // Now the end date should be editable
    const endDateInput = screen.getByDisplayValue('2024-09-30')
    expect(endDateInput).toBeInTheDocument()
    expect(endDateInput.tagName).toBe('INPUT')
  })

  it('does not show editable date fields for middle phase when edit is clicked', () => {
    const onBoundaryDateChange = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Find and click the edit button for the middle phase
    const editButtons = screen.getAllByLabelText('edit')
    fireEvent.click(editButtons[1]) // Second phase (middle)

    // Middle phase dates should not be editable
    const middlePhaseStartInputs = screen.queryAllByDisplayValue('2024-04-01')
    const middlePhaseEndInputs = screen.queryAllByDisplayValue('2024-06-30')
    
    expect(middlePhaseStartInputs.length).toBe(0)
    expect(middlePhaseEndInputs.length).toBe(0)
  })

  it('calls onBoundaryDateChange when first phase start date is changed and saved', () => {
    const onBoundaryDateChange = vi.fn()
    const onUpdate = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Click edit button for first phase
    const editButtons = screen.getAllByLabelText('edit')
    fireEvent.click(editButtons[0])

    // Change the start date
    const startDateInput = screen.getByDisplayValue('2024-01-01')
    fireEvent.change(startDateInput, { target: { value: '2024-01-15' } })
    
    // Click save button
    const saveButton = screen.getByLabelText('save')
    fireEvent.click(saveButton)
    
    // Verify callback was called with correct parameters
    expect(onBoundaryDateChange).toHaveBeenCalledWith('phase-1', 'start_date', '2024-01-15')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('calls onBoundaryDateChange when last phase end date is changed and saved', () => {
    const onBoundaryDateChange = vi.fn()
    const onUpdate = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Click edit button for last phase
    const editButtons = screen.getAllByLabelText('edit')
    fireEvent.click(editButtons[2])

    // Change the end date
    const endDateInput = screen.getByDisplayValue('2024-09-30')
    fireEvent.change(endDateInput, { target: { value: '2024-10-15' } })
    
    // Click save button
    const saveButton = screen.getByLabelText('save')
    fireEvent.click(saveButton)
    
    // Verify callback was called with correct parameters
    expect(onBoundaryDateChange).toHaveBeenCalledWith('phase-3', 'end_date', '2024-10-15')
    expect(onUpdate).toHaveBeenCalled()
  })

  it('does not call onBoundaryDateChange when boundary dates are not changed', () => {
    const onBoundaryDateChange = vi.fn()
    const onUpdate = vi.fn()
    
    render(
      <PhaseList
        phases={mockPhases}
        onAdd={vi.fn()}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
        onBoundaryDateChange={onBoundaryDateChange}
      />
    )

    // Click edit button for first phase
    const editButtons = screen.getAllByLabelText('edit')
    fireEvent.click(editButtons[0])

    // Change the name but not the date
    const nameInput = screen.getByDisplayValue('Planning')
    fireEvent.change(nameInput, { target: { value: 'Planning Updated' } })
    
    // Click save button
    const saveButton = screen.getByLabelText('save')
    fireEvent.click(saveButton)
    
    // Verify onBoundaryDateChange was NOT called
    expect(onBoundaryDateChange).not.toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalled()
  })
})
