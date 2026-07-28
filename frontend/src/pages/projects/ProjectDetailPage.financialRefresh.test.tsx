import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getProjectForecast } from '../../api/forecast'
import { phasesApi } from '../../api/phases'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'
import { createTestStore, render } from '../../test/test-utils'
import ProjectDetailPage from './ProjectDetailPage'

vi.mock('../../api/forecast')
vi.mock('../../api/phases')
vi.mock('../../api/programs')
vi.mock('../../api/projects')

vi.mock('../../components/phases/PhaseEditor', () => ({
  default: ({ onSaveSuccess }: { onSaveSuccess: () => void }) => (
    <button onClick={onSaveSuccess}>Simulate phase save</button>
  ),
}))
vi.mock('../../components/resources/ResourceAssignmentCalendar', () => ({
  default: () => null,
}))
vi.mock('../../components/resources/NonLaborAssignmentsGrid', () => ({
  default: () => null,
}))
vi.mock('../../components/actuals/ProjectActualsTab', () => ({
  default: () => null,
}))
vi.mock('../../components/portfolio/ChartSection', () => ({
  default: () => null,
}))
vi.mock('../../components/portfolio/FinancialSummaryTable', () => ({
  FinancialSummaryTable: () => null,
}))
vi.mock('../../contexts/UserSettingsContext', () => ({
  useUserSettings: () => ({
    settings: { assignmentGrids: {} },
    updateSettings: vi.fn(),
  }),
}))
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>(
    'react-router-dom',
  )
  return {
    ...actual,
    useParams: () => ({ id: 'project-1' }),
  }
})

const zeroBreakdown = {
  total: 0,
  capital: 0,
  expense: 0,
  labor_capital: 0,
  labor_expense: 0,
  nonlabor_capital: 0,
  nonlabor_expense: 0,
}

describe('ProjectDetailPage financial refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.get).mockResolvedValue({
      id: 'project-1',
      program_id: 'program-1',
      name: 'Test Project',
      business_sponsor: 'Sponsor',
      project_manager: 'Manager',
      technical_lead: 'Lead',
      cost_center_code: 'CC-1',
      description: '',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      currency_code: 'USD',
      version: 1,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
      phases: [],
    } as never)
    vi.mocked(programsApi.get).mockResolvedValue({
      id: 'program-1',
      name: 'Program',
    } as never)
    vi.mocked(phasesApi.list).mockResolvedValue([])
    vi.mocked(getProjectForecast).mockResolvedValue({
      entity_id: 'project-1',
      entity_name: 'Test Project',
      entity_type: 'project',
      budget: zeroBreakdown,
      actual: zeroBreakdown,
      forecast: zeroBreakdown,
      analysis: {
        budget_remaining: 0,
        forecast_variance: 0,
        budget_utilization_percentage: 0,
        forecast_to_budget_percentage: 0,
      },
    })
  })

  it('immediately refreshes phase and forecast queries after a phase save', async () => {
    const user = userEvent.setup()
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    })
    const invalidate = vi.spyOn(queryClient, 'invalidateQueries')

    render(<ProjectDetailPage />, {
      queryClient,
      store: createTestStore(),
    })

    await screen.findByRole('heading', { name: 'Test Project' })
    await waitFor(() => expect(getProjectForecast).toHaveBeenCalledTimes(1))
    await user.click(screen.getByRole('button', { name: 'Simulate phase save' }))

    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['phases', 'project-1'],
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['forecast'] })
    await waitFor(() => expect(getProjectForecast).toHaveBeenCalledTimes(2))
  })
})
