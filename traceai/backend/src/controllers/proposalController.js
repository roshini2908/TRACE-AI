/**
 * Proposal controller — Code Viewer + Generate Proposed Change + CRUD
 *
 * IMPORTANT: This system NEVER automatically modifies uploaded source code.
 * All proposals are analysis suggestions that require human review.
 */
const path = require('path')

const Project            = require('../models/Project')
const CodebaseUpload     = require('../models/CodebaseUpload')
const CodeImpactAnalysis = require('../models/CodeImpactAnalysis')
const CodeChangeProposal = require('../models/CodeChangeProposal')

const { getFileContent }  = require('../services/fileContentService')
const { generateProposal, generateDiff } = require('../services/proposalService')

// ─── HELPER ───────────────────────────────────────────────────────────────────
const assertOwner = async (projectId, userId) => {
  const p = await Project.findOne({ _id: projectId, owner: userId })
  if (!p) throw Object.assign(new Error('Project not found or not authorized'), { statusCode: 404 })
  return p
}

const assertUploadOwner = async (uploadId, userId) => {
  const upload = await CodebaseUpload.findById(uploadId)
  if (!upload) throw Object.assign(new Error('Upload not found'), { statusCode: 404 })
  await assertOwner(upload.projectId, userId)
  return upload
}

// ─── GET FILE CONTENT ─────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId/file-content?path=...
const getFile = async (req, res, next) => {
  try {
    const upload   = await assertUploadOwner(req.params.uploadId, req.user._id)
    const filePath = req.query.path

    if (!filePath || filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({ success: false, message: 'Invalid file path' })
    }

    const result = await getFileContent(upload._id, filePath, req.user._id)
    res.json({ success: true, data: result })
  } catch (err) { next(err) }
}

// ─── GENERATE PROPOSAL ────────────────────────────────────────────────────────
// POST /api/codebase/:uploadId/proposals
const createProposal = async (req, res, next) => {
  try {
    const upload  = await assertUploadOwner(req.params.uploadId, req.user._id)
    const { impactId, filePath, requirementText } = req.body

    if (!filePath || !requirementText?.trim()) {
      return res.status(400).json({ success: false, message: 'filePath and requirementText are required' })
    }
    if (filePath.includes('..') || path.isAbsolute(filePath)) {
      return res.status(400).json({ success: false, message: 'Invalid file path' })
    }

    // Fetch actual file content from ZIP
    const fileData = await getFileContent(upload._id, filePath, req.user._id)

    // Generate AI proposal
    const { proposedCode, diff, reasoning, provider } = await generateProposal(
      fileData.content,
      requirementText,
      filePath,
      fileData.fileType,
      fileData.language
    )

    // Check if a proposal already exists for this upload+file
    let proposal = await CodeChangeProposal.findOne({ uploadId: upload._id, filePath })
    if (proposal) {
      // Update existing
      proposal.originalCode    = fileData.content
      proposal.proposedCode    = proposedCode
      proposal.diff            = diff
      proposal.reasoning       = reasoning
      proposal.provider        = provider
      proposal.proposalStatus  = 'Draft'
      proposal.editedCode      = undefined
      proposal.reviewComment   = undefined
      proposal.requirementText = requirementText
      if (impactId) proposal.impactId = impactId
      await proposal.save()
    } else {
      // Create new
      proposal = await CodeChangeProposal.create({
        uploadId:        upload._id,
        impactId:        impactId || undefined,
        projectId:       upload.projectId,
        requirementText: requirementText.trim(),
        filePath,
        fileType:        fileData.fileType,
        language:        fileData.language,
        originalCode:    fileData.content,
        proposedCode,
        diff,
        reasoning,
        provider,
        createdBy:       req.user._id,
      })
    }

    res.status(201).json({
      success: true,
      message: 'AI-proposed code change generated. This is a suggestion — review before applying.',
      data: { proposal },
    })
  } catch (err) { next(err) }
}

