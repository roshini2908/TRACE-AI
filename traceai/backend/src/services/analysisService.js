const AIAnalysis = require('../models/AIAnalysis')
const Requirement = require('../models/Requirement')
const RequirementVersion = require('../models/RequirementVersion')
const Component = require('../models/Component')
const { analyze } = require('./aiService')

const runAnalysis = async ({ requirementId, oldVersion, newVersion, userId, projectId }) => {
  const [requirement, oldVer, newVer, components] = await Promise.all([
    Requirement.findById(requirementId),
    RequirementVersion.findOne({ requirementId, version: oldVersion }),
    RequirementVersion.findOne({ requirementId, version: newVersion }),
    Component.find({ projectId }),
  ])

  if (!requirement) throw Object.assign(new Error('Requirement not found'), { statusCode: 404 })
  if (!oldVer) throw Object.assign(new Error(`Version ${oldVersion} not found`), { statusCode: 404 })
  if (!newVer) throw Object.assign(new Error(`Version ${newVersion} not found`), { statusCode: 404 })

  const result = await analyze({
    oldText: oldVer.description,
    newText: newVer.description,
    components,
  })

  const analysis = await AIAnalysis.create({
    projectId: projectId || requirement.projectId,
    requirementId,
    oldVersion,
    newVersion,
    changeType: result.changeType,
    changedConcepts: result.changedConcepts,
    summary: result.summary,
    impactedComponents: result.impactedComponents,
    risks: result.risks,
    recommendations: result.recommendations,
    status: 'Completed',
    provider: result.provider,
    createdBy: userId,
  })

  return { analysis, requirement, oldVer, newVer }
}

module.exports = { runAnalysis }
