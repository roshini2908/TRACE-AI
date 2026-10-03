import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Brain, Loader } from 'lucide-react'
import { requirementsAPI, analysisAPI } from '../services/api'

export default function VersionComparison() {
  const { requirementId } = useParams()
  const navigate = useNavigate()

  const [req, setReq]             = useState(null)
  const [versions, setVers]       = useState([])
  const [oldVer, setOldVer]       = useState('')
  const [newVer, setNewVer]       = useState('')
  const [comparison, setComp]     = useState(null)
  const [loadingComp, setLoadComp]= useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [error, setError]         = useState('')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [rRes, vRes] = await Promise.all([
          requirementsAPI.getOne(requirementId),
          requirementsAPI.getVersions(requirementId),
        ])
        setReq(rRes.data.data.requirement)
        const vs = vRes.data.data.versions
        setVers(vs)
        if (vs.length >= 2) {
          setOldVer(vs[vs.length - 2].version)
          setNewVer(vs[vs.length - 1].version)
        }
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    load()
  }, [requirementId])

  const handleCompare = async () => {
    if (!oldVer || !newVer || oldVer === newVer) return
    setLoadComp(true)
    setComp(null)
    setError('')
    try {
      const res = await requirementsAPI.compare(requirementId, oldVer, newVer)
      setComp(res.data.data)
    } catch (err) { setError(err.message) }
    finally { setLoadComp(false) }
  }

  useEffect(() => {
    if (oldVer && newVer) handleCompare()
  }, [oldVer, newVer])

  const handleAnalyzeImpact = async () => {
    setAnalyzing(true)
    try {
      const res = await analysisAPI.run({ requirementId, oldVersion: oldVer, newVersion: newVer, projectId: req?.projectId?._id || req?.projectId })
      navigate(`/ai-analysis?analysisId=${res.data.data.analysis._id}`)
    } catch (err) { setError(err.message) }
    finally { setAnalyzing(false) }
  }

  const highlightDiff = (oldText, newText) => {
    const oldWords = new Set(oldText.toLowerCase().split(/\s+/))
    return newText.split(/\s+/).map((word, i) => {
      const isNew = !oldWords.has(word.toLowerCase().replace(/[^a-z]/g, ''))
      return (
        <span key={i}>{i > 0 && ' '}
          {isNew ? <mark className="bg-green-200 text-green-900 rounded px-0.5 font-medium">{word}</mark> : word}
        </span>
      )
    })
  }

  if (loading) return <div className="card animate-pulse h-64" />

  const oldVerObj = versions.find(v => v.version === oldVer)
  const newVerObj = versions.find(v => v.version === newVer)

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to={`/requirements/${requirementId}`} className="text-gray-400 hover:text-gray-600 no-underline"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Version Comparison</h1>
          {req && <p className="text-sm text-gray-500">{req.reqId} — {req.title}</p>}
        </div>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {/* Version selector */}
      <div className="card flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">Old version:</label>
          <select value={oldVer} onChange={(e) => setOldVer(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400">
            {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
        </div>
        <ArrowRight size={16} className="text-gray-300" />
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-600">New version:</label>
          <select value={newVer} onChange={(e) => setNewVer(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-400">
            {versions.map(v => <option key={v.version} value={v.version}>v{v.version}</option>)}
          </select>
        </div>
      </div>

      {/* Side-by-side comparison */}
      {loadingComp ? (
        <div className="card animate-pulse h-40" />
      ) : oldVerObj && newVerObj ? (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="card border-l-4 border-l-gray-300">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-gray-500 uppercase">Old Version</span>
              <span className="badge bg-gray-100 text-gray-600">v{oldVerObj.version}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{oldVerObj.description}</p>
          </div>
          <div className="card border-l-4 border-l-green-400">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-green-600 uppercase">New Version</span>
              <span className="badge bg-green-100 text-green-700">v{newVerObj.version}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">
              {highlightDiff(oldVerObj.description, newVerObj.description)}
            </p>
            <p className="text-xs text-green-600 mt-2 font-medium">
              🟢 Highlighted words are new additions
            </p>
          </div>
        </div>
      ) : null}

      {/* AI Insight */}
      {comparison && (
        <div className="card border border-purple-100 bg-purple-50/30">
          <div className="flex items-center gap-2 mb-3">
            <Brain size={16} className="text-purple-600" />
            <span className="text-sm font-semibold text-purple-700">Change Summary</span>
            <span className="badge bg-purple-100 text-purple-600 text-[10px]">AI Suggested</span>
          </div>
          <p className="text-sm text-gray-700">{newVerObj?.changeSummary || 'Version updated.'}</p>
        </div>
      )}

      {/* Analyze Impact button */}
      <div className="flex justify-end">
        <button
          onClick={handleAnalyzeImpact}
          disabled={analyzing || !oldVer || !newVer || oldVer === newVer}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-colors"
        >
          {analyzing ? (
            <><Loader size={15} className="animate-spin" /> Analyzing Impact…</>
          ) : (
            <><Brain size={15} /> Analyze Impact</>
          )}
        </button>
      </div>
    </div>
  )
}
