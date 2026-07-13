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

  // Starts (or restarts) the heartbeat interval for a held lock. If a beat
  // comes back with refreshed:false, the server no longer considers us the
  // holder (someone else took over, TTL raced out, etc.) — treat that like a
  // failed acquire: stop heartbeating and flip to 'blocked', looking up the
  // current holder so the banner can show who has it.
  const startHeartbeat = useCallback(
    (type: string, id: string) => {
      stopHeartbeat()
      heartbeatRef.current = setInterval(() => {
        realtimeApi
          .heartbeatLock(type, id)
          .then((res) => {
            if (res.refreshed === false) {
              heldRef.current = false
              stopHeartbeat()
              setState('blocked')
              realtimeApi
                .getLock(type, id)
                .then((info) => setHolder(info.holder ?? undefined))
                .catch(() => setHolder(undefined))
            }
          })
          .catch(() => {
            // best-effort: a network hiccup on a single heartbeat shouldn't
            // flip state; only an explicit refreshed:false does.
          })
      }, HEARTBEAT_MS)
    },
    [stopHeartbeat],
  )

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
        if (cancelled) {
          // The component unmounted (or wantLock flipped false) while this
          // acquire was in flight. heldRef was never set, so the cleanup
          // below couldn't release it — if we did end up acquiring, release
          // it now (best-effort) so the lock doesn't sit on the server for
          // the full TTL. React StrictMode's mount->cleanup->remount makes
          // this a routine occurrence, not just an edge case.
          if (result.acquired) {
            realtimeApi.releaseLock(type, id).catch(() => {})
          }
          return
        }
        if (result.acquired) {
          heldRef.current = true
          setState('held')
          setHolder(undefined)
          startHeartbeat(type, id)
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
  }, [entityType, entityId, wantLock, validId, stopHeartbeat, startHeartbeat])

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
        startHeartbeat(type, id)
      } else {
        heldRef.current = false
        setState('blocked')
        setHolder(result.holder ?? undefined)
      }
    } catch {
      // best-effort: leave state as-is
    }
  }, [entityType, entityId, validId, startHeartbeat])

  return { state, holder, takeOver }
}
