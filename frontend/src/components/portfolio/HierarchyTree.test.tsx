import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { render, createTestStore, createTestQueryClient } from '../../test/test-utils'
import HierarchyTree from './HierarchyTree'
import { portfoliosApi } from '../../api/portfolios'
import { programsApi } from '../../api/programs'
import { projectsApi } from '../../api/projects'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => ({
  ...(await vi.importActual<any>('react-router-dom')),
  useNavigate: () => mockNavigate,
}))
vi.mock('../../api/portfolios', () => ({ portfoliosApi: { list: vi.fn() } }))
vi.mock('../../api/programs', () => ({ programsApi: { list: vi.fn() } }))
vi.mock('../../api/projects', () => ({ projectsApi: { list: vi.fn() } }))
vi.mock('../../hooks/usePermissions', () => ({
  useScopeFilter: () => ({
    filterPrograms: (items: any[]) => items,
    filterProjects: (items: any[]) => items,
  }),
}))

const pf = { id: 'pf1', name: 'Default Portfolio', description: '', owner: 'o', reporting_start_date: '2024-01-01', reporting_end_date: '2026-12-31', program_count: 1, version: 1, created_at: '', updated_at: '' }
const pg = { id: 'pg1', name: 'Customer Experience', portfolio_id: 'pf1', business_sponsor: 'b', program_manager: 'm', technical_lead: 't', start_date: '2024-01-01', end_date: '2025-12-31', version: 1, created_at: '', updated_at: '' }
const pj = { id: 'pj1', name: 'CRM System Upgrade', program_id: 'pg1', business_sponsor: 'b', project_manager: 'p', technical_lead: 't', cost_center_code: 'CC-1', start_date: '2024-01-01', end_date: '2025-06-30', version: 1, created_at: '', updated_at: '' }

const makeStore = () =>
  createTestStore({
    auth: {
      user: { id: '1', username: 'admin', email: 'a@e.c', roles: ['ADMIN'], permissions: [] },
      token: 't',
      isAuthenticated: true,
    },
  })

describe('HierarchyTree', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockNavigate.mockClear()
    vi.mocked(portfoliosApi.list).mockResolvedValue({ items: [pf], total: 1, page: 1, size: 1000, pages: 1 } as any)
    vi.mocked(programsApi.list).mockResolvedValue({ items: [pg], total: 1, page: 1, size: 1000, pages: 1 } as any)
    vi.mocked(projectsApi.list).mockResolvedValue({ items: [pj], total: 1, page: 1, size: 1000, pages: 1 } as any)
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('auto-expands ancestors of the active project and highlights it', async () => {
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })

    // Ancestors auto-expanded => all three names visible without any clicks
    await waitFor(() => {
      expect(screen.getByText('Default Portfolio')).toBeInTheDocument()
      expect(screen.getByText('Customer Experience')).toBeInTheDocument()
      expect(screen.getByText('CRM System Upgrade')).toBeInTheDocument()
    })
    expect(screen.getByText('CRM System Upgrade').closest('[data-active="true"]')).not.toBeNull()
  })

  it('navigates when a row name is clicked', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.click(screen.getByText('Customer Experience'))
    expect(mockNavigate).toHaveBeenCalledWith('/programs/pg1', expect.anything())
  })

  it('arrow button collapses without navigating', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('CRM System Upgrade')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Collapse Customer Experience' }))
    await waitFor(() =>
      expect(screen.queryByText('CRM System Upgrade')).not.toBeInTheDocument()
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
