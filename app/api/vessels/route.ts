/**
 * app/api/vessels/route.ts  (updated)
 *
 * Changes from v1:
 *  - Listen for 15 seconds instead of 8 (more ships captured)
 *  - Wider default radius: 500 km instead of 300 km
 *  - Returns demo vessels as fallback when 0 live vessels found
 *  - Better error messages
 */

import { NextRequest, NextResponse } from 'next/server'
import { AISAccumulator } from '@/lib/nauticeye/ais-transform'
import { VESSELS as DEMO_VESSELS } from '@/lib/nauticeye/demo-data'

const AISSTREAM_WS     = 'wss://stream.aisstream.io/v0/stream'
const DEFAULT_LAT      = 19.52
const DEFAULT_LNG      = 71.48
const DEFAULT_RADIUS   = 500   // wider — Arabian Sea is big
const DEFAULT_SECS     = 15    // longer — more time to catch broadcasts
const MAX_SECS         = 25

function toBoundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ]
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  const spillParam = searchParams.get('spill') ?? `${DEFAULT_LAT},${DEFAULT_LNG}`
  const [rawLat, rawLng] = spillParam.split(',').map(Number)
  const lat    = Number.isFinite(rawLat) ? rawLat : DEFAULT_LAT
  const lng    = Number.isFinite(rawLng) ? rawLng : DEFAULT_LNG
  const radius = Math.min(Math.abs(Number(searchParams.get('radius') ?? DEFAULT_RADIUS)), 700)
  const secs   = Math.min(Math.abs(Number(searchParams.get('secs')   ?? DEFAULT_SECS)),   MAX_SECS)

  const apiKey = process.env.AISSTREAM_API_KEY
  if (!apiKey) {
    return NextResponse.json({
      error: 'AISSTREAM_API_KEY is not set.',
      help:  'Add AISSTREAM_API_KEY=your_key to .env.local and restart the server.',
    }, { status: 503 })
  }

  const accumulator = new AISAccumulator()
  const boundingBox = toBoundingBox(lat, lng, radius)

  try {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(AISSTREAM_WS)
      let settled = false

      const finish = () => { if (!settled) { settled = true; ws.close(); resolve() } }
      const timeout = setTimeout(finish, secs * 1000)

      ws.onopen = () => {
        ws.send(JSON.stringify({
          APIKey: apiKey,
          BoundingBoxes: [boundingBox],
          FilterMessageTypes: [
            'PositionReport',
            'StandardClassBPositionReport',
            'ShipStaticData',
          ],
        }))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(
            typeof event.data === 'string' ? event.data : event.data.toString(),
          )
          accumulator.ingest(msg)
        } catch { /* skip malformed */ }
      }

      ws.onerror = () => { clearTimeout(timeout); reject(new Error('AISStream WebSocket error')) }
      ws.onclose = () => { clearTimeout(timeout); finish() }
    })
  } catch (err) {
    // WebSocket failed entirely — return demo data so app still works
    return NextResponse.json({
      source:      'demo_fallback',
      reason:      String(err),
      collectedAt: new Date().toISOString(),
      vesselCount: DEMO_VESSELS.length,
      vessels:     DEMO_VESSELS,
    })
  }

  const liveVessels = accumulator.toVessels()

  // If we got nothing, return demo vessels so the map isn't empty
  if (liveVessels.length === 0) {
    return NextResponse.json({
      source:      'demo_fallback',
      reason:      `No AIS traffic observed in ${radius} km radius after ${secs}s. This is common with free-tier AISStream coverage. Returning demo vessels.`,
      collectedAt: new Date().toISOString(),
      centre:      { lat, lng },
      vesselCount: DEMO_VESSELS.length,
      vessels:     DEMO_VESSELS,
    })
  }

  return NextResponse.json({
    source:      'live',
    collectedAt: new Date().toISOString(),
    centre:      { lat, lng },
    radiusKm:    radius,
    listenSecs:  secs,
    vesselCount: liveVessels.length,
    vessels:     liveVessels,
  }, {
    headers: { 'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=30' },
  })
}
