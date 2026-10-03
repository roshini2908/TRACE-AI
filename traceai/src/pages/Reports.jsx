import { useEffect, useState } from 'react'
import { BarChart2, Download } from 'lucide-react'
import { projectsAPI, requirementsAPI, componentsAPI, traceabilityAPI, analysisAPI } from '../services/api'

const downloadCSV = (filename, rows) => {
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function Reports() {
  const [data, setData]     = useState(null)
  const [loading, setLoad]  = useState(true)
  const [error, setError]   = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, rRes, cRes, lRes, aRes] = await Promise.all([
          projectsAPI.getAll(), requirementsAPI.getAll({}),
          componentsAPI.getAll({}), traceabilityAPI.getAll({}), analysisAPI.getAll({}),
        ])
        setData({
          projects:     pRes.data.data.projects,
          requirements: rRes.data.data.requirements,
          components:   cRes.data.data.components,
          links:        lRes.data.data.links,
          analyses:     aRes.data.data.analyses,
        })
      } catch (err) { setError(err.message) }
      finally { setLoad(false) }
    }
    load()
  }, [])

  const exportTraceability = () => {
    if (!data) return
    const rows = [['Requirement ID','Requirement Title','Component','Type','Relationship','Source','Confidence','Verification']]
    data.links.forEach(l => rows.push([
      l.requirementId?.reqId || '', l.requirementId?.title || '', l.componentId?.name || '',
      l.componentId?.type || '', l.relationshipType, l.source, l.confidence, l.verificationStatus,
    ]))
    downloadCSV('traceability-coverage.csv', rows)
  }

  const exportImpact = () => {
    if (!data) return
    const rows = [['Analysis ID','Requirement','Old Ver','New Ver','Change Type','Component','Impact Level','Confidence','Verification']]
    data.analyses.forEach(a => (a.impactedComponents || []).forEach(c => rows.push([
      a._id, a.requirementId?.reqId || '', a.oldVersion, a.newVersion,
      a.changeType, c.componentName, c.impactLevel, c.confidence, c.verificationStatus,
    ])))
    downloadCSV('requirement-impact.csv', rows)
  }

  const exportAnalyses = () => {
    if (!data) return
    const rows = [['Analysis ID','Requirement','Old Version','New Version','Change Type','Summary','Components','Provider','Date']]
    data.analyses.forEach(a => rows.push([
      a._id, a.requirementId?.reqId || '', a.oldVersion, a.newVersion,
      a.changeType, a.summary || '', a.impactedComponents?.length || 0, a.provider,
      new Date(a.createdAt).toLocaleDateString(),
    ]))
    downloadCSV('ai-analysis-report.csv', rows)
  }

  const exportMissing = () => {
    if (!data) return
    const linkedReqIds = new Set(data.links.map(l => String(l.requirementId?._id || l.requirementId)))
    const unlinked = data.requirements.filter(r => !linkedReqIds.has(String(r._id)))
    const rows = [['Requirement ID','Title','Type','Priority','Status']]
    unlinked.forEach(r => rows.push([r.reqId, r.title, r.type, r.priority, r.status]))
    downloadCSV('missing-traceability.csv', rows)
  }

  const REPORTS = [
    { title: 'Traceability Coverage Report', desc: 'All requirement-to-component links with verification status.', action: exportTraceability, stat: data ? `${data.links.length} links` : '…' },
    { title: 'Requirement Impact Report',    desc: 'AI-identified potentially affected components per requirement change.', action: exportImpact, stat: data ? `${data.analyses.length} analyses` : '…' },
    { title: 'AI Analysis Report',           desc: 'Full AI analysis history including summaries and changed concepts.', action: exportAnalyses, stat: data ? `${data.analyses.length} records` : '…' },
    { title: 'Missing Traceability Report',  desc: 'Requirements without any linked components.', action: exportMissing,
      stat: data ? `${data.requirements.filter(r => !new Set(data.links.map(l => String(l.requirementId?._id))).has(String(r._id))).length} unlinked` : '…' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Generate and export traceability and impact reports.</p>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 gap-4">{[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-32" />)}</div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {REPORTS.map(r => (
            <div key={r.title} className="card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <BarChart2 size={18} className="text-primary-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{r.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{r.desc}</p>
                  <span className="badge bg-gray-100 text-gray-500 mt-1">{r.stat}</span>
                </div>
              </div>
              <button onClick={r.action}
                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-primary-600 border border-primary-200 hover:bg-primary-50 py-2 rounded-lg transition-colors">
                <Download size={14} /> Export CSV
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
