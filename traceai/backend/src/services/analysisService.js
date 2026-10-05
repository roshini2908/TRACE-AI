const AIAnalysis = require('../models/AIAnalysis')
const Requirement = require('../models/Requirement')
const RequirementVersion = require('../models/RequirementVersion')
const Component = require('../models/Component')
const { analyze } = require('./aiService')

const runAnalysis = async ({ requirementId, oldVersion, newVersion, userId, projectId }) => {
  if (!projectId) {
    throw Object.assign(new Error('Project ID is required for impact analysis.'), { statusCode: 400 })
  }

  const [requirement, oldVer, newVer] = await Promise.all([
    Requirement.findById(requirementId),
    RequirementVersion.findOne({ requirementId, version: oldVersion }),
    RequirementVersion.findOne({ requirementId, version: newVersion }),
  ])

  if (!requirement) {
    throw Object.assign(new Error('Requirement not found'), { statusCode: 404 })
  }

  // ── Cross-project isolation: requirement must belong to the given project ──
  if (String(requirement.projectId) !== String(projectId)) {
    throw Object.assign(
      new Error('Requirement does not belong to the selected project.'),
      { statusCode: 403 }
    )
  }

  if (!oldVer) throw Object.assign(new Error(`Version ${oldVersion} not found`), { statusCode: 404 })
  if (!newVer) throw Object.assign(new Error(`Version ${newVersion} not found`), { statusCode: 404 })

  // ── Load ONLY components belonging to this project ─────────────────────────
  const components = await Component.find({ projectId }).lean()

  const result = await analyze({
    oldText:    oldVer.description,
    newText:    newVer.description,
    components,
  })

  const analysis = await AIAnalysis.create({
    projectId,                         // always the validated project
    requirementId,
    oldVersion,
    newVersion,
    changeType:          result.changeType,
    changedConcepts:     result.changedConcepts,
    summary:             result.summary,
    impactedComponents:  result.impactedComponents,
    risks:               result.risks,
    recommendations:     result.recommendations,
    status:              'Completed',
    provider:            result.provider,
    createdBy:           userId,
  })

  return { analysis, requirement, oldVer, newVer }
}

module.exports = { runAnalysis }