// ─── GET PROPOSAL ─────────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId/proposals/:proposalId
const getProposal = async (req, res, next) => {
  try {
    const upload   = await assertUploadOwner(req.params.uploadId, req.user._id)
    const proposal = await CodeChangeProposal.findOne({ _id: req.params.proposalId, uploadId: upload._id })
    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })
    res.json({ success: true, data: { proposal } })
  } catch (err) { next(err) }
}

// ─── LIST PROPOSALS FOR UPLOAD ────────────────────────────────────────────────
// GET /api/codebase/:uploadId/proposals
const listProposals = async (req, res, next) => {
  try {
    const upload    = await assertUploadOwner(req.params.uploadId, req.user._id)
    const proposals = await CodeChangeProposal.find({ uploadId: upload._id })
      .select('-originalCode -proposedCode -editedCode -diff')
      .sort('-createdAt')
    res.json({ success: true, data: { proposals } })
  } catch (err) { next(err) }
}

// ─── EDIT PROPOSED CODE ───────────────────────────────────────────────────────
// PATCH /api/codebase/:uploadId/proposals/:proposalId
const editProposal = async (req, res, next) => {
  try {
    const upload   = await assertUploadOwner(req.params.uploadId, req.user._id)
    const proposal = await CodeChangeProposal.findOne({ _id: req.params.proposalId, uploadId: upload._id })
    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })

    const { editedCode, reviewComment } = req.body
    if (!editedCode?.trim()) {
      return res.status(400).json({ success: false, message: 'editedCode is required' })
    }

    proposal.editedCode     = editedCode
    proposal.reviewComment  = reviewComment || proposal.reviewComment
    proposal.proposalStatus = 'Edited'
    // Regenerate diff against original
    proposal.diff = generateDiff(proposal.originalCode, editedCode, proposal.filePath)
    await proposal.save()

    res.json({ success: true, message: 'Proposal updated', data: { proposal } })
  } catch (err) { next(err) }
}

// ─── APPROVE PROPOSAL ─────────────────────────────────────────────────────────
// POST /api/codebase/:uploadId/proposals/:proposalId/approve
const approveProposal = async (req, res, next) => {
  try {
    const upload   = await assertUploadOwner(req.params.uploadId, req.user._id)
    const proposal = await CodeChangeProposal.findOne({ _id: req.params.proposalId, uploadId: upload._id })
    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })

    proposal.proposalStatus = 'Approved'
    proposal.reviewComment  = req.body.reviewComment || proposal.reviewComment
    proposal.reviewedBy     = req.user._id
    proposal.reviewedAt     = new Date()
    await proposal.save()

    res.json({
      success: true,
      message: 'Proposal approved. The original uploaded code has NOT been modified — this marks the developer\'s approval of the AI suggestion.',
      data: { proposal },
    })
  } catch (err) { next(err) }
}

// ─── REJECT PROPOSAL ──────────────────────────────────────────────────────────
// POST /api/codebase/:uploadId/proposals/:proposalId/reject
const rejectProposal = async (req, res, next) => {
  try {
    const upload   = await assertUploadOwner(req.params.uploadId, req.user._id)
    const proposal = await CodeChangeProposal.findOne({ _id: req.params.proposalId, uploadId: upload._id })
    if (!proposal) return res.status(404).json({ success: false, message: 'Proposal not found' })

    proposal.proposalStatus = 'Rejected'
    proposal.reviewComment  = req.body.reviewComment || proposal.reviewComment
    proposal.reviewedBy     = req.user._id
    proposal.reviewedAt     = new Date()
    await proposal.save()

    res.json({ success: true, message: 'Proposal rejected', data: { proposal } })
  } catch (err) { next(err) }
}

module.exports = {
  getFile, createProposal, getProposal, listProposals,
  editProposal, approveProposal, rejectProposal,
}
