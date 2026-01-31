import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { getProgramForecast, getProjectForecast } from './forecast'
import { apiClient } from './client'

// Mock the API client
vi.mock('./client', () => ({
  apiClient: {
    get: vi.fn()
  }
}))

describe('Forecast API - Property-Based Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Property 7: API Date Parameter', () => {
    // Feature: portfolio-dashboard, Property 7: API Date Parameter
    // Validates: Requirements 6.3
    it('should always set as_of_date parameter to today\'s date in ISO format for program forecast', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Generate random program IDs
          async (programId) => {
            // Mock successful API response
            const mockResponse = {
              data: {
                entity_id: programId,
                entity_name: 'Test Program',
                entity_type: 'program' as const,
                budget: { total: 1000, capital: 600, expense: 400 },
                actual: { total: 500, capital: 300, expense: 200 },
                forecast: { total: 400, capital: 250, expense: 150 },
                analysis: {
                  budget_remaining: 100,
                  forecast_variance: 100,
                  budget_utilization_percentage: 90,
                  forecast_to_budget_percentage: 90
                }
              }
            }
            
            vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)
            
            // Get today's date in ISO format
            const today = new Date().toISOString().split('T')[0]
            
            // Call the function with today's date
            await getProgramForecast(programId, today)
            
            // Verify the API was called with correct parameters
            expect(apiClient.get).toHaveBeenCalledWith(
              `/reports/forecast/program/${programId}`,
              {
                params: { as_of_date: today }
              }
            )
            
            // Verify the date format is YYYY-MM-DD
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            expect(today).toMatch(dateRegex)
          }
        ),
        { numRuns: 100 }
      )
    })

    // Feature: portfolio-dashboard, Property 7: API Date Parameter
    // Validates: Requirements 6.3
    it('should always set as_of_date parameter to today\'s date in ISO format for project forecast', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Generate random project IDs
          async (projectId) => {
            // Mock successful API response
            const mockResponse = {
              data: {
                entity_id: projectId,
                entity_name: 'Test Project',
                entity_type: 'project' as const,
                budget: { total: 1000, capital: 600, expense: 400 },
                actual: { total: 500, capital: 300, expense: 200 },
                forecast: { total: 400, capital: 250, expense: 150 },
                analysis: {
                  budget_remaining: 100,
                  forecast_variance: 100,
                  budget_utilization_percentage: 90,
                  forecast_to_budget_percentage: 90
                }
              }
            }
            
            vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)
            
            // Get today's date in ISO format
            const today = new Date().toISOString().split('T')[0]
            
            // Call the function with today's date
            await getProjectForecast(projectId, today)
            
            // Verify the API was called with correct parameters
            expect(apiClient.get).toHaveBeenCalledWith(
              `/reports/forecast/project/${projectId}`,
              {
                params: { as_of_date: today }
              }
            )
            
            // Verify the date format is YYYY-MM-DD
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            expect(today).toMatch(dateRegex)
          }
        ),
        { numRuns: 100 }
      )
    })

    // Feature: portfolio-dashboard, Property 7: API Date Parameter
    // Validates: Requirements 6.3
    it('should verify that any forecast API call uses ISO date format (YYYY-MM-DD)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.uuid(), // Generate random IDs
          fc.constantFrom('program', 'project'), // Test both endpoint types
          async (entityId, entityType) => {
            // Mock successful API response
            const mockResponse = {
              data: {
                entity_id: entityId,
                entity_name: `Test ${entityType}`,
                entity_type: entityType as 'program' | 'project',
                budget: { total: 1000, capital: 600, expense: 400 },
                actual: { total: 500, capital: 300, expense: 200 },
                forecast: { total: 400, capital: 250, expense: 150 },
                analysis: {
                  budget_remaining: 100,
                  forecast_variance: 100,
                  budget_utilization_percentage: 90,
                  forecast_to_budget_percentage: 90
                }
              }
            }
            
            vi.mocked(apiClient.get).mockResolvedValueOnce(mockResponse)
            
            // Get today's date in ISO format
            const today = new Date().toISOString().split('T')[0]
            
            // Call the appropriate function
            if (entityType === 'program') {
              await getProgramForecast(entityId, today)
            } else {
              await getProjectForecast(entityId, today)
            }
            
            // Extract the as_of_date parameter from the API call
            const callArgs = vi.mocked(apiClient.get).mock.calls[0]
            const asOfDate = callArgs[1]?.params?.as_of_date
            
            // Verify the date parameter exists
            expect(asOfDate).toBeDefined()
            
            // Verify the date format is YYYY-MM-DD
            const dateRegex = /^\d{4}-\d{2}-\d{2}$/
            expect(asOfDate).toMatch(dateRegex)
            
            // Verify it's a valid date
            const parsedDate = new Date(asOfDate)
            expect(parsedDate.toString()).not.toBe('Invalid Date')
            
            // Verify it's today's date
            expect(asOfDate).toBe(today)
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
