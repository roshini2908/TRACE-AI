const TraceabilityLink = require('../models/TraceabilityLink')
const Project = require('../models/Project')
const { calculateCoverage } = require('../services/traceabilityService')

const assertProjectOwner = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, owner: userId })
  if (!project) throw Object.assign(new Error('Project not found or unauthorized'), { statusCode: 404 })
  return project
}

const getLinks = async (req, res, next) => {
  try {
    const filter = {}
    if (req.query.projectId) {
      await assertProjectOwner(req.query.projectId, req.user._id)
      filter.projectId = req.query.projectId
    } else {
      const projects = await Project.find({ owner: req.user._id }).select('_id')
      filter.projectId = { $in: projects.map((p) => p._id) }
    }
    if (req.query.requirementId) filter.requirementId = req.query.requirementId
    if (req.query.verificationStatus) filter.verificationStatus = req.query.verificationStatus

    const links = await TraceabilityLink.find(filter)
      .populate('requirementId', 'reqId title')
      .populate('componentId', 'componentId name type')
      .populate('verifiedBy', 'name')
      .sort('-createdAt')
    res.json({ success: true, data: { links } })
  } catch (err) { next(err) }
}

const getLink = async (req, res, next) => {
  try {
    const link = await TraceabilityLink.findById(req.params.id)
      .populate('requirementId', 'reqId title projectId')
      .populate('componentId', 'componentId name type')
    if (!link) return res.status(404).json({ success: false, message: 'Link not found' })
    res.json({ success: true, data: { link } })
  } catch (err) { next(err) }
}

const createLink = async (req, res, next) => {
  try {
    const { projectId, requirementId, componentId, relationshipType, source, confidence } = req.body
    await assertProjectOwner(projectId, req.user._id)
    const link = await TraceabilityLink.create({ projectId, requirementId, componentId, relationshipType, source, confidence, createdBy: req.user._id })
    res.status(201).json({ success: true, message: 'Traceability link created', data: { link } })
  } catch (err) { next(err) }
}

const updateLink = async (req, res, next) => {
  try {
    const { verificationStatus, reviewComment } = req.body
    const update = { verificationStatus, reviewComment }
    if (verificationStatus === 'Verified') update.verifiedBy = req.user._id
    const link = await TraceabilityLink.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
    if (!link) return res.status(404).json({ success: false, message: 'Link not found' })
    res.json({ success: true, message: 'Link updated', data: { link } })
  } catch (err) { next(err) }
}

const deleteLink = async (req, res, next) => {
  try {
    const link = await TraceabilityLink.findByIdAndDelete(req.params.id)
    if (!link) return res.status(404).json({ success: false, message: 'Link not found' })
    res.json({ success: true, message: 'Link deleted' })
  } catch (err) { next(err) }
}

const getCoverage = async (req, res, next) => {
  try {
    await assertProjectOwner(req.params.projectId, req.user._id)
    const coverage = await calculateCoverage(req.params.projectId)
    res.json({ success: true, data: { coverage } })
  } catch (err) { next(err) }
}

module.exports = { getLinks, getLink, createLink, updateLink, deleteLink, getCoverage }
