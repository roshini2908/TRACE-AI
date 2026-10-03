import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, FolderOpen, X } from 'lucide-react'
import { projectsAPI } from '../services/api'

function ProjectModal({ project, onClose, onSaved }) {
  const [form, setForm] = useState({ name: project?.name || '', description: project?.description || '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Project name is required.'); return }
    setLoading(true)
    try {
      if (project) await projectsAPI.update(project._id, form)
      else await projectsAPI.create(form)
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{project ? 'Edit Project' : 'New Project'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Project Name *</label>
            <input value={form.name} onChange={(e) => setForm(p => ({...p, name: e.target.value}))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" placeholder="e.g. Food Delivery Platform" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm(p => ({...p, description: e.target.value}))} rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none" placeholder="Brief description..." />
          </div>
          {error && <p className="text-xs text-danger-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm py-2 rounded-lg transition-colors">
              {loading ? 'Saving…' : (project ? 'Save Changes' : 'Create Project')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [modal, setModal]       = useState(null) // null | 'create' | project object

  const load = async () => {
    setLoading(true)
    try {
      const res = await projectsAPI.getAll()
      setProjects(res.data.data.projects)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete project "${name}"? This cannot be undone.`)) return
    try { await projectsAPI.remove(id); load() }
    catch (err) { alert(err.message) }
  }

  const STATUS_COLORS = { active: 'bg-green-100 text-green-700', archived: 'bg-gray-100 text-gray-500', draft: 'bg-orange-100 text-orange-700' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
          <p className="text-sm text-gray-500 mt-1">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('create')}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Project
        </button>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-40 bg-gray-50" />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="card text-center py-16">
          <FolderOpen size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm font-medium text-gray-500">No projects yet</p>
          <button onClick={() => setModal('create')} className="mt-4 text-sm text-primary-500 hover:text-primary-700">Create your first project →</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <div key={p._id} className="card hover:shadow-card-hover transition-shadow flex flex-col">
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center flex-shrink-0">
                    <FolderOpen size={17} className="text-primary-600" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm truncate">{p.name}</h3>
                </div>
                <span className={`badge flex-shrink-0 ${STATUS_COLORS[p.status] || 'bg-gray-100 text-gray-500'}`}>{p.status}</span>
              </div>
              {p.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{p.description}</p>}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                {[['Requirements', p.requirementCount], ['Components', p.componentCount], ['Links', p.linkCount]].map(([label, val]) => (
                  <div key={label} className="bg-gray-50 rounded-lg py-2">
                    <p className="text-base font-bold text-gray-900">{val ?? 0}</p>
                    <p className="text-[10px] text-gray-400">{label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-auto">
                <button onClick={() => navigate(`/projects/${p._id}`)}
                  className="flex-1 text-xs font-medium bg-primary-50 text-primary-600 hover:bg-primary-100 py-1.5 rounded-lg transition-colors">Open</button>
                <button onClick={() => setModal(p)} className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Edit"><Pencil size={14} /></button>
                <button onClick={() => handleDelete(p._id, p.name)} className="p-1.5 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded-lg transition-colors" aria-label="Delete"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <ProjectModal
          project={modal === 'create' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
