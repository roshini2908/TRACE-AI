const Requirement = require('../models/Requirement')
const RequirementVersion = require('../models/RequirementVersion')

/** Ensure user owns the project the requirement belongs to */
const assertOwnership = async (requirementId, userId) => {
  const req = await Requirement.findById(requirementId).populate('projectId')
  if (!req) throw Object.assign(new Error('Requirement not found'), { statusCode: 404 })
  if (String(req.projectId.owner) !== String(userId))
    throw Object.assign(new Error('Not authorized'), { statusCode: 403 })
  return req
}

/** Bump version string: '1.0' → '2.0', '2.0' → '3.0' */
const bumpVersion = (current) => {
  const [major] = current.split('.')
  return `${parseInt(major, 10) + 1}.0`
}

const createVersion = async (requirementId, { description, changeSummary }, userId) => {
  const requirement = await assertOwnership(requirementId, userId)
  const newVersion = bumpVersion(requirement.currentVersion)

  const version = await RequirementVersion.create({
    requirementId,
    version: newVersion,
    description,
    changeSummary,
    createdBy: userId,
  })

  await Requirement.findByIdAndUpdate(requirementId, {
    description,
    currentVersion: newVersion,
    status: 'Changed',
  })

  return version
}

const getVersions = async (requirementId) => {
  return RequirementVersion.find({ requirementId }).sort('createdAt')
}

const compareVersions = async (requirementId, oldVer, newVer) => {
  const [oldVersion, newVersion] = await Promise.all([
    RequirementVersion.findOne({ requirementId, version: oldVer }),
    RequirementVersion.findOne({ requirementId, version: newVer }),
  ])
  if (!oldVersion) throw Object.assign(new Error(`Version ${oldVer} not found`), { statusCode: 404 })
  if (!newVersion) throw Object.assign(new Error(`Version ${newVer} not found`), { statusCode: 404 })
  return { oldVersion, newVersion }
}

module.exports = { createVersion, getVersions, compareVersions, assertOwnership }
