export type GridDensityPreference = 'compact' | 'standard' | 'comfortable'
export type AssignmentPeriodPreference = 'daily' | 'weekly' | 'monthly'
export type LandingDestination =
  | 'hierarchy'
  | 'workers'
  | 'reference_data'
  | 'users'
  | 'resources'
  | 'actuals'

export interface UserGridSettings {
  density?: GridDensityPreference
  columnOrder?: string[]
  columnVisibility?: Record<string, boolean>
  columnWidths?: Record<string, number>
}

export interface UserSettings {
  navigation?: {
    hierarchyPane?: {
      width?: number
      collapsed?: boolean
    }
    hierarchyLabelMode?: 'name' | 'business_id'
    landingDestination?: LandingDestination
  }
  lists?: {
    resources?: {
      defaultTab?: 'labor' | 'non_labor'
    }
  }
  assignmentGrids?: {
    projectPerspective?: 'labor' | 'non_labor'
    project?: {
      period?: AssignmentPeriodPreference
      chartVisible?: boolean
    }
    resource?: {
      period?: AssignmentPeriodPreference
      chartVisible?: boolean
    }
    nonLaborProject?: {
      period?: AssignmentPeriodPreference
      chartVisible?: boolean
    }
    nonLaborResource?: {
      period?: AssignmentPeriodPreference
      chartVisible?: boolean
    }
  }
  grids?: Record<string, UserGridSettings>
}

export interface UserSettingsResponse {
  settings_schema_version: number
  settings: UserSettings
  version: number
  created_at: string
  updated_at: string
}

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Array<infer U>
    ? Array<U>
    : T[K] extends object
      ? DeepPartial<T[K]>
      : T[K]
}

export const DEFAULT_USER_SETTINGS: Required<
  Pick<UserSettings, 'navigation' | 'lists' | 'assignmentGrids' | 'grids'>
> = {
  navigation: {
    hierarchyPane: { collapsed: false },
    hierarchyLabelMode: 'name',
    landingDestination: 'hierarchy',
  },
  lists: {
    resources: { defaultTab: 'labor' },
  },
  assignmentGrids: {
    projectPerspective: 'labor',
    project: { period: 'daily', chartVisible: true },
    resource: { period: 'daily', chartVisible: true },
    nonLaborProject: { period: 'daily', chartVisible: true },
    nonLaborResource: { period: 'daily', chartVisible: true },
  },
  grids: {},
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

export const mergeSettings = <T extends object>(
  base: T,
  patch: DeepPartial<T>,
): T => {
  const merged = { ...base } as Record<string, unknown>
  Object.entries(patch).forEach(([key, value]) => {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeSettings(merged[key], value)
    } else {
      merged[key] = value
    }
  })
  return merged as T
}

export const withUserSettingsDefaults = (settings: UserSettings): UserSettings =>
  mergeSettings<UserSettings>(DEFAULT_USER_SETTINGS, settings)
