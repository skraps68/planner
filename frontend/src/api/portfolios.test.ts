import { describe, it, expect, vi, beforeEach } from 'vitest'
import { portfoliosApi } from './portfolios'
import apiClient from './client'
import { Portfolio, PortfolioCreate, PortfolioUpdate } from '../types/portfolio'
import { Program } from '../types'

// Mock the API client
vi.mock('./client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}))

describe('Portfolios API Client', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('list', () => {
    it('should fetch list of portfolios with pagination', async () => {
      const mockResponse = {
        data: {
          items: [
            {
              id: '1',
              name: 'Portfolio 1',
              description: 'Description 1',
              owner: 'Owner 1',
              reporting_start_date: '2024-01-01',
              reporting_end_date: '2024-12-31',
              program_count: 5,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-01T00:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          size: 10,
          pages: 1,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.list({ skip: 0, limit: 10 })

      expect(apiClient.get).toHaveBeenCalledWith('/portfolios', {
        params: { skip: 0, limit: 10 },
      })
      expect(result).toEqual(mockResponse.data)
      expect(result.items).toHaveLength(1)
      expect(result.items[0].name).toBe('Portfolio 1')
    })

    it('should fetch list of portfolios without params', async () => {
      const mockResponse = {
        data: {
          items: [],
          total: 0,
          page: 1,
          size: 10,
          pages: 0,
        },
      }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.list()

      expect(apiClient.get).toHaveBeenCalledWith('/portfolios', {
        params: undefined,
      })
      expect(result.items).toHaveLength(0)
    })
  })

  describe('get', () => {
    it('should fetch a single portfolio by id', async () => {
      const mockPortfolio: Portfolio = {
        id: '123',
        name: 'Test Portfolio',
        description: 'Test Description',
        owner: 'Test Owner',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
        program_count: 3,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const mockResponse = { data: mockPortfolio }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.get('123')

      expect(apiClient.get).toHaveBeenCalledWith('/portfolios/123')
      expect(result).toEqual(mockPortfolio)
      expect(result.id).toBe('123')
      expect(result.name).toBe('Test Portfolio')
    })
  })

  describe('create', () => {
    it('should create a new portfolio', async () => {
      const createData: PortfolioCreate = {
        name: 'New Portfolio',
        description: 'New Description',
        owner: 'New Owner',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
      }

      const mockCreatedPortfolio: Portfolio = {
        id: '456',
        ...createData,
        program_count: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      }

      const mockResponse = { data: mockCreatedPortfolio }

      vi.mocked(apiClient.post).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.create(createData)

      expect(apiClient.post).toHaveBeenCalledWith('/portfolios', createData)
      expect(result).toEqual(mockCreatedPortfolio)
      expect(result.name).toBe('New Portfolio')
      expect(result.id).toBe('456')
    })
  })

  describe('update', () => {
    it('should update an existing portfolio', async () => {
      const updateData: PortfolioUpdate = {
        name: 'Updated Portfolio',
        description: 'Updated Description',
      }

      const mockUpdatedPortfolio: Portfolio = {
        id: '789',
        name: 'Updated Portfolio',
        description: 'Updated Description',
        owner: 'Original Owner',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
        program_count: 2,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }

      const mockResponse = { data: mockUpdatedPortfolio }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.update('789', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/portfolios/789', updateData)
      expect(result).toEqual(mockUpdatedPortfolio)
      expect(result.name).toBe('Updated Portfolio')
    })

    it('should update portfolio with partial data', async () => {
      const updateData: PortfolioUpdate = {
        owner: 'New Owner',
      }

      const mockUpdatedPortfolio: Portfolio = {
        id: '789',
        name: 'Original Portfolio',
        description: 'Original Description',
        owner: 'New Owner',
        reporting_start_date: '2024-01-01',
        reporting_end_date: '2024-12-31',
        program_count: 2,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      }

      const mockResponse = { data: mockUpdatedPortfolio }

      vi.mocked(apiClient.put).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.update('789', updateData)

      expect(apiClient.put).toHaveBeenCalledWith('/portfolios/789', updateData)
      expect(result.owner).toBe('New Owner')
    })
  })

  describe('delete', () => {
    it('should delete a portfolio', async () => {
      vi.mocked(apiClient.delete).mockResolvedValueOnce({ data: undefined })

      await portfoliosApi.delete('999')

      expect(apiClient.delete).toHaveBeenCalledWith('/portfolios/999')
    })
  })

  describe('getPrograms', () => {
    it('should fetch programs for a portfolio', async () => {
      const mockPrograms: Program[] = [
        {
          id: 'prog1',
          name: 'Program 1',
          business_sponsor: 'Sponsor 1',
          program_manager: 'Manager 1',
          technical_lead: 'Lead 1',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'prog2',
          name: 'Program 2',
          business_sponsor: 'Sponsor 2',
          program_manager: 'Manager 2',
          technical_lead: 'Lead 2',
          start_date: '2024-01-01',
          end_date: '2024-12-31',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ]

      const mockResponse = { data: mockPrograms }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.getPrograms('portfolio123')

      expect(apiClient.get).toHaveBeenCalledWith('/portfolios/portfolio123/programs')
      expect(result).toEqual(mockPrograms)
      expect(result).toHaveLength(2)
      expect(result[0].name).toBe('Program 1')
    })

    it('should return empty array when portfolio has no programs', async () => {
      const mockResponse = { data: [] }

      vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)

      const result = await portfoliosApi.getPrograms('portfolio456')

      expect(apiClient.get).toHaveBeenCalledWith('/portfolios/portfolio456/programs')
      expect(result).toEqual([])
      expect(result).toHaveLength(0)
    })
  })

  describe('error handling', () => {
    it('should handle network errors on list', async () => {
      const error = new Error('Network error')
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(portfoliosApi.list()).rejects.toThrow('Network error')
    })

    it('should handle 404 errors on get', async () => {
      const error = { response: { status: 404, data: { detail: 'Portfolio not found' } } }
      vi.mocked(apiClient.get).mockRejectedValueOnce(error)

      await expect(portfoliosApi.get('nonexistent')).rejects.toEqual(error)
    })

    it('should handle validation errors on create', async () => {
      const error = {
        response: {
          status: 400,
          data: { detail: 'Validation error: name is required' },
        },
      }
      vi.mocked(apiClient.post).mockRejectedValueOnce(error)

      const invalidData = {} as PortfolioCreate

      await expect(portfoliosApi.create(invalidData)).rejects.toEqual(error)
    })

    it('should handle conflict errors on delete', async () => {
      const error = {
        response: {
          status: 409,
          data: { detail: 'Cannot delete portfolio with associated programs' },
        },
      }
      vi.mocked(apiClient.delete).mockRejectedValueOnce(error)

      await expect(portfoliosApi.delete('portfolio-with-programs')).rejects.toEqual(error)
    })
  })
})
