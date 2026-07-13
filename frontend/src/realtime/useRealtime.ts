import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { realtimeApi } from './realtimeApi'
import { queryKeyPrefixesFor } from './eventKeyMap'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1'
const COALESCE_MS = Number(import.meta.env.VITE_REALTIME_TOLERANCE_ACTIVE_MS) || 3000

export function useRealtime(): void {
  const queryClient = useQueryClient()
  const esRef = useRef<EventSource | null>(null)
  const pendingRef = useRef<Map<string, Array<string>>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

    const connect = async () => {
      try {
        const ticket = await realtimeApi.mintTicket()
        if (cancelled) return
        const es = new EventSource(`${API_BASE}/realtime/stream?ticket=${encodeURIComponent(ticket)}`)
        esRef.current = es
        es.onopen = () => {
          // Reconnect self-heal: refetch everything currently mounted.
          queryClient.invalidateQueries()
        }
        es.onmessage = (evt) => {
          try {
            const data = JSON.parse(evt.data)
            for (const prefix of queryKeyPrefixesFor(data.type)) schedule(prefix)
          } catch { /* ignore malformed */ }
        }
        es.onerror = () => { /* EventSource auto-reconnects */ }
      } catch { /* best-effort; try again on next mount */ }
    }

    connect()
    return () => {
      cancelled = true
      if (timerRef.current) clearTimeout(timerRef.current)
      esRef.current?.close()
      esRef.current = null
    }
  }, [queryClient])
}
