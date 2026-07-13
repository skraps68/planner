import { useCallback, useEffect, useRef, useState } from 'react'
import { realtimeApi, LockHolder } from './realtimeApi'

const HEARTBEAT_MS = Number(import.meta.env.VITE_LOCK_HEARTBEAT_MS) || 30000

export type LockState = 'idle' | 'held' | 'blocked'

export interface UseEntityLockResult {
  state: LockState
  holder?: LockHolder
  takeOver: () => Promise<void>
}

// Advisory locking: gates entry into edit mode on a resource/worker so two
// users don't clobber each other. Best-effort throughout — any network/API
// failure degrades to 'idle' (no lock enforcement) rather than blocking the
// user, since the existing bulk-conflict handling remains the correctness
// backstop (see ResourceAssignmentCalendar / Task 12).
export function useEntityLock(
  entityType: string,
  entityId: string | undefined,
  wantLock: boolean,
): UseEntityLockResult {
  const [state, setState] = useState<LockState>('idle')
  const [holder, setHolder] = useState<LockHolder | undefined>(undefined)

  // Guard against undefined/'new' ids for unsaved entities (same bug class
  // Task 14 hit with presence).
  const validId = !!entityId && entityId !== 'new'

  const heldRef = useRef(false)
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined)

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (!wantLock || !validId) {
      setState('idle')
      setHolder(undefined)
      return
    }

    const type = entityType
    const id = entityId as string
    let cancelled = false

    realtimeApi
      .acquireLock(type, id)
      .then((result) => {
        if (cancelled) return
        if (result.acquired) {
          heldRef.current = true
          setState('held')
          setHolder(undefined)
          stopHeartbeat()
          heartbeatRef.current = setInterval(() => {
            realtimeApi.heartbeatLock(type, id).catch(() => {})
          }, HEARTBEAT_MS)
        } else {
          heldRef.current = false
          setState('blocked')
          setHolder(result.holder ?? undefined)
        }
      })
      .catch(() => {
        // Best-effort: swallow and stay idle (no lock enforcement) so the
        // realtime layer degrades gracefully.
      })

    return () => {
      cancelled = true
      stopHeartbeat()
      if (heldRef.current) {
        heldRef.current = false
        realtimeApi.releaseLock(type, id).catch(() => {})
      }
    }
  }, [entityType, entityId, wantLock, validId, stopHeartbeat])

  // Best-effort release when the tab/window is closing.
  useEffect(() => {
    if (!validId) return
    const type = entityType
    const id = entityId as string
    const handler = () => {
      if (heldRef.current) {
        realtimeApi.releaseLock(type, id).catch(() => {})
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [entityType, entityId, validId])

  const takeOver = useCallback(async () => {
    if (!validId) return
    const type = entityType
    const id = entityId as string

    try {
      await realtimeApi.releaseLock(type, id)
    } catch {
      // best-effort
    }

    try {
      const result = await realtimeApi.acquireLock(type, id)
      if (result.acquired) {
        heldRef.current = true
        setState('held')
        setHolder(undefined)
        stopHeartbeat()
        heartbeatRef.current = setInterval(() => {
          realtimeApi.heartbeatLock(type, id).catch(() => {})
        }, HEARTBEAT_MS)
      } else {
        heldRef.current = false
        setState('blocked')
        setHolder(result.holder ?? undefined)
      }
    } catch {
      // best-effort: leave state as-is
    }
  }, [entityType, entityId, validId, stopHeartbeat])

  return { state, holder, takeOver }
}
