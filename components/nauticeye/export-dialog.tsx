'use client'

import { useState } from 'react'
import { ArrowDownToLine, FileText, Braces, Map, Table2, Check } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { downloadReport, type ExportFormat, type ReportContext } from '@/lib/nauticeye/report'
import type { RankedVessel, Spill } from '@/lib/nauticeye/types'

const formats = [
  { id: 'html', icon: FileText, title: 'Investigation report', detail: 'Readable, print-ready HTML · save as PDF from your browser' },
  { id: 'json', icon: Braces, title: 'Complete evidence', detail: 'Incident, all candidates, factor scores, AIS history, and flags' },
  { id: 'csv', icon: Table2, title: 'Vessel rankings', detail: 'Spreadsheet-ready comparison of every candidate' },
  { id: 'geojson', icon: Map, title: 'Geospatial evidence', detail: 'Incident point, illustrative footprint, and vessel tracks' },
] as const

export function ExportDialog({ open, onClose, spill, ranked, flaggedIds, context }: { open: boolean; onClose: () => void; spill: Spill; ranked: RankedVessel[]; flaggedIds: string[]; context: ReportContext }) {
  const [downloaded, setDownloaded] = useState<ExportFormat | null>(null)
  const [error, setError] = useState(false)
  const download = (format: ExportFormat) => {
    try { downloadReport(spill, ranked, flaggedIds, format, context); setDownloaded(format); setError(false) } catch { setError(true) }
  }
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Take the evidence with you.</DialogTitle><DialogDescription>{spill.name} · {ranked.length} vessel histories · {ranked.filter(r => flaggedIds.includes(r.vessel.id) || r.vessel.flagged).length} flagged</DialogDescription></DialogHeader><div className="export-formats">{formats.map(({ id, icon: Icon, title, detail }) => <button key={id} onClick={() => download(id)}><Icon size={21} /><span><strong>{title}<small>.{id}</small></strong><span>{detail}</span></span>{downloaded === id ? <Check size={17} /> : <ArrowDownToLine size={17} />}</button>)}</div><p className="scientific-note">Simulated evidence, clearly labelled in every export. Rankings use full track history; the selected replay time is recorded in HTML and JSON. A correlation is a lead, not a verdict.</p><p className="export-status" role="status">{error ? 'The export could not be created. Please try again.' : downloaded ? `${downloaded.toUpperCase()} download requested. Check your browser downloads.` : 'Choose a format to download. No account required.'}</p></DialogContent></Dialog>
}
