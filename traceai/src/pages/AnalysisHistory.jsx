import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { History, RefreshCw, Eye } from 'lucide-react'
import { analysisAPI, projectsAPI } from '../services/api'

const CHANGE_COLORS = { Addition:'bg-green-100 text-green-700', Deletion:'bg-danger-100 text-danger-600', Modification:'bg-orange-100 text-orange-700', Clarification:'bg-primary-100 text-primary-700', Unknown:'bg-gray-100 text-gray-500' }

export default function AnalysisHistory() {
  const [analyses, setAnalyses] = useState([])
  const [projects, setProjects] = useState([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = async (pid) => {
    setLoading(true)
    try {
      const [pRes, aRes] = await Promise.all([
        projectsAPI.getAll(),
        pid ? analysisAPI.getHistory(pid) : analysisAPI.getAll({}),
      ])
      setProjects(pRes.data.data.projects)
      setAnalyses(pid ? aRes.data.data.analyses : aRes.data.data.analyses)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load('') }, [])
  useEffect(() => { if (projectId) load(projectId) }, [projectId])

  const handleRerun = async (id) => {
    try {
      await analysisAPI.rerun(id)
      load(projectId)
    } catch (err) { alert(err.message) }
  }

  const exportCSV = () => {
    const header = 'Analysis ID,Requirement,Old Version,New Version,Change Type,Components Affected,Status,Date'
    const rows = analyses.map(a =>
      `${a._id},"${a.requirementId?.reqId || ''}",${a.oldVersion},${a.newVersion},${a.changeType},${a.impactedComponents?.length || 0},${a.status},"${new Date(a.createdAt).toLocaleDateString()}"`
    )
    const csv = [header, ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'analysis-history.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analysis History</h1>
          <p className="text-sm text-gray-500 mt-1">{analyses.length} analysis record{analyses.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-2">
          <select value={projectId} onChange={e => setProjectId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="">All Projects</option>
            {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
          </select>
          <button onClick={exportCSV} className="text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 px-4 py-2 rounded-lg transition-colors">Export CSV</button>
        </div>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {loading ? <div className="card animate-pulse h-48" /> : analyses.length === 0 ? (
        <div className="card text-center py-16">
          <History size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No analyses yet. Run your first AI impact analysis.</p>
          <Link to="/ai-analysis" className="mt-4 text-sm text-primary-500 hover:text-primary-700 no-underline">Run Analysis →</Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Requirement','Versions','Change Type','Affected','Status','Date','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {analyses.map(a => (
                  <tr key={a._id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary-600 font-medium">{a.requirementId?.reqId || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">v{a.oldVersion} → v{a.newVersion}</td>
                    <td className="px-4 py-3"><span className={`badge ${CHANGE_COLORS[a.changeType] || 'bg-gray-100 text-gray-500'}`}>{a.changeType}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-700 font-medium">{a.impactedComponents?.length || 0}</td>
                    <td className="px-4 py-3"><span className={`badge ${a.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{a.status}</span></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{new Date(a.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Link to={`/ai-analysis?analysisId=${a._id}`} className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors no-underline" title="View">
                          <Eye size={13} />
                        </Link>
                        <button onClick={() => handleRerun(a._id)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Re-run">
                          <RefreshCw size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
