import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { Box, CircularProgress } from '@mui/material'
import { AxiosError } from 'axios'
import { useAuth } from './AuthContext'
import { userSettingsApi } from '../api/userSettings'
import {
  mergeSettings,
  withUserSettingsDefaults,
  type DeepPartial,
  type UserGridSettings,
  type UserSettings,
  type UserSettingsResponse,
} from '../types/userSettings'

const SAVE_DEBOUNCE_MS = 700
const SETTINGS_CACHE_PREFIX = 'planner:user-settings:v1:'
const SETTINGS_MIGRATED_PREFIX = 'planner:user-settings:migrated:v1:'
const LEGACY_GRID_PREFIX = 'planner:grid:v1:'

const GRID_KEYS = [
  'resources-labor',
  'resources-non_labor',
  'workers',
  'actuals',
  'project-actuals',
  'admin-users',
  'admin-user-audit-all',
  'admin-user-audit-permissions',
]

const isEmptyObject = (value: object) => Object.keys(value).length === 0

const readCachedResponse = (userId: string): UserSettingsResponse | null => {
  try {
    const value = localStorage.getItem(`${SETTINGS_CACHE_PREFIX}${userId}`)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const writeCachedResponse = (userId: string, response: UserSettingsResponse) => {
  try {
    localStorage.setItem(`${SETTINGS_CACHE_PREFIX}${userId}`, JSON.stringify(response))
  } catch {
    // A settings cache is an optimization; server persistence remains authoritative.
  }
}

const readLegacyGrid = (key: string): UserGridSettings | null => {
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(`${LEGACY_GRID_PREFIX}${key}`) ?? 'null',
    ) as {
      density?: unknown
      columns?: {
        dimensions?: Record<string, { width?: unknown }>
        orderedFields?: unknown
        columnVisibilityModel?: unknown
      }
    } | null
    if (!saved || typeof saved !== 'object') return null
    const widths = Object.fromEntries(
      Object.entries(saved.columns?.dimensions ?? {})
        .filter((entry): entry is [string, { width: number }] =>
          typeof entry[1].width === 'number' && Number.isFinite(entry[1].width),
        )
        .map(([field, value]) => [field, Math.round(value.width)]),
    )
    const density =
      saved.density === 'compact'
      || saved.density === 'standard'
      || saved.density === 'comfortable'
        ? saved.density
        : undefined
    return {
      ...(density ? { density } : {}),
      ...(Array.isArray(saved.columns?.orderedFields)
        && saved.columns.orderedFields.every((field) => typeof field === 'string')
        ? { columnOrder: saved.columns.orderedFields }
        : {}),
      ...(saved.columns?.columnVisibilityModel
        && typeof saved.columns.columnVisibilityModel === 'object'
        ? {
            columnVisibility: saved.columns.columnVisibilityModel as Record<string, boolean>,
          }
        : {}),
      ...(Object.keys(widths).length ? { columnWidths: widths } : {}),
    }
  } catch {
    return null
  }
}

