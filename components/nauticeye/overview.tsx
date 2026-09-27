'use client'

import { ArrowRight, ArrowUpRight, Play, Satellite, ScanLine, Route, FileCheck2, ChevronRight, Crosshair } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SarView } from './sar-view'
import type { Spill } from '@/lib/nauticeye/types'

export function OverviewIntro({ onEnter, onTour, count, vessels, active }: { onEnter: () => void; onTour: () => void; count: number; vessels: number; active: number }) {
  return <section className="overview-intro" aria-label="NauticEye introduction">
    <div className="eyebrow mission-eyebrow"><span className="eyebrow-line" /> INTELLIGENCE BEYOND THE SURFACE</div>
    <h1>The ocean<br/>leaves <em>evidence.</em></h1>
    <p className="hero-description">See the spill. Reconstruct the journey.<br/>Connect the evidence.</p>
    <p className="hero-context">Satellite observation meets vessel intelligence.<br/>A clearer picture of what happened at sea.</p>
    <div className="intro-actions"><Button onClick={onEnter} size="lg">Enter intelligence <ArrowUpRight data-icon="inline-end" /></Button><button className="tour-trigger" onClick={onTour}><span><Play size={11} fill="currentColor" /></span>Watch the investigation</button></div>
    <div className="overview-stats"><div><strong>{String(count).padStart(2, '0')}<span> detections</span></strong><small>IN OBSERVATION WINDOW</small></div><div><strong>{String(vessels).padStart(2, '0')}<span> vessels</span></strong><small>HISTORIES RECONSTRUCTED</small></div></div>
    <div className="hero-footnote"><span className="status-dot" />{active} active incidents<span>ARABIAN SEA / WESTERN INDIA</span></div>
  </section>
}

export function AcquisitionPreview({ spill, onEnter, lightweight }: { spill: Spill; onEnter: () => void; lightweight: boolean }) {
  return <section className="acquisition-preview" aria-label="Featured satellite acquisition">
    <div className="preview-heading"><span className="eyebrow"><Satellite size={12} /> ACQUISITION / {spill.id.replace('S', '0')}</span><span className="preview-cross">+</span></div>
    <SarView spill={spill} lightweight={lightweight} />
    <div className="preview-description"><span className="eyebrow">{spill.satellite.replace(' (simulated)', '')}<span>{new Date(spill.detectedAt).toISOString().slice(11, 16)} UTC</span></span><h2>{spill.name}</h2>
      <div className="preview-metrics"><span><b>{spill.confidence}<small>%</small></b>CONFIDENCE</span><span><b>{spill.area}<small> km²</small></b>SPILL FOOTPRINT</span></div>
      <button onClick={onEnter}>Examine the evidence <ArrowUpRight size={15} /></button>
    </div>
    <div className="preview-bottom"><span className="status-dot" /> SYNTHETIC SCENE · ANALYST DEMO</div>
  </section>
}

export const narrativeSteps = [
  { icon: Satellite, label: 'Acquire', title: 'A signature in the noise.', body: 'Synthetic SAR backscatter reveals a low-texture anomaly. Inspect the raw scene, then reveal the illustrative segmentation contour.' },
  { icon: ScanLine, label: 'Detect', title: 'The anomaly has a location.', body: 'An incident takes shape in the Arabian Sea. Confidence, estimated footprint, and acquisition time stay attached to the evidence.' },
  { icon: Route, label: 'Correlate', title: 'Reconstruct who was there.', body: 'Follow the AIS history. Closest approach, time offset, and course alignment explain why one vessel becomes a stronger lead.' },
  { icon: FileCheck2, label: 'Investigate', title: 'A lead. Not a conclusion.', body: 'Replay the preceding 56 hours. Examine alternative candidates, flag a vessel for review, and export the evidence—not an assumption.' },
]

export function PipelineNav({ onStep }: { onStep: (step: number) => void }) {
  return <nav className="map-pipeline" aria-label="Explore the investigation pipeline">{narrativeSteps.map(({ icon: Icon, label }, index) => <button key={label} onClick={() => onStep(index)}><span>0{index + 1}</span><Icon size={13} /><span>{label}</span>{index < 3 && <ChevronRight size={11} />}</button>)}</nav>
}

export function StoryPanel({ step, onStep, onFinish }: { step: number; onStep: (step: number) => void; onFinish: () => void }) {
  const current = narrativeSteps[step]
  return <section className="story-panel" aria-label="Guided product story">
    <div className="eyebrow"><span className="eyebrow-line" /> THE INVESTIGATION / 0{step + 1}</div>
    <div className="story-chapter" aria-hidden="true">0{step + 1}<current.icon size={30} strokeWidth={1} /></div>
    <div key={step} className="story-content"><h1>{current.title}</h1><p>{current.body}</p></div>
    <div className="story-progress">{narrativeSteps.map((s, i) => <button key={s.label} aria-label={`Step ${i + 1}: ${s.label}`} aria-current={step === i ? 'step' : undefined} onClick={() => onStep(i)}><span>0{i + 1}</span>{s.label}{step === i && <ArrowRight size={13} />}</button>)}</div>
    <Button onClick={() => step < 3 ? onStep(step + 1) : onFinish()} size="lg">{step < 3 ? 'Follow the evidence' : 'Open investigation'}<ArrowRight data-icon="inline-end" /></Button>
    <span className="story-disclaimer">An exploration of the supplied simulation.<br/>Weather, drift, and origin models are not connected.</span>
  </section>
}
