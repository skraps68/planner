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

const pf = { id: 'pf1', name: 'Default Portfolio', description: '', owner: 'o', reporting_start_date: '2024-01-01', reporting_end_date: '2026-12-31', program_count: 1, version: 1, created_at: '', updated_at: '', business_id: '010000001' }
const pg = { id: 'pg1', name: 'Customer Experience', portfolio_id: 'pf1', business_sponsor: 'b', program_manager: 'm', technical_lead: 't', start_date: '2024-01-01', end_date: '2025-12-31', version: 1, created_at: '', updated_at: '', business_id: '020000001' }
const pg2 = { ...pg, id: 'pg2', name: 'Legacy Systems', business_id: '020000002' }
const pj = { id: 'pj1', name: 'CRM System Upgrade', program_id: 'pg1', business_sponsor: 'b', project_manager: 'p', technical_lead: 't', cost_center_code: 'CC-1', start_date: '2024-01-01', end_date: '2025-06-30', version: 1, created_at: '', updated_at: '', business_id: '030000001' }

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
    vi.mocked(programsApi.list).mockResolvedValue({ items: [pg, pg2], total: 2, page: 1, size: 1000, pages: 1 } as any)
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
    const activeProject = screen.getByText('CRM System Upgrade').closest('[data-active="true"]')
    expect(activeProject).not.toBeNull()
    expect(activeProject?.querySelector('[data-selection-outline]')).toHaveStyle({
      left: '48px',
    })
  })

  it('starts a selected program outline beside its expand control', async () => {
    render(<HierarchyTree activeType="program" activeId="pg1" />, {
      store: makeStore(),
      queryClient: createTestQueryClient(),
    })

    const activeProgram = (await screen.findByText('Customer Experience')).closest('[data-active="true"]')
    expect(activeProgram).not.toBeNull()
    expect(activeProgram?.querySelector('[data-selection-outline]')).toHaveStyle({
      left: '16px',
    })
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

describe('HierarchyTree filtering', () => {
  beforeEach(() => {
    sessionStorage.clear()
    mockNavigate.mockClear()
    vi.mocked(portfoliosApi.list).mockResolvedValue({ items: [pf], total: 1, page: 1, size: 1000, pages: 1 } as any)
    vi.mocked(programsApi.list).mockResolvedValue({ items: [pg, pg2], total: 2, page: 1, size: 1000, pages: 1 } as any)
    vi.mocked(projectsApi.list).mockResolvedValue({ items: [pj], total: 1, page: 1, size: 1000, pages: 1 } as any)
    window.HTMLElement.prototype.scrollIntoView = vi.fn()
  })

  it('filters to matches + ancestors, dims ancestors, hides the rest', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Filter…'), 'crm')

    await waitFor(() => {
      // match + ancestors visible, sibling program hidden
      expect(screen.getByText(/CRM/)).toBeInTheDocument()
      expect(screen.getByText('Customer Experience')).toBeInTheDocument()
      expect(screen.queryByText('Legacy Systems')).not.toBeInTheDocument()
    })
  })

  it('id mode: shows (business_id) prefix and matches ids', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: /toggle id mode/i }))
    await waitFor(() =>
      expect(screen.getByText(/\(020000001\)/)).toBeInTheDocument()
    )

    await user.type(screen.getByPlaceholderText('Filter…'), '0300000')
    await waitFor(() => {
      // The matched ID digits are wrapped in a highlight span, so match on the
      // row label's full text content rather than a single text node
      expect(
        screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === '(030000001) CRM System Upgrade')
      ).toBeInTheDocument()
      expect(screen.queryByText(/Legacy Systems/)).not.toBeInTheDocument()
      // ...and the ID match itself is highlighted
      const mark = document.querySelector('[data-highlight]')
      expect(mark).not.toBeNull()
      expect(mark!.textContent).toBe('0300000')
    })
  })

  it('clear button erases the filter and restores the full tree', async () => {
    const user = userEvent.setup()
    render(<HierarchyTree activeType="project" activeId="pj1" />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await waitFor(() => expect(screen.getByText('Customer Experience')).toBeInTheDocument())

    await user.type(screen.getByPlaceholderText('Filter…'), 'crm')
    await waitFor(() =>
      expect(screen.queryByText('Legacy Systems')).not.toBeInTheDocument()
    )

    await user.click(screen.getByRole('button', { name: /clear filter/i }))
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Filter…')).toHaveValue('')
      expect(screen.getByText('Legacy Systems')).toBeInTheDocument()
    })
    // Clear control hides when the filter is empty
    expect(screen.queryByRole('button', { name: /clear filter/i })).not.toBeInTheDocument()
  })

  it('renders collapse button only when onCollapse given, and calls it', async () => {
    const user = userEvent.setup()
    const onCollapse = vi.fn()
    render(<HierarchyTree activeType="project" activeId="pj1" onCollapse={onCollapse} />, {
      store: makeStore(), queryClient: createTestQueryClient(),
    })
    await user.click(await screen.findByRole('button', { name: /collapse tree/i }))
    expect(onCollapse).toHaveBeenCalled()
  })
})
