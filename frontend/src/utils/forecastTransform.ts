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
 * Options for labor/non-labor toggle in transformForecastData
 */
export interface LaborToggle {
  laborOn: boolean
  nonlaborOn: boolean
}

/**
 * Apply labor/non-labor toggle to a CategoryBreakdown
 * @param b - The category breakdown to filter
 * @param t - The toggle options
 * @returns A new CategoryBreakdown with capital/expense/total computed from the toggle
 */
function applyToggle(b: CategoryBreakdown, t: LaborToggle): CategoryBreakdown {
  const capital = (t.laborOn ? b.labor_capital : 0) + (t.nonlaborOn ? b.nonlabor_capital : 0)
  const expense = (t.laborOn ? b.labor_expense : 0) + (t.nonlaborOn ? b.nonlabor_expense : 0)
  return { ...b, capital, expense, total: capital + expense }
}

/**
 * Transform forecast API response into financial table data
 *
 * This function:
 * - Maps API response fields to UI-friendly names
 * - Calculates currentForecast as actuals + forecast for each category
 * - Calculates variance as budget - currentForecast for each category
 * - Applies labor/non-labor toggle filtering to capital/expense/total values
 *
 * @param apiResponse - The forecast API response
 * @param options - Toggle options (default: both labor and non-labor enabled)
 * @returns Transformed financial table data
 *
 * Requirements: 4.4, 4.5, 6.4
 */
export function transformForecastData(
  apiResponse: ForecastApiResponse,
  options: LaborToggle = { laborOn: true, nonlaborOn: true },
): FinancialTableData {
  const { budget, actual, forecast } = apiResponse

  // Apply toggle filtering to each category
  const budgetToggled = applyToggle(budget, options)
  const actualToggled = applyToggle(actual, options)
  const forecastToggled = applyToggle(forecast, options)

  // Calculate current forecast: actuals + forecast (Requirement 4.4)
  const currentForecast: CategoryBreakdown = {
    ...actualToggled,
    total: actualToggled.total + forecastToggled.total,
    capital: actualToggled.capital + forecastToggled.capital,
    expense: actualToggled.expense + forecastToggled.expense
  }

  // Calculate variance: budget - currentForecast (Requirement 4.5)
  const variance: CategoryBreakdown = {
    ...budgetToggled,
    total: budgetToggled.total - currentForecast.total,
    capital: budgetToggled.capital - currentForecast.capital,
    expense: budgetToggled.expense - currentForecast.expense
  }

  return {
    budget: budgetToggled,
    actuals: actualToggled,
    forecast: forecastToggled,
    currentForecast,
    variance
  }
}
