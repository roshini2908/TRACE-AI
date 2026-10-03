const Component = require('../models/Component')
const Project = require('../models/Project')

const assertProjectOwner = async (projectId, userId) => {
  const project = await Project.findOne({ _id: projectId, owner: userId })
  if (!project) throw Object.assign(new Error('Project not found or unauthorized'), { statusCode: 404 })
  return project
}

const getComponents = async (req, res, next) => {
  try {
    const filter = {}
    if (req.query.projectId) {
      await assertProjectOwner(req.query.projectId, req.user._id)
      filter.projectId = req.query.projectId
    } else {
      const projects = await Project.find({ owner: req.user._id }).select('_id')
      filter.projectId = { $in: projects.map((p) => p._id) }
    }
    if (req.query.type) filter.type = req.query.type
    if (req.query.status) filter.status = req.query.status

    const components = await Component.find(filter).sort('name')
    res.json({ success: true, data: { components } })
  } catch (err) { next(err) }
}

const getComponent = async (req, res, next) => {
  try {
    const component = await Component.findById(req.params.id).populate('projectId', 'name owner')
    if (!component) return res.status(404).json({ success: false, message: 'Component not found' })
    if (String(component.projectId.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' })
    res.json({ success: true, data: { component } })
  } catch (err) { next(err) }
}

const createComponent = async (req, res, next) => {
  try {
    const { projectId, componentId, name, type, description, technology, path, status } = req.body
    await assertProjectOwner(projectId, req.user._id)
    const component = await Component.create({ projectId, componentId, name, type, description, technology, path, status, createdBy: req.user._id })
    res.status(201).json({ success: true, message: 'Component created', data: { component } })
  } catch (err) { next(err) }
}

const updateComponent = async (req, res, next) => {
  try {
    const component = await Component.findById(req.params.id).populate('projectId', 'owner')
    if (!component) return res.status(404).json({ success: false, message: 'Component not found' })
    if (String(component.projectId.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' })
    const updated = await Component.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true })
    res.json({ success: true, message: 'Component updated', data: { component: updated } })
  } catch (err) { next(err) }
}

const deleteComponent = async (req, res, next) => {
  try {
    const component = await Component.findById(req.params.id).populate('projectId', 'owner')
    if (!component) return res.status(404).json({ success: false, message: 'Component not found' })
    if (String(component.projectId.owner) !== String(req.user._id))
      return res.status(403).json({ success: false, message: 'Not authorized' })
    await Component.findByIdAndDelete(req.params.id)
    res.json({ success: true, message: 'Component deleted' })
  } catch (err) { next(err) }
}

module.exports = { getComponents, getComponent, createComponent, updateComponent, deleteComponent }
