'use client'

import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowLeft, ArrowRight, Check, ChevronDown, Flag, Route, Ship, X, Crosshair, Clock3, Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SarView } from './sar-view'
import { angleDiff, bearingDeg, closestApproach, rankVessels } from '@/lib/nauticeye/engine'
import { ExportDialog } from './export-dialog'
import type { Spill, Vessel, RankedVessel } from '@/lib/nauticeye/types'
import { cn } from '@/lib/utils'

function VesselEvidence({ entry, spill, expanded, onExpand, trackOn, onTrack, flagged, onFlag, onSeek }: { entry: RankedVessel; spill: Spill; expanded: boolean; onExpand: () => void; trackOn: boolean; onTrack: () => void; flagged: boolean; onFlag: () => void; onSeek: (stamp: number) => void }) {
  const { vessel, score } = entry
  const ca = closestApproach(vessel, spill)
  const heading = angleDiff(ca.course, bearingDeg(ca.lat, ca.lng, spill.lat, spill.lng))
  return <article className={cn('vessel-evidence', expanded && 'expanded')}>
    <button className="vessel-summary" onClick={onExpand} aria-expanded={expanded} aria-label={`Inspect ${vessel.name}`}><span className="vessel-symbol"><Ship size={16} /></span><span><strong>{vessel.name}</strong><small>{vessel.flag} · {vessel.type}</small></span><b className={score.overall >= 70 ? 'strong-score' : ''}>{score.overall}<small>%</small></b><ChevronDown size={13} /></button>
    <div className="correlation-bar"><i style={{ width: `${score.overall}%` }} /></div>
    {expanded && <div className="vessel-detail">
      <div className="evidence-id">MMSI {vessel.mmsi}<span>{flagged ? 'FLAGGED' : 'AIS HISTORY'}</span></div>
      {[{ icon: Crosshair, label: 'Proximity', value: score.proximity, weight: '45%' }, { icon: Clock3, label: 'Time match', value: score.timeScore, weight: '35%' }, { icon: Compass, label: 'Course alignment', value: score.courseScore, weight: '20%' }].map(({ icon: Icon, label, value, weight }, i) => <div key={label} className="evidence-factor" style={{ '--factor-delay': `${i * 85}ms` } as React.CSSProperties}><Icon size={12} /><span>{label}<small>{weight} weight</small></span><div><i style={{ width: `${value}%` }} /></div><b>{value}</b></div>)}
      <div className="evidence-measures"><div><b>{score.distKm.toFixed(1)}<small> km</small></b><span>Closest approach</span></div><div><b>{score.timeDiffH.toFixed(1)}<small> h</small></b><span>Time offset</span></div><div><b>{heading.toFixed(0)}<small>°</small></b><span>Heading difference</span></div></div>
      <p className="evidence-explanation">Track approached the spill at {new Date(ca.atTime).toISOString().slice(11, 16)} UTC. Proximity gates the final score; distant vessels cannot rank on timing alone.</p>
      <div className="evidence-actions"><Button variant={trackOn ? 'secondary' : 'outline'} size="sm" aria-pressed={trackOn} onClick={onTrack}><Route data-icon="inline-start" />{trackOn ? 'Clear highlight' : 'Highlight track'}</Button><Button variant={flagged ? 'secondary' : 'outline'} size="sm" aria-pressed={flagged} onClick={onFlag} disabled={vessel.flagged}><Flag data-icon="inline-start" />{flagged ? 'Flagged' : 'Flag vessel'}</Button></div>
      <button className="approach-replay" onClick={() => onSeek(ca.atTime)}><Clock3 size={13} />Replay closest approach<ArrowRight size={13} /></button>
      <span className="session-note">Investigation flags are session-only in this demo.</span>
    </div>}
  </article>
}

