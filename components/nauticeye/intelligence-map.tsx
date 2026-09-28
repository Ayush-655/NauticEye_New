'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/lib/nauticeye/leaflet-fix'
import { Crosshair, Minus, Plus, RotateCcw, Ruler, Maximize2, Minimize2, X, LocateFixed } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { blobPoints, hashStr, interpAt, closestApproach, haversineKm } from '@/lib/nauticeye/engine'
import { PLACE_LABELS } from '@/lib/nauticeye/demo-data'
import type { Layers, MaritimeDataset, Spill, Vessel } from '@/lib/nauticeye/types'
import { escapeHtml } from '@/lib/nauticeye/report'

const colors = { high: '#ef9a70', medium: '#d9bd76', low: '#96a9a6' }
const region: L.LatLngTuple = [19.55, 71.15]
const shipIcon = (course: number, selected: boolean) => L.divIcon({ className: 'vessel-marker', html: `<span class="ship-shape ${selected ? 'selected' : ''}" style="transform:rotate(${course}deg)"></span>`, iconSize: [28, 28], iconAnchor: [14, 14] })
const formatCoordinate = (lat: number, lng: number) => `${Math.abs(lat).toFixed(3)}° ${lat >= 0 ? 'N' : 'S'} / ${Math.abs(lng).toFixed(3)}° ${lng >= 0 ? 'E' : 'W'}`

type Props = { dataset: MaritimeDataset; spill: Spill | null; vessel: Vessel | null; time: number; layers: Layers; highlights: string[]; overview: boolean; reducedMotion: boolean; onSpill: (id: string) => void; onVessel: (id: string) => void; focusVersion: number; expanded: boolean; onExpand: () => void }
type VesselLayers = { marker: L.Marker; track: L.Polyline; points: L.LayerGroup; selected: boolean; pointKey: string }

