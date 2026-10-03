const TraceabilityLink = require('../models/TraceabilityLink')
const Requirement = require('../models/Requirement')
const Component = require('../models/Component')

/**
 * Calculate traceability coverage for a project.
 * Coverage = percentage of requirements that have at least one verified link.
 */
const calculateCoverage = async (projectId) => {
  const [requirements, components, links] = await Promise.all([
    Requirement.find({ projectId }).select('_id'),
    Component.find({ projectId }).select('_id'),
    TraceabilityLink.find({ projectId }),
  ])

  const totalReqs = requirements.length
  const totalComps = components.length
  const totalLinks = links.length

  if (totalReqs === 0) return { overall: 0, verified: 0, pending: 0, missing: 100, totalReqs, totalComps, totalLinks }

  const reqsWithLinks = new Set(links.map((l) => String(l.requirementId)))
  const verifiedLinks = links.filter((l) => l.verificationStatus === 'Verified')
  const pendingLinks  = links.filter((l) => l.verificationStatus === 'Pending Review')

  const reqsWithVerifiedLink = new Set(
    verifiedLinks.map((l) => String(l.requirementId))
  )

  const overall  = Math.round((reqsWithLinks.size / totalReqs) * 100)
  const verified = Math.round((reqsWithVerifiedLink.size / totalReqs) * 100)
  const pending  = Math.round((pendingLinks.length / (totalLinks || 1)) * 100)
  const missing  = 100 - overall

  // Requirements without any link
  const coveredReqIds = new Set(links.map((l) => String(l.requirementId)))
  const missingRequirements = requirements.filter((r) => !coveredReqIds.has(String(r._id)))

  // Components without any link
  const coveredCompIds = new Set(links.map((l) => String(l.componentId)))
  const missingComponents = components.filter((c) => !coveredCompIds.has(String(c._id)))

  return {
    overall, verified, pending, missing,
    totalReqs, totalComps, totalLinks,
    verifiedCount: verifiedLinks.length,
    pendingCount: pendingLinks.length,
    missingRequirements: missingRequirements.map((r) => r._id),
    missingComponents: missingComponents.map((c) => c._id),
  }
}

module.exports = { calculateCoverage }
