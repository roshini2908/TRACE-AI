import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Plus, Search, FileText, X, ChevronRight } from 'lucide-react'
import { requirementsAPI, projectsAPI } from '../services/api'

const TYPES      = ['Functional','Non-Functional','Security','Performance','Business']
const PRIORITIES = ['Low','Medium','High','Critical']
const STATUSES   = ['Draft','Active','Changed','Deprecated']

const PRIORITY_COLORS = {
  Low: 'bg-gray-100 text-gray-600', Medium: 'bg-primary-100 text-primary-700',
  High: 'bg-orange-100 text-orange-700', Critical: 'bg-danger-100 text-danger-700',
}
const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600', Active: 'bg-green-100 text-green-700',
  Changed: 'bg-orange-100 text-orange-700', Deprecated: 'bg-danger-100 text-danger-600',
}

// Defined at module level so React never sees it as a new component type on re-render.
// If defined inside ReqModal, every keystroke would create a new Field reference,
// causing React to unmount/remount the input and lose focus.
const REQ_INPUT_CLS  = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
const REQ_SELECT_CLS = "w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"

function ReqField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

function ReqModal({ req, projects, onClose, onSaved }) {
  const [form, setForm] = useState({
    projectId: req?.projectId?._id || req?.projectId || projects[0]?._id || '',
    reqId: req?.reqId || '', title: req?.title || '', description: req?.description || '',
    type: req?.type || 'Functional', priority: req?.priority || 'Medium', status: req?.status || 'Draft',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim() || !form.reqId.trim() || !form.description.trim()) {
      setError('Title, ID, and description are required.'); return
    }
    setLoading(true)
    try {
      if (req) await requirementsAPI.update(req._id, form)
      else await requirementsAPI.create(form)
      onSaved()
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">{req ? 'Edit Requirement' : 'New Requirement'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <ReqField label="Requirement ID *">
              <input value={form.reqId} onChange={set('reqId')} className={REQ_INPUT_CLS} placeholder="REQ-101" />
            </ReqField>
            <ReqField label="Project *">
              <select value={form.projectId} onChange={set('projectId')} className={REQ_SELECT_CLS}>
                {projects.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
              </select>
            </ReqField>
          </div>
          <ReqField label="Title *">
            <input value={form.title} onChange={set('title')} className={REQ_INPUT_CLS} placeholder="Short requirement title" />
          </ReqField>
          <ReqField label="Description *">
            <textarea value={form.description} onChange={set('description')} rows={3} className={`${REQ_INPUT_CLS} resize-none`} placeholder="Full requirement description..." />
          </ReqField>
          <div className="grid grid-cols-3 gap-3">
            <ReqField label="Type">
              <select value={form.type} onChange={set('type')} className={REQ_SELECT_CLS}>
                {TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </ReqField>
            <ReqField label="Priority">
              <select value={form.priority} onChange={set('priority')} className={REQ_SELECT_CLS}>
                {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
              </select>
            </ReqField>
            <ReqField label="Status">
              <select value={form.status} onChange={set('status')} className={REQ_SELECT_CLS}>
                {STATUSES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </ReqField>
          </div>
          {error && <p className="text-xs text-danger-500">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button type="submit" disabled={loading} className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-semibold text-sm py-2 rounded-lg transition-colors">
              {loading ? 'Saving…' : (req ? 'Save Changes' : 'Create Requirement')}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Requirements() {
  const [searchParams] = useSearchParams()
  const [requirements, setRequirements] = useState([])
  const [projects, setProjects]         = useState([])
  const [loading, setLoading]           = useState(true)
  const [error, setError]               = useState('')
  const [search, setSearch]             = useState(searchParams.get('search') || '')
  const [filter, setFilter]             = useState({ type: '', priority: '', status: '' })
  const [modal, setModal]               = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [reqRes, projRes] = await Promise.all([requirementsAPI.getAll({}), projectsAPI.getAll()])
      setRequirements(reqRes.data.data.requirements)
      setProjects(projRes.data.data.projects)
    } catch (err) { setError(err.message) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Delete "${title}"?`)) return
    try { await requirementsAPI.remove(id); load() } catch (err) { alert(err.message) }
  }

  const filtered = requirements.filter((r) => {
    const q = search.toLowerCase()
    const matchSearch = !q || r.reqId.toLowerCase().includes(q) || r.title.toLowerCase().includes(q)
    const matchType   = !filter.type     || r.type     === filter.type
    const matchPri    = !filter.priority || r.priority === filter.priority
    const matchStat   = !filter.status   || r.status   === filter.status
    return matchSearch && matchType && matchPri && matchStat
  })

  const selectCls = "text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-400"

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Requirements</h1>
          <p className="text-sm text-gray-500 mt-1">{filtered.length} of {requirements.length} requirement{requirements.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setModal('create')} className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
          <Plus size={16} /> New Requirement
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by ID or title…"
            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-primary-400" />
        </div>
        <select value={filter.type} onChange={(e) => setFilter(p => ({...p, type: e.target.value}))} className={selectCls}>
          <option value="">All Types</option>{TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <select value={filter.priority} onChange={(e) => setFilter(p => ({...p, priority: e.target.value}))} className={selectCls}>
          <option value="">All Priorities</option>{PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </select>
        <select value={filter.status} onChange={(e) => setFilter(p => ({...p, status: e.target.value}))} className={selectCls}>
          <option value="">All Statuses</option>{STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>

      {error && <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>}

      {loading ? (
        <div className="card animate-pulse h-64" />
      ) : filtered.length === 0 ? (
        <div className="card text-center py-16">
          <FileText size={40} className="mx-auto text-gray-200 mb-3" />
          <p className="text-sm text-gray-400">{search || Object.values(filter).some(Boolean) ? 'No requirements match your filters.' : 'No requirements yet.'}</p>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['ID','Title','Type','Priority','Status','Version',''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((r) => (
                <tr key={r._id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs text-primary-600 font-medium">{r.reqId}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">{r.title}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{r.type}</td>
                  <td className="px-4 py-3"><span className={`badge ${PRIORITY_COLORS[r.priority]}`}>{r.priority}</span></td>
                  <td className="px-4 py-3"><span className={`badge ${STATUS_COLORS[r.status]}`}>{r.status}</span></td>
                  <td className="px-4 py-3 text-xs text-gray-400">v{r.currentVersion}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setModal(r)} className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors text-xs">Edit</button>
                      <button onClick={() => handleDelete(r._id, r.title)} className="p-1 text-gray-400 hover:text-danger-500 hover:bg-danger-50 rounded transition-colors text-xs">Del</button>
                      <Link to={`/requirements/${r._id}`} className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors no-underline">
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ReqModal
          req={modal === 'create' ? null : modal}
          projects={projects}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load() }}
        />
      )}
    </div>
  )
}
