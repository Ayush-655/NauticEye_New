'use client'

import { useState } from 'react'
import { Layers3, Satellite, ChevronDown, X, Navigation2 } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { Layers } from '@/lib/nauticeye/types'

export function MapToolbar({ layers, onLayers, activeCount, vesselCount }: { layers: Layers; onLayers: (layers: Layers) => void; activeCount: number; vesselCount: number }) {
  const [open, setOpen] = useState(false)
  return <><div className="map-topbar"><div className="map-region"><span className="eyebrow">AREA OF INTEREST <span>01</span></span><strong>Arabian Sea <i>/</i> Western India</strong></div><div className="map-toolbar-actions"><Button variant="outline" onClick={() => onLayers({ ...layers, satellite: !layers.satellite })} aria-pressed={layers.satellite}><Satellite data-icon="inline-start" /><span>{layers.satellite ? 'Satellite' : 'Basemap'}</span></Button><Button variant="outline" onClick={() => setOpen(v => !v)} aria-expanded={open} aria-controls="map-layers"><Layers3 data-icon="inline-start" />Layers<ChevronDown data-icon="inline-end" /></Button></div></div>
    {open && <section className="layer-panel" id="map-layers" aria-label="Map layers"><div className="section-heading"><h3>Visible layers</h3><Button variant="ghost" size="icon-sm" aria-label="Close layers" onClick={() => setOpen(false)}><X /></Button></div>{([{ key: 'spills', label: 'Oil-spill footprints' }, { key: 'vessels', label: 'AIS vessels' }, { key: 'tracks', label: 'Historical vessel tracks' }] as const).map(({ key, label }) => <label key={key} className="layer-row"><span>{label}</span><Switch aria-label={label} checked={layers[key]} onCheckedChange={checked => onLayers({ ...layers, [key]: checked })} /></label>)}<div className="map-symbol-legend"><span><i className="high-dot" /> High-severity detection</span><span><i className="review-dot" /> Medium-severity detection</span><span><Navigation2 size={12} /> AIS vessel position</span><span><i className="legend-track" /> Highlighted vessel history</span></div><p>Footprints and vessel history are simulated. Basemap imagery is not the SAR acquisition. Vessel positions appear only after their first AIS observation.</p></section>}
    <div className="map-bottom-context"><span className="map-north"><Navigation2 size={15} /><b>N</b></span><span className="eyebrow"><i className="high-dot" /> {activeCount} DETECTIONS{layers.spills ? '' : ' · HIDDEN'}</span><span className="map-data-source">{vesselCount} AIS VESSELS · SIMULATED</span></div>
  </>
}
