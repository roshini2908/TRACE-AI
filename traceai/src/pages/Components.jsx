import { useEffect, useState } from 'react'
import { Plus, Layers, X, Search } from 'lucide-react'
import { componentsAPI, projectsAPI } from '../services/api'

const TYPES = ['Frontend','API','Backend','Database','Service','Test','Documentation']
const TYPE_COLORS = {
  Frontend:'bg-primary-100 text-primary-700', API:'bg-purple-100 text-purple-700',
  Backend:'bg-teal-100 text-teal-700', Database:'bg-orange-100 text-orange-700',
  Service:'bg-green-100 text-green-700', Test:'bg-gray-100 text-gray-600',
  Documentation:'bg-gray-100 text-gray-600',
}

function CompModal({ comp, projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    projectId: comp?.projectId?._id || comp?.projectId || projects[0]?._id || '',
    componentId: comp?.componentId || '', name: comp?.name || '', type: comp?.type || 'Frontend',
    technology: comp?.technology || '', path: comp?.path || '', description: comp?.description || '', status: comp?.status || 'Active',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm(p => ({...p, [k]: e.target.value}))
  const inputCls = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim() || !form.componentId.trim()) { setError('Name and Component ID are required.'); return }
    setLoading(true)
    try {
      if (comp) await componentsAPI.update(comp._id, form)
      else await componentsAPI.create(form)
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{comp ? 'Edit Component' : 'New Component'}</h2>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Component ID *</label>
              <input value={form.componentId} onChange={set('componentId')} className={inputCls} placeholder="COMP-001" /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Project *</label>
              <select value={form.projectId} onChange={set('projectId')} className={inputCls}>
                {projects.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}</select></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input value={form.name} onChange={set('name')} className={inputCls} placeholder="OrderTrackingPage" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select value={form.type} onChange={set('type')} className={inputCls}>
                {TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
              <select value={form.status} onChange={set('status')} className={inputCls}>
                {['Active','Draft','Deprecated'].map(s => <option key={s}>{s}</option>)}</select></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Technology</label>
            <input value={form.technology} onChange={set('technology')} className={inputCls} placeholder="React, Node.js…" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">File Path</label>
            <input value={form.path} onChange={set('path')} className={inputCls} placeholder="src/components/…" /></div>
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
            <textarea value={form.description} onChange={set('description')} rows={2} className={`${inputCls} resize-none`} /></div>
          {error && <p className="text-xs text-danger-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm py-2 rounded-lg">
              {loading ? 'Saving…' : (comp ? 'Save Changes' : 'Create Component')}</button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Components() {
  const [components, setComponents] = useState([])
  const [projects, setProjects]     = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState('')
  const [search, setSearch]         = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [modal, setModal]           = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [cRes, pRes] = await Promise.all([componentsAPI.getAll({}), projectsAPI.getAll()])
      setComponents(cRes.data.data.components)
      setProjects(pRes.data.data.projects)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}"?`)) return
    try { await componentsAPI.remove(id); load() } catch (err) { alert(err.message) }
  }

  const filtered = components.filter(c => {
    const q = search.toLowerCase()
    return (!q || c.name.toLowerCase().includes(q) || c.componentId.toLowerCase().includes(q))
        && (!typeFilter || c.type === typeFilter)
  })

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Components</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} of {components.length} component{components.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('create')} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          <Plus size={16} /> New Component
        </button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1 min-w-40">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400">
          <option value="">All Types</option>{TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {loading ? <div className="card animate-pulse h-48" /> : filtered.length === 0 ? (
        <div className="card text-center py-16"><Layers size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">No components found.</p></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => (
            <div key={c._id} className="card hover:shadow-card-hover transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <span className="font-mono text-xs text-gray-400">{c.componentId}</span>
                  <h3 className="font-semibold text-gray-900 text-sm mt-0.5">{c.name}</h3>
                </div>
                <span className={`badge flex-shrink-0 ${TYPE_COLORS[c.type] || 'bg-gray-100 text-gray-600'}`}>{c.type}</span>
              </div>
              {c.description && <p className="text-xs text-gray-500 mb-2 line-clamp-2">{c.description}</p>}
              {c.technology && <p className="text-xs text-gray-400 mb-1">⚙ {c.technology}</p>}
              {c.path && <p className="text-xs font-mono text-gray-300 truncate mb-3">{c.path}</p>}
              <div className="flex gap-2 mt-auto pt-2 border-t border-gray-50">
                <button onClick={() => setModal(c)} className="flex-1 text-xs font-medium text-gray-600 hover:text-gray-900 py-1 hover:bg-gray-50 rounded transition-colors">Edit</button>
                <button onClick={() => handleDelete(c._id, c.name)} className="flex-1 text-xs font-medium text-danger-500 hover:text-danger-700 py-1 hover:bg-danger-50 rounded transition-colors">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <CompModal comp={modal === 'create' ? null : modal} projects={projects} onClose={() => setModal(null)} onSaved={() => { setModal(null); load() }} />}
    </div>
  )
}
