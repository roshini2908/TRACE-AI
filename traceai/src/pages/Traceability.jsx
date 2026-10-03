import { useEffect, useState } from 'react'
import { GitBranch, CheckCircle, Clock, XCircle } from 'lucide-react'
import { traceabilityAPI, projectsAPI } from '../services/api'

const VER_STYLES = {
  Verified:       { icon: CheckCircle, cls: 'text-green-600',  badge: 'bg-green-100 text-green-700' },
  'Pending Review':{ icon: Clock,       cls: 'text-orange-500', badge: 'bg-orange-100 text-orange-600' },
  Rejected:       { icon: XCircle,     cls: 'text-danger-500', badge: 'bg-danger-100 text-danger-600' },
}

export default function Traceability() {
  const [links, setLinks]         = useState([])
  const [coverage, setCoverage]   = useState(null)
  const [projects, setProjects]   = useState([])
  const [projectId, setProjectId] = useState('')
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState('')

  const load = async (pid) => {
    setLoading(true)
    try {
      const params = pid ? { projectId: pid } : {}
      const [lRes, pRes] = await Promise.all([traceabilityAPI.getAll(params), projectsAPI.getAll()])
      setLinks(lRes.data.data.links)
      setProjects(pRes.data.data.projects)
      if (pid) {
        const cRes = await traceabilityAPI.getCoverage(pid)
        setCoverage(cRes.data.data.coverage)
      }
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load('') }, [])
  useEffect(() => { if (projectId) load(projectId) }, [projectId])

  const handleVerify = async (id, status) => {
    try {
      await traceabilityAPI.update(id, { verificationStatus: status })
      load(projectId)
    } catch (err) { alert(err.message) }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Traceability</h1>
          <p className="text-sm text-gray-500 mt-1">{links.length} link{links.length !== 1 ? 's' : ''}</p>
        </div>
        <select value={projectId} onChange={e => setProjectId(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="">All Projects</option>
          {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
        </select>
      </div>

      {/* Coverage cards */}
      {coverage && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[['Overall Coverage', `${coverage.overall}%`, 'text-primary-600'],
            ['Verified', `${coverage.verified}%`, 'text-green-600'],
            ['Pending', `${coverage.pending}%`, 'text-orange-500'],
            ['Missing', `${coverage.missing}%`, 'text-danger-500'],
          ].map(([label, val, color]) => (
            <div key={label} className="card text-center py-3">
              <p className={`text-2xl font-bold ${color}`}>{val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      )}

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {loading ? <div className="card animate-pulse h-48" /> : links.length === 0 ? (
        <div className="card text-center py-16">
          <GitBranch size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No traceability links found.</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>{['Requirement','Component','Relationship','Source','Confidence','Verification','Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {links.map(l => {
                  const vs = VER_STYLES[l.verificationStatus] || VER_STYLES['Pending Review']
                  const VerIcon = vs.icon
                  return (
                    <tr key={l._id} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-primary-600 font-medium">{l.requirementId?.reqId || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 text-xs">{l.componentId?.name || '—'}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{l.relationshipType}</td>
                      <td className="px-4 py-3">
                        <span className={`badge ${l.source === 'AI Suggested' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                          {l.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{l.confidence}%</td>
                      <td className="px-4 py-3">
                        <span className={`badge flex items-center gap-1 ${vs.badge}`}>
                          <VerIcon size={10} />{l.verificationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {l.verificationStatus !== 'Verified' && (
                            <button onClick={() => handleVerify(l._id, 'Verified')} className="text-[10px] px-2 py-1 bg-green-100 text-green-700 hover:bg-green-200 rounded transition-colors font-medium">✓</button>
                          )}
                          {l.verificationStatus !== 'Rejected' && (
                            <button onClick={() => handleVerify(l._id, 'Rejected')} className="text-[10px] px-2 py-1 bg-danger-100 text-danger-600 hover:bg-danger-200 rounded transition-colors font-medium">✗</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
