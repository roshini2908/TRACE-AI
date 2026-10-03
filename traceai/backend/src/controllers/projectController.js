const Project = require('../models/Project')
const Requirement = require('../models/Requirement')
const Component = require('../models/Component')
const TraceabilityLink = require('../models/TraceabilityLink')
const AIAnalysis = require('../models/AIAnalysis')

const getProjects = async (req, res, next) => {
  try {
    const projects = await Project.find({ owner: req.user._id }).sort('-createdAt')
    // Attach counts
    const enriched = await Promise.all(
      projects.map(async (p) => {
        const [reqCount, compCount, linkCount, analysisCount] = await Promise.all([
          Requirement.countDocuments({ projectId: p._id }),
          Component.countDocuments({ projectId: p._id }),
          TraceabilityLink.countDocuments({ projectId: p._id }),
          AIAnalysis.countDocuments({ projectId: p._id }),
        ])
        return { ...p.toJSON(), requirementCount: reqCount, componentCount: compCount, linkCount, analysisCount }
      })
    )
    res.json({ success: true, data: { projects: enriched } })
  } catch (err) { next(err) }
}

const getProject = async (req, res, next) => {
  try {
    const project = await Project.findOne({ _id: req.params.id, owner: req.user._id })
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    const [reqCount, compCount, linkCount] = await Promise.all([
      Requirement.countDocuments({ projectId: project._id }),
      Component.countDocuments({ projectId: project._id }),
      TraceabilityLink.countDocuments({ projectId: project._id }),
    ])
    res.json({ success: true, data: { project: { ...project.toJSON(), requirementCount: reqCount, componentCount: compCount, linkCount } } })
  } catch (err) { next(err) }
}

const createProject = async (req, res, next) => {
  try {
    const { name, description, techStack } = req.body
    const project = await Project.create({ name, description, techStack, owner: req.user._id })
    res.status(201).json({ success: true, message: 'Project created', data: { project } })
  } catch (err) { next(err) }
}

const updateProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $set: req.body },
      { new: true, runValidators: true }
    )
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    res.json({ success: true, message: 'Project updated', data: { project } })
  } catch (err) { next(err) }
}

const deleteProject = async (req, res, next) => {
  try {
    const project = await Project.findOneAndDelete({ _id: req.params.id, owner: req.user._id })
    if (!project) return res.status(404).json({ success: false, message: 'Project not found' })
    // Cascade delete related data
    await Promise.all([
      Requirement.deleteMany({ projectId: req.params.id }),
      Component.deleteMany({ projectId: req.params.id }),
      TraceabilityLink.deleteMany({ projectId: req.params.id }),
      AIAnalysis.deleteMany({ projectId: req.params.id }),
    ])
    res.json({ success: true, message: 'Project deleted' })
  } catch (err) { next(err) }
}

module.exports = { getProjects, getProject, createProject, updateProject, deleteProject }
