/**
 * use-live-vessels.ts
 *
 * Fetches real AIS vessels from /api/vessels and merges them with the
 * demo dataset so the app always has something to show even when the
 * network or API key is unavailable.
 *
 * Usage:
 *   const { vessels, status, refresh } = useLiveVessels(spill)
 *
 * Status values:
 *   'idle'     — not started yet
 *   'loading'  — fetch in progress
 *   'live'     — using real AIS data
 *   'demo'     — API failed, using demo vessels as fallback
 *   'error'    — hard failure (shown to user)
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
  source:      string
  collectedAt: string
  error?:      string
  help?:       string
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLiveVessels(
  spill: Spill | null,
  /** Set to false to skip live fetch and use demo data (e.g. in story mode). */
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

    // Cancel any in-flight request
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setStatus('loading')
    setMessage('Connecting to AIS network…')

    const params = new URLSearchParams({
      spill:  spill ? `${spill.lat},${spill.lng}` : '19.52,71.48',
      radius: '300',
      secs:   '8',
    })

    try {
      const res = await fetch(`/api/vessels?${params}`, {
        signal: controller.signal,
      })

      const json: APIResponse = await res.json()

      if (!res.ok || json.error) {
        throw new Error(json.help ?? json.error ?? `HTTP ${res.status}`)
      }

      if (json.vessels.length === 0) {
        // No vessels in range right now — fall back to demo but tell the user
        setVessels(DEMO_VESSELS)
        setStatus('demo')
        setMessage(
          'No AIS traffic observed in this area right now. Showing demonstration vessels.',
        )
      } else {
        setVessels(json.vessels)
        setStatus('live')
        setMessage(
          `${json.vesselCount} live vessel${json.vesselCount === 1 ? '' : 's'} received from AIS network.`,
        )
      }

      setLastFetch(new Date(json.collectedAt))

    } catch (err: unknown) {
      if ((err as Error).name === 'AbortError') return

      console.error('[useLiveVessels]', err)

      // Graceful fallback — demo data is always better than nothing
      setVessels(DEMO_VESSELS)
      setStatus('demo')
      setMessage(
        `Live AIS unavailable (${(err as Error).message ?? 'network error'}). ` +
        'Showing demonstration vessels.',
      )
    }
  }, [spill, enabled])

  // Fetch on mount and whenever the selected spill changes
  useEffect(() => {
    fetch_()
    return () => abortRef.current?.abort()
  }, [fetch_])

  return { vessels, status, message, refresh: fetch_, lastFetch }
}
