import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, FileText, Layers, GitBranch, Brain } from 'lucide-react'
import { projectsAPI, requirementsAPI, componentsAPI, traceabilityAPI, analysisAPI } from '../services/api'

export default function ProjectDetails() {
  const { projectId } = useParams()
  const [project, setProject]   = useState(null)
  const [reqs, setReqs]         = useState([])
  const [comps, setComps]       = useState([])
  const [links, setLinks]       = useState([])
  const [analyses, setAnalyses] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const [pRes, rRes, cRes, lRes, aRes] = await Promise.all([
          projectsAPI.getOne(projectId),
          requirementsAPI.getAll({ projectId }),
          componentsAPI.getAll({ projectId }),
          traceabilityAPI.getAll({ projectId }),
          analysisAPI.getHistory(projectId),
        ])
        setProject(pRes.data.data.project)
        setReqs(rRes.data.data.requirements)
        setComps(cRes.data.data.components)
        setLinks(lRes.data.data.links)
        setAnalyses(aRes.data.data.analyses)
      } catch (err) { setError(err.message) }
      finally { setLoading(false) }
    }
    load()
  }, [projectId])

  if (loading) return <div className="card animate-pulse h-64" />
  if (error)   return <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>
  if (!project) return null

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="flex items-center gap-3">
        <Link to="/projects" className="text-gray-400 hover:text-gray-600 no-underline"><ArrowLeft size={18} /></Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          {project.description && <p className="text-sm text-gray-500 mt-0.5">{project.description}</p>}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: FileText,  label: 'Requirements', value: reqs.length,    color: 'bg-primary-100', iconColor: 'text-primary-600', to: '/requirements' },
          { icon: Layers,    label: 'Components',   value: comps.length,   color: 'bg-teal-100',    iconColor: 'text-teal-600',    to: '/components' },
          { icon: GitBranch, label: 'Links',         value: links.length,   color: 'bg-green-100',   iconColor: 'text-green-600',   to: '/traceability' },
          { icon: Brain,     label: 'Analyses',      value: analyses.length,color: 'bg-purple-100',  iconColor: 'text-purple-600',  to: '/ai-analysis' },
        ].map(({ icon: Icon, label, value, color, iconColor, to }) => (
          <Link key={label} to={to} className="card flex items-center gap-3 hover:shadow-card-hover transition-shadow no-underline">
            <div className={`w-9 h-9 rounded-lg ${color} flex items-center justify-center flex-shrink-0`}>
              <Icon size={16} className={iconColor} />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Recent requirements */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-900">Requirements</h2>
          <Link to="/requirements" className="text-xs text-primary-500 no-underline hover:text-primary-700">View all →</Link>
        </div>
        {reqs.length === 0 ? <p className="text-xs text-gray-400">No requirements yet.</p> : (
          <div className="space-y-2">
            {reqs.slice(0, 5).map(r => (
              <div key={r._id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-primary-600 font-bold">{r.reqId}</span>
                  <span className="text-sm text-gray-800">{r.title}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">v{r.currentVersion}</span>
                  <Link to={`/requirements/${r._id}`} className="text-xs text-primary-500 no-underline hover:text-primary-700">View →</Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          { label: 'View Traceability', to: '/traceability', desc: 'Requirement-component links' },
          { label: 'Run AI Analysis',   to: '/ai-analysis',  desc: 'Detect impact from changes' },
          { label: 'View Graph',        to: '/graph',        desc: 'Visual dependency map' },
        ].map(({ label, to, desc }) => (
          <Link key={label} to={to} className="card text-center hover:shadow-card-hover transition-shadow no-underline group">
            <p className="text-sm font-semibold text-primary-600 group-hover:text-primary-700">{label}</p>
            <p className="text-xs text-gray-400 mt-1">{desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
