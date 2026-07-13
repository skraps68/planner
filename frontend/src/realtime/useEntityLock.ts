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
  // The user_id we were granted the lock under, captured from the initial
  // successful acquire (or takeOver). Used by the heartbeat's refreshed:false
  // handler to tell "someone else genuinely holds it now" apart from an
  // ambiguous/ Redis-hiccup response where get_lock can't confirm a holder.
  const myUserIdRef = useRef<string | undefined>(undefined)

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current)
      heartbeatRef.current = undefined
    }
  }, [])

  // Starts (or restarts) the heartbeat interval for a held lock. If a beat
  // comes back with refreshed:false, the server no longer confirms us as the
  // holder — but that's ambiguous: it's the same response shape whether
  // someone else genuinely took over, or Redis is having a hiccup (locks.py
  // degrades heartbeat/get_lock to False/None on any Redis failure). We
  // confirm via getLock: only flip to 'blocked' (and stop heartbeating) if a
  // holder is present AND it isn't us. If the holder is absent (ambiguous —
  // could be Redis down) or still us, treat it as transient and keep
  // heartbeating so a brief outage doesn't silently kick a mid-edit user to
  // read-only.
  const startHeartbeat = useCallback(
    (type: string, id: string) => {
      stopHeartbeat()
      heartbeatRef.current = setInterval(() => {
        realtimeApi
          .heartbeatLock(type, id)
          .then((res) => {
            if (res.refreshed === false) {
              realtimeApi
                .getLock(type, id)
                .then((info) => {
                  const holderUserId = info.holder?.user_id
                  const lostToSomeoneElse =
                    !!holderUserId && holderUserId !== myUserIdRef.current
                  if (lostToSomeoneElse) {
                    heldRef.current = false
                    stopHeartbeat()
                    setState('blocked')
                    setHolder(info.holder ?? undefined)
                  }
                  // else: ambiguous (no confirmed holder) or still us —
                  // transient hiccup, stay 'held' and keep heartbeating.
                })
                .catch(() => {
                  // getLock itself failed — can't confirm loss, stay held.
                })
            }
          })
          .catch(() => {
            // best-effort: a network hiccup on a single heartbeat shouldn't
            // flip state; only a confirmed loss (via getLock) does.
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
          myUserIdRef.current = result.holder?.user_id
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

  // Real force-override, gated behind LockBanner's confirm dialog: unlike the
  // regular owner-checked releaseLock (which no-ops against someone else's
  // active lock), forceReleaseLock deletes the key unconditionally, so
  // "Take over" works even while the original holder is actively editing.
  const takeOver = useCallback(async () => {
    if (!validId) return
    const type = entityType
    const id = entityId as string

    try {
      await realtimeApi.forceReleaseLock(type, id)
    } catch {
      // best-effort
    }

    try {
      const result = await realtimeApi.acquireLock(type, id)
      if (result.acquired) {
        heldRef.current = true
        myUserIdRef.current = result.holder?.user_id
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
