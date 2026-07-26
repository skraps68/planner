import React, { useCallback, useEffect, useMemo, useRef } from 'react'
import {
  DataGrid,
  DataGridProps,
  GridDensity,
  GridInitialState,
  GridState,
} from '@mui/x-data-grid'
import { useUserSettings } from '../../contexts/UserSettingsContext'
import type { UserGridSettings } from '../../types/userSettings'

const STORAGE_PREFIX = 'planner:grid:v1:'
const STORAGE_VERSION = 1
const SAVE_DEBOUNCE_MS = 100
const DENSITIES: GridDensity[] = ['compact', 'standard', 'comfortable']

type PersistedColumns = NonNullable<GridInitialState['columns']>

export interface PersistedGridPreferences {
  version: typeof STORAGE_VERSION
  density: GridDensity
  columns: PersistedColumns
}

const storageKeyFor = (persistenceKey: string) => `${STORAGE_PREFIX}${persistenceKey}`

const readPreferences = (persistenceKey: string): PersistedGridPreferences | null => {
  try {
    const raw = sessionStorage.getItem(storageKeyFor(persistenceKey))
    if (!raw) return null

    const parsed = JSON.parse(raw) as Partial<PersistedGridPreferences>
    if (
      parsed.version !== STORAGE_VERSION ||
      !parsed.density ||
      !DENSITIES.includes(parsed.density) ||
      !parsed.columns ||
      typeof parsed.columns !== 'object'
    ) {
      return null
    }

    return parsed as PersistedGridPreferences
  } catch {
    return null
  }
}

const writePreferences = (
  persistenceKey: string,
  preferences: PersistedGridPreferences
) => {
  try {
    sessionStorage.setItem(storageKeyFor(persistenceKey), JSON.stringify(preferences))
  } catch {
    // Storage can be unavailable or full; the grid should remain usable.
  }
}

const fromUserGridSettings = (
  settings: UserGridSettings | undefined,
): PersistedGridPreferences | null => {
  if (!settings) return null
  const dimensions = Object.fromEntries(
    Object.entries(settings.columnWidths ?? {}).map(([field, width]) => [
      field,
      { width },
    ]),
  )
  return {
    version: STORAGE_VERSION,
    density: settings.density ?? 'compact',
    columns: {
      ...(settings.columnOrder ? { orderedFields: settings.columnOrder } : {}),
      columnVisibilityModel: settings.columnVisibility ?? {},
      ...(Object.keys(dimensions).length ? { dimensions } : {}),
    },
  }
}

const toUserGridSettings = (
  preferences: PersistedGridPreferences,
): UserGridSettings => ({
  density: preferences.density,
  columnOrder: preferences.columns.orderedFields,
  columnVisibility: preferences.columns.columnVisibilityModel,
  columnWidths: Object.fromEntries(
    Object.entries(preferences.columns.dimensions ?? {})
      .filter((entry): entry is [string, { width: number }] =>
        typeof entry[1].width === 'number',
      )
      .map(([field, dimension]) => [field, dimension.width]),
  ),
})

export const extractGridPreferences = (state: GridState): PersistedGridPreferences => {
  const dimensions: NonNullable<PersistedColumns['dimensions']> = {}

  state.columns.orderedFields.forEach((field) => {
    const column = state.columns.lookup[field]
    if (!column?.hasBeenResized) return

    dimensions[field] = {
      width: column.width,
      minWidth: column.minWidth,
      maxWidth: column.maxWidth === Infinity ? -1 : column.maxWidth,
      flex: column.flex,
    }
  })

  return {
    version: STORAGE_VERSION,
    density: state.density.value,
    columns: {
      orderedFields: state.columns.orderedFields,
      columnVisibilityModel: state.columns.columnVisibilityModel,
      ...(Object.keys(dimensions).length > 0 ? { dimensions } : {}),
    },
  }
}

type PersistentDataGridProps = DataGridProps & {
  persistenceKey: string
}

/**
 * DataGrid wrapper that keeps user-controlled density and column configuration
 * (visibility, order and resized widths) for the lifetime of the browser tab.
 */
const PersistentDataGrid: React.FC<PersistentDataGridProps> = ({
  persistenceKey,
  initialState,
  density,
  onStateChange,
  ...props
}) => {
  const {
    settings,
    isServerBacked,
    resetCounter,
    updateSettings,
  } = useUserSettings()
  const stored = useMemo(
    () =>
      fromUserGridSettings(settings.grids?.[persistenceKey])
      ?? (!isServerBacked ? readPreferences(persistenceKey) : null),
    [isServerBacked, persistenceKey, settings.grids],
  )
  const pendingPreferences = useRef<PersistedGridPreferences | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSerialized = useRef<string | null>(
    stored ? JSON.stringify(stored) : null
  )

  const mergedInitialState = useMemo<GridInitialState>(() => ({
    ...initialState,
    columns: {
      ...initialState?.columns,
      ...stored?.columns,
      columnVisibilityModel: {
        ...initialState?.columns?.columnVisibilityModel,
        ...stored?.columns.columnVisibilityModel,
      },
    },
  }), [initialState, stored])

  const flushPreferences = useCallback(() => {
    const preferences = pendingPreferences.current
    if (!preferences) return

    const serialized = JSON.stringify(preferences)
    if (serialized !== lastSerialized.current) {
      writePreferences(persistenceKey, preferences)
      updateSettings({
        grids: { [persistenceKey]: toUserGridSettings(preferences) },
      })
      lastSerialized.current = serialized
    }
    pendingPreferences.current = null
  }, [persistenceKey, updateSettings])

  const handleStateChange: NonNullable<DataGridProps['onStateChange']> = useCallback(
    (state, event, details) => {
      onStateChange?.(state, event, details)
      pendingPreferences.current = extractGridPreferences(state)

      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        saveTimer.current = null
        flushPreferences()
      }, SAVE_DEBOUNCE_MS)
    },
    [flushPreferences, onStateChange]
  )

  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    flushPreferences()
  }, [flushPreferences])

  return (
    <DataGrid
      key={`${storageKeyFor(persistenceKey)}:${resetCounter}`}
      {...props}
      density={stored?.density ?? density ?? 'compact'}
      initialState={mergedInitialState}
      onStateChange={handleStateChange}
    />
  )
}

export default PersistentDataGrid
