'use client'

import { useEffect, useRef } from 'react'
import { hashStr, prand } from '@/lib/nauticeye/engine'
import type { Spill } from '@/lib/nauticeye/types'

export function SarView({ spill, miniature = false, mask = true, lightweight = false }: { spill: Spill; miniature?: boolean; mask?: boolean; lightweight?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const paint = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const w = canvas.clientWidth || 300, h = canvas.clientHeight || 180
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const seed = hashStr(spill.id)
      ctx.fillStyle = '#25312f'; ctx.fillRect(0, 0, w, h)
      const step = lightweight ? 4 : miniature ? 2 : 1.5
      for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
        const noise = prand(seed + x * 1.371 + y * 2.719)
        const band = Math.sin(x * .035 + y * .055) * 11
        const value = 35 + noise * 76 + band
        ctx.fillStyle = `rgb(${value * .93},${value},${value * .97})`
        ctx.fillRect(x, y, step, step)
      }
      const cx = w * .52, cy = h * .5, baseR = Math.min(w, h) * .3 * (.55 + spill.confidence / 100 * .6)
      ctx.beginPath()
      for (let i = 0; i <= 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const r = baseR * (.55 + .5 * prand(seed + (i % 16) * 5.53))
        const x = cx + Math.cos(a) * r * 1.35, y = cy + Math.sin(a) * r * .82
        if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y)
      }
      ctx.closePath(); ctx.fillStyle = '#111c1b'; ctx.fill()
      if (mask) { ctx.fillStyle = '#55d7b829'; ctx.fill(); ctx.strokeStyle = '#80e1c2'; ctx.lineWidth = miniature ? .7 : 1; ctx.stroke() }
      if (!miniature) {
        ctx.strokeStyle = '#c3dad322'; ctx.lineWidth = .5
        for (let x = w / 6; x < w; x += w / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke() }
        for (let y = h / 4; y < h; y += h / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke() }
        ctx.strokeStyle = '#c6e0d7'; ctx.beginPath(); ctx.moveTo(cx - 6, cy); ctx.lineTo(cx + 6, cy); ctx.moveTo(cx, cy - 6); ctx.lineTo(cx, cy + 6); ctx.stroke()
        ctx.strokeStyle = '#77c4aa'; ctx.setLineDash([3, 4]); ctx.strokeRect(w * .18, h * .2, w * .66, h * .61); ctx.setLineDash([])
      }
    }
    const observer = new ResizeObserver(paint)
    observer.observe(canvas); paint()
    return () => observer.disconnect()
  }, [spill, miniature, mask, lightweight])
  return <div className={miniature ? 'sar-view miniature' : 'sar-view'}>
    <canvas ref={ref} role="img" aria-label={`Synthetic SAR illustration of ${spill.name}${mask ? ' with illustrative segmentation contour' : ', raw texture'}`} />
    {!miniature && <><span className="sar-corner top">{mask ? 'SEGMENTATION OVERLAY' : 'RAW BACKSCATTER'}</span><span className="sar-corner bottom">SYNTHETIC SAR <span>{spill.confidence}% CONF.</span></span><i className="sar-scan" key={`${spill.id}-${mask}`} /></>}
  </div>
}
