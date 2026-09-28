'use client'

/**
 * console.tsx  (updated)
 *
 * Changes from original:
 *  1. Imports useLiveVessels() and getLiveDataset()
 *  2. Keeps the prop dataset as the initial/fallback value
 *  3. Swaps to live vessels once the hook resolves
 *  4. Shows a small status badge so the user knows whether they're
 *     looking at live or demo data
 */

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useState, Component, type ReactNode } from 'react'
import {
  ArrowRight, ArrowUpRight, Crosshair, Radar, Map, ListFilter,
  Route, BookOpen, CircleHelp, Radio, Wifi, WifiOff, RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DetectionList } from './detection-list'
import { AnalysisPanel } from './analysis-panel'
import { AcquisitionPreview, OverviewIntro, StoryPanel, PipelineNav } from './overview'
import { MissionHeader, MissionDialog, SystemFooter, type ConsoleMode } from './mission-chrome'
import { Timeline } from './timeline'
import { MapToolbar } from './map-toolbar'
import { useCapabilities } from '@/lib/nauticeye/use-capabilities'
import { useLiveVessels } from '@/lib/nauticeye/use-live-vessels'
import { getLiveDataset } from '@/lib/nauticeye/data-source'
import { rankVessels } from '@/lib/nauticeye/engine'
import type { Layers, MaritimeDataset } from '@/lib/nauticeye/types'

const IntelligenceMap = dynamic(() => import('./intelligence-map'), {
  ssr: false,
  loading: () => (
    <div className="map-loading">
      <Radar size={28} />
      <span>Loading geographic canvas</span>
      <small>Incident data is already available.</small>
    </div>
  ),
})

class MapBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() {
    return this.state.failed
      ? (
        <div className="map-loading">
          <Map size={28} />
          <strong>Map renderer unavailable</strong>
          <p>Detection details, replay, and reports remain available.</p>
          <a href="/lite">Open lightweight view</a>
        </div>
      )
      : this.props.children
  }
}

// ─── Live-status badge ────────────────────────────────────────────────────────

function LiveStatusBadge({
  status,
  message,
  onRefresh,
}: {
  status: 'idle' | 'loading' | 'live' | 'demo' | 'error'
  message: string
  onRefresh: () => void
}) {
  if (status === 'idle' || status === 'loading') {
    return (
      <span
        style={{
          position: 'fixed', bottom: '44px', right: '14px', zIndex: 800,
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#101c20ee', border: '1px solid #263336',
          padding: '6px 10px', fontSize: '9px', fontFamily: 'var(--font-technical)',
          letterSpacing: '0.6px', color: '#8c9c9d',
        }}
        role="status"
        aria-live="polite"
      >
        <RefreshCw size={11} style={{ animation: 'spin 1.2s linear infinite' }} />
        CONNECTING TO AIS NETWORK…
      </span>
    )
  }

  if (status === 'live') {
    return (
      <span
        style={{
          position: 'fixed', bottom: '44px', right: '14px', zIndex: 800,
          display: 'flex', alignItems: 'center', gap: '6px',
          background: '#101c20ee', border: '1px solid #263336',
          padding: '6px 10px', fontSize: '9px', fontFamily: 'var(--font-technical)',
          letterSpacing: '0.6px', color: '#bce1bd',
        }}
        title={message}
      >
        <Wifi size={11} />
        LIVE AIS DATA
      </span>
    )
  }

  // demo or error — show fallback notice with refresh button
  return (
    <span
      style={{
        position: 'fixed', bottom: '44px', right: '14px', zIndex: 800,
        display: 'flex', alignItems: 'center', gap: '8px',
        background: '#101c20ee', border: '1px solid #263336',
        padding: '6px 10px', fontSize: '9px', fontFamily: 'var(--font-technical)',
        letterSpacing: '0.6px', color: '#8c9c9d',
      }}
      title={message}
    >
      <WifiOff size={11} />
      DEMO DATA
      <button
        onClick={onRefresh}
        style={{ color: '#bce1bd', marginLeft: '4px', fontSize: '9px' }}
        aria-label="Retry live AIS fetch"
      >
        RETRY
      </button>
    </span>
  )
}

