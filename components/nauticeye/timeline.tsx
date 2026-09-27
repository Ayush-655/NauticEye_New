'use client'

import { Pause, Play, RotateCcw, SkipForward, Satellite } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Spill } from '@/lib/nauticeye/types'

export function Timeline({ value, onChange, playing, onPlay, speed, onSpeed, spills, referenceTime }: { value: number; onChange: (value: number) => void; playing: boolean; onPlay: () => void; speed: number; onSpeed: () => void; spills: Spill[]; referenceTime: number }) {
  const stamp = new Date(referenceTime - (56 - value) * 3600000)
  return <section className="timeline-dock" aria-label="Historical vessel replay">
    <div className="timeline-heading"><span className="eyebrow"><span className={playing ? 'status-dot' : 'status-dot paused'} />TEMPORAL REPLAY</span><div className="timeline-stamp"><strong>{stamp.toISOString().slice(11, 16)}</strong><span>UTC / {stamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' }).toUpperCase()}</span></div></div>
    <div className="playback-buttons"><Button size="icon" variant="ghost" onClick={() => onChange(0)} aria-label="Rewind to start"><RotateCcw /></Button><Button size="icon-lg" onClick={onPlay} aria-label={playing ? 'Pause replay' : 'Play replay'}>{playing ? <Pause /> : <Play />}</Button><Button size="icon" variant="ghost" onClick={() => onChange(56)} aria-label="Jump to latest"><SkipForward /></Button></div>
    <div className="timeline-instrument">
      <div className="timeline-events" aria-label="Satellite detection events">{spills.map(s => { const position = 56 - (referenceTime - s.detectedAt) / 3600000; return <button key={s.id} style={{ left: `${position / 56 * 100}%` }} title={`${s.name} — jump to detection`} aria-label={`Jump to ${s.name} detection`} onClick={() => onChange(position)} className={value >= position ? 'occurred' : ''}><Satellite size={12} /><span>{s.id.replace('S', '0')}</span></button> })}</div>
      <div className="timeline-ruler"><div className="timeline-progress" style={{ width: `${value / 56 * 100}%` }} /><input aria-label="Replay time" aria-valuetext={`${stamp.toUTCString()}, ${(56 - value).toFixed(1)} hours before reference time`} type="range" min="0" max="56" step="0.1" value={value} onChange={e => onChange(Number(e.target.value))} /></div>
      <div className="timeline-labels">{['−56 h', '−42 h', '−28 h', '−14 h', 'LATEST'].map(label => <span key={label}>{label}</span>)}</div>
    </div>
    <div className="timeline-end"><button onClick={onSpeed} aria-label={`Replay speed ${speed} times; change speed`}>{speed}× <span>PLAYBACK</span></button><span className="eyebrow">56-HOUR WINDOW</span></div>
  </section>
}
