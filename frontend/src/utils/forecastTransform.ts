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
 * @returns A new CategoryBreakdown with sub-keys and aggregates computed from the toggle
 */
function applyToggle(b: CategoryBreakdown, t: LaborToggle): CategoryBreakdown {
  const labor_capital = t.laborOn ? b.labor_capital : 0
  const labor_expense = t.laborOn ? b.labor_expense : 0
  const nonlabor_capital = t.nonlaborOn ? b.nonlabor_capital : 0
  const nonlabor_expense = t.nonlaborOn ? b.nonlabor_expense : 0
  const capital = labor_capital + nonlabor_capital
  const expense = labor_expense + nonlabor_expense
  return { ...b, labor_capital, labor_expense, nonlabor_capital, nonlabor_expense, capital, expense, total: capital + expense }
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
    labor_capital: actualToggled.labor_capital + forecastToggled.labor_capital,
    labor_expense: actualToggled.labor_expense + forecastToggled.labor_expense,
    nonlabor_capital: actualToggled.nonlabor_capital + forecastToggled.nonlabor_capital,
    nonlabor_expense: actualToggled.nonlabor_expense + forecastToggled.nonlabor_expense,
    capital: actualToggled.capital + forecastToggled.capital,
    expense: actualToggled.expense + forecastToggled.expense,
    total: actualToggled.total + forecastToggled.total
  }

  // Calculate variance: budget - currentForecast (Requirement 4.5)
  const variance: CategoryBreakdown = {
    labor_capital: budgetToggled.labor_capital - currentForecast.labor_capital,
    labor_expense: budgetToggled.labor_expense - currentForecast.labor_expense,
    nonlabor_capital: budgetToggled.nonlabor_capital - currentForecast.nonlabor_capital,
    nonlabor_expense: budgetToggled.nonlabor_expense - currentForecast.nonlabor_expense,
    capital: budgetToggled.capital - currentForecast.capital,
    expense: budgetToggled.expense - currentForecast.expense,
    total: budgetToggled.total - currentForecast.total
  }

  return {
    budget: budgetToggled,
    actuals: actualToggled,
    forecast: forecastToggled,
    currentForecast,
    variance
  }
}
