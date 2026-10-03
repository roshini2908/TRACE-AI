import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FolderOpen, FileText, Layers, GitBranch, Brain, Clock, ArrowRight,
  AlertTriangle, CheckCircle, Code2, Activity,
} from 'lucide-react'
import { projectsAPI, requirementsAPI, componentsAPI, traceabilityAPI, analysisAPI, codebaseAPI } from '../services/api'
import { useAuth } from '../context/AuthContext'

function StatCard({ icon: Icon, label, value, color, to }) {
  const card = (
    <div className={`card flex items-center gap-4 hover:shadow-card-hover transition-shadow ${to ? 'cursor-pointer' : ''}`}>
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  )
  return to ? <Link to={to} className="no-underline">{card}</Link> : card
}

const RISK_BAR = {
  low:      'bg-green-500',
  medium:   'bg-orange-500',
  high:     'bg-danger-500',
  critical: 'bg-red-600',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats,    setStats]    = useState(null)
  const [analyses, setAnalyses] = useState([])
  const [health,   setHealth]   = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [projRes, reqRes, compRes, linkRes, anRes] = await Promise.all([
          projectsAPI.getAll(),
          requirementsAPI.getAll({}),
          componentsAPI.getAll({}),
          traceabilityAPI.getAll({}),
          analysisAPI.getAll({}),
        ])
        const projects     = projRes.data.data.projects
        const requirements = reqRes.data.data.requirements
        const components   = compRes.data.data.components
        const links        = linkRes.data.data.links
        const allAnalyses  = anRes.data.data.analyses

        const pendingVerifs = allAnalyses.reduce((sum, a) =>
          sum + (a.impactedComponents?.filter(c => c.verificationStatus === 'Pending Review').length || 0), 0)
        const potentialImpacts = allAnalyses.reduce((sum, a) =>
          sum + (a.impactedComponents?.length || 0), 0)

        setStats({ projects: projects.length, requirements: requirements.length, components: components.length, links: links.length, potentialImpacts, pendingVerifs })
        setAnalyses(allAnalyses.slice(0, 5))

        // Load health for first project if available
        if (projects.length > 0) {
          try {
            const hRes = await codebaseAPI.getProjectHealth(projects[0]._id)
            setHealth(hRes.data.data.health)
          } catch { /* health is optional */ }
        }
      } catch (err) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const STAT_CARDS = stats ? [
    { icon: FolderOpen, label: 'Projects',            value: stats.projects,        color: 'bg-primary-500',  to: '/projects' },
    { icon: FileText,   label: 'Requirements',         value: stats.requirements,    color: 'bg-purple-500',   to: '/requirements' },
    { icon: Layers,     label: 'Components',           value: stats.components,      color: 'bg-teal-500',     to: '/components' },
    { icon: GitBranch,  label: 'Traceability Links',   value: stats.links,           color: 'bg-green-500',    to: '/traceability' },
    { icon: Brain,      label: 'Potential Impacts',    value: stats.potentialImpacts,color: 'bg-orange-500',   to: '/ai-analysis' },
    { icon: Clock,      label: 'Pending Verifications',value: stats.pendingVerifs,   color: 'bg-danger-500',   to: '/ai-analysis' },
  ] : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Welcome back, {user?.name}. Here's your traceability overview.</p>
      </div>

      {error && (
        <div className="card border-danger-200 bg-danger-50">
          <p className="text-sm text-danger-600">{error}</p>
        </div>
      )}

      {/* Stat cards */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-center gap-4">
                <div className="w-11 h-11 rounded-xl bg-gray-100" />
                <div className="space-y-2 flex-1">
                  <div className="h-5 bg-gray-100 rounded w-12" />
                  <div className="h-3 bg-gray-100 rounded w-24" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {STAT_CARDS.map((s) => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      {/* Project Health widget */}
      {health && (
        <div className="card">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <Activity size={16} className="text-primary-600" /> Project Health
            </h2>
            <Link to="/codebase" className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 no-underline">
              Codebase Analyzer <ArrowRight size={11} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              ['Source Files',       health.sourceFiles,            'text-primary-600'],
              ['Verified Links',     health.verifiedLinks,          'text-green-600'],
              ['Traceability Gaps',  health.traceabilityGaps,       health.traceabilityGaps > 0 ? 'text-danger-600' : 'text-green-600'],
              ['AI Analyses',        health.aiAnalyses,             'text-purple-600'],
            ].map(([label, val, color]) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
                <p className={`text-xl font-bold ${color}`}>{val ?? 0}</p>
                <p className="text-xs text-gray-400 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Traceability coverage bar */}
          {health.traceabilityLinks > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gray-500 font-medium">Traceability Coverage</span>
                <span className="text-xs font-bold text-gray-700">
                  {Math.round((health.verifiedLinks / health.traceabilityLinks) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${Math.round((health.verifiedLinks / health.traceabilityLinks) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Attention items */}
          {health.attention?.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-gray-600 flex items-center gap-1.5 mb-2">
                <AlertTriangle size={12} className="text-orange-500" /> Attention Required
              </p>
              {health.attention.map((item, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-gray-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                  <span className="text-orange-400 flex-shrink-0 mt-0.5">⚠</span>
                  {item}
                </div>
              ))}
            </div>
          )}

          {!health.attention?.length && (
            <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-100 rounded-lg px-3 py-2">
              <CheckCircle size={13} /> No attention items. Project health looks good.
            </div>
          )}
        </div>
      )}

      {/* Recent AI analyses */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Recent AI Analyses</h2>
          <Link to="/history" className="text-xs text-primary-500 hover:text-primary-700 flex items-center gap-1 no-underline">
            View all <ArrowRight size={12} />
          </Link>
        </div>
        {analyses.length === 0 ? (
          <p className="text-sm text-gray-400">No analyses yet. Run your first AI impact analysis.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {analyses.map((a) => (
              <div key={a._id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {a.requirementId?.reqId || 'REQ'} — {a.oldVersion} → {a.newVersion}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {a.changeType} · {a.impactedComponents?.length || 0} potentially affected
                  </p>
                </div>
                <span className={`badge ${a.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
