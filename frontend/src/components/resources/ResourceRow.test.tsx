import React from 'react'
import { render, screen } from '../../test/test-utils'
import ResourceRow from './ResourceRow'
import { GridData, ResourceInfo } from '../../utils/calendarTransform'

describe('ResourceRow', () => {
  const mockResource: ResourceInfo = {
    resourceId: 'r1',
    resourceName: 'Resource 1',
  }

  const mockDates = [
    new Date('2024-01-01'),
    new Date('2024-01-02'),
    new Date('2024-01-03'),
  ]

  const createMockGridData = (cellData: Record<string, any> = {}): GridData => {
    const cells = new Map()
    Object.entries(cellData).forEach(([key, value]) => {
      cells.set(key, value)
    })

    return {
      resources: [mockResource],
      dates: mockDates,
      cells,
    }
  }

  it('should render resource name', () => {
    const gridData = createMockGridData()

    render(<ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />)

    // Resource name appears twice (once for Capital row, once for Expense row)
    const resourceNames = screen.getAllByText('Resource 1')
    expect(resourceNames).toHaveLength(2)
  })

  it('should render Capital and Expense row labels', () => {
    const gridData = createMockGridData()

    render(<ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />)

    expect(screen.getByText('Capital')).toBeInTheDocument()
    expect(screen.getByText('Expense')).toBeInTheDocument()
  })

  it('should display capital percentage values', () => {
    const gridData = createMockGridData({
      'r1:2024-01-01:capital': {
        assignmentId: '1',
        capitalPercentage: 60,
        expensePercentage: 40,
      },
    })

    render(<ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />)

    expect(screen.getByText('60%')).toBeInTheDocument()
  })

  it('should display expense percentage values', () => {
    const gridData = createMockGridData({
      'r1:2024-01-01:expense': {
        assignmentId: '1',
        capitalPercentage: 60,
        expensePercentage: 40,
      },
    })

    render(<ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />)

    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('should display empty cells when no assignment exists', () => {
    const gridData = createMockGridData()

    const { container } = render(
      <ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />
    )

    // Check that cells exist but are empty (no percentage text)
    const percentageTexts = container.querySelectorAll('p')
    const emptyPercentages = Array.from(percentageTexts).filter(
      (p) => p.textContent === ''
    )
    
    // Should have empty cells for dates with no assignments
    expect(emptyPercentages.length).toBeGreaterThan(0)
  })

  it('should handle zero percentage values', () => {
    const gridData = createMockGridData({
      'r1:2024-01-01:capital': {
        assignmentId: '1',
        capitalPercentage: 0,
        expensePercentage: 0,
      },
      'r1:2024-01-01:expense': {
        assignmentId: '1',
        capitalPercentage: 0,
        expensePercentage: 0,
      },
    })

    const { container } = render(
      <ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />
    )

    // Zero values should display as empty
    const percentageTexts = container.querySelectorAll('p')
    const emptyPercentages = Array.from(percentageTexts).filter(
      (p) => p.textContent === ''
    )
    
    expect(emptyPercentages.length).toBeGreaterThan(0)
  })

  it('should render cells for each date', () => {
    const gridData = createMockGridData()

    const { container } = render(
      <ResourceRow resource={mockResource} dates={mockDates} gridData={gridData} />
    )

    // Each row should have cells for all dates
    // 2 rows (Capital + Expense) * 3 dates = 6 date cells
    // Plus 2 resource name cells = 8 total cells minimum
    const allCells = container.querySelectorAll('[class*="MuiBox"]')
    expect(allCells.length).toBeGreaterThanOrEqual(8)
  })
})
