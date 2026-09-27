'use client'

import { useState } from 'react'
import { ArrowUpRight, CircleHelp, Radar, Satellite, Waves, Search, Ship, Crosshair } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { MaritimeDataset } from '@/lib/nauticeye/types'

export type ConsoleMode = 'overview' | 'intelligence' | 'story'

export function MissionHeader({ mode, count, onOverview, onEnter, onCases, onHelp, onSearch }: { mode: ConsoleMode; count: number; onOverview: () => void; onEnter: () => void; onCases: () => void; onHelp: () => void; onSearch: () => void }) {
  return <>
    <header className="command-header">
      <a href="/" className="brand" onClick={event => { event.preventDefault(); onOverview() }} aria-label="NauticEye overview">
        <span className="brand-symbol"><Radar size={32} strokeWidth={1.4} /></span>
        <span>Nautic<span className="brand-eye">Eye</span><small>OCEAN INTELLIGENCE SYSTEM</small></span>
      </a>
      <nav className="primary-nav" aria-label="Main navigation">
        <button aria-current={mode === 'overview' ? 'page' : undefined} onClick={onOverview}>Overview</button>
        <button aria-current={mode !== 'overview' ? 'page' : undefined} onClick={onEnter}>Intelligence<span className="nav-count">{String(count).padStart(2, '0')}</span></button>
        <button onClick={onCases}>Case archive<ArrowUpRight size={12} /></button>
      </nav>
      <div className="header-right"><span className="simulation-label"><span />SIMULATION</span><Button variant="ghost" size="icon" aria-label="Search incidents and vessels" title="Search incidents and vessels (Ctrl / ⌘ K)" onClick={onSearch}><Search /></Button><Button variant="ghost" size="icon" aria-label="About this demonstration" onClick={onHelp}><CircleHelp /></Button><button className="team-avatar" onClick={onHelp} aria-label="About Team Raw Onions">RO</button></div>
    </header>
    <div className="mission-bar"><span><Waves size={13} /> MARITIME DOMAIN AWARENESS</span><span><Satellite size={12} /> SAR IMAGERY <i>+</i> AIS VESSEL INTELLIGENCE</span><span className="mission-id">SIH 2026 <i>/</i> TEAM RAW ONIONS</span></div>
  </>
}

export function MissionDialog({ dialog, onClose, dataset, onCase, onVessel }: { dialog: 'help' | 'cases' | 'search' | null; onClose: () => void; dataset: MaritimeDataset; onCase: (id: string) => void; onVessel: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const term = query.trim().toLowerCase()
  const cases = dataset.spills.filter(s => `${s.id} ${s.name} ${s.status} ${s.severity} ${s.satellite}`.toLowerCase().includes(term))
  const vessels = dialog === 'search' ? dataset.vessels.filter(v => `${v.name} ${v.mmsi} ${v.flag} ${v.type}`.toLowerCase().includes(term)) : []
  return <Dialog open={dialog !== null} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{dialog === 'search' ? 'Find the evidence.' : dialog === 'cases' ? 'Investigation archive' : 'Intelligence, with context.'}</DialogTitle><DialogDescription>{dialog === 'search' ? 'Search incident names, vessel names, MMSI, or flag states.' : dialog === 'cases' ? `${dataset.spills.length} synthetic incidents. Every case retains its original evidence.` : 'NauticEye · Team Raw Onions · Smart India Hackathon 2026'}</DialogDescription></DialogHeader>
      {dialog === 'cases' || dialog === 'search' ? <>
        <Field><FieldLabel htmlFor="mission-search" className="sr-only">Search {dialog === 'cases' ? 'archive' : 'incidents and vessels'}</FieldLabel><Input id="mission-search" type="search" placeholder={dialog === 'cases' ? 'Name, status, satellite…' : 'Incident, vessel, or MMSI…'} value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" /></Field>
        <div className="search-results" aria-live="polite"><span className="eyebrow">{cases.length + vessels.length} MATCHING RECORDS</span>
          {!!cases.length && <><h3 className="search-group-title"><Crosshair size={13} /> INCIDENTS</h3><div className="case-file-list">{cases.map(s => <button key={s.id} onClick={() => onCase(s.id)}><span>{s.id.replace('S', '0')}</span><div><strong>{s.name}</strong><small>{s.status.toUpperCase()} · {s.area} km² · {s.confidence}% confidence</small></div><ArrowUpRight size={16} /></button>)}</div></>}
          {!!vessels.length && <><h3 className="search-group-title"><Ship size={13} /> VESSEL HISTORIES</h3><div className="case-file-list">{vessels.map(v => <button key={v.id} onClick={() => onVessel(v.id)}><Ship size={16} /><div><strong>{v.name}</strong><small>{v.mmsi} · {v.flag} · {v.type}</small></div><ArrowUpRight size={16} /></button>)}</div></>}
          {!cases.length && !vessels.length && <div className="search-empty"><Search size={24} /><h3>No matching evidence</h3><p>Try a shorter name, vessel MMSI, or incident status.</p><Button variant="outline" onClick={() => setQuery('')}>Clear search</Button></div>}
        </div>
      </> : <div className="help-content">
        <p>All incident records, vessel identities, SAR textures, and case outcomes are <strong>simulated</strong>, referenced to {new Date(dataset.referenceTime).toUTCString()}. Geographic basemap imagery is supplied by Esri or CARTO.</p>
        <h3>Evidence before conclusions.</h3><p>Correlation combines proximity (45%), timing (35%), and course alignment (20%), then gates the result by proximity. A high score is an investigative lead—not a probability of guilt. Replay changes the historical scene; correlation uses the full recorded history.</p>
        <h3>Navigate the investigation.</h3><p>Select an incident, inspect a vessel, and jump to its closest approach. Use the ruler to measure distance between two map points. Expand the map for an unobstructed view; press Escape to return. Search all records with Ctrl/⌘ K.</p>
        <h3>What is not connected?</h3><p>No live satellite, AIS, weather, drift, or origin-estimation backend is connected. Investigation flags last for this session only. Export an HTML report, full JSON evidence, CSV rankings, or GeoJSON to keep the investigation. GeoJSON footprints are illustrative, not survey geometry.</p>
        <h3>A lighter way to investigate.</h3><p>The interface respects reduced motion and data-saving preferences. The lightweight console provides cases, vessel evidence, historical positions, and reports without JavaScript.</p><a href="/lite">Open lightweight console <ArrowUpRight size={14} /></a>
      </div>}
    </DialogContent>
  </Dialog>
}

export function SystemFooter({ vessels }: { vessels: number }) {
  return <footer className="system-footer"><span><span className="status-dot" /> DEMONSTRATION DATA <i>/</i> NOT A LIVE FEED</span><span className="footer-center">{vessels} VESSEL HISTORIES <i>·</i> 56 HOURS OF EVIDENCE</span><a href="/lite">LIGHTWEIGHT VIEW <ArrowUpRight size={11} /></a></footer>
}
