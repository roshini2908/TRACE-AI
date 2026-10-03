import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Brain, Loader, CheckCircle, XCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react'
import { projectsAPI, requirementsAPI, analysisAPI } from '../services/api'

const IMPACT_COLORS = { High:'bg-danger-100 text-danger-700', Medium:'bg-orange-100 text-orange-700', Low:'bg-green-100 text-green-700', Critical:'bg-danger-200 text-danger-800' }
const VER_COLORS    = { Verified:'bg-green-100 text-green-700', Rejected:'bg-danger-100 text-danger-600', 'Pending Review':'bg-orange-100 text-orange-600' }

const LOADING_STEPS = [
  'Analyzing requirement text…',
  'Comparing versions semantically…',
  'Understanding conceptual changes…',
  'Matching related components…',
  'Calculating potential impact…',
]

function AnalysisResult({ analysis, onVerify }) {
  const [expanded, setExpanded] = useState(null)

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="card border border-purple-100 bg-purple-50/30">
        <div className="flex items-center gap-2 mb-2">
          <Brain size={16} className="text-purple-600" />
          <span className="text-sm font-semibold text-purple-700">AI Analysis Summary</span>
          <span className="badge bg-purple-100 text-purple-600 text-[10px]">AI Suggested</span>
        </div>
        <p className="text-sm text-gray-700 mb-3">{analysis.summary}</p>
        <div className="flex flex-wrap gap-3 text-xs">
          <span className="bg-white border border-purple-100 rounded-lg px-3 py-1.5">
            <span className="text-gray-400">Change type: </span><strong>{analysis.changeType}</strong>
          </span>
          {analysis.changedConcepts?.map(c => (
            <span key={c} className="bg-green-100 text-green-700 rounded-lg px-3 py-1.5 font-medium">{c}</span>
          ))}
        </div>
      </div>

      {/* Impact stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          ['Potentially Affected', analysis.impactedComponents?.length || 0, 'text-orange-600'],
          ['High Impact', analysis.impactedComponents?.filter(c => c.impactLevel === 'High' || c.impactLevel === 'Critical').length || 0, 'text-danger-600'],
          ['Pending Review', analysis.impactedComponents?.filter(c => c.verificationStatus === 'Pending Review').length || 0, 'text-orange-500'],
          ['Verified', analysis.impactedComponents?.filter(c => c.verificationStatus === 'Verified').length || 0, 'text-green-600'],
        ].map(([label, val, color]) => (
          <div key={label} className="card text-center py-3">
            <p className={`text-2xl font-bold ${color}`}>{val}</p>
            <p className="text-xs text-gray-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Impacted components */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Potentially Affected Components</h2>
        <p className="text-xs text-gray-400 mb-3 italic">These are AI-suggested impacts. All results require human verification.</p>
        <div className="space-y-3">
          {analysis.impactedComponents?.map((comp) => (
            <div key={comp._id} className="card">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{comp.componentName}</span>
                    <span className="badge bg-gray-100 text-gray-600">{comp.componentType}</span>
                    <span className={`badge ${IMPACT_COLORS[comp.impactLevel]}`}>{comp.impactLevel} Impact</span>
                    <span className={`badge ${VER_COLORS[comp.verificationStatus]}`}>{comp.verificationStatus}</span>
                    <span className="text-xs text-gray-400">Confidence: {comp.confidence}%</span>
                  </div>

                  <button onClick={() => setExpanded(expanded === comp._id ? null : comp._id)}
                    className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 mt-2">
                    {expanded === comp._id ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                    {expanded === comp._id ? 'Less detail' : 'View reason & recommendation'}
                  </button>

                  {expanded === comp._id && (
                    <div className="mt-3 space-y-2">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-600 mb-1">AI Reason</p>
                        <p className="text-xs text-gray-700">{comp.reason}</p>
                      </div>
                      <div className="bg-primary-50 rounded-lg p-3">
                        <p className="text-xs font-semibold text-primary-700 mb-1">Recommended Action</p>
                        <p className="text-xs text-gray-700">{comp.recommendedAction}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Verification actions */}
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => onVerify(analysis._id, comp._id, 'Verified')}
                    disabled={comp.verificationStatus === 'Verified'}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors font-medium">
                    <CheckCircle size={12} /> Accept
                  </button>
                  <button onClick={() => onVerify(analysis._id, comp._id, 'Rejected')}
                    disabled={comp.verificationStatus === 'Rejected'}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-danger-100 text-danger-600 hover:bg-danger-200 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors font-medium">
                    <XCircle size={12} /> Reject
                  </button>
                  <button onClick={() => onVerify(analysis._id, comp._id, 'Pending Review')}
                    className="flex items-center gap-1 text-xs px-2.5 py-1.5 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-lg transition-colors font-medium">
                    <Clock size={12} /> Review
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risks */}
      {analysis.risks?.length > 0 && (
        <div className="card border-l-4 border-l-orange-400">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Identified Risks</h3>
          <ul className="space-y-1">
            {analysis.risks.map((r, i) => <li key={i} className="text-xs text-gray-600 flex gap-2"><span className="text-orange-400 flex-shrink-0">⚠</span>{r}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

export default function AIAnalysis() {
  const [searchParams] = useSearchParams()
  const initialId = searchParams.get('analysisId')

  const [projects, setProjects]     = useState([])
  const [requirements, setReqs]     = useState([])
  const [versions, setVers]         = useState([])
  const [form, setForm]             = useState({ projectId: '', requirementId: '', oldVersion: '', newVersion: '' })
  const [analysis, setAnalysis]     = useState(null)
  const [loadingStep, setLoadStep]  = useState('')
  const [analyzing, setAnalyzing]   = useState(false)
  const [error, setError]           = useState('')
  const [loading, setLoading]       = useState(true)

  useEffect(() => {
    const init = async () => {
      try {
        const pRes = await projectsAPI.getAll()
        setProjects(pRes.data.data.projects)
        if (pRes.data.data.projects.length > 0) {
          setForm(f => ({ ...f, projectId: pRes.data.data.projects[0]._id }))
        }
        if (initialId) {
          const aRes = await analysisAPI.getOne(initialId)
          setAnalysis(aRes.data.data.analysis)
        }
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    init()
  }, [initialId])

  useEffect(() => {
    if (!form.projectId) return
    requirementsAPI.getAll({ projectId: form.projectId }).then(res => {
      setReqs(res.data.data.requirements)
      setForm(f => ({ ...f, requirementId: '', oldVersion: '', newVersion: '' }))
    }).catch(() => {})
  }, [form.projectId])

  useEffect(() => {
    if (!form.requirementId) return
    requirementsAPI.getVersions(form.requirementId).then(res => {
      const vs = res.data.data.versions
      setVers(vs)
      if (vs.length >= 2) setForm(f => ({ ...f, oldVersion: vs[vs.length-2].version, newVersion: vs[vs.length-1].version }))
    }).catch(() => {})
  }, [form.requirementId])

  const handleAnalyze = async () => {
    if (!form.requirementId || !form.oldVersion || !form.newVersion) return
    setAnalyzing(true)
    setError('')
    setAnalysis(null)
    for (const step of LOADING_STEPS) {
      setLoadStep(step)
      await new Promise(r => setTimeout(r, 500))
    }
    try {
      const res = await analysisAPI.run(form)
      setAnalysis(res.data.data.analysis)
    } catch (err) { setError(err.message) }
    finally { setAnalyzing(false); setLoadStep('') }
  }

  const handleVerify = async (analysisId, componentId, status) => {
    try {
      const res = await analysisAPI.verify(analysisId, componentId, { verificationStatus: status })
      setAnalysis(res.data.data.analysis)
    } catch (err) { alert(err.message) }
  }

  const selectCls = "w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-400"

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Impact Analysis</h1>
        <p className="text-sm text-gray-500 mt-1">Select a requirement and compare versions to identify potentially affected components.</p>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      <div className="card space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Project</label>
            <select value={form.projectId} onChange={e => setForm(f => ({...f, projectId: e.target.value}))} className={selectCls}>
              <option value="">Select project…</option>
              {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Requirement</label>
            <select value={form.requirementId} onChange={e => setForm(f => ({...f, requirementId: e.target.value}))} className={selectCls}>
              <option value="">Select requirement…</option>
              {requirements.map(r => <option key={r._id} value={r._id}>{r.reqId} — {r.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Old Version</label>
            <select value={form.oldVersion} onChange={e => setForm(f => ({...f, oldVersion: e.target.value}))} className={selectCls}>
              <option value="">Select…</option>
              {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">New Version</label>
            <select value={form.newVersion} onChange={e => setForm(f => ({...f, newVersion: e.target.value}))} className={selectCls}>
              <option value="">Select…</option>
              {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
            </select>
          </div>
        </div>

        <button onClick={handleAnalyze}
          disabled={analyzing || !form.requirementId || !form.oldVersion || !form.newVersion}
          className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors">
          {analyzing ? <><Loader size={16} className="animate-spin" /> {loadingStep || 'Analyzing…'}</> : <><Brain size={16} /> Analyze Impact</>}
        </button>
      </div>

      {analysis && <AnalysisResult analysis={analysis} onVerify={handleVerify} />}
    </div>
  )
}
