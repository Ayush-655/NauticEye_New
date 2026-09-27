'use client'

import { ArrowUpRight, Check, Radio, SlidersHorizontal, Crosshair, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Button } from '@/components/ui/button'
import { SarView } from './sar-view'
import { cn } from '@/lib/utils'
import type { Spill } from '@/lib/nauticeye/types'

type Props = { spills: Spill[]; selectedId: string | null; onSelect: (id: string) => void; simTime: number; referenceTime: number; lightweight: boolean; deck?: boolean }

export function DetectionList({ spills, selectedId, onSelect, simTime, lightweight, deck = false }: Props) {
  const [activeOnly, setActiveOnly] = useState(false)
  const [query, setQuery] = useState('')
  const id = useId()
  const shown = spills.filter(s => (!activeOnly || s.status === 'active') && `${s.name} ${s.id} ${s.status} ${s.severity} ${s.satellite}`.toLowerCase().includes(query.trim().toLowerCase()))
  return <section className={cn('detection-feed', deck && 'detection-deck')} aria-label="Detection feed">
    <div className="feed-heading"><div><span className="eyebrow"><Crosshair size={12} /> INCIDENT REGISTER</span><h2>Signals worth investigating.<span>{String(shown.length).padStart(2, '0')}</span></h2></div><button className={cn('filter-button', activeOnly && 'active')} aria-label={activeOnly ? 'Show all detections' : 'Show active detections only'} aria-pressed={activeOnly} onClick={() => setActiveOnly(v => !v)}><SlidersHorizontal size={13} /><span>{activeOnly ? 'Active only' : 'All detections'}</span></button></div>
    {!deck && <div className="register-search"><Field><FieldLabel htmlFor={id} className="sr-only">Search detections</FieldLabel><Input id={id} type="search" placeholder="Search incidents or status…" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" /></Field><span className="register-count" role="status">{shown.length} of {spills.length} incidents{activeOnly ? ' · active only' : ''}</span></div>}
    <div className="detection-items">{shown.map(s => {
      const pending = s.detectedAt > simTime
      const age = Math.abs(simTime - s.detectedAt) / 3600000
      const ageText = age < 1 ? `${Math.round(age * 60)}m` : age < 24 ? `${Math.floor(age)}h` : `${Math.floor(age / 24)}d`
      return <button key={s.id} className={cn('detection-item', selectedId === s.id && 'selected', pending && 'pending')} data-severity={s.severity} data-status={s.status} data-testid={`detection-${s.id}`} disabled={pending} onClick={() => onSelect(s.id)} aria-pressed={selectedId === s.id}>
        <span className="detection-index">{s.id.replace('S', '0')}</span>
        <SarView spill={s} miniature lightweight={lightweight} />
        <span className="detection-copy"><span className="detection-meta">{s.status === 'resolved' ? <Check size={10} /> : <Radio size={10} />}<span>{pending ? 'NOT YET DETECTED' : s.status.toUpperCase()}</span><i>·</i>{pending ? `in ${ageText}` : `${ageText} ago`}</span><strong>{s.name}</strong><span className="detection-location">{s.area} km² <i>·</i> {s.lat.toFixed(2)}° N, {s.lng.toFixed(2)}° E</span></span>
        <span className="detection-confidence"><span>{s.confidence}<small>%</small></span><ArrowUpRight size={14} /></span>
      </button>
    })}</div>
    {!shown.length && <div className="search-empty"><Search size={22} /><p>No incidents match this search.</p><Button variant="outline" size="sm" onClick={() => { setQuery(''); setActiveOnly(false) }}>Reset filters</Button></div>}
    {!deck && <div className="feed-legend"><span><i className="high-dot" />High severity</span><span><i className="review-dot" />Review</span><span><i className="resolved-dot" />Resolved</span></div>}
  </section>
}
