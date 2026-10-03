/**
 * TraceAI — Centralized Axios instance.
 * All backend communication goes through this service.
 * NEVER put GEMINI_API_KEY or backend secrets here.
 */
import axios from 'axios'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
})

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const stored = localStorage.getItem('traceai_user')
  if (stored) {
    try {
      const user = JSON.parse(stored)
      if (user?.token) config.headers.Authorization = `Bearer ${user.token}`
    } catch { /* ignore */ }
  }
  return config
})

// Normalize error responses
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const message =
      err.response?.data?.message ||
      err.message ||
      'Network error — is the backend running?'
    return Promise.reject(new Error(message))
  }
)

// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const authAPI = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  me:       ()     => api.get('/auth/me'),
}

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
export const projectsAPI = {
  getAll:  ()         => api.get('/projects'),
  getOne:  (id)       => api.get(`/projects/${id}`),
  create:  (data)     => api.post('/projects', data),
  update:  (id, data) => api.put(`/projects/${id}`, data),
  remove:  (id)       => api.delete(`/projects/${id}`),
}

// ─── REQUIREMENTS ─────────────────────────────────────────────────────────────
export const requirementsAPI = {
  getAll:   (params) => api.get('/requirements', { params }),
  getOne:   (id)     => api.get(`/requirements/${id}`),
  create:   (data)   => api.post('/requirements', data),
  update:   (id, data) => api.put(`/requirements/${id}`, data),
  remove:   (id)     => api.delete(`/requirements/${id}`),
  // Versions
  getVersions: (id)              => api.get(`/requirements/${id}/versions`),
  addVersion:  (id, data)        => api.post(`/requirements/${id}/versions`, data),
  compare:     (id, oldV, newV)  => api.get(`/requirements/${id}/compare/${oldV}/${newV}`),
}

// ─── COMPONENTS ───────────────────────────────────────────────────────────────
export const componentsAPI = {
  getAll:  (params)    => api.get('/components', { params }),
  getOne:  (id)        => api.get(`/components/${id}`),
  create:  (data)      => api.post('/components', data),
  update:  (id, data)  => api.put(`/components/${id}`, data),
  remove:  (id)        => api.delete(`/components/${id}`),
}

// ─── TRACEABILITY ─────────────────────────────────────────────────────────────
export const traceabilityAPI = {
  getAll:      (params)    => api.get('/traceability', { params }),
  getOne:      (id)        => api.get(`/traceability/${id}`),
  create:      (data)      => api.post('/traceability', data),
  update:      (id, data)  => api.put(`/traceability/${id}`, data),
  remove:      (id)        => api.delete(`/traceability/${id}`),
  getCoverage: (projectId) => api.get(`/traceability/coverage/${projectId}`),
}

// ─── AI ANALYSIS ──────────────────────────────────────────────────────────────
export const analysisAPI = {
  run:        (data)                       => api.post('/analysis', data),
  getAll:     (params)                     => api.get('/analysis', { params }),
  getOne:     (id)                         => api.get(`/analysis/${id}`),
  getHistory: (projectId)                  => api.get(`/analysis/history/${projectId}`),
  rerun:      (id)                         => api.post(`/analysis/${id}/rerun`),
  verify:     (analysisId, componentId, data) =>
    api.put(`/analysis/${analysisId}/components/${componentId}/verification`, data),
}

// ─── NOTIFICATIONS ────────────────────────────────────────────────────────────
export const notificationsAPI = {
  getAll:     ()   => api.get('/notifications'),
  markRead:   (id) => api.put(`/notifications/${id}/read`),
  markAllRead:()   => api.put('/notifications/read-all'),
}

export default api

// ─── CODEBASE ANALYZER ────────────────────────────────────────────────────────
export const codebaseAPI = {
  /** Upload a ZIP file. formData must contain 'zipFile' + 'projectId'. */
  upload: (formData) =>
    api.post('/codebase/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),

  /** Get all uploads for a project */
  getProjectUploads: (projectId) => api.get(`/codebase/project/${projectId}`),

  /** Get a single upload record */
  getUpload: (uploadId) => api.get(`/codebase/${uploadId}`),

  /** Start analysis of an uploaded ZIP */
  analyze: (uploadId) => api.post(`/codebase/${uploadId}/analyze`),

  /** Get analyzed files */
  getFiles: (uploadId, params) => api.get(`/codebase/${uploadId}/files`, { params }),

  /** Get dependency edges */
  getDependencies: (uploadId) => api.get(`/codebase/${uploadId}/dependencies`),

  /** Get React-Flow graph data */
  getGraph: (uploadId) => api.get(`/codebase/${uploadId}/graph`),

  /** Run code impact analysis for a requirement */
  runImpact: (uploadId, data) => api.post(`/codebase/${uploadId}/impact`, data),

  /** Get impact analysis history for an upload */
  getImpactHistory: (uploadId) => api.get(`/codebase/${uploadId}/impact/history`),

  /** Verify an impact item */
  verifyItem: (impactId, itemId, data) =>
    api.put(`/codebase/impact/${impactId}/items/${itemId}/verify`, data),

  // ── Code Viewer ────────────────────────────────────────────────────────────
  /** Get actual source code of a file from the stored ZIP */
  getFileContent: (uploadId, filePath) =>
    api.get(`/codebase/${uploadId}/file-content`, { params: { path: filePath } }),

  // ── Proposals ──────────────────────────────────────────────────────────────
  /** Generate (or regenerate) an AI proposed code change for a file */
  generateProposal: (uploadId, data) =>
    api.post(`/codebase/${uploadId}/proposals`, data),

  /** List all proposals for an upload (lightweight — no code bodies) */
  listProposals: (uploadId) =>
    api.get(`/codebase/${uploadId}/proposals`),

  /** Get a single proposal with full code content */
  getProposal: (uploadId, proposalId) =>
    api.get(`/codebase/${uploadId}/proposals/${proposalId}`),

  /** Update (edit) the proposed code */
  editProposal: (uploadId, proposalId, data) =>
    api.patch(`/codebase/${uploadId}/proposals/${proposalId}`, data),

  /** Approve a proposal — marks developer's sign-off, does NOT modify source */
  approveProposal: (uploadId, proposalId, data) =>
    api.post(`/codebase/${uploadId}/proposals/${proposalId}/approve`, data),

  /** Reject a proposal */
  rejectProposal: (uploadId, proposalId, data) =>
    api.post(`/codebase/${uploadId}/proposals/${proposalId}/reject`, data),

  // ── Health & Reports ────────────────────────────────────────────────────────
  /** Get project health dashboard data */
  getProjectHealth: (projectId) =>
    api.get(`/codebase/project/${projectId}/health`),

  /** Get a single impact analysis with all extended fields */
  getImpactDetail: (impactId) =>
    api.get(`/codebase/impact/${impactId}`),

  /** Get the full impact report (structured + plain text) */
  getImpactReport: (impactId) =>
    api.get(`/codebase/impact/${impactId}/report`),
}
