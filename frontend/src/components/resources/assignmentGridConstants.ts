export const ASSIGNMENTS_GRID_PRIMARY_WIDTH = 180
export const ASSIGNMENTS_GRID_TYPE_WIDTH = 52
export const ASSIGNMENTS_GRID_AGGREGATE_TYPE_WIDTH = 76
export const ASSIGNMENTS_GRID_DATE_WIDTH = 42
export const ASSIGNMENTS_GRID_WEEK_WIDTH = 70
export const ASSIGNMENTS_GRID_MONTH_WIDTH = 50
export const ASSIGNMENTS_GRID_ROW_HEIGHT = 24
export const ASSIGNMENTS_GRID_HEADER_HEIGHT = 26
export const ASSIGNMENTS_GRID_VIEW_TOGGLE_HEIGHT = 34
export const ASSIGNMENTS_GRID_CELL_PADDING = '1px 4px'
export const ASSIGNMENTS_GRID_MAX_HEIGHT = 'calc(100vh - 300px)'
export const ASSIGNMENTS_GRID_WEEKEND_BG = '#edf1f5'
export const ASSIGNMENTS_GRID_TOTAL_WEEKEND_BG = '#dfeae3'
export const ASSIGNMENTS_GRID_BOUNDARY_COLOR = '#66778b'
export const ASSIGNMENTS_GRID_REPORTING_BOUNDARY_COLOR = '#d32f2f'
export const ASSIGNMENTS_GRID_PROJECT_START_COLOR = '#2e7d32'
export const ASSIGNMENTS_GRID_PROJECT_END_COLOR = '#d32f2f'
export const ASSIGNMENTS_GRID_WARNING_MARKER_COLOR = '#a66300'

/**
 * CSS table borders paint inward from their column edge, while SVG strokes
 * are centered on their coordinate. Center a 2px overlay on the same painted
 * pixels as the table border, retaining a visible stroke at the plot origin.
 */
export const getAssignmentsGridBoundaryStrokeCenter = (
  boundaryX: number,
): number => boundaryX <= 0 ? 1 : boundaryX - 1
