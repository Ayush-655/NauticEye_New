/**
 * use-live-vessels.ts  (updated)
 *
 * Changes from v1:
 *  - Reads the source field from the API response
 *  - Shows 'live' only when source === 'live', 'demo' when fallback
 *  - No longer double-falls-back on the client (API handles it)
 */

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { VESSELS as DEMO_VESSELS } from './demo-data'
import type { Spill, Vessel } from './types'

export type LiveVesselStatus = 'idle' | 'loading' | 'live' | 'demo' | 'error'

interface UseLiveVesselsResult {
  vessels:   Vessel[]
  status:    LiveVesselStatus
  message:   string
  refresh:   () => void
  lastFetch: Date | null
}

interface APIResponse {
  vessels:     Vessel[]
  vesselCount: number
  source:      'live' | 'demo_fallback'
  reason?:     string
  collectedAt: string
  error?:      string
  help?:       string
}

export function useLiveVessels(
  spill: Spill | null,
  enabled = true,
): UseLiveVesselsResult {
  const [vessels,   setVessels]   = useState<Vessel[]>(DEMO_VESSELS)
  const [status,    setStatus]    = useState<LiveVesselStatus>('idle')
  const [message,   setMessage]   = useState('Using demonstration vessel data.')
  const [lastFetch, setLastFetch] = useState<Date | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const fetch_ = useCallback(async () => {
    if (!enabled) {
      setVessels(DEMO_VESSELS)
      setStatus('demo')
      setMessage('Live fetch disabled — showing demonstration vessels.')
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setMessage('Connecting to AIS network…')

    const params = new URLSearchParams({
      spill:  spill ? `${spill.lat},${spill.lng}` : '19.52,71.48',
      radius: '500',
      secs:   '15',
    })

    try {
      const res = await fetch(`/api/vessels?${params}`, { signal: controller.signal })

      // If the response isn't JSON (e.g. HTML error page), handle gracefully
      const text = await res.text()
      let json: APIResponse
      try {
        json = JSON.parse(text)
      } catch {
        throw new Error(`Server returned non-JSON response (status ${res.status})`)
      }

      if (!res.ok && json.error) throw new Error(json.help ?? json.error)

      setVessels(json.vessels)
      setLastFetch(new Date(json.collectedAt))

      if (json.source === 'live') {
        setStatus('live')
        setMessage(`${json.vesselCount} live vessel${json.vesselCount === 1 ? '' : 's'} from AIS network.`)
      } else {
        setStatus('demo')
        setMessage(json.reason ?? 'No live vessels found. Showing demonstration data.')
      }

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return
      console.error('[useLiveVessels]', err)
      setVessels(DEMO_VESSELS)
      setStatus('demo')
      setMessage(`Live AIS unavailable. Showing demonstration vessels.`)
    }
  }, [spill, enabled])

  useEffect(() => {
    fetch_()
    return () => abortRef.current?.abort()
  }, [fetch_])

  return { vessels, status, message, refresh: fetch_, lastFetch }
}
