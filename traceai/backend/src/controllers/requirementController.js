const Requirement = require('../models/Requirement')
const Project = require('../models/Project')
const { createVersion, getVersions, compareVersions } = require('../services/requirementService')

// Helper — verify project belongs to logged-in user
const assertProjectOwner = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, owner: userId })
  if (!project) throw Object.assign(new Error('Project not found or unauthorized'), { statusCode: 404 })
  return project
}

const getRequirements = async (req, res, next) => {
  try {
    const filter = { projectId: req.query.projectId }
    if (!filter.projectId) {
      // Return all requirements for user's projects
      const Project = require('../models/Project')
      const projects = await Project.find({ owner: req.user._id }).select('_id')
      filter.projectId = { $in: projects.map((p) => p._id) }
    } else {
      await assertProjectOwner(filter.projectId, req.user._id)
    }
    if (req.query.type) filter.type = req.query.type
    if (req.query.priority) filter.priority = req.query.priority
    if (req.query.status) filter.status = req.query.status

    const requirements = await Requirement.find(filter).sort('-createdAt')
    res.json({ success: true, data: { requirements } })
  } catch (err) { next(err) }
}

const getRequirement = async (req, res, next) => {
  try {
    const requirement = await Requirement.findById(req.params.id).populate('projectId', 'name owner')
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found' })
    if (String(requirement.projectId.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' })
    res.json({ success: true, data: { requirement } })
  } catch (err) { next(err) }
}

const createRequirement = async (req, res, next) => {
  try {
    const { projectId, reqId, title, description, type, priority, status } = req.body
    await assertProjectOwner(projectId, req.user._id)
    const requirement = await Requirement.create({ projectId, reqId, title, description, type, priority, status, createdBy: req.user._id })
    // Save initial version
    const { RequirementVersion } = require('../models/RequirementVersion') || {}
    const RV = require('../models/RequirementVersion')
    await RV.create({ requirementId: requirement._id, version: '1.0', description, changeSummary: 'Initial version', createdBy: req.user._id })
    res.status(201).json({ success: true, message: 'Requirement created', data: { requirement } })
  } catch (err) { next(err) }
}

const updateRequirement = async (req, res, next) => {
  try {
    const requirement = await Requirement.findById(req.params.id).populate('projectId', 'owner')
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found' })
    if (String(requirement.projectId.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' })
    const updated = await Requirement.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
    res.json({ success: true, message: 'Requirement updated', data: { requirement: updated } })
  } catch (err) { next(err) }
}

const deleteRequirement = async (req, res, next) => {
  try {
    const requirement = await Requirement.findById(req.params.id).populate('projectId', 'owner')
    if (!requirement) return res.status(404).json({ success: false, message: 'Requirement not found' })
    if (String(requirement.projectId.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' })
    await Requirement.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Requirement deleted' })
  } catch (err) { next(err) }
}

// Version endpoints
const addVersion = async (req, res, next) => {
  try {
    const version = await createVersion(req.params.id, req.body, req.user._id)
    res.status(201).json({ success: true, message: 'Version created', data: { version } })
  } catch (err) { next(err) }
}

const listVersions = async (req, res, next) => {
  try {
    const versions = await getVersions(req.params.id)
    res.json({ success: true, data: { versions } })
  } catch (err) { next(err) }
}

const compareReqVersions = async (req, res, next) => {
  try {
    const { oldVersion, newVersion } = await compareVersions(req.params.id, req.params.oldVer, req.params.newVer)
    res.json({ success: true, data: { oldVersion, newVersion } })
  } catch (err) { next(err) }
}

module.exports = { getRequirements, getRequirement, createRequirement, updateRequirement, deleteRequirement, addVersion, listVersions, compareReqVersions }
