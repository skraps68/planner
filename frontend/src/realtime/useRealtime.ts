import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeApi } from './realtimeApi'
import { queryKeyPrefixesFor } from './eventKeyMap'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const COALESCE_MS = Number(import.meta.env.VITE_REALTIME_TOLERANCE_ACTIVE_MS) || 3000
const RECONNECT_BASE_MS = Number(import.meta.env.VITE_REALTIME_RECONNECT_BASE_MS) || 1000
const RECONNECT_MAX_MS = 30_000

export function useRealtime(): void {
  const queryClient = useQueryClient()
  const esRef = useRef<EventSource | null>(null)
  const pendingRef = useRef<Map<string, Array<string>>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffRef = useRef(RECONNECT_BASE_MS)

  useEffect(() => {
    if (!localStorage.getItem('token')) return
    let cancelled = false

    const flush = () => {
      timerRef.current = null
      const prefixes = Array.from(pendingRef.current.values())
      pendingRef.current.clear()
      for (const prefix of prefixes) {
        queryClient.invalidateQueries({ queryKey: prefix })
      }
    }

    const schedule = (prefix: Array<string>) => {
      pendingRef.current.set(prefix.join(' '), prefix)
      if (timerRef.current == null) {
        timerRef.current = setTimeout(flush, COALESCE_MS)
      }
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      const delay = backoffRef.current
      backoffRef.current = Math.min(backoffRef.current * 2, RECONNECT_MAX_MS)
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null
        if (!cancelled) connect()
      }, delay)
    }

    const connect = async () => {
      try {
        const ticket = await realtimeApi.mintTicket()
        if (cancelled) return
        const es = new EventSource(`${API_BASE}/realtime/stream?ticket=${encodeURIComponent(ticket)}`)
        esRef.current = es
        es.onopen = () => {
          // Connection established: reset the reconnect backoff.
          backoffRef.current = RECONNECT_BASE_MS
          // Reconnect self-heal: refetch everything currently mounted.
          queryClient.invalidateQueries()
        }
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data)
            for (const prefix of queryKeyPrefixesFor(data.type)) schedule(prefix)
          } catch { /* ignore malformed */ }
        }
        es.onerror = () => {
          // Tickets are single-use (backend consumes them with GETDEL), so the
          // native EventSource auto-reconnect would replay a consumed ticket,
          // get a 401, and die fatally (readyState CLOSED, no more retries).
          // Instead, close the connection ourselves and reconnect with a
          // freshly minted ticket, backing off exponentially.
          es.close()
          esRef.current = null
          scheduleReconnect()
        }
      } catch {
        // Ticket mint failed (e.g. backend restarting). Best-effort: retry
        // with backoff rather than silently giving up for the session.
        scheduleReconnect()
      }
    }

    connect()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [queryClient])
}
