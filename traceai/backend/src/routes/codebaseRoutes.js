const express = require('express')
const { body } = require('express-validator')
const { protect } = require('../middleware/authMiddleware')
const { validate } = require('../middleware/validationMiddleware')
const { handleZipUpload } = require('../middleware/uploadMiddleware')
const {
  uploadCodebase, analyzeCodebase, getUpload, getProjectUploads,
  getFiles, getDependencies, getGraphData,
  runImpactAnalysis, getImpactHistory, verifyImpactItem,
  getProjectHealth, getImpactReport, getImpactDetail,
} = require('../controllers/codebaseController')
const {
  getFile, createProposal, getProposal, listProposals,
  editProposal, approveProposal, rejectProposal,
} = require('../controllers/proposalController')

const router = express.Router()
router.use(protect)

// Upload a ZIP
router.post('/upload', handleZipUpload, uploadCodebase)

// Per-project uploads
router.get('/project/:projectId', getProjectUploads)
// Project health
router.get('/project/:projectId/health', getProjectHealth)

// ── Verification (must come before /:uploadId wildcard) ──────────────────────
router.put(
  '/impact/:impactId/items/:itemId/verify',
  [body('verificationStatus').notEmpty().withMessage('verificationStatus required')],
  validate,
  verifyImpactItem
)
// Impact detail + report (named before /:uploadId)
router.get('/impact/:impactId',        getImpactDetail)
router.get('/impact/:impactId/report', getImpactReport)

// ── Per-upload: specific named routes BEFORE /:uploadId wildcard ─────────────
router.post('/:uploadId/analyze',      analyzeCodebase)
router.get( '/:uploadId/files',        getFiles)
router.get( '/:uploadId/file-content', getFile)           // ← NEW: Code Viewer
router.get( '/:uploadId/dependencies', getDependencies)
router.get( '/:uploadId/graph',        getGraphData)

// Impact analysis
router.post(
  '/:uploadId/impact',
  [body('requirementText').trim().notEmpty().withMessage('requirementText is required')],
  validate,
  runImpactAnalysis
)
router.get('/:uploadId/impact/history', getImpactHistory)

// Proposals (Code Change)                                 ← NEW
router.route('/:uploadId/proposals')
  .get(listProposals)
  .post(
    [
      body('filePath').notEmpty().withMessage('filePath is required'),
      body('requirementText').trim().notEmpty().withMessage('requirementText is required'),
    ],
    validate,
    createProposal
  )

router.get( '/:uploadId/proposals/:proposalId',          getProposal)
router.patch('/:uploadId/proposals/:proposalId',         editProposal)
router.post('/:uploadId/proposals/:proposalId/approve',  approveProposal)
router.post('/:uploadId/proposals/:proposalId/reject',   rejectProposal)

// Wildcard — must be last
router.get('/:uploadId', getUpload)

module.exports = router
