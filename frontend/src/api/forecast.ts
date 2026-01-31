import { apiClient } from './client'

/**
 * Category breakdown for financial metrics
 */
export interface CategoryBreakdown {
  total: number
  capital: number
  expense: number
}

/**
 * Analysis metrics from forecast API
 */
export interface ForecastAnalysis {
  budget_remaining: number
  forecast_variance: number
  budget_utilization_percentage: number
  forecast_to_budget_percentage: number
}

/**
 * API response from forecast endpoints
 */
export interface ForecastApiResponse {
  entity_id: string
  entity_name: string
  entity_type: 'project' | 'program'
  budget: CategoryBreakdown
  actual: CategoryBreakdown
  forecast: CategoryBreakdown
  analysis: ForecastAnalysis
}

/**
 * Get program-level forecast data
 * @param programId - The ID of the program
 * @param asOfDate - The date to use for splitting actuals from forecast (ISO format: YYYY-MM-DD)
 * @returns Promise with forecast data for the program
 */
export const getProgramForecast = async (
  programId: string,
  asOfDate: string
): Promise<ForecastApiResponse> => {
  const response = await apiClient.get(`/reports/forecast/program/${programId}`, {
    params: { as_of_date: asOfDate }
  })
  return response.data
}

/**
 * Get project-level forecast data
 * @param projectId - The ID of the project
 * @param asOfDate - The date to use for splitting actuals from forecast (ISO format: YYYY-MM-DD)
 * @returns Promise with forecast data for the project
 */
export const getProjectForecast = async (
  projectId: string,
  asOfDate: string
): Promise<ForecastApiResponse> => {
  const response = await apiClient.get(`/reports/forecast/project/${projectId}`, {
    params: { as_of_date: asOfDate }
  })
  return response.data
}
