const AIAnalysis = require('../models/AIAnalysis')
const Project = require('../models/Project')
const TraceabilityLink = require('../models/TraceabilityLink')
const { runAnalysis } = require('../services/analysisService')

/**
 * Map a component type to the most appropriate traceability relationship.
 * This is a sensible default — users can always edit the link manually.
 */
const defaultRelationship = (componentType) => {
  const map = {
    Frontend:      'Displays',
    API:           'Calls',
    Backend:       'Implements',
    Database:      'Stores Data',
    Service:       'Uses',
    Test:          'Tests',
    Documentation: 'Documents',
  }
  return map[componentType] || 'Implements'
}

const assertProjectOwner = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, owner: userId })
  if (!project) throw Object.assign(new Error('Project not found or unauthorized'), { statusCode: 404 })
  return project
}

// POST /api/analysis — run new analysis
const createAnalysis = async (req, res, next) => {
  try {
    const { requirementId, oldVersion, newVersion, projectId } = req.body
    const { analysis, requirement, oldVer, newVer } = await runAnalysis({
      requirementId, oldVersion, newVersion, userId: req.user._id, projectId,
    })
    res.status(201).json({
      success: true,
      message: 'AI analysis completed. Results are AI-suggested and require human verification.',
      data: { analysis, requirement, oldVersion: oldVer, newVersion: newVer },
    })
  } catch (err) { next(err) }
}

// GET /api/analysis — all analyses for user's projects
const getAnalyses = async (req, res, next) => {
  try {
    const filter = {}
    if (req.query.projectId) {
      await assertProjectOwner(req.query.projectId, req.user._id)
      filter.projectId = req.query.projectId
    } else {
      const projects = await Project.find({ owner: req.user._id }).select('_id')
      filter.projectId = { $in: projects.map((p) => p._id) }
    }
    const analyses = await AIAnalysis.find(filter)
      .populate('requirementId', 'reqId title')
      .populate('projectId', 'name')
      .sort('-createdAt')
    res.json({ success: true, data: { analyses } })
  } catch (err) { next(err) }
}

// GET /api/analysis/:id
const getAnalysis = async (req, res, next) => {
  try {
    const analysis = await AIAnalysis.findById(req.params.id)
      .populate('requirementId', 'reqId title description')
      .populate('projectId', 'name')
      .populate('createdBy', 'name')
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' })
    res.json({ success: true, data: { analysis } })
  } catch (err) { next(err) }
}

// GET /api/analysis/history/:projectId
const getHistory = async (req, res, next) => {
  try {
    await assertProjectOwner(req.params.projectId, req.user._id)
    const analyses = await AIAnalysis.find({ projectId: req.params.projectId })
      .populate('requirementId', 'reqId title')
      .sort('-createdAt')
    res.json({ success: true, data: { analyses } })
  } catch (err) { next(err) }
}

// POST /api/analysis/:id/rerun
const rerunAnalysis = async (req, res, next) => {
  try {
    const original = await AIAnalysis.findById(req.params.id)
    if (!original) return res.status(404).json({ success: false, message: 'Analysis not found' })
    const { analysis, requirement, oldVer, newVer } = await runAnalysis({
      requirementId: original.requirementId,
      oldVersion: original.oldVersion,
      newVersion: original.newVersion,
      userId: req.user._id,
      projectId: original.projectId,
    })
    res.status(201).json({ success: true, message: 'Analysis re-run completed', data: { analysis, requirement, oldVersion: oldVer, newVersion: newVer } })
  } catch (err) { next(err) }
}

// PUT /api/analysis/:analysisId/components/:componentId/verification
const verifyComponent = async (req, res, next) => {
  try {
    const { verificationStatus, reviewComment } = req.body
    const analysis = await AIAnalysis.findById(req.params.analysisId)
    if (!analysis) return res.status(404).json({ success: false, message: 'Analysis not found' })

    const component = analysis.impactedComponents.id(req.params.componentId)
    if (!component) return res.status(404).json({ success: false, message: 'Component entry not found' })

    // Update the subdocument on AIAnalysis
    component.verificationStatus = verificationStatus
    component.reviewComment = reviewComment || component.reviewComment
    component.verifiedBy = req.user._id

    await analysis.save()

    // ── Sync to TraceabilityLink ────────────────────────────────────────────
    // Only sync if the component has a real MongoDB componentId
    // (seed data and live analyses always populate this).
    if (component.componentId) {
      if (verificationStatus === 'Rejected') {
        // Rejected — remove the AI-suggested link so it no longer pollutes the
        // traceability matrix. Manual links (source: 'Manual') are left untouched.
        await TraceabilityLink.deleteOne({
          requirementId: analysis.requirementId,
          componentId:   component.componentId,
          source:        'AI Suggested',
        })
      } else {
        // Verified or Pending Review — upsert the traceability link.
        // findOneAndUpdate with upsert prevents duplicates even if the endpoint
        // is called multiple times (idempotent).
        const linkUpdate = {
          projectId:        analysis.projectId,
          source:           'AI Suggested',
          confidence:       component.confidence,
          relationshipType: defaultRelationship(component.componentType),
          verificationStatus,
          reviewComment:    component.reviewComment,
          createdBy:        analysis.createdBy,
          ...(verificationStatus === 'Verified' && { verifiedBy: req.user._id }),
        }

        await TraceabilityLink.findOneAndUpdate(
          // Match on the unique pair — prevents duplicates
          {
            requirementId: analysis.requirementId,
            componentId:   component.componentId,
          },
          { $set: linkUpdate },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        )
      }
    }
    // ── End sync ────────────────────────────────────────────────────────────

    res.json({
      success: true,
      message: `Component marked as ${verificationStatus}`,
      data: { analysis },
    })
  } catch (err) { next(err) }
}

module.exports = { createAnalysis, getAnalyses, getAnalysis, getHistory, rerunAnalysis, verifyComponent }
