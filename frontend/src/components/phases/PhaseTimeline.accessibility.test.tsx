import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PhaseTimeline from './PhaseTimeline'
import { ProjectPhase } from '../../types'

describe('PhaseTimeline - Accessibility', () => {
  const mockPhases: Partial<ProjectPhase>[] = [
    {
      id: 'phase-1',
      name: 'Phase 1',
      start_date: '2024-01-01',
      end_date: '2024-01-10',
    },
    {
      id: 'phase-2',
      name: 'Phase 2',
      start_date: '2024-01-11',
      end_date: '2024-01-20',
    },
    {
      id: 'phase-3',
      name: 'Phase 3',
      start_date: '2024-01-21',
      end_date: '2024-01-31',
    },
  ]

  it('renders phases with keyboard accessibility attributes when reordering is enabled', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
      />
    )

    // Check that phases have tabIndex and role attributes
    const phaseElements = screen.getAllByRole('button')
    expect(phaseElements.length).toBeGreaterThan(0)
    
    // Check that phases have aria-label
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    expect(phase1).toBeDefined()
    expect(phase1?.getAttribute('aria-label')).toContain('Phase 1')
  })

  it('does not make phases focusable when reordering is disabled', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={false}
      />
    )

    // Phases should not have role="button" when reordering is disabled
    const buttons = screen.queryAllByRole('button')
    expect(buttons.length).toBe(0)
  })

  it('does not make single phase focusable even when reordering is enabled', () => {
    render(
      <PhaseTimeline
        phases={[mockPhases[0]]}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
      />
    )

    // Single phase should not have role="button"
    const buttons = screen.queryAllByRole('button')
    expect(buttons.length).toBe(0)
  })

  it('activates keyboard reordering mode with Ctrl+Shift+M', () => {
    const onPhaseReorder = vi.fn()
    
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
        onPhaseReorder={onPhaseReorder}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus the phase
    phase1!.focus()
    
    // Activate keyboard reordering mode
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Check that announcement was made (indicates mode is active)
    const liveRegion = screen.getByRole('status')
    expect(liveRegion.textContent).toContain('Keyboard reordering mode activated')
  })

  it('moves phase with arrow keys in keyboard reordering mode', () => {
    const onPhaseReorder = vi.fn()
    
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
        onPhaseReorder={onPhaseReorder}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus and activate keyboard reordering
    phase1!.focus()
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Move phase right (later position)
    fireEvent.keyDown(phase1!, { key: 'ArrowRight' })
    
    // Apply reordering with Enter
    fireEvent.keyDown(phase1!, { key: 'Enter' })
    
    // Verify onPhaseReorder was called
    expect(onPhaseReorder).toHaveBeenCalled()
    
    // Verify the reordered phases
    const reorderedPhases = onPhaseReorder.mock.calls[0][0]
    expect(reorderedPhases[0].id).toBe('phase-2')
    expect(reorderedPhases[1].id).toBe('phase-1')
    expect(reorderedPhases[2].id).toBe('phase-3')
  })

  it('cancels keyboard reordering with Escape', () => {
    const onPhaseReorder = vi.fn()
    
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
        onPhaseReorder={onPhaseReorder}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus and activate keyboard reordering
    phase1!.focus()
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Move phase right
    fireEvent.keyDown(phase1!, { key: 'ArrowRight' })
    
    // Cancel with Escape
    fireEvent.keyDown(phase1!, { key: 'Escape' })
    
    // Verify onPhaseReorder was NOT called
    expect(onPhaseReorder).not.toHaveBeenCalled()
  })

  it('renders aria-live region for screen reader announcements', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
      />
    )

    // Check for aria-live region
    const liveRegion = screen.getByRole('status')
    expect(liveRegion).toBeDefined()
    expect(liveRegion.getAttribute('aria-live')).toBe('polite')
    expect(liveRegion.getAttribute('aria-atomic')).toBe('true')
  })

  it('announces keyboard reordering activation to screen readers', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus and activate keyboard reordering
    phase1!.focus()
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Check that announcement was made
    const liveRegion = screen.getByRole('status')
    expect(liveRegion.textContent).toContain('Keyboard reordering mode activated')
    expect(liveRegion.textContent).toContain('Phase 1')
  })

  it('announces position changes during keyboard reordering', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus and activate keyboard reordering
    phase1!.focus()
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Move phase right
    fireEvent.keyDown(phase1!, { key: 'ArrowRight' })
    
    // Check that position change was announced
    const liveRegion = screen.getByRole('status')
    expect(liveRegion.textContent).toContain('will move to position')
  })

  it('announces successful reordering completion', () => {
    const onPhaseReorder = vi.fn()
    
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
        onPhaseReorder={onPhaseReorder}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus and activate keyboard reordering
    phase1!.focus()
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Move and confirm
    fireEvent.keyDown(phase1!, { key: 'ArrowRight' })
    fireEvent.keyDown(phase1!, { key: 'Enter' })
    
    // Check that completion was announced
    const liveRegion = screen.getByRole('status')
    expect(liveRegion.textContent).toContain('Reordering complete')
  })

  it('announces cancellation when Escape is pressed', () => {
    render(
      <PhaseTimeline
        phases={mockPhases}
        projectStartDate="2024-01-01"
        projectEndDate="2024-01-31"
        validationErrors={[]}
        enableReorder={true}
      />
    )

    const phaseElements = screen.getAllByRole('button')
    const phase1 = phaseElements.find(el => el.textContent?.includes('Phase 1'))
    
    expect(phase1).toBeDefined()
    
    // Focus and activate keyboard reordering
    phase1!.focus()
    fireEvent.keyDown(phase1!, { key: 'M', ctrlKey: true, shiftKey: true })
    
    // Cancel
    fireEvent.keyDown(phase1!, { key: 'Escape' })
    
    // Check that cancellation was announced
    const liveRegion = screen.getByRole('status')
    expect(liveRegion.textContent).toContain('Reordering cancelled')
  })
})
