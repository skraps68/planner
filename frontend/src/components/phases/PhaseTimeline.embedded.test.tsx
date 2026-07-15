import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../../test/test-utils'
import PhaseTimeline from './PhaseTimeline'

const phases = [
  { id: '1', name: 'Design', start_date: '2024-01-01', end_date: '2024-03-31' },
  { id: '2', name: 'Build', start_date: '2024-04-01', end_date: '2024-12-31' },
]

const base = {
  phases, projectStartDate: '2024-01-01', projectEndDate: '2024-12-31',
  validationErrors: [], onPhaseResize: vi.fn(), onPhaseReorder: vi.fn(),
}

describe('PhaseTimeline embedded variant', () => {
  it('hides the section title when embedded', () => {
    render(<PhaseTimeline {...base} embedded />)
    expect(screen.queryByText(/Phase Timeline/i)).toBeNull()
    // phases still render
    expect(screen.getAllByText('Design').length).toBeGreaterThan(0)
  })

  it('shows the section title in the default (non-embedded) variant', () => {
    render(<PhaseTimeline {...base} />)
    expect(screen.getByText(/Phase Timeline/i)).toBeTruthy()
  })
})
