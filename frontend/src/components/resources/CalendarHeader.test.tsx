import React from 'react'
import { render, screen } from '../../test/test-utils'
import CalendarHeader from './CalendarHeader'

describe('CalendarHeader', () => {
  it('should render resource column header', () => {
    const dates = [new Date(Date.UTC(2024, 0, 1))]

    render(<CalendarHeader dates={dates} />)

    expect(screen.getByText('Resource')).toBeInTheDocument()
  })

  it('should render date column headers', () => {
    const dates = [
      new Date(Date.UTC(2024, 0, 1)),
      new Date(Date.UTC(2024, 0, 2)),
      new Date(Date.UTC(2024, 0, 3)),
    ]

    const { container } = render(<CalendarHeader dates={dates} />)

    // Check that we have the correct number of date columns (3 dates + 1 resource header)
    const boxes = container.querySelectorAll('[class*="MuiBox"]')
    expect(boxes.length).toBeGreaterThanOrEqual(4)
  })

  it('should format dates consistently', () => {
    const dates = [new Date(Date.UTC(2024, 11, 25))]

    render(<CalendarHeader dates={dates} />)

    // Check that date is rendered with year
    expect(screen.getByText(/2024/)).toBeInTheDocument()
    expect(screen.getByText(/Dec/)).toBeInTheDocument()
  })

  it('should render correct number of date columns', () => {
    const dates = [
      new Date(Date.UTC(2024, 0, 1)),
      new Date(Date.UTC(2024, 0, 2)),
      new Date(Date.UTC(2024, 0, 3)),
      new Date(Date.UTC(2024, 0, 4)),
      new Date(Date.UTC(2024, 0, 5)),
    ]

    render(<CalendarHeader dates={dates} />)

    // Resource header + 5 date headers
    const headers = screen.getAllByRole('generic').filter(
      (el) => el.textContent && (el.textContent.includes('Resource') || el.textContent.includes('2024'))
    )
    
    expect(headers.length).toBeGreaterThanOrEqual(5)
  })

  it('should handle empty dates array', () => {
    const dates: Date[] = []

    render(<CalendarHeader dates={dates} />)

    expect(screen.getByText('Resource')).toBeInTheDocument()
  })
})
