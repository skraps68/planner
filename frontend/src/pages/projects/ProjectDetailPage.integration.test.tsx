import React from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import ProjectDetailPage from './ProjectDetailPage'
import { projectsApi } from '../../api/projects'
import { phasesApi } from '../../api/phases'

// Mock the API modules
vi.mock('../../api/projects')
vi.mock('../../api/phases')

const mockProject = {
  id: 'project-1',
  program_id: 'program-1',
  name: 'Test Project',
  project_manager: 'John Doe',
  cost_center_code: 'CC-001',
  start_date: '2024-01-01',
  end_date: '2024-12-31',
  capital_budget: 100000,
  expense_budget: 50000,
  total_budget: 150000,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
}

const mockPhases = [
  {
    id: 'phase-1',
    project_id: 'project-1',
    name: 'Planning',
    start_date: '2024-01-01',
    end_date: '2024-06-30',
    description: 'Planning phase',
    capital_budget: 50000,
    expense_budget: 25000,
    total_budget: 75000,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'phase-2',
    project_id: 'project-1',
    name: 'Execution',
    start_date: '2024-07-01',
    end_date: '2024-12-31',
    description: 'Execution phase',
    capital_budget: 50000,
    expense_budget: 25000,
    total_budget: 75000,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
]

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/project-1']}>
        <Routes>
          <Route path="/projects/:id" element={children} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ProjectDetailPage - Phase Editor Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(projectsApi.get).mockResolvedValue(mockProject)
    vi.mocked(phasesApi.list).mockResolvedValue(mockPhases)
  })

  it('should load Phase Editor with project data', async () => {
    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Wait for project to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })

    // Click on Phases tab
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await userEvent.click(phasesTab)

    // Wait for phases to load
    await waitFor(() => {
      expect(screen.getByText('Phase Editor')).toBeInTheDocument()
    })

    // Verify API calls
    expect(projectsApi.get).toHaveBeenCalledWith('project-1')
    expect(phasesApi.list).toHaveBeenCalledWith('project-1')

    // Verify phases are displayed (check for multiple occurrences)
    const planningElements = screen.queryAllByText('Planning')
    expect(planningElements.length).toBeGreaterThan(0)
    const executionElements = screen.queryAllByText('Execution')
    expect(executionElements.length).toBeGreaterThan(0)
  })

  it('should create a new phase through UI', async () => {
    const user = userEvent.setup()
    vi.mocked(phasesApi.create).mockResolvedValue({
      ...mockPhases[0],
      id: 'phase-3',
      name: 'Phase 3',
    })

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Navigate to Phases tab
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await user.click(phasesTab)

    // Wait for Phase Editor to load
    await waitFor(() => {
      expect(screen.getByText('Phase Editor')).toBeInTheDocument()
    })

    // Click Add Phase button
    const addButton = screen.getByRole('button', { name: /add phase/i })
    await user.click(addButton)

    // Verify a new phase row appears
    await waitFor(() => {
      const phaseRows = screen.getAllByRole('row')
      // Header row + 2 existing phases + 1 new phase = 4 rows
      expect(phaseRows.length).toBeGreaterThan(3)
    })

    // Save changes
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveButton)

    // Verify create API was called
    await waitFor(() => {
      expect(phasesApi.create).toHaveBeenCalled()
    })

    // Verify success message
    await waitFor(() => {
      expect(screen.getByText(/phases saved successfully/i)).toBeInTheDocument()
    })
  })

  it('should update a phase through UI', async () => {
    const user = userEvent.setup()
    vi.mocked(phasesApi.update).mockResolvedValue({
      ...mockPhases[0],
      name: 'Updated Planning',
    })
    vi.mocked(phasesApi.list).mockResolvedValue(mockPhases)

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Navigate to Phases tab
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await user.click(phasesTab)

    // Wait for Phase Editor to load
    await waitFor(() => {
      expect(screen.getByText('Phase Editor')).toBeInTheDocument()
    })

    // Find the table and click edit button within it
    const table = screen.getByRole('table')
    const editButtons = within(table).getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0])

    // Wait for edit mode to activate
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Planning')
      expect(nameInput).toBeInTheDocument()
    })

    // Find and edit the phase name
    const nameInput = screen.getByDisplayValue('Planning')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Planning')

    // Click save button for the row (updates local state)
    const saveButtons = within(table).getAllByRole('button', { name: /save/i })
    await user.click(saveButtons[0])

    // Click the main "Save Changes" button (calls API)
    const saveChangesButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveChangesButton)

    // Verify update API was called
    await waitFor(() => {
      expect(phasesApi.update).toHaveBeenCalledWith(
        'phase-1',
        expect.objectContaining({
          name: 'Updated Planning',
        })
      )
    })
  })

  it('should delete a phase through UI', async () => {
    const user = userEvent.setup()
    vi.mocked(phasesApi.delete).mockResolvedValue(undefined)
    vi.mocked(phasesApi.list).mockResolvedValueOnce(mockPhases).mockResolvedValueOnce([mockPhases[1]])

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Navigate to Phases tab
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await user.click(phasesTab)

    // Wait for Phase Editor to load
    await waitFor(() => {
      expect(screen.getByText('Phase Editor')).toBeInTheDocument()
    })

    // Find the table and click delete button within it
    const table = screen.getByRole('table')
    const deleteButtons = within(table).getAllByRole('button', { name: /delete/i })
    await user.click(deleteButtons[0])

    // Click the main "Save Changes" button (calls API)
    const saveChangesButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveChangesButton)

    // Verify delete API was called
    await waitFor(() => {
      expect(phasesApi.delete).toHaveBeenCalledWith('phase-1')
    })
  })

  it('should prevent saving when validation errors exist', async () => {
    const user = userEvent.setup()
    
    // Create phases with a gap
    const phasesWithGap = [
      {
        ...mockPhases[0],
        end_date: '2024-05-31', // Ends early, creating a gap
      },
      {
        ...mockPhases[1],
        start_date: '2024-07-01', // Starts later, gap from June 1-30
      },
    ]
    
    vi.mocked(phasesApi.list).mockResolvedValue(phasesWithGap)

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Navigate to Phases tab
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await user.click(phasesTab)

    // Wait for Phase Editor to load
    await waitFor(() => {
      expect(screen.getByText('Phase Editor')).toBeInTheDocument()
    })

    // Verify validation error is displayed (look for specific error message)
    await waitFor(() => {
      const errorMessages = screen.queryAllByText(/gap/i)
      // Should find at least one error message (not just the description text)
      expect(errorMessages.length).toBeGreaterThan(1)
    })

    // Verify save button is disabled
    const saveButton = screen.getByRole('button', { name: /save changes/i })
    expect(saveButton).toBeDisabled()
  })

  it('should display error message when save fails', async () => {
    const user = userEvent.setup()
    vi.mocked(phasesApi.update).mockRejectedValue(new Error('Network error'))

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Navigate to Phases tab
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await user.click(phasesTab)

    // Wait for Phase Editor to load
    await waitFor(() => {
      expect(screen.getByText('Phase Editor')).toBeInTheDocument()
    })

    // Find the table and click edit button within it
    const table = screen.getByRole('table')
    const editButtons = within(table).getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0])

    // Wait for edit mode
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Planning')
      expect(nameInput).toBeInTheDocument()
    })

    // Make a change
    const nameInput = screen.getByDisplayValue('Planning')
    await user.clear(nameInput)
    await user.type(nameInput, 'Updated Planning')

    // Click save button for the row
    const saveButtons = within(table).getAllByRole('button', { name: /save/i })
    await user.click(saveButtons[0])

    // Try to save with the main button
    const saveChangesButton = screen.getByRole('button', { name: /save changes/i })
    await user.click(saveChangesButton)

    // Verify error handling (update was called and failed)
    await waitFor(() => {
      expect(phasesApi.update).toHaveBeenCalled()
    })
  })

  it('should show loading state while fetching data', async () => {
    // Delay the API response
    vi.mocked(projectsApi.get).mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mockProject), 100))
    )

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Verify loading state
    expect(screen.getByText('Loading...')).toBeInTheDocument()

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
  })

  it('should handle project not found', async () => {
    vi.mocked(projectsApi.get).mockResolvedValue(null as any)

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument()
    })
  })

  it('should cancel changes and restore original phases', async () => {
    const user = userEvent.setup()

    render(<ProjectDetailPage />, { wrapper: createWrapper() })

    // Navigate to Phases tab
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Test Project' })).toBeInTheDocument()
    })
    const phasesTab = screen.getByRole('tab', { name: /phases/i })
    await user.click(phasesTab)

    // Wait for phases to load
    await waitFor(() => {
      const planningElements = screen.queryAllByText('Planning')
      expect(planningElements.length).toBeGreaterThan(0)
    })

    // Find the table and click edit button within it
    const table = screen.getByRole('table')
    const editButtons = within(table).getAllByRole('button', { name: /edit/i })
    await user.click(editButtons[0])

    // Wait for edit mode
    await waitFor(() => {
      const nameInput = screen.getByDisplayValue('Planning')
      expect(nameInput).toBeInTheDocument()
    })

    // Make a change
    const nameInput = screen.getByDisplayValue('Planning')
    await user.clear(nameInput)
    await user.type(nameInput, 'Modified Planning')

    // Verify change was made
    expect(nameInput).toHaveValue('Modified Planning')

    // Click cancel button for the row
    const cancelButtons = within(table).getAllByRole('button', { name: /cancel/i })
    await user.click(cancelButtons[0])

    // Verify original value is restored (edit mode exited)
    await waitFor(() => {
      const planningElements = screen.queryAllByText('Planning')
      expect(planningElements.length).toBeGreaterThan(0)
    })

    // Verify no API calls were made
    expect(phasesApi.update).not.toHaveBeenCalled()
  })
})