export function AnalysisPanel({ spill, vessels, vesselId, onVessel, highlights, onTrack, flags, onFlag, onClose, onTour, caseIndex, caseCount, referenceTime, replayTime, onSeek, lightweight, pending }: { spill: Spill; vessels: Vessel[]; vesselId: string | null; onVessel: (id: string | null) => void; highlights: string[]; onTrack: (id: string) => void; flags: Record<string, boolean>; onFlag: (id: string) => void; onClose: () => void; onTour: (delta: number) => void; caseIndex: number; caseCount: number; referenceTime: number; replayTime: number; onSeek: (stamp: number) => void; lightweight: boolean; pending: boolean }) {
  const ranked = useMemo(() => rankVessels(spill, vessels), [spill, vessels])
  const [showAll, setShowAll] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [raw, setRaw] = useState(false)
  const visibleCandidates = showAll ? ranked : ranked.filter((entry, index) => index < 5 || entry.vessel.id === vesselId)
  return <aside className="analysis-panel" aria-label="Incident investigation">
    <div className="analysis-topline"><span className="eyebrow"><Crosshair size={12} /> INCIDENT INTELLIGENCE</span><Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close investigation"><X /></Button></div>
    <div className="analysis-title"><span className={cn('case-state', spill.status)}>{spill.status === 'resolved' ? 'RESOLVED / SIMULATED OUTCOME' : spill.status === 'review' ? 'REQUIRES ANALYST REVIEW' : 'ACTIVE DETECTION'}</span><h2>{spill.name}</h2><p>{spill.lat.toFixed(3)}° N <span>/</span> {spill.lng.toFixed(3)}° E</p></div>
    <div className="case-navigation"><Button variant="ghost" size="icon-sm" onClick={() => onTour(-1)} aria-label="Previous case"><ArrowLeft /></Button><span>CASE {String(caseIndex + 1).padStart(2, '0')} <i>/</i> {String(caseCount).padStart(2, '0')}</span><Button variant="ghost" size="icon-sm" onClick={() => onTour(1)} aria-label="Next case"><ArrowRight /></Button></div>
    <div className="analysis-scroll">
      {pending && <p className="data-notice" role="status">This incident is not yet detected at the replay time. Showing its recorded case details; the map hides its footprint.</p>}
      <Tabs defaultValue="evidence">
        <TabsList variant="line" className="w-full"><TabsTrigger value="evidence">Evidence</TabsTrigger><TabsTrigger value="details">Case details</TabsTrigger></TabsList>
        <TabsContent value="evidence">
          <div className="sar-section"><div className="section-heading"><h3><SatelliteLabel /> SAR acquisition</h3><button className="text-control" onClick={() => setRaw(v => !v)} aria-pressed={!raw}>{raw ? 'SHOW MASK' : 'VIEW RAW'}</button></div><SarView spill={spill} mask={!raw} lightweight={lightweight} /><div className="acquisition-meta"><span>{spill.satellite.replace(' (simulated)', '')}</span><span>{new Date(spill.detectedAt).toISOString().slice(11, 16)} UTC</span></div></div>
          <div className="incident-metrics"><div><b>{spill.confidence}<small>%</small></b><span>Detection confidence</span></div><div><b>{spill.area}<small> km²</small></b><span>Estimated spill area</span></div></div>
          <div className="candidate-section"><div className="section-heading"><h3>Vessel correlation</h3><span className="count-label">{ranked.length} TRACKS</span></div><p className="subtle-copy">Ranked by spatial and temporal evidence.</p>
            {visibleCandidates.map(entry => <VesselEvidence onSeek={onSeek} key={entry.vessel.id} entry={entry} spill={spill} expanded={vesselId === entry.vessel.id} onExpand={() => onVessel(vesselId === entry.vessel.id ? null : entry.vessel.id)} trackOn={highlights.includes(entry.vessel.id)} onTrack={() => onTrack(entry.vessel.id)} flagged={!!flags[`${entry.vessel.id}__${spill.id}`] || !!entry.vessel.flagged} onFlag={() => onFlag(entry.vessel.id)} />)}
            {!ranked.length && <p className="muted-note">No vessels with sufficient AIS history for correlation.</p>}
            {ranked.length > 5 && <button className="show-all" onClick={() => setShowAll(v => !v)}>{showAll ? 'Show top 5 candidates' : `Explore all ${ranked.length} vessel tracks`}<ArrowRight size={13} /></button>}
            <p className="scientific-note">Correlation indicates a lead, not responsibility. Full available track history is used.</p>
          </div>
        </TabsContent>
        <TabsContent value="details"><div className="case-details"><h3>Incident assessment</h3><p>{spill.desc}</p><dl><dt>Acquisition</dt><dd>{new Date(spill.detectedAt).toUTCString()}</dd><dt>Satellite source</dt><dd>{spill.satellite}</dd><dt>Severity</dt><dd>{spill.severity}</dd><dt>Dataset</dt><dd>Geographically grounded synthetic demonstration</dd></dl>{spill.resolvedNote && <div className="resolution-note"><Check size={16} /><p><b>Simulated case resolution</b>{spill.resolvedNote}</p></div>}<h3>Data availability</h3><p>SAR textures and spill geometry are illustrative. Weather, drift reconstruction, and origin estimates are unavailable; no source attribution is inferred from those layers.</p></div></TabsContent>
      </Tabs>
    </div>
    <div className="analysis-footer"><Button onClick={() => setExportOpen(true)} className="w-full"><ArrowDownToLine data-icon="inline-start" />Export investigation<ArrowRight data-icon="inline-end" /></Button><span>HTML · JSON · CSV · GEOJSON</span></div>
    <ExportDialog open={exportOpen} onClose={() => setExportOpen(false)} spill={spill} ranked={ranked} flaggedIds={vessels.filter(v => flags[`${v.id}__${spill.id}`]).map(v => v.id)} context={{ referenceTime, replayTime }} />
  </aside>
}

function SatelliteLabel() { return <span className="sensor-mark" aria-hidden="true">+</span> }
