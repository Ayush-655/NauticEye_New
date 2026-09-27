import type { RankedVessel, Spill } from './types'
import { blobPoints, hashStr } from './engine'
import { NOW } from './demo-data'

export type ExportFormat = 'html' | 'json' | 'csv' | 'geojson'
export type ReportContext = { referenceTime: number; replayTime: number }
const disclaimer = 'SIMULATED DEMONSTRATION. Vessel identities, detections, SAR imagery, footprint geometry, and outcomes are synthetic. Correlation is an investigative lead, not proof of responsibility. Scores are heuristic, not calibrated probabilities.'
const defaultContext = { referenceTime: NOW, replayTime: NOW }

export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
}

export function createEvidenceExport(spill: Spill, ranked: RankedVessel[], flaggedIds: string[] = [], context: ReportContext = defaultContext) {
  return {
    schemaVersion: '1.0', source: 'simulated', generatedAt: new Date().toISOString(), disclaimer,
    referenceTime: new Date(context.referenceTime).toISOString(), replayTime: new Date(context.replayTime).toISOString(),
    scoringScope: 'Full available track history, including observations after replay time',
    method: { proximityWeight: .45, timingWeight: .35, courseWeight: .20, gate: 'proximity / 100' },
    incident: { ...spill, detectedAt: new Date(spill.detectedAt).toISOString() },
    candidates: ranked.map(({ vessel, score }, index) => ({ rank: index + 1, vessel: { ...vessel, flagged: flaggedIds.includes(vessel.id) || !!vessel.flagged }, score })),
  }
}

export function createGeoJSON(spill: Spill, ranked: RankedVessel[], flaggedIds: string[] = []) {
  const ring = blobPoints(spill.lat, spill.lng, Math.sqrt(spill.area) * 1.3 + 1.5, hashStr(spill.id)).map(([lat, lng]) => [lng, lat])
  ring.push([...ring[0]])
  return {
    type: 'FeatureCollection', name: `NauticEye ${spill.id}`, disclaimer,
    features: [
      { type: 'Feature', properties: { id: spill.id, name: spill.name, source: 'simulated', kind: 'incident', detectedAt: new Date(spill.detectedAt).toISOString(), estimatedAreaKm2: spill.area, confidence: spill.confidence }, geometry: { type: 'Point', coordinates: [spill.lng, spill.lat] } },
      { type: 'Feature', properties: { id: `${spill.id}-footprint`, source: 'illustrative', kind: 'footprint', notSurveyGeometry: true }, geometry: { type: 'Polygon', coordinates: [ring] } },
      ...ranked.map(({ vessel, score }) => ({ type: 'Feature', properties: { id: vessel.id, name: vessel.name, mmsi: vessel.mmsi, source: 'simulated', kind: 'vessel-track', correlation: score.overall, flagged: flaggedIds.includes(vessel.id) || !!vessel.flagged, timestamps: vessel.track.map(p => new Date(p.t).toISOString()) }, geometry: { type: 'LineString', coordinates: vessel.track.map(p => [p.lng, p.lat]) } })),
    ],
  }
}