// ─── Main console ─────────────────────────────────────────────────────────────

export function NauticEyeConsole({ dataset: initialDataset }: { dataset: MaritimeDataset }) {
  const [mode, setMode] = useState<ConsoleMode>('overview')
  const [selectedId, setSelectedId] = useState<string | null>(initialDataset.spills[0]?.id ?? null)
  const [vesselId, setVesselId] = useState<string | null>(null)
  const [highlights, setHighlights] = useState<string[]>([])
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [time, setTime] = useState(56)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [layers, setLayers] = useState<Layers>({ spills: true, vessels: true, tracks: true, satellite: true })
  const [storyStep, setStoryStep] = useState(0)
  const [dialog, setDialog] = useState<'help' | 'cases' | 'search' | null>(null)
  const [expandedMap, setExpandedMap] = useState(false)
  const [mobilePane, setMobilePane] = useState<'map' | 'detections' | 'analysis'>('map')
  const [forceMap, setForceMap] = useState(false)
  const [focusVersion, setFocusVersion] = useState(0)
  const { capability, reducedMotion, ready } = useCapabilities()
  const lightweight = capability === 'lightweight' || capability === 'compatibility'

  // ── Live AIS integration ─────────────────────────────────────────────────
  const currentSpillForFetch = initialDataset.spills.find(s => s.id === selectedId) ?? null
  const { vessels: liveVessels, status: aisStatus, message: aisMessage, refresh: refreshAIS } =
    useLiveVessels(currentSpillForFetch, mode !== 'story')

  // Build the active dataset: live vessels over demo spills
  const dataset: MaritimeDataset = aisStatus === 'live'
    ? getLiveDataset(liveVessels, initialDataset.referenceTime)
    : initialDataset

  // ── Derived state ────────────────────────────────────────────────────────
  const spill = dataset.spills.find(s => s.id === selectedId) ?? null
  const vessel = dataset.vessels.find(v => v.id === vesselId) ?? null
  const simTime = dataset.referenceTime - (56 - time) * 3600000
  const detected = dataset.spills.filter(s => s.detectedAt <= simTime)
  const activeCount = detected.filter(s => s.status === 'active').length

  useEffect(() => { if (ready && capability === 'compatibility') window.location.replace('/lite') }, [ready, capability])

  useEffect(() => {
    if (!playing) return
    let previous = performance.now()
    const timer = setInterval(() => {
      const now = performance.now(), elapsed = Math.min(now - previous, 500); previous = now
      if (document.hidden) return
      setTime(t => Math.min(56, t + elapsed / 160 * speed))
    }, capability === 'full' ? 100 : 200)
    return () => clearInterval(timer)
  }, [playing, speed, capability])

  useEffect(() => { if (time >= 56) setPlaying(false) }, [time])

  useEffect(() => {
    const visibility = () => {
      document.documentElement.dataset.hidden = String(document.hidden)
      if (document.hidden) setPlaying(false)
    }
    document.addEventListener('visibilitychange', visibility)
    return () => document.removeEventListener('visibilitychange', visibility)
  }, [])

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setDialog('search'); setPlaying(false)
      }
      if (event.key === 'Escape') setExpandedMap(false)
    }
    document.addEventListener('keydown', shortcut)
    return () => document.removeEventListener('keydown', shortcut)
  }, [])

  const selectSpill = useCallback((id: string) => {
    const target = dataset.spills.find(s => s.id === id)
    if (!target || target.detectedAt > dataset.referenceTime - (56 - time) * 3600000) return
    setSelectedId(id); setVesselId(null); setHighlights([])
    setExpandedMap(false); setMode('intelligence'); setMobilePane('analysis')
    setFocusVersion(v => v + 1)
  }, [dataset, time])

  const enter = () => {
    if (!spill) setSelectedId(detected[0]?.id ?? null)
    if (mode === 'story') setLayers(l => ({ ...l, spills: true, vessels: true, tracks: true }))
    setMode('intelligence'); setMobilePane('map'); setExpandedMap(false)
  }

  const changeTime = (value: number) => { setPlaying(false); setTime(value) }

  const onVessel = (id: string | null) => {
    setVesselId(id)
    if (id) {
      if (!spill) setSelectedId(detected[0]?.id ?? dataset.spills[0]?.id ?? null)
      setHighlights(h => h.includes(id) ? h : [...h, id])
      setLayers(l => ({ ...l, tracks: true, vessels: true }))
      setMode('intelligence'); setMobilePane('analysis'); setExpandedMap(false)
    }
  }

  const tourCase = (delta: number) => {
    const index = dataset.spills.findIndex(s => s.id === selectedId)
    const next = dataset.spills[(index + delta + dataset.spills.length) % dataset.spills.length]
    if (!next) return
    setPlaying(false); setTime(56); setSelectedId(next.id)
    setVesselId(null); setHighlights([]); setFocusVersion(v => v + 1)
  }

  const chooseStoryStep = (step: number) => {
    setStoryStep(step); setTime(56); setPlaying(false)
    const first = dataset.spills[0]
    if (!first) return
    setSelectedId(first.id)
    const top = rankVessels(first, dataset.vessels)[0]
    setVesselId(step >= 2 && top ? top.vessel.id : null)
    setHighlights(step >= 2 && top ? [top.vessel.id] : [])
    setLayers(l => ({ ...l, spills: step >= 1, tracks: step >= 2, vessels: step >= 2 }))
  }

  const startTour = () => { setMode('story'); setMobilePane('map'); chooseStoryStep(0) }
  const finishTour = () => {
    setMode('intelligence')
    setLayers(l => ({ ...l, spills: true, vessels: true, tracks: true }))
    setMobilePane('analysis')
  }
  const overview = () => {
    setExpandedMap(false); setVesselId(null); setHighlights([])
    setSelectedId(dataset.spills[0]?.id ?? null); setMode('overview')
    setMobilePane('map'); setPlaying(false); setTime(56)
    setLayers(l => ({ ...l, spills: true, vessels: true, tracks: true }))
  }
  const openCase = (id: string) => {
    setHighlights([]); setExpandedMap(false); setTime(56); setPlaying(false)
    setSelectedId(id); setVesselId(null); setMode('intelligence')
    setMobilePane('analysis'); setDialog(null); setFocusVersion(v => v + 1)
  }

  const feedProps = {
    spills: dataset.spills, selectedId, onSelect: selectSpill,
    simTime, referenceTime: dataset.referenceTime, lightweight,
  }
  const showAnalysis = mode === 'intelligence' || (mode === 'story' && storyStep >= 2)

  return (
    <div
      className="nauticeye-app"
      data-mode={mode}
      data-capability={capability}
      data-reduced-motion={reducedMotion}
      data-mobile-pane={mobilePane}
      data-ready={ready}
      data-analysis={showAnalysis}
      data-map-expanded={expandedMap}
    >
      <a href="#main-workspace" className="skip-link">Skip to intelligence workspace</a>

      <MissionHeader
        mode={mode} count={dataset.spills.length}
        onSearch={() => { setDialog('search'); setPlaying(false) }}
        onOverview={overview} onEnter={enter}
        onCases={() => setDialog('cases')} onHelp={() => setDialog('help')}
      />

      <div className="workspace-frame">
        <nav className="command-rail" aria-label="Workspace tools">
          <button onClick={overview} aria-label="Overview" aria-current={mode === 'overview' ? 'page' : undefined} title="Overview"><Radar size={19} /></button>
          <button onClick={enter} aria-label="Open intelligence map" aria-current={mode === 'intelligence' ? 'page' : undefined} title="Intelligence map"><Map size={18} /></button>
          <button onClick={() => { enter(); setMobilePane('detections') }} aria-label="Detection register" title="Detection register"><Crosshair size={18} /></button>
          <button onClick={startTour} aria-label="Start guided investigation" aria-current={mode === 'story' ? 'page' : undefined} title="Guided investigation"><Route size={18} /></button>
          <button onClick={() => setDialog('cases')} aria-label="Open case archive" title="Case archive"><BookOpen size={18} /></button>
          <span className="rail-axis">19.52° N / 71.48° E</span>
          <button onClick={() => setDialog('help')} aria-label="System information" title="System information"><CircleHelp size={18} /></button>
        </nav>

        <main id="main-workspace" className="main-workspace" tabIndex={-1}>
          <section className="map-stage" aria-label="Geospatial evidence">
            <MapBoundary>
              {ready && (!lightweight || forceMap)
                ? (
                  <IntelligenceMap
                    dataset={dataset} spill={spill} vessel={vessel}
                    time={time} layers={layers} highlights={highlights}
                    overview={mode === 'overview' || (mode === 'story' && storyStep === 0)}
                    reducedMotion={reducedMotion || capability !== 'full'}
                    onSpill={selectSpill} onVessel={onVessel}
                    focusVersion={focusVersion} expanded={expandedMap}
                    onExpand={() => { setExpandedMap(v => !v); setMobilePane('map') }}
                  />
                )
                : (
                  <div className="map-loading">
                    <Radar size={36} />
                    <strong>{ready ? 'Geographic summary' : 'Preparing geographic canvas'}</strong>
                    <p>
                      Arabian Sea · Western India<br />
                      {spill ? `${spill.lat.toFixed(3)}° N / ${spill.lng.toFixed(3)}° E` : 'Select a detection for coordinates'}
                    </p>
                    {ready && (
                      <>
                        <p>Lightweight mode keeps imagery and motion off.</p>
                        <Button variant="outline" onClick={() => setForceMap(true)}>Load interactive map</Button>
                      </>
                    )}
                  </div>
                )
              }
            </MapBoundary>
            <MapToolbar
              layers={layers} onLayers={setLayers}
              activeCount={detected.length}
              vesselCount={dataset.vessels.filter(v => v.track.length && v.track[0].t <= simTime).length}
            />
            {mode === 'overview' && (
              <div className="observation-caption">
                <span className="eyebrow">REGIONAL OBSERVATION</span>
                <span>ARABIAN SEA</span>
                <small>09 SEP 2026 · 09:00 UTC</small>
              </div>
            )}
            {(mode === 'overview' || (mode === 'story' && storyStep < 2)) && spill && spill.detectedAt <= simTime && (
              <AcquisitionPreview
                spill={spill}
                onEnter={mode === 'story' ? () => chooseStoryStep(storyStep + 1) : () => selectSpill(spill.id)}
                lightweight={lightweight}
              />
            )}
            {mode === 'overview' && <PipelineNav onStep={step => { setMode('story'); chooseStoryStep(step) }} />}
          </section>

          <aside className="left-rail">
            {mode === 'overview'
              ? <OverviewIntro onEnter={enter} onTour={startTour} count={detected.length} vessels={dataset.vessels.length} active={activeCount} />
              : mode === 'story'
              ? <StoryPanel step={storyStep} onStep={chooseStoryStep} onFinish={finishTour} />
              : (
                <>
                  <div className="workspace-intro">
                    <span className="eyebrow"><Radio size={12} /> OBSERVATION WORKSPACE</span>
                    <h1>Follow the<br /><em>evidence.</em></h1>
                    <p>Select a signal. Begin an investigation.</p>
                    <button className="tour-trigger" onClick={startTour}>Explore the pipeline<ArrowRight size={13} /></button>
                  </div>
                  <DetectionList {...feedProps} />
                  <div className="rail-footer">
                    <span>OBSERVATION → ATTRIBUTION</span>
                    <a href="/lite">Low-bandwidth view <ArrowUpRight size={12} /></a>
                  </div>
                </>
              )
            }
          </aside>

          {showAnalysis && spill && (
            <AnalysisPanel
              key={spill.id}
              spill={spill}
              vessels={dataset.vessels}
              vesselId={vesselId}
              onVessel={onVessel}
              highlights={highlights}
              onTrack={id => setHighlights(h => h.includes(id) ? h.filter(v => v !== id) : [...h, id])}
              flags={flags}
              onFlag={id => setFlags(f => ({ ...f, [`${id}__${spill.id}`]: !f[`${id}__${spill.id}`] }))}
              onClose={() => { setSelectedId(null); setVesselId(null); setMobilePane('map') }}
              onTour={tourCase}
              caseIndex={dataset.spills.findIndex(s => s.id === spill.id)}
              caseCount={dataset.spills.length}
              referenceTime={dataset.referenceTime}
              replayTime={simTime}
              onSeek={stamp => { changeTime(Math.max(0, Math.min(56, 56 - (dataset.referenceTime - stamp) / 3600000))); setMobilePane('map') }}
              lightweight={lightweight}
              pending={spill.detectedAt > simTime}
            />
          )}

          {mode === 'intelligence' && !spill && (
            <aside className="analysis-panel empty-analysis">
              <Crosshair size={32} />
              <h2>No incident selected</h2>
              <p>Select a detection on the map or in the register to examine its satellite scene and vessel history.</p>
              <Button variant="outline" onClick={startTour}>Start guided investigation<ArrowRight data-icon="inline-end" /></Button>
            </aside>
          )}
        </main>
      </div>

      {mode === 'overview' && <DetectionList {...feedProps} deck />}

      {mode !== 'overview' && (
        <>
          <div className="mobile-navigation">
            <button className={mobilePane === 'map' ? 'active' : ''} onClick={() => setMobilePane('map')}><Map size={16} />Map</button>
            <button className={mobilePane === 'detections' ? 'active' : ''} onClick={() => { setMode('intelligence'); setMobilePane('detections') }}><ListFilter size={16} />Detections</button>
            <button className={mobilePane === 'analysis' ? 'active' : ''} onClick={() => { setMode('intelligence'); setMobilePane('analysis') }}><Crosshair size={16} />Evidence</button>
          </div>
          <Timeline
            value={time} onChange={changeTime} playing={playing}
            onPlay={() => { if (!playing && time >= 56) setTime(0); setPlaying(p => !p) }}
            speed={speed} onSpeed={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 4 : 1)}
            spills={dataset.spills} referenceTime={dataset.referenceTime}
          />
        </>
      )}

      <SystemFooter vessels={dataset.vessels.length} />

      <MissionDialog
        key={dialog ?? 'closed'}
        dialog={dialog} onClose={() => setDialog(null)}
        dataset={dataset} onCase={openCase}
        onVessel={id => { setTime(56); setPlaying(false); onVessel(id); setDialog(null) }}
      />

      {/* Live AIS status badge — only renders on client to avoid hydration mismatch */}
      {ready && <LiveStatusBadge status={aisStatus} message={aisMessage} onRefresh={refreshAIS} />}

      <div className="sr-only" role="status" aria-live="polite">
        {mode === 'overview'
          ? 'Regional overview'
          : mode === 'story'
          ? `Guided investigation, step ${storyStep + 1} of 4`
          : spill
          ? `Investigating ${spill.name}${vessel ? `, vessel ${vessel.name}` : ''}`
          : 'Select an incident'}
      </div>
    </div>
  )
}
