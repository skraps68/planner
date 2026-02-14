import { describe, it, expect, vi, beforeEach } from 'vitest'
import { programsApi } from './programs'
import { projectsApi } from './projects'
import { phasesApi } from './phases'
import { resourcesApi } from './resources'
import { workersApi, workerTypesApi } from './workers'
import { assignmentsApi } from './assignments'
import { ratesApi } from './rates'
import { actualsApi } from './actuals'
import { usersApi } from './users'
import apiClient from './client'

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('API Client Version Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Programs API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        name: 'Updated Program',
        version: 3,
      }

      const mockResponse = {
        data: {
          id: 'prog1',
          name: 'Updated Program',
          business_sponsor: 'Sponsor',
          program_manager: 'Manager',
          technical_lead: 'Lead',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          portfolio_id: 'port1',
          version: 4,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await programsApi.update('prog1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/programs/prog1', expect.objectContaining({ version: 3 }))
      expect(result.version).toBe(4)
    })

    it('should store version from get response', async () => {
      const mockResponse = {
        data: {
          id: 'prog1',
          name: 'Program 1',
          business_sponsor: 'Sponsor',
          program_manager: 'Manager',
          technical_lead: 'Lead',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          portfolio_id: 'port1',
          version: 2,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)

      const result = await programsApi.get('prog1')

      expect(result.version).toBe(2)
      expect(result).toHaveProperty('version')
    })
  })

  describe('Projects API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        name: 'Updated Project',
        version: 5,
      }

      const mockResponse = {
        data: {
          id: 'proj1',
          program_id: 'prog1',
          name: 'Updated Project',
          business_sponsor: 'Sponsor',
          project_manager: 'Manager',
          technical_lead: 'Lead',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          cost_center_code: 'CC001',
          version: 6,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await projectsApi.update('proj1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/projects/proj1', expect.objectContaining({ version: 5 }))
      expect(result.version).toBe(6)
    })
  })

  describe('Phases API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        name: 'Updated Phase',
        version: 2,
      }

      const mockResponse = {
        data: {
          id: 'phase1',
          project_id: 'proj1',
          name: 'Updated Phase',
          start_date: '2024-01-01',
          end_date: '2024-03-31',
          capital_budget: 100000,
          expense_budget: 50000,
          total_budget: 150000,
          version: 3,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await phasesApi.update('phase1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/phases/phase1', expect.objectContaining({ version: 2 }))
      expect(result.version).toBe(3)
    })
  })

  describe('Resources API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        name: 'Updated Resource',
        version: 1,
      }

      const mockResponse = {
        data: {
          id: 'res1',
          name: 'Updated Resource',
          resource_type: 'LABOR' as const,
          version: 2,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await resourcesApi.update('res1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/resources/res1', expect.objectContaining({ version: 1 }))
      expect(result.version).toBe(2)
    })
  })

  describe('Workers API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        name: 'Updated Worker',
        version: 4,
      }

      const mockResponse = {
        data: {
          id: 'worker1',
          external_id: 'EXT001',
          name: 'Updated Worker',
          worker_type_id: 'type1',
          version: 5,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await workersApi.update('worker1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/workers/worker1', expect.objectContaining({ version: 4 }))
      expect(result.version).toBe(5)
    })
  })

  describe('WorkerTypes API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        type: 'Updated Type',
        version: 1,
      }

      const mockResponse = {
        data: {
          id: 'type1',
          type: 'Updated Type',
          description: 'Description',
          version: 2,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await workerTypesApi.update('type1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/workers/types/type1', expect.objectContaining({ version: 1 }))
      expect(result.version).toBe(2)
    })
  })

  describe('Assignments API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        capital_percentage: 60,
        version: 7,
      }

      const mockResponse = {
        data: {
          id: 'assign1',
          resource_id: 'res1',
          project_id: 'proj1',
          project_phase_id: 'phase1',
          assignment_date: '2024-01-15',
          capital_percentage: 60,
          expense_percentage: 40,
          version: 8,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await assignmentsApi.update('assign1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/assignments/assign1', expect.objectContaining({ version: 7 }))
      expect(result.version).toBe(8)
    })
  })

  describe('Actuals API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        allocation_percentage: 75,
        version: 3,
      }

      const mockResponse = {
        data: {
          id: 'actual1',
          project_id: 'proj1',
          external_worker_id: 'EXT001',
          worker_name: 'Worker Name',
          actual_date: '2024-01-15',
          allocation_percentage: 75,
          actual_cost: 1000,
          capital_amount: 750,
          expense_amount: 250,
          version: 4,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await actualsApi.updateActual('actual1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/actuals/actual1', expect.objectContaining({ version: 3 }))
      expect(result.version).toBe(4)
    })
  })

  describe('Users API', () => {
    it('should include version in update requests', async () => {
      const updateData = {
        username: 'updated_user',
        version: 2,
      }

      const mockResponse = {
        data: {
          id: 'user1',
          username: 'updated_user',
          email: 'user@example.com',
          is_active: true,
          user_roles: [],
          version: 3,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await usersApi.updateUser('user1', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/users/user1', expect.objectContaining({ version: 2 }))
      expect(result.version).toBe(3)
    })
  })

  describe('Version field presence in responses', () => {
    it('should have version field in all entity list responses', async () => {
      const mockProgramsResponse = {
        data: {
          items: [{
            id: 'prog1',
            name: 'Program 1',
            business_sponsor: 'Sponsor',
            program_manager: 'Manager',
            technical_lead: 'Lead',
            start_date: '2024-01-01',
            end_date: '2024-12-31',
            portfolio_id: 'port1',
            version: 1,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          }],
          total: 1,
          page: 1,
          size: 10,
          pages: 1,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockProgramsResponse)

      const programs = await programsApi.list()

      expect(programs.items[0]).toHaveProperty('version')
      expect(programs.items[0].version).toBe(1)
    })

    it('should have version field in create responses', async () => {
      const createData = {
        name: 'New Resource',
        resource_type: 'LABOR' as const,
      }

      const mockResponse = {
        data: {
          id: 'res1',
          name: 'New Resource',
          resource_type: 'LABOR' as const,
          version: 1,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      }

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse)

      const result = await resourcesApi.create(createData)

      expect(result).toHaveProperty('version')
      expect(result.version).toBe(1)
    })
  })
})