export default function IntelligenceMap({ dataset, spill, vessel, time, layers, highlights, overview, reducedMotion, onSpill, onVessel, focusVersion, expanded, onExpand }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const incidentGroup = useRef<L.LayerGroup | null>(null)
  const evidenceGroup = useRef<L.LayerGroup | null>(null)
  const measurementGroup = useRef<L.LayerGroup | null>(null)
  const fleet = useRef(new Map<string, VesselLayers>())
  const incidents = useRef(new Map<string, { marker: L.Marker; polygon: L.Polygon; selected: boolean }>())
  const handlers = useRef({ onSpill, onVessel })
  handlers.current = { onSpill, onVessel }
  const measuring = useRef(false)
  const measurementPoints = useRef<L.LatLng[]>([])
  const [measure, setMeasure] = useState(false)
  const [measurement, setMeasurement] = useState<string | null>(null)
  const [coords, setCoords] = useState(formatCoordinate(region[0], region[1]))
  const [tileStatus, setTileStatus] = useState<'loading' | 'ready' | 'fallback' | 'error'>('loading')
  const [retry, setRetry] = useState(0)
  const [ready, setReady] = useState(false)
  const [zoom, setZoom] = useState(7)
  const simTime = dataset.referenceTime - (56 - time) * 3600000
  const approach = useMemo(() => spill && vessel && vessel.track.length >= 2 ? closestApproach(vessel, spill) : null, [spill, vessel])
  const evidenceVisible = !!(approach && spill && spill.detectedAt <= simTime && approach.atTime <= simTime && vessel && highlights.includes(vessel.id) && layers.tracks)

  // ── Map initialisation ───────────────────────────────────────────────────
  useEffect(() => {
    if (!host.current || map.current) return
    const m = L.map(host.current, { zoomControl: false, minZoom: 4, maxZoom: 17, attributionControl: true, scrollWheelZoom: !L.Browser.mobile, zoomSnap: .5 }).setView(region, 7)
    map.current = m
    incidentGroup.current = L.layerGroup().addTo(m)
    evidenceGroup.current = L.layerGroup().addTo(m)
    measurementGroup.current = L.layerGroup().addTo(m)
    m.createPane('placeLabels')
    m.getPane('placeLabels')!.style.pointerEvents = 'none'
    m.getPane('placeLabels')!.style.zIndex = '350'
    PLACE_LABELS.forEach(p => L.marker([p.lat, p.lng], { interactive: false, keyboard: false, pane: 'placeLabels', icon: L.divIcon({ className: 'place-label', html: `<span>· ${escapeHtml(p.name)}</span>`, iconSize: [130, 16], iconAnchor: [-7, 8] }) }).addTo(m))
    L.control.scale({ position: 'bottomleft', imperial: false, maxWidth: 90 }).addTo(m)
    let last = 0
    m.on('mousemove', (e: L.LeafletMouseEvent) => {
      if (Date.now() - last < 150) return
      last = Date.now()
      setCoords(formatCoordinate(e.latlng.lat, e.latlng.lng))
    })
    m.on('moveend', () => { const c = m.getCenter(); setCoords(formatCoordinate(c.lat, c.lng)) })
    m.on('zoomend', () => setZoom(m.getZoom()))
    m.on('click', (event: L.LeafletMouseEvent) => {
      if (!measuring.current || !measurementGroup.current) return
      const group = measurementGroup.current
      if (measurementPoints.current.length === 2) { measurementPoints.current = []; group.clearLayers() }
      measurementPoints.current.push(event.latlng)
      L.circleMarker(event.latlng, { radius: 4, color: '#bce1bd', fillOpacity: 1 }).addTo(group)
      if (measurementPoints.current.length === 2) {
        const [a, b] = measurementPoints.current
        const distance = haversineKm(a.lat, a.lng, b.lat, b.lng)
        const text = `${distance.toFixed(2)} km / ${(distance / 1.852).toFixed(2)} nm`
        L.polyline([a, b], { color: '#bce1bd', weight: 2, dashArray: '5 5' }).bindTooltip(text, { permanent: true, direction: 'center' }).addTo(group)
        setMeasurement(text)
      } else setMeasurement('Select an end point on the map')
    })
    const resize = new ResizeObserver(() => { if (map.current) map.current.invalidateSize({ pan: false }) })
    resize.observe(host.current)
    setReady(true)
    return () => {
      resize.disconnect()
      // Stop all animations before removing to prevent "map is null" errors
      try { m.stop() } catch { /* ignore */ }
      m.remove()
      map.current = null
      fleet.current.clear()
      incidents.current.clear()
    }
  }, [])

  // ── Tile layer ────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    let disposed = false
    let successes = 0
    let failures = 0
    let fallback = false
    let layer: L.TileLayer
    let timeout: ReturnType<typeof setTimeout>
    setTileStatus('loading')

    const attach = (satellite: boolean) => {
      const url = satellite
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}.png'
      layer = L.tileLayer(url, {
        maxZoom: 19,
        keepBuffer: 2,
        className: satellite ? 'satellite-tiles' : 'cartographic-tiles',
        attribution: satellite
          ? 'Tiles © Esri, Maxar, Earthstar Geographics'
          : '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      })
      const fail = () => {
        if (disposed) return
        if (satellite && !fallback && successes === 0) {
          fallback = true; failures = 0
          try { layer.off(); layer.remove() } catch { /* ignore */ }
          clearTimeout(timeout)
          setTileStatus('fallback')
          attach(false)
        } else setTileStatus('error')
      }
      layer.on('tileload', () => {
        if (disposed) return
        successes++
        clearTimeout(timeout)
        setTileStatus(fallback ? 'fallback' : 'ready')
      })
      layer.on('tileerror', () => { failures++; if (failures >= 3 && successes === 0) fail() })
      timeout = setTimeout(() => { if (!successes) fail() }, 10000)
      // Guard: only add if map still exists
      if (map.current) layer.addTo(m)
    }

    attach(layers.satellite)

    return () => {
      disposed = true
      clearTimeout(timeout)
      // Guard: stop animations before removing tile layer
      try { m.stop() } catch { /* ignore */ }
      try { layer.off(); layer.remove() } catch { /* ignore */ }
    }
  }, [layers.satellite, ready, retry])

  // ── Incidents ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const group = incidentGroup.current
    if (!group || !ready) return
    const visible = new Set<string>()
    if (layers.spills) dataset.spills.filter(s => s.detectedAt <= simTime).forEach(s => {
      visible.add(s.id)
      const active = spill?.id === s.id
      const color = colors[s.severity]
      let entry = incidents.current.get(s.id)
      if (!entry) {
        const polygon = L.polygon(blobPoints(s.lat, s.lng, Math.sqrt(s.area) * 1.3 + 1.5, hashStr(s.id)), { color, weight: 1, fillOpacity: .12 }).addTo(group)
        polygon.bindTooltip('Illustrative footprint · not survey geometry')
        polygon.on('click', () => { if (!measuring.current) handlers.current.onSpill(s.id) })
        const marker = L.marker([s.lat, s.lng], { title: s.name, alt: s.name, icon: L.divIcon({ className: 'incident-marker' }) }).addTo(group)
        marker.on('click', () => { if (!measuring.current) handlers.current.onSpill(s.id) })
        entry = { marker, polygon, selected: !active }
        incidents.current.set(s.id, entry)
      }
      if (entry.selected !== active) {
        const label = `<span class="incident-pin ${active ? 'is-selected' : ''}" style="--pin:${color}"><i></i><b>${escapeHtml(s.id.replace('S', '0'))}</b></span>${active ? `<span class="map-incident-label"><small>DETECTION ${escapeHtml(s.id.replace('S', '0'))} / ${s.confidence}% CONFIDENCE</small><strong>${escapeHtml(s.name)}</strong><em>${s.area} km² · ${s.status.toUpperCase()}</em></span>` : ''}`
        entry.marker.setIcon(L.divIcon({ className: 'incident-marker', html: label, iconSize: [40, 40], iconAnchor: [16, 16] })).setZIndexOffset(active ? 600 : 400)
        entry.polygon.setStyle({ weight: active ? 1.7 : 1, fillOpacity: active ? .25 : .12 })
        entry.selected = active
      }
    })
    incidents.current.forEach((entry, id) => {
      if (!visible.has(id)) {
        try { group.removeLayer(entry.marker); group.removeLayer(entry.polygon) } catch { /* ignore */ }
        incidents.current.delete(id)
      }
    })
  }, [dataset, spill, simTime, layers.spills, ready])

  // ── Vessels ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    const available = new Set<string>()
    dataset.vessels.filter(v => v.track.length && v.track[0].t <= simTime).forEach(v => {
      available.add(v.id)
      const pos = interpAt(v, 56 - time, dataset.referenceTime)
      const selected = vessel?.id === v.id || highlights.includes(v.id)
      const color = selected ? '#b8d7a0' : '#839b91'
      let entry = fleet.current.get(v.id)
      if (!entry) {
        const marker = L.marker([pos.lat, pos.lng], { icon: shipIcon(pos.course, selected), title: v.name, alt: `Inspect ${v.name}` })
        marker.bindTooltip('', { direction: 'top', offset: [0, -12] })
        marker.on('click', () => { if (!measuring.current) handlers.current.onVessel(v.id) })
        entry = { marker, track: L.polyline([], { weight: 1 }), points: L.layerGroup(), selected, pointKey: '' }
        fleet.current.set(v.id, entry)
      }
      entry.marker.setLatLng([pos.lat, pos.lng]).setOpacity(vessel && !selected ? .4 : 1).setZIndexOffset(selected ? 700 : 200)
      if (entry.selected !== selected) { entry.marker.setIcon(shipIcon(pos.course, selected)); entry.selected = selected }
      const shape = entry.marker.getElement()?.querySelector<HTMLElement>('.ship-shape')
      if (shape) shape.style.transform = `rotate(${pos.course}deg)`
      entry.marker.setTooltipContent(`<b>${escapeHtml(v.name)}</b><br/>MMSI ${escapeHtml(v.mmsi)} · ${escapeHtml(v.flag)}<br/>${pos.speed.toFixed(1)} kn · ${Math.round(pos.course)}°<br/>${new Date(simTime).toISOString().slice(11, 16)} UTC · simulated position`)
      if (layers.vessels) { if (!m.hasLayer(entry.marker)) entry.marker.addTo(m) } else entry.marker.remove()
      const observed = v.track.filter(p => p.t <= simTime)
      const past: L.LatLngTuple[] = observed.map(p => [p.lat, p.lng])
      past.push([pos.lat, pos.lng])
      entry.track.setLatLngs(past).setStyle({ color, weight: selected ? 2.2 : 1, opacity: selected ? .9 : .32, dashArray: selected ? undefined : '3 6' })
      if (layers.tracks && past.length > 1) { if (!m.hasLayer(entry.track)) entry.track.addTo(m) } else entry.track.remove()
      const pointKey = `${selected && layers.tracks}:${observed.length}`
      if (entry.pointKey !== pointKey) {
        entry.points.clearLayers()
        if (selected && layers.tracks) observed.forEach(p => L.circleMarker([p.lat, p.lng], { radius: 2.5, color, fillOpacity: 1, weight: 1 }).bindTooltip(`${new Date(p.t).toUTCString()} · ${p.speed} kn`).addTo(entry!.points))
        entry.pointKey = pointKey
      }
      if (!m.hasLayer(entry.points)) entry.points.addTo(m)
    })
    fleet.current.forEach((entry, id) => {
      if (!available.has(id)) {
        try { entry.marker.remove(); entry.track.remove(); entry.points.remove() } catch { /* ignore */ }
        fleet.current.delete(id)
      }
    })
  }, [dataset, simTime, time, vessel, highlights, layers.vessels, layers.tracks, ready])

  // ── Evidence line ─────────────────────────────────────────────────────────
  useEffect(() => {
    const group = evidenceGroup.current
    if (!group || !ready) return
    group.clearLayers()
    if (!evidenceVisible || !approach || !spill) return
    L.polyline([[approach.lat, approach.lng], [spill.lat, spill.lng]], { color: '#efb38b', weight: 1.5, dashArray: '4 4', className: 'evidence-line' }).addTo(group)
    L.circleMarker([approach.lat, approach.lng], { color: '#efb38b', radius: 4, fillColor: '#0a1313', fillOpacity: 1, weight: 2 }).bindTooltip(`${approach.distKm.toFixed(1)} km closest approach · ${new Date(approach.atTime).toISOString().slice(11, 16)} UTC`, { permanent: !overview, direction: 'bottom', className: 'evidence-tooltip' }).addTo(group)
    const r = approach.course * Math.PI / 180
    L.polyline([[approach.lat, approach.lng], [approach.lat + Math.cos(r) * 8 / 111.32, approach.lng + Math.sin(r) * 8 / (111.32 * Math.cos(approach.lat * Math.PI / 180))]], { color: '#b8d7a0', weight: 2, opacity: .65 }).bindTooltip(`Heading ${Math.round(approach.course)}° · vector shown at 8 km`).addTo(group)
  }, [approach, evidenceVisible, spill, overview, ready])

  // ── Camera ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const m = map.current
    if (!m || !ready) return
    try { m.stop() } catch { /* ignore */ }
    const options = { animate: !reducedMotion, duration: .9 }
    if (overview) m.flyTo(region, 7, options)
    else if (spill && vessel && vessel.track.length) m.flyToBounds(L.latLngBounds([[spill.lat, spill.lng], ...vessel.track.map(p => [p.lat, p.lng] as L.LatLngTuple)]), { ...options, paddingTopLeft: [45, 85], paddingBottomRight: [65, 100], maxZoom: 9 })
    else if (spill) m.flyTo([spill.lat, spill.lng], 8, options)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spill?.id, vessel?.id, overview, reducedMotion, ready, focusVersion])

  const toggleMeasure = () => {
    const next = !measure
    measuring.current = next; setMeasure(next); setMeasurement(null)
    measurementPoints.current = []; measurementGroup.current?.clearLayers()
  }
  const fitRegion = () => {
    const bounds = L.latLngBounds(dataset.spills.map(s => [s.lat, s.lng] as L.LatLngTuple))
    if (bounds.isValid()) map.current?.flyToBounds(bounds, { padding: [75, 95], maxZoom: 8, animate: !reducedMotion })
  }

  return (
    <div className="intelligence-map" data-map-ready={ready} data-measuring={measure}>
      <div ref={host} className="leaflet-host" aria-label="Interactive Arabian Sea map. Arrow keys pan; plus and minus zoom." />
      <div className="map-coordinate"><Crosshair size={12} /><span>{coords}</span><span className="coordinate-datum">WGS 84</span></div>
      <div className="map-zoom">
        <Button size="icon" variant="outline" aria-label={expanded ? 'Restore workspace' : 'Expand map'} onClick={onExpand}>{expanded ? <Minimize2 /> : <Maximize2 />}</Button>
        <Button size="icon" variant="outline" aria-label="Measure map distance" aria-pressed={measure} onClick={toggleMeasure}><Ruler /></Button>
        <Button size="icon" variant="outline" aria-label="Focus selected incident" disabled={!spill} onClick={() => spill && map.current?.flyTo([spill.lat, spill.lng], 10, { animate: !reducedMotion })}><LocateFixed /></Button>
        <Button size="icon" variant="outline" aria-label="Zoom in" disabled={zoom >= 17} onClick={() => map.current?.zoomIn()}><Plus /></Button>
        <Button size="icon" variant="outline" aria-label="Zoom out" disabled={zoom <= 4} onClick={() => map.current?.zoomOut()}><Minus /></Button>
        <Button size="icon" variant="outline" aria-label="Fit all incidents" onClick={fitRegion}><RotateCcw /></Button>
      </div>
      {measure && (
        <div className="measurement-status" role="status">
          <Ruler size={14} />
          <span>{measurement ?? 'Select a start point on the map'}<small>Geodesic distance · two points · click again to restart</small></span>
          <button aria-label="Close measurement" onClick={toggleMeasure}><X size={16} /></button>
        </div>
      )}
      {tileStatus === 'loading' && <span className="basemap-loading" role="status">Loading basemap…</span>}
      {(tileStatus === 'error' || tileStatus === 'fallback') && (
        <div className="tile-warning" role="status">
          {tileStatus === 'fallback' ? 'Satellite unavailable. Showing CARTO basemap.' : 'Basemap connection interrupted.'}
          {' '}<button onClick={() => setRetry(n => n + 1)}>Retry</button>
        </div>
      )}
    </div>
  )
}