const collectLegacySettings = (): DeepPartial<UserSettings> => {
  const patch: DeepPartial<UserSettings> = {}
  const width = Number(sessionStorage.getItem('portfolioTreeWidth'))
  const collapsed = sessionStorage.getItem('portfolioTreeCollapsed')
  let idMode: boolean | undefined
  try {
    const listState = JSON.parse(sessionStorage.getItem('portfoliosListState') ?? 'null')
    if (typeof listState?.idMode === 'boolean') idMode = listState.idMode
  } catch {
    // Ignore corrupt legacy browser state.
  }

  if (Number.isFinite(width) || collapsed !== null || idMode !== undefined) {
    patch.navigation = {
      ...(Number.isFinite(width) && width > 0
        ? { hierarchyPane: { width: Math.round(width) } }
        : {}),
      ...(collapsed !== null
        ? {
            hierarchyPane: {
              ...(Number.isFinite(width) && width > 0 ? { width: Math.round(width) } : {}),
              collapsed: collapsed === '1',
            },
          }
        : {}),
      ...(idMode !== undefined
        ? { hierarchyLabelMode: idMode ? 'business_id' : 'name' }
        : {}),
    }
  }

  const grids = Object.fromEntries(
    GRID_KEYS
      .map((key) => [key, readLegacyGrid(key)] as const)
      .filter((entry): entry is readonly [string, UserGridSettings] => entry[1] !== null),
  )
  if (Object.keys(grids).length) patch.grids = grids

  const lastDetail = sessionStorage.getItem('lastHierarchyDetail')
  const projectId = lastDetail?.match(/^\/projects\/([^/?#]+)/)?.[1]
  if (projectId) {
    try {
      const projectView = JSON.parse(
        sessionStorage.getItem(`projectAssignmentView:${projectId}`) ?? 'null',
      )
      if (projectView) {
        const period =
          projectView.viewMode === 'daily'
          || projectView.viewMode === 'weekly'
          || projectView.viewMode === 'monthly'
            ? projectView.viewMode
            : undefined
        patch.assignmentGrids = {
          project: {
            ...(period ? { period } : {}),
            ...(typeof projectView.chartVisible === 'boolean'
              ? { chartVisible: projectView.chartVisible }
              : {}),
          },
        }
      }
    } catch {
      // Ignore corrupt legacy browser state.
    }
  }
  return patch
}

const clearLegacyPreferenceState = () => {
  sessionStorage.removeItem('portfolioTreeWidth')
  sessionStorage.removeItem('portfolioTreeCollapsed')
  GRID_KEYS.forEach((key) => sessionStorage.removeItem(`${LEGACY_GRID_PREFIX}${key}`))
  Object.keys(sessionStorage)
    .filter((key) => key.startsWith('projectAssignmentView:'))
    .forEach((key) => sessionStorage.removeItem(key))
  try {
    const listState = JSON.parse(sessionStorage.getItem('portfoliosListState') ?? 'null')
    if (listState && typeof listState === 'object') {
      sessionStorage.setItem(
        'portfoliosListState',
        JSON.stringify({ ...listState, idMode: false }),
      )
    }
  } catch {
    // Ignore corrupt legacy browser state during a reset.
  }
}

interface UserSettingsContextValue {
  settings: UserSettings
  isServerBacked: boolean
  isLoaded: boolean
  isSaving: boolean
  saveError: string | null
  resetCounter: number
  updateSettings: (patch: DeepPartial<UserSettings>) => void
  resetSettings: () => Promise<void>
}

const defaultContext: UserSettingsContextValue = {
  settings: withUserSettingsDefaults({}),
  isServerBacked: false,
  isLoaded: true,
  isSaving: false,
  saveError: null,
  resetCounter: 0,
  updateSettings: () => undefined,
  resetSettings: async () => undefined,
}

const UserSettingsContext = createContext<UserSettingsContextValue>(defaultContext)

export const useUserSettings = () => useContext(UserSettingsContext)

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth()
  const userId = user?.id
  const [settings, setSettings] = useState<UserSettings>(defaultContext.settings)
  const [isLoaded, setIsLoaded] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [resetCounter, setResetCounter] = useState(0)
  const versionRef = useRef(0)
  const responseRef = useRef<UserSettingsResponse | null>(null)
  const pendingPatchRef = useRef<DeepPartial<UserSettings>>({})
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savingRef = useRef(false)
  const ignoreUpdatesRef = useRef(false)
  const flushRef = useRef<() => Promise<void>>(async () => undefined)

  const cacheCurrentState = useCallback((nextSettings: UserSettings) => {
    if (!userId || !responseRef.current) return
    const response = { ...responseRef.current, settings: nextSettings }
    writeCachedResponse(userId, response)
  }, [userId])

  const scheduleFlush = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null
      void flushRef.current()
    }, SAVE_DEBOUNCE_MS)
  }, [])

  const flushPending = useCallback(async () => {
    if (!userId || savingRef.current || isEmptyObject(pendingPatchRef.current)) return
    const patch = pendingPatchRef.current
    pendingPatchRef.current = {}
    savingRef.current = true
    let saveFailed = false
    setIsSaving(true)
    setSaveError(null)
    try {
      let response: UserSettingsResponse
      try {
        response = await userSettingsApi.patch(versionRef.current, patch)
      } catch (error) {
        if ((error as AxiosError).response?.status !== 409) throw error
        const latest = await userSettingsApi.get()
        response = await userSettingsApi.patch(latest.version, patch)
      }
      versionRef.current = response.version
      responseRef.current = response
      const nextSettings = withUserSettingsDefaults(
        mergeSettings(response.settings, pendingPatchRef.current),
      )
      setSettings(nextSettings)
      writeCachedResponse(userId, { ...response, settings: nextSettings })
    } catch {
      saveFailed = true
      pendingPatchRef.current = mergeSettings(patch, pendingPatchRef.current)
      setSaveError('Preferences could not be saved. They will be retried after the next change.')
    } finally {
      savingRef.current = false
      setIsSaving(false)
      if (!saveFailed && !isEmptyObject(pendingPatchRef.current)) scheduleFlush()
    }
  }, [scheduleFlush, userId])
  flushRef.current = flushPending

  const updateSettings = useCallback((patch: DeepPartial<UserSettings>) => {
    if (ignoreUpdatesRef.current) return
    pendingPatchRef.current = mergeSettings(pendingPatchRef.current, patch)
    setSettings((current) => {
      const next = withUserSettingsDefaults(mergeSettings(current, patch))
      cacheCurrentState(next)
      return next
    })
    scheduleFlush()
  }, [cacheCurrentState, scheduleFlush])

  const resetSettings = useCallback(async () => {
    if (!userId) return
    ignoreUpdatesRef.current = true
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    pendingPatchRef.current = {}
    setIsSaving(true)
    setSaveError(null)
    try {
      const response = await userSettingsApi.reset()
      clearLegacyPreferenceState()
      versionRef.current = response.version
      responseRef.current = response
      const defaults = withUserSettingsDefaults({})
      setSettings(defaults)
      setResetCounter((current) => current + 1)
      writeCachedResponse(userId, { ...response, settings: defaults })
    } catch {
      setSaveError('Preferences could not be reset.')
      throw new Error('Preferences could not be reset.')
    } finally {
      setIsSaving(false)
      setTimeout(() => {
        ignoreUpdatesRef.current = false
      }, 0)
    }
  }, [userId])

  useEffect(() => {
    if (!userId) {
      setSettings(defaultContext.settings)
      setIsLoaded(false)
      return
    }
    let cancelled = false
    const cached = readCachedResponse(userId)
    if (cached) {
      versionRef.current = cached.version
      responseRef.current = cached
      setSettings(withUserSettingsDefaults(cached.settings))
    }

    const load = async () => {
      try {
        let response = await userSettingsApi.get()
        const migrationKey = `${SETTINGS_MIGRATED_PREFIX}${userId}`
        if (
          isEmptyObject(response.settings)
          && localStorage.getItem(migrationKey) !== '1'
        ) {
          const legacyPatch = collectLegacySettings()
          if (!isEmptyObject(legacyPatch)) {
            response = await userSettingsApi.patch(response.version, legacyPatch)
          }
          localStorage.setItem(migrationKey, '1')
        }
        if (cancelled) return
        versionRef.current = response.version
        responseRef.current = response
        const loadedSettings = withUserSettingsDefaults(response.settings)
        setSettings(loadedSettings)
        writeCachedResponse(userId, { ...response, settings: loadedSettings })
        setSaveError(null)
      } catch {
        if (!cancelled) {
          setSaveError('Preferences could not be loaded; defaults are in use.')
        }
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [userId])

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    if (!isEmptyObject(pendingPatchRef.current)) void flushRef.current()
  }, [])

  useEffect(() => {
    const flushWhenHidden = () => {
      if (document.visibilityState === 'hidden') void flushRef.current()
    }
    const flushOnPageHide = () => void flushRef.current()
    document.addEventListener('visibilitychange', flushWhenHidden)
    window.addEventListener('pagehide', flushOnPageHide)
    return () => {
      document.removeEventListener('visibilitychange', flushWhenHidden)
      window.removeEventListener('pagehide', flushOnPageHide)
    }
  }, [])

  if (!isLoaded) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <UserSettingsContext.Provider
      value={{
        settings,
        isServerBacked: true,
        isLoaded,
        isSaving,
        saveError,
        resetCounter,
        updateSettings,
        resetSettings,
      }}
    >
      {children}
    </UserSettingsContext.Provider>
  )
}
