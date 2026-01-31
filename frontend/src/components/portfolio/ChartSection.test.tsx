import { describe, it, expect } from 'vitest'
import { render, screen } from '../../test/test-utils'
import ChartSection from './ChartSection'

describe('ChartSection Component', () => {
  // Requirements: 8.1, 8.2, 8.3
  it('should render without crashing', () => {
    const { container } = render(<ChartSection />)
    expect(container).toBeInTheDocument()
  })

  // Requirements: 8.1, 8.2, 8.3
  it('should display placeholder message', () => {
    render(<ChartSection />)
    
    // Check for the main heading
    const heading = screen.getByText(/chart visualization/i)
    expect(heading).toBeInTheDocument()
    
    // Check for the placeholder message
    const placeholderMessage = screen.getByText(/visual charts and graphs will be available in a future release/i)
    expect(placeholderMessage).toBeInTheDocument()
  })

  // Requirements: 8.1, 8.2, 8.3
  it('should display chart icon', () => {
    const { container } = render(<ChartSection />)
    
    // Check that an SVG icon is rendered (MUI icons render as SVG)
    const icon = container.querySelector('svg')
    expect(icon).toBeInTheDocument()
  })
})