function csvCell(value: string | number | boolean) {
  const text = String(value)
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function createCSV(spill: Spill, ranked: RankedVessel[], flaggedIds: string[] = []) {
  const header = ['Source', 'Case', 'Rank', 'Vessel', 'MMSI', 'Flag state', 'Correlation percent', 'Proximity', 'Time match', 'Course match', 'Closest km', 'Time offset hours', 'Flagged', 'Caveat']
  const rows = ranked.map(({ vessel, score }, index) => ['SIMULATED', spill.id, index + 1, vessel.name, vessel.mmsi, vessel.flag, score.overall, score.proximity, score.timeScore, score.courseScore, score.distKm.toFixed(3), score.timeDiffH.toFixed(3), flaggedIds.includes(vessel.id) || !!vessel.flagged, 'Investigative lead, not proof of responsibility'])
  return [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n')
}

export function createReport(spill: Spill, ranked: RankedVessel[], flaggedIds: string[] = [], context: ReportContext = defaultContext) {
  const rows = ranked.map(({ vessel: v, score: s }, i) => `<tr><td>${i + 1}</td><td>${escapeHtml(v.name)}${flaggedIds.includes(v.id) || v.flagged ? ' [FLAGGED]' : ''}<br><small>${escapeHtml(v.mmsi)} · ${escapeHtml(v.flag)}</small></td><td>${s.overall}%</td><td>${s.proximity} / ${s.timeScore} / ${s.courseScore}</td><td>${s.distKm.toFixed(2)} km</td><td>${s.timeDiffH.toFixed(2)} h</td></tr>`).join('')
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>NauticEye — ${escapeHtml(spill.name)}</title>
<style>body{font-family:Arial,sans-serif;color:#192923;padding:32px;max-width:960px;margin:auto;line-height:1.7}h1{font-size:26px}h2{font-size:21px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:8px;border:1px solid #ccd4ce;text-align:left}th{background:#edf2ed}footer,small{font-size:11px;color:#52635a}footer{border-top:1px solid #ccd4ce;margin-top:30px;padding-top:15px}.notice{background:#fff6dd;border-left:3px solid #ad7527;padding:14px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px}.table-wrap{overflow:auto}@media print{body{padding:0}tr{break-inside:avoid}thead{display:table-header-group}.notice{background:none}}@media(max-width:600px){body{padding:16px}.meta{grid-template-columns:1fr}}</style></head>
<body><header><small>NAUTICEYE / MARITIME INTELLIGENCE / ${escapeHtml(spill.id)}</small><h1>Investigation evidence report</h1><p>Team Raw Onions · Smart India Hackathon 2026<br>Generated ${new Date().toISOString()}</p></header><p class="notice">${disclaimer}</p><h2>${escapeHtml(spill.name)}</h2><div class="meta"><div><b>Location:</b> ${spill.lat.toFixed(3)}°N, ${spill.lng.toFixed(3)}°E</div><div><b>Acquired:</b> ${new Date(spill.detectedAt).toUTCString()}</div><div><b>Detection confidence:</b> ${spill.confidence}%</div><div><b>Estimated area:</b> ${spill.area} km²</div><div><b>Satellite:</b> ${escapeHtml(spill.satellite)}</div><div><b>Status / severity:</b> ${escapeHtml(spill.status)} / ${escapeHtml(spill.severity)}</div></div><p>${escapeHtml(spill.desc)}</p>${spill.resolvedNote ? `<p><b>Simulated resolution:</b> ${escapeHtml(spill.resolvedNote)}</p>` : ''}<h2>Correlated vessel histories (${ranked.length})</h2><p>Every ranked candidate is included. Factor scores are proximity / time / course, each out of 100.</p><div class="table-wrap"><table><thead><tr><th>#</th><th>Vessel / identity</th><th>Score</th><th>Factor scores</th><th>Closest approach</th><th>Time offset</th></tr></thead><tbody>${rows}</tbody></table></div><h2>Method and limitations</h2><p>Proximity (45%), timing (35%), and course alignment (20%) are combined, then gated by proximity. Full available AIS history is evaluated, including observations after the selected replay time. No weather, drift reconstruction, origin estimation, or live attribution model is connected.</p><footer>Dataset reference: ${new Date(context.referenceTime).toUTCString()}<br>Selected replay scene: ${new Date(context.replayTime).toUTCString()}<br>SAR imagery and spill footprints are illustrative. Session flags are included in this export. Open this file in a browser and use Print to save a PDF.</footer></body></html>`
}

export function downloadReport(spill: Spill, ranked: RankedVessel[], flaggedIds: string[] = [], format: ExportFormat = 'html', context: ReportContext = defaultContext) {
  const content = format === 'html' ? createReport(spill, ranked, flaggedIds, context) : format === 'csv' ? createCSV(spill, ranked, flaggedIds) : JSON.stringify(format === 'geojson' ? createGeoJSON(spill, ranked, flaggedIds) : createEvidenceExport(spill, ranked, flaggedIds, context), null, 2)
  const mime = { html: 'text/html', json: 'application/json', csv: 'text/csv', geojson: 'application/geo+json' }[format]
  const blob = new Blob([content], { type: `${mime};charset=utf-8` })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = `NauticEye_Report_${spill.id}.${format}`
  document.body.appendChild(anchor); anchor.click(); anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
