/**
 * app/api/vessels/route.ts
 *
 * GET /api/vessels?spill=19.52,71.48&radius=300
 *
 * Connects to AISStream.io via WebSocket, collects position messages for
 * ~8 seconds within a bounding box around the requested spill coordinates,
 * then returns the transformed vessel array as JSON.
 *
 * ENV VARIABLES (add to .env.local):
 *   AISSTREAM_API_KEY=your_key_here
 *
 * Get a free key at https://aisstream.io  (no credit card required)
 *
 * QUERY PARAMS:
 *   spill   "lat,lng"   centre of bounding box  (default: 19.52,71.48)
 *   radius  km          half-width of box        (default: 300)
 *   secs    number      how long to listen       (default: 8, max: 20)
 */

import { NextRequest, NextResponse } from 'next/server'
import { AISAccumulator } from '@/lib/nauticeye/ais-transform'

// ─── Config ───────────────────────────────────────────────────────────────────

const AISSTREAM_WS = 'wss://stream.aisstream.io/v0/stream'
const DEFAULT_LAT  = 19.52
const DEFAULT_LNG  = 71.48
const DEFAULT_RADIUS_KM = 300
const DEFAULT_SECS = 8
const MAX_SECS     = 20

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a centre + radius (km) to a [minLat,minLng,maxLat,maxLng] bounding box. */
function toBoundingBox(lat: number, lng: number, radiusKm: number) {
  const dLat = radiusKm / 111.32
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))
  return [
    [lat - dLat, lng - dLng],
    [lat + dLat, lng + dLng],
  ]
}

/** Build the AISStream subscription payload. */
function subscriptionPayload(apiKey: string, boundingBox: number[][]) {
  return JSON.stringify({
    APIKey: apiKey,
    BoundingBoxes: [boundingBox],
    FilterMessageTypes: [
      'PositionReport',
      'StandardClassBPositionReport',
      'ShipStaticData',
    ],
  })
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  // ── 1. Parse query params ──────────────────────────────────────────────────
  const { searchParams } = request.nextUrl

  const spillParam = searchParams.get('spill') ?? `${DEFAULT_LAT},${DEFAULT_LNG}`
  const [rawLat, rawLng] = spillParam.split(',').map(Number)
  const lat = Number.isFinite(rawLat) ? rawLat : DEFAULT_LAT
  const lng = Number.isFinite(rawLng) ? rawLng : DEFAULT_LNG

  const radius = Math.min(
    Math.abs(Number(searchParams.get('radius') ?? DEFAULT_RADIUS_KM)),
    600,   // hard cap so we don't swamp the WebSocket
  )
  const secs = Math.min(
    Math.abs(Number(searchParams.get('secs') ?? DEFAULT_SECS)),
    MAX_SECS,
  )

  // ── 2. Check API key ───────────────────────────────────────────────────────
  const apiKey = process.env.AISSTREAM_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        error: 'AISSTREAM_API_KEY is not set.',
        help:  'Add AISSTREAM_API_KEY=your_key to .env.local. Get a free key at https://aisstream.io',
      },
      { status: 503 },
    )
  }

  // ── 3. Open WebSocket, collect messages ────────────────────────────────────
  const accumulator = new AISAccumulator()
  const boundingBox  = toBoundingBox(lat, lng, radius)

  try {
    await new Promise<void>((resolve, reject) => {
      // Node 18+ has a built-in WebSocket; Next.js 14+ uses it automatically.
      // For older Node, the `ws` package is a drop-in replacement.
      const ws = new WebSocket(AISSTREAM_WS)

      const timeout = setTimeout(() => {
        ws.close()
        resolve()   // time's up — return whatever we collected
      }, secs * 1000)

      ws.onopen = () => {
        ws.send(subscriptionPayload(apiKey, boundingBox))
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(
            typeof event.data === 'string' ? event.data : event.data.toString(),
          )
          accumulator.ingest(msg)
        } catch {
          // Malformed message — skip it
        }
      }

      ws.onerror = (err) => {
        clearTimeout(timeout)
        reject(new Error(`AISStream WebSocket error: ${String(err)}`))
      }

      ws.onclose = () => {
        clearTimeout(timeout)
        resolve()
      }
    })
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 502 },
    )
  }

  // ── 4. Return transformed vessels ─────────────────────────────────────────
  const vessels = accumulator.toVessels()

  return NextResponse.json(
    {
      source:     'live',
      collectedAt: new Date().toISOString(),
      centre:     { lat, lng },
      radiusKm:   radius,
      listenSecs: secs,
      vesselCount: vessels.length,
      vessels,
    },
    {
      headers: {
        // Allow browser to cache for 90 seconds before re-fetching
        'Cache-Control': 'public, s-maxage=90, stale-while-revalidate=30',
      },
    },
  )
}
