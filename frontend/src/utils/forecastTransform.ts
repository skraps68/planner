import { ForecastApiResponse, CategoryBreakdown } from '../api/forecast'

/**
 * Transformed financial data for UI display
 */
export interface FinancialTableData {
  budget: CategoryBreakdown
  actuals: CategoryBreakdown
  forecast: CategoryBreakdown
  currentForecast: CategoryBreakdown
  variance: CategoryBreakdown
}

/**
 * Transform forecast API response into financial table data
 * 
 * This function:
 * - Maps API response fields to UI-friendly names
 * - Calculates currentForecast as actuals + forecast for each category
 * - Calculates variance as budget - currentForecast for each category
 * 
 * @param apiResponse - The forecast API response
 * @returns Transformed financial table data
 * 
 * Requirements: 4.4, 4.5, 6.4
 */
export function transformForecastData(apiResponse: ForecastApiResponse): FinancialTableData {
  const { budget, actual, forecast } = apiResponse

  // Calculate current forecast: actuals + forecast (Requirement 4.4)
  const currentForecast: CategoryBreakdown = {
    total: actual.total + forecast.total,
    capital: actual.capital + forecast.capital,
    expense: actual.expense + forecast.expense
  }

  // Calculate variance: budget - currentForecast (Requirement 4.5)
  const variance: CategoryBreakdown = {
    total: budget.total - currentForecast.total,
    capital: budget.capital - currentForecast.capital,
    expense: budget.expense - currentForecast.expense
  }

  return {
    budget,
    actuals: actual,
    forecast,
    currentForecast,
    variance
  }
}
