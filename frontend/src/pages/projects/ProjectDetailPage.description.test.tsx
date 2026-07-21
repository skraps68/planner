import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, createTestStore } from '../../test/test-utils'
import ProjectDetailPage from './ProjectDetailPage'
import { projectsApi } from '../../api/projects'
import { programsApi } from '../../api/programs'
import { assignmentsApi } from '../../api/assignments'

vi.mock('../../api/projects')
vi.mock('../../api/programs')
vi.mock('../../api/assignments')

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useParams: () => ({ id: 'project-1' }),
    useLocation: () => ({ state: null, search: '' }),
  }
})

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1', username: 'a', email: 'a@e.c', role: 'admin', scopes: [] } }),
}))

const mockProject = {
  id: 'project-1',
  program_id: 'program-1',
  name: 'Test Project',
  business_sponsor: 'Jane Smith',
  project_manager: 'John Doe',
  technical_lead: 'Bob Johnson',
  cost_center_code: 'CC-001',
  description: 'A meaningful project description',
  start_date: '2024-01-01',
  end_date: '2024-01-31',
  version: 1,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  phases: [],
}

const mockProgram = { id: 'program-1', name: 'Test Program', portfolio_id: 'portfolio-1' }

describe('ProjectDetailPage description', () => {
  let queryClient: QueryClient
  let store: ReturnType<typeof createTestStore>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.get).mockResolvedValue(mockProject as any)
    vi.mocked(programsApi.get).mockResolvedValue(mockProgram as any)
    vi.mocked(assignmentsApi.getByProject).mockResolvedValue([] as any)
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    store = createTestStore()
  })

  it('shows the Description label and value in view mode', async () => {
    render(<ProjectDetailPage />, { store, queryClient })
    await waitFor(() => expect(screen.getByText('Description')).toBeInTheDocument())
    expect(screen.getByText('Description')).toBeInTheDocument()
    expect(screen.getByText('A meaningful project description')).toBeInTheDocument()
  })

  it('makes the description editable after clicking Edit', async () => {
    const user = userEvent.setup()
    render(<ProjectDetailPage />, { store, queryClient })
    await waitFor(() => expect(screen.getByText('Description')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /^edit$/i }))
    expect(screen.getByDisplayValue('A meaningful project description')).toBeInTheDocument()
  })
})
