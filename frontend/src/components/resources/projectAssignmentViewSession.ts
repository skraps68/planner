import type { AssignmentViewMode } from './assignmentPeriods'

export interface ProjectAssignmentViewState {
  viewMode: AssignmentViewMode
  chartVisible: boolean
}

const DEFAULT_PROJECT_ASSIGNMENT_VIEW: ProjectAssignmentViewState = {
  viewMode: 'daily',
  chartVisible: true,
}

const projectAssignmentViewKey = (projectId: string) =>
  `projectAssignmentView:${projectId}`

const isAssignmentViewMode = (value: unknown): value is AssignmentViewMode =>
  value === 'daily' || value === 'weekly' || value === 'monthly'

export const loadProjectAssignmentView = (
  projectId: string,
  fallback: ProjectAssignmentViewState = DEFAULT_PROJECT_ASSIGNMENT_VIEW,
): ProjectAssignmentViewState => {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(projectAssignmentViewKey(projectId)) ?? 'null',
    )
    return {
      viewMode: isAssignmentViewMode(saved?.viewMode)
        ? saved.viewMode
        : fallback.viewMode,
      chartVisible: typeof saved?.chartVisible === 'boolean'
        ? saved.chartVisible
        : fallback.chartVisible,
    }
  } catch {
    return fallback
  }
}

export const saveProjectAssignmentView = (
  projectId: string,
  state: ProjectAssignmentViewState,
) => {
  sessionStorage.setItem(projectAssignmentViewKey(projectId), JSON.stringify(state))
}
