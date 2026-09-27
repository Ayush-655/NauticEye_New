'use client'

import { useEffect, useState } from 'react'
import type { Capability } from './types'

type Network = EventTarget & { saveData?: boolean; effectiveType?: string }
type Device = Navigator & { deviceMemory?: number; connection?: Network }

export function useCapabilities() {
  const [capability, setCapability] = useState<Capability>('lightweight')
  const [reducedMotion, setReducedMotion] = useState(true)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    const device = navigator as Device
    const update = () => {
      const memory = device.deviceMemory ?? 8
      const cores = device.hardwareConcurrency ?? 8
      const network = device.connection
      const compatibility = /KaiOS|Opera Mini|Nokia|Series40/i.test(device.userAgent)
      const light = network?.saveData || /(^|-)2g$/.test(network?.effectiveType ?? '') || memory < 2
      setCapability(compatibility ? 'compatibility' : light ? 'lightweight' : memory <= 4 || cores <= 4 || network?.effectiveType === '3g' ? 'balanced' : 'full')
      setReducedMotion(motion.matches)
      setReady(true)
    }
    update()
    motion.addEventListener?.('change', update)
    device.connection?.addEventListener('change', update)
    return () => {
      motion.removeEventListener?.('change', update)
      device.connection?.removeEventListener('change', update)
    }
  }, [])
  return { capability, reducedMotion, ready }
}
