/**
 * Calendar transformation utilities for resource assignment calendar view
 */

/**
 * Generates an array of dates from startDate to endDate (inclusive)
 * @param startDate - The first date in the range
 * @param endDate - The last date in the range
 * @returns Array of Date objects, one for each day in the range (normalized to UTC midnight)
 */
export function generateDateRange(startDate: Date, endDate: Date): Date[] {
  const dates: Date[] = []
  
  // Normalize inputs to UTC midnight to avoid timezone issues
  // Use UTC methods to extract date components
  const start = new Date(Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate()
  ))
  const end = new Date(Date.UTC(
    endDate.getUTCFullYear(),
    endDate.getUTCMonth(),
    endDate.getUTCDate()
  ))
  
  // Handle invalid ranges
  if (start > end) {
    return dates
  }
  
  // Generate dates
  const currentDate = new Date(start)
  while (currentDate <= end) {
    dates.push(new Date(currentDate))
    currentDate.setUTCDate(currentDate.getUTCDate() + 1)
  }
  
  return dates
}

/**
 * Generates a composite key for cell lookup
 * @param resourceId - The resource identifier
 * @param date - The date (Date object or ISO string)
 * @param costTreatment - Either 'capital' or 'expense'
 * @returns A unique string key for the cell
 */
export function getCellKey(
  resourceId: string,
  date: Date | string,
  costTreatment: 'capital' | 'expense'
): string {
  let dateStr: string
  if (typeof date === 'string') {
    dateStr = date
  } else {
    // Extract UTC date components to avoid timezone issues
    const year = date.getUTCFullYear()
    const month = String(date.getUTCMonth() + 1).padStart(2, '0')
    const day = String(date.getUTCDate()).padStart(2, '0')
    dateStr = `${year}-${month}-${day}`
  }
  return `${resourceId}:${dateStr}:${costTreatment}`
}

/**
 * Resource information
 */
export interface ResourceInfo {
  resourceId: string
  resourceName: string
}

/**
 * Cell data containing assignment information
 */
export interface CellData {
  assignmentId?: string
  capitalPercentage: number
  expensePercentage: number
}

/**
 * Grid data structure for calendar view
 */
export interface GridData {
  resources: ResourceInfo[]
  dates: Date[]
  cells: Map<string, CellData>
}

/**
 * Resource assignment from API
 */
export interface ResourceAssignment {
  id?: string
  resource_id: string
  resource_name?: string
  assignment_date: string
  capital_percentage: number
  expense_percentage: number
}

/**
 * Transforms flat assignment list into a 2D grid structure
 * @param assignments - Array of resource assignments
 * @param startDate - Project start date
 * @param endDate - Project end date
 * @returns GridData structure for rendering
 */
export function transformToGrid(
  assignments: ResourceAssignment[],
  startDate: Date,
  endDate: Date
): GridData {
  // 1. Extract unique resources
  const resourceMap = new Map<string, ResourceInfo>()
  assignments.forEach(a => {
    if (!resourceMap.has(a.resource_id)) {
      resourceMap.set(a.resource_id, {
        resourceId: a.resource_id,
        resourceName: a.resource_name || a.resource_id
      })
    }
  })
  
  // 2. Generate date range
  const dates = generateDateRange(startDate, endDate)
  
  // 3. Create cell map with composite keys
  // Store capital and expense as separate entries for proper lookup
  const cells = new Map<string, CellData>()
  assignments.forEach(a => {
    const baseData = {
      assignmentId: a.id,
      capitalPercentage: a.capital_percentage || 0,
      expensePercentage: a.expense_percentage || 0
    }
    
    // Store under capital key (we'll look up both from this)
    const capitalKey = getCellKey(a.resource_id, a.assignment_date, 'capital')
    cells.set(capitalKey, baseData)
    
    // Also store under expense key for direct lookup
    const expenseKey = getCellKey(a.resource_id, a.assignment_date, 'expense')
    cells.set(expenseKey, baseData)
  })
  
  return {
    resources: Array.from(resourceMap.values()),
    dates,
    cells
  }
}

/**
 * Gets the cell value for a specific resource, date, and cost treatment
 * @param gridData - The grid data structure
 * @param resourceId - The resource identifier
 * @param date - The date
 * @param costTreatment - Either 'capital' or 'expense'
 * @returns The percentage value (0 if no assignment exists)
 */
export function getCellValue(
  gridData: GridData,
  resourceId: string,
  date: Date,
  costTreatment: 'capital' | 'expense'
): number {
  const key = getCellKey(resourceId, date, costTreatment)
  const cellData = gridData.cells.get(key)
  
  if (!cellData) return 0
  
  return costTreatment === 'capital'
    ? cellData.capitalPercentage
    : cellData.expensePercentage
}
