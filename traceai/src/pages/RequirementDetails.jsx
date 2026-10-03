import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, GitCompare, Clock, Tag, ChevronRight, Plus, X, Loader } from 'lucide-react'
import { requirementsAPI, traceabilityAPI } from '../services/api'

const PRIORITY_COLORS = {
  Low: 'bg-gray-100 text-gray-600', Medium: 'bg-primary-100 text-primary-700',
  High: 'bg-orange-100 text-orange-700', Critical: 'bg-danger-100 text-danger-700',
}
const STATUS_COLORS = {
  Draft: 'bg-gray-100 text-gray-600', Active: 'bg-green-100 text-green-700',
  Changed: 'bg-orange-100 text-orange-700', Deprecated: 'bg-danger-100 text-danger-600',
}

/** Calculate what the next version will be, mirroring the backend bumpVersion logic */
const nextVersion = (current) => {
  const major = parseInt((current || '1').split('.')[0], 10)
  return `${major + 1}.0`
}

// ─── Create New Version Modal ────────────────────────────────────────────────
function CreateVersionModal({ req, onClose, onCreated }) {
  const preview = nextVersion(req.currentVersion)

  const [form, setForm] = useState({
    description: '',
    changeSummary: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.description.trim()) {
      setError('Description is required.')
      return
    }
    setLoading(true)
    setError('')
    try {
      // POST /api/requirements/:id/versions
      // Backend auto-calculates the new version number from currentVersion.
      await requirementsAPI.addVersion(req._id, {
        description:   form.description.trim(),
        changeSummary: form.changeSummary.trim(),
      })
      onCreated()
    } catch (err) {
      setError(err.message || 'Failed to create version.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      aria-labelledby="create-version-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 id="create-version-title" className="text-lg font-semibold text-gray-900">
              Create New Version
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              A new version record will be created. The existing version is preserved.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Read-only context */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg px-3 py-2.5">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
              Requirement
            </p>
            <p className="text-sm font-mono font-bold text-primary-600">{req.reqId}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">
                Current
              </p>
              <p className="text-sm font-bold text-gray-500">v{req.currentVersion}</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5">
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wide mb-0.5">
                New
              </p>
              <p className="text-sm font-bold text-green-700">v{preview}</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* Description */}
          <div>
            <label
              htmlFor="new-version-description"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Description <span className="text-danger-500">*</span>
            </label>
            <textarea
              id="new-version-description"
              rows={4}
              value={form.description}
              onChange={(e) => {
                setForm((p) => ({ ...p, description: e.target.value }))
                setError('')
              }}
              placeholder={`Describe the updated requirement for v${preview}…`}
              className={`w-full px-3 py-2 text-sm border rounded-lg resize-none
                focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent
                ${error && !form.description.trim() ? 'border-danger-400 bg-danger-50' : 'border-gray-200'}`}
            />
            <p className="text-xs text-gray-400 mt-1">
              The current v{req.currentVersion} description will remain unchanged.
            </p>
          </div>

          {/* Change Summary */}
          <div>
            <label
              htmlFor="new-version-summary"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Change Summary
              <span className="ml-1 text-xs text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              id="new-version-summary"
              rows={2}
              value={form.changeSummary}
              onChange={(e) => setForm((p) => ({ ...p, changeSummary: e.target.value }))}
              placeholder="Briefly describe what changed in this version…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none
                focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent"
            />
          </div>

          {error && (
            <p role="alert" className="text-xs text-danger-500 bg-danger-50 border border-danger-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700
                disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-sm
                py-2.5 rounded-lg transition-colors"
            >
              {loading
                ? <><Loader size={14} className="animate-spin" /> Creating v{preview}…</>
                : <><Plus size={14} /> Create v{preview}</>
              }
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-gray-600"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function RequirementDetails() {
  const { requirementId } = useParams()

  const [req, setReq]               = useState(null)
  const [versions, setVers]         = useState([])
  const [links, setLinks]           = useState([])
  const [loading, setLoad]          = useState(true)
  const [error, setError]           = useState('')
  const [showVersionModal, setShow] = useState(false)
  const [successMsg, setSuccess]    = useState('')

  const load = useCallback(async () => {
    try {
      const [rRes, vRes] = await Promise.all([
        requirementsAPI.getOne(requirementId),
        requirementsAPI.getVersions(requirementId),
      ])
      const requirement = rRes.data.data.requirement
      setReq(requirement)
      setVers(vRes.data.data.versions)

      const lRes = await traceabilityAPI.getAll({ requirementId })
      setLinks(lRes.data.data.links)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoad(false)
    }
  }, [requirementId])

  useEffect(() => { load() }, [load])

  const handleVersionCreated = () => {
    setShow(false)
    // Reload to get the new version and updated currentVersion
    setLoad(true)
    load().then(() => {
      setSuccess('New version created successfully.')
      setTimeout(() => setSuccess(''), 4000)
    })
  }

  if (loading) return <div className="card animate-pulse h-64" />
  if (error)   return <div className="card border-danger-200 bg-danger-50"><p className="text-sm text-danger-600">{error}</p></div>
  if (!req)    return <div className="card"><p className="text-sm text-gray-500">Requirement not found.</p></div>

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Link to="/requirements" className="text-gray-400 hover:text-gray-600 no-underline">
          <ArrowLeft size={18} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-sm font-bold text-primary-600">{req.reqId}</span>
            <span className={`badge ${STATUS_COLORS[req.status]}`}>{req.status}</span>
            <span className={`badge ${PRIORITY_COLORS[req.priority]}`}>{req.priority}</span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-0.5">{req.title}</h1>
        </div>
        {/* Create New Version button — always visible */}
        <button
          onClick={() => setShow(true)}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 text-white
            text-sm font-semibold px-4 py-2 rounded-lg transition-colors flex-shrink-0"
        >
          <Plus size={15} /> New Version
        </button>
      </div>

      {/* Success banner */}
      {successMsg && (
        <div className="card border-green-200 bg-green-50 py-2.5 px-4">
          <p className="text-sm text-green-700 font-medium">✓ {successMsg}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        {/* Main — description + version history */}
        <div className="lg:col-span-2 space-y-5">

          {/* Current description */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-2">
              Description{' '}
              <span className="text-xs text-gray-400 font-normal">v{req.currentVersion}</span>
            </h2>
            <p className="text-sm text-gray-800 leading-relaxed">{req.description}</p>
          </div>

          {/* Version history */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Clock size={14} /> Version History
                <span className="badge bg-gray-100 text-gray-500 font-normal">{versions.length}</span>
              </h2>
              <div className="flex items-center gap-2">
                {versions.length >= 2 && (
                  <Link
                    to={`/requirements/${requirementId}/compare`}
                    className="flex items-center gap-1 text-xs text-primary-500 hover:text-primary-700 no-underline font-medium"
                  >
                    <GitCompare size={13} /> Compare Versions
                  </Link>
                )}
                <button
                  onClick={() => setShow(true)}
                  className="flex items-center gap-1 text-xs text-green-600 hover:text-green-800 font-medium"
                  aria-label="Create new version"
                >
                  <Plus size={13} /> New Version
                </button>
              </div>
            </div>

            {versions.length === 0 ? (
              <p className="text-sm text-gray-400">No versions found.</p>
            ) : (
              <div className="space-y-3">
                {[...versions].reverse().map((v, i) => (
                  <div
                    key={v._id}
                    className={`border rounded-lg p-3 ${
                      i === 0
                        ? 'border-primary-200 bg-primary-50/40'
                        : 'border-gray-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-bold text-gray-700">v{v.version}</span>
                      {i === 0 && (
                        <span className="badge bg-primary-100 text-primary-700">Current</span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">{v.description}</p>
                    {v.changeSummary && (
                      <p className="text-xs text-gray-400 mt-1.5 italic border-t border-gray-50 pt-1.5">
                        {v.changeSummary}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Details card */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Tag size={14} /> Details
            </h2>
            {[
              ['Type',     req.type],
              ['Priority', req.priority],
              ['Status',   req.status],
              ['Version',  `v${req.currentVersion}`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-xs text-gray-500">{k}</span>
                <span className="text-xs font-medium text-gray-800">{v}</span>
              </div>
            ))}
          </div>

          {/* Linked components */}
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-700 mb-3">Linked Components</h2>
            {links.length === 0 ? (
              <p className="text-xs text-gray-400">No links yet.</p>
            ) : (
              <div className="space-y-2">
                {links.map((l) => (
                  <div key={l._id} className="flex items-center justify-between text-xs">
                    <span className="font-medium text-gray-800">{l.componentId?.name}</span>
                    <span className="text-gray-400">{l.relationshipType}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <button
              onClick={() => setShow(true)}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-green-600
                hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Plus size={15} /> Create New Version
            </button>
            <Link
              to={`/requirements/${requirementId}/compare`}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-primary-600
                hover:bg-primary-700 text-white text-sm font-semibold rounded-lg no-underline transition-colors"
            >
              <GitCompare size={15} /> Compare Versions <ChevronRight size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Create Version Modal */}
      {showVersionModal && (
        <CreateVersionModal
          req={req}
          onClose={() => setShow(false)}
          onCreated={handleVersionCreated}
        />
      )}
    </div>
  )
}
