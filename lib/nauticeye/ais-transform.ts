/**
 * ais-transform.ts
 *
 * Converts raw AIS position messages (from AISStream.io) into the
 * Vessel + TrackPoint shape that the rest of the app already understands.
 *
 * AISStream gives us one position per WebSocket message; we collect them
 * into per-MMSI buckets and emit a Vessel array once we close the socket.
 */

import type { Vessel, TrackPoint } from './types'

// ─── Raw AIS message shapes (AISStream.io) ────────────────────────────────────

export interface AISPositionMessage {
  MessageType: 'PositionReport' | 'StandardClassBPositionReport'
  MetaData: {
    MMSI: string
    ShipName: string
    latitude: number
    longitude: number
    time_utc: string   // "2026/09/09 07:12:34.000000"
  }
  Message: {
    PositionReport?: {
      Cog: number       // course over ground, degrees
      Sog: number       // speed over ground, knots
      TrueHeading?: number
    }
    StandardClassBPositionReport?: {
      Cog: number
      Sog: number
    }
  }
}

export interface AISStaticMessage {
  MessageType: 'ShipStaticData'
  MetaData: {
    MMSI: string
    ShipName: string
  }
  Message: {
    ShipStaticData: {
      Name: string
      ImoNumber?: number
      CallSign?: string
      // Type codes: https://api.vtexplorer.com/docs/ref-aistypes.html
      Type?: number
      Destination?: string
      Eta?: string
      Dimension?: { A: number; B: number; C: number; D: number }
    }
  }
}

// ─── Internal accumulator ─────────────────────────────────────────────────────

interface VesselAccumulator {
  mmsi: string
  name: string
  flag: string        // derived from MMSI prefix
  type: string        // derived from AIS type code
  points: TrackPoint[]
}

// ─── MMSI → flag state ────────────────────────────────────────────────────────
// First 3 digits are the Maritime Identification Digit (MID).
// Only the most common ones in the Arabian Sea / Indian Ocean region are listed.

const MID_FLAGS: Record<string, string> = {
  '419': 'India',
  '414': 'India',
  '419': 'India',
  '422': 'Iran',
  '432': 'Iran',
  '431': 'Japan',
  '352': 'Panama',
  '353': 'Panama',
  '354': 'Panama',
  '370': 'Panama',
  '371': 'Panama',
  '372': 'Panama',
  '374': 'Panama',
  '511': 'Bahrain',
  '447': 'UAE',
  '470': 'UAE',
  '403': 'Saudi Arabia',
  '403': 'Saudi Arabia',
  '563': 'Singapore',
  '564': 'Singapore',
  '565': 'Singapore',
  '636': 'Liberia',
  '538': 'Marshall Islands',
  '477': 'Hong Kong',
  '477': 'Hong Kong',
  '312': 'Belize',
  '667': 'Sierra Leone',
  '620': 'Madagascar',
}

export function mmsiToFlag(mmsi: string): string {
  const mid = mmsi.slice(0, 3)
  return MID_FLAGS[mid] ?? 'Unknown'
}

// ─── AIS type code → human label ─────────────────────────────────────────────

const AIS_TYPES: Record<number, string> = {
  0:  'Unknown',
  20: 'Wing in Ground',
  21: 'Wing in Ground',
  30: 'Fishing',
  31: 'Tug',
  32: 'Tug',
  33: 'Dredger',
  34: 'Dive Vessel',
  35: 'Military',
  36: 'Sailing',
  37: 'Pleasure Craft',
  40: 'High-Speed Craft',
  50: 'Pilot Vessel',
  51: 'Search and Rescue',
  52: 'Tug',
  53: 'Port Tender',
  55: 'Law Enforcement',
  60: 'Passenger',
  61: 'Passenger',
  62: 'Passenger',
  63: 'Passenger',
  64: 'Passenger',
  69: 'Passenger',
  70: 'Cargo',
  71: 'Cargo',
  72: 'Cargo',
  73: 'Cargo',
  74: 'Cargo',
  79: 'Cargo',
  80: 'Tanker',
  81: 'Crude Oil Tanker',
  82: 'Product Tanker',
  83: 'Chemical Tanker',
  84: 'Gas Tanker',
  89: 'Tanker',
  90: 'Other',
}

export function aisTypeToLabel(code?: number): string {
  if (code === undefined) return 'Vessel'
  return AIS_TYPES[code] ?? 'Vessel'
}

// ─── Parse AISStream UTC string → milliseconds ────────────────────────────────

export function parseAisTime(timeUtc: string): number {
  // Format: "2026/09/09 07:12:34.000000"
  try {
    const clean = timeUtc.replace(/\//g, '-').replace(' ', 'T').slice(0, 19) + 'Z'
    const ms = Date.parse(clean)
    return Number.isNaN(ms) ? Date.now() : ms
  } catch {
    return Date.now()
  }
}

// ─── Main accumulator class ────────────────────────────────────────────────────

export class AISAccumulator {
  private vessels = new Map<string, VesselAccumulator>()
  private static idCounter = 100

  /** Feed a single parsed AISStream message. */
  ingest(raw: AISPositionMessage | AISStaticMessage) {
    const mmsi = raw.MetaData.MMSI
    if (!mmsi) return

    if (!this.vessels.has(mmsi)) {
      this.vessels.set(mmsi, {
        mmsi,
        name: raw.MetaData.ShipName?.trim() || `Vessel ${mmsi}`,
        flag: mmsiToFlag(mmsi),
        type: 'Vessel',
        points: [],
      })
    }

    const acc = this.vessels.get(mmsi)!

    // Update name if we have a better one
    if (raw.MetaData.ShipName?.trim()) {
      acc.name = raw.MetaData.ShipName.trim()
    }

    // Handle static data (ship type)
    if (raw.MessageType === 'ShipStaticData') {
      const s = (raw as AISStaticMessage).Message.ShipStaticData
      acc.type = aisTypeToLabel(s.Type)
      return
    }

    // Handle position reports
    const pos = (raw as AISPositionMessage)
    const report =
      pos.Message.PositionReport ?? pos.Message.StandardClassBPositionReport

    if (!report) return

    const lat = pos.MetaData.latitude
    const lng = pos.MetaData.longitude
    const t   = parseAisTime(pos.MetaData.time_utc)

    // Skip invalid coordinates (0,0 or out of range)
    if (Math.abs(lat) < 0.001 && Math.abs(lng) < 0.001) return
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return

    const point: TrackPoint = {
      t,
      lat,
      lng,
      course: report.Cog ?? 0,
      speed:  report.Sog ?? 0,
    }

    // Deduplicate: skip if same position within 30 seconds
    const last = acc.points[acc.points.length - 1]
    if (last && Math.abs(last.t - t) < 30_000 &&
        Math.abs(last.lat - lat) < 0.0001 &&
        Math.abs(last.lng - lng) < 0.0001) return

    acc.points.push(point)
  }

  /** Return all accumulated vessels in app format, sorted by track length. */
  toVessels(): Vessel[] {
    const result: Vessel[] = []
    let idx = 100

    for (const acc of this.vessels.values()) {
      if (acc.points.length < 2) continue   // Need at least 2 points to correlate

      // Sort track chronologically
      acc.points.sort((a, b) => a.t - b.t)

      result.push({
        id:    `LIVE_${idx++}`,
        name:  acc.name,
        mmsi:  acc.mmsi,
        flag:  acc.flag,
        type:  acc.type,
        track: acc.points,
      })
    }

    // Most track points first = most data = most interesting candidates
    return result.sort((a, b) => b.track.length - a.track.length)
  }

  get size() { return this.vessels.size }
}
