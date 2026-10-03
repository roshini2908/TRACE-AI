const fs   = require('fs')
const path = require('path')

const Project          = require('../models/Project')
const CodebaseUpload   = require('../models/CodebaseUpload')
const CodeFile         = require('../models/CodeFile')
const CodeDependency   = require('../models/CodeDependency')
const CodeImpactAnalysis = require('../models/CodeImpactAnalysis')

const { extractZip, analyzeExtractedFiles, cleanupExtractDir } = require('../services/zipExtractService')
const { buildDependencies } = require('../services/codeAnalyzerService')
const { analyzeCodeImpact }  = require('../services/codeImpactService')

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const assertOwner = async (projectId, userId) => {
  const p = await Project.findOne({ _id: projectId, owner: userId })
  if (!p) throw Object.assign(new Error('Project not found or not authorized'), { statusCode: 404 })
  return p
}

// ─── UPLOAD ───────────────────────────────────────────────────────────────────
// POST /api/codebase/upload
const uploadCodebase = async (req, res, next) => {
  const zipPath = req.file?.path
  try {
    const { projectId } = req.body
    if (!projectId) throw Object.assign(new Error('projectId is required'), { statusCode: 400 })
    await assertOwner(projectId, req.user._id)

    if (!req.file) throw Object.assign(new Error('No ZIP file uploaded'), { statusCode: 400 })

    // Create upload record
    const upload = await CodebaseUpload.create({
      projectId,
      uploadedBy:       req.user._id,
      originalFileName: req.file.originalname,
      storedFileName:   req.file.filename,
      uploadSizeBytes:  req.file.size,
      uploadStatus:     'uploaded',
      analysisStatus:   'pending',
    })

    res.status(201).json({
      success: true,
      message: 'ZIP uploaded. Call /analyze to start analysis.',
      data: { upload },
    })
  } catch (err) {
    // Clean up uploaded file on error
    if (zipPath) try { fs.unlinkSync(zipPath) } catch {}
    next(err)
  }
}

// ─── ANALYZE ──────────────────────────────────────────────────────────────────
// POST /api/codebase/:uploadId/analyze
const analyzeCodebase = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)

    // Locate stored ZIP
    const zipPath = path.join(__dirname, '../../uploads', upload.storedFileName)
    if (!fs.existsSync(zipPath)) {
      return res.status(404).json({ success: false, message: 'Uploaded ZIP file not found on server' })
    }

    // Update status
    upload.uploadStatus   = 'analyzing'
    upload.analysisStatus = 'in_progress'
    upload.analysisStartedAt = new Date()
    await upload.save()

    // Extract
    let extractDir, fileList
    try {
      ;({ extractDir, fileList } = await extractZip(zipPath))
    } catch (err) {
      upload.uploadStatus   = 'failed'
      upload.analysisStatus = 'failed'
      upload.errorMessage   = err.message
      await upload.save()
      return res.status(400).json({ success: false, message: err.message })
    }

    try {
      // Analyze files
      const analyzed = await analyzeExtractedFiles(extractDir, fileList, upload.projectId, upload._id)

      // Clear previous results for re-analysis
      await Promise.all([
        CodeFile.deleteMany({ uploadId: upload._id }),
        CodeDependency.deleteMany({ uploadId: upload._id }),
      ])

      // Save files
      if (analyzed.length > 0) await CodeFile.insertMany(analyzed)

      // Build + save dependencies
      const depEdges = buildDependencies(analyzed)
      const uniqueDeps = []
      const seen = new Set()
      for (const d of depEdges) {
        const key = `${d.sourceFile}::${d.targetFile}`
        if (!seen.has(key)) { seen.add(key); uniqueDeps.push({ ...d, uploadId: upload._id, projectId: upload.projectId }) }
      }
      if (uniqueDeps.length > 0) {
        try { await CodeDependency.insertMany(uniqueDeps, { ordered: false }) } catch {}
      }

      // Compute summary
      const components = analyzed.filter(f => f.fileType === 'component').length
      const apis       = analyzed.filter(f => f.fileType === 'api').length
      const models     = analyzed.filter(f => f.fileType === 'model').length
      const functions  = analyzed.reduce((s, f) => s + (f.functions?.length || 0), 0)
      const langs      = [...new Set(analyzed.map(f => f.language).filter(l => l !== 'unknown'))]

      upload.uploadStatus    = 'completed'
      upload.analysisStatus  = 'completed'
      upload.totalFiles      = fileList.length
      upload.sourceFiles     = analyzed.length
      upload.ignoredFiles    = fileList.length - analyzed.length
      upload.languages       = langs
      upload.analysisFinishedAt = new Date()
      upload.summary = { components, apis, models, functions, dependencies: uniqueDeps.length }
      await upload.save()

      // Clean up temp dir (async, don't block response)
      cleanupExtractDir(extractDir)

      res.json({
        success: true,
        message: `Analysis complete. ${analyzed.length} source files analyzed.`,
        data: { upload },
      })
    } catch (err) {
      cleanupExtractDir(extractDir)
      upload.uploadStatus   = 'failed'
      upload.analysisStatus = 'failed'
      upload.errorMessage   = err.message
      await upload.save()
      throw err
    }
  } catch (err) { next(err) }
}

// ─── GET UPLOAD INFO ──────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId
const getUpload = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)
    res.json({ success: true, data: { upload } })
  } catch (err) { next(err) }
}

// GET /api/codebase/project/:projectId  — all uploads for a project
const getProjectUploads = async (req, res, next) => {
  try {
    await assertOwner(req.params.projectId, req.user._id)
    const uploads = await CodebaseUpload.find({ projectId: req.params.projectId }).sort('-createdAt')
    res.json({ success: true, data: { uploads } })
  } catch (err) { next(err) }
}

// ─── FILES ────────────────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId/files
const getFiles = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)

    const filter = { uploadId: upload._id }
    if (req.query.type) filter.fileType = req.query.type
    if (req.query.language) filter.language = req.query.language

    const files = await CodeFile.find(filter).select('-imports -exports').sort('path')
    res.json({ success: true, data: { files, count: files.length } })
  } catch (err) { next(err) }
}

// ─── DEPENDENCIES ─────────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId/dependencies
const getDependencies = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)
    const deps = await CodeDependency.find({ uploadId: upload._id })
    res.json({ success: true, data: { dependencies: deps, count: deps.length } })
  } catch (err) { next(err) }
}

// ─── GRAPH DATA ───────────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId/graph
const getGraphData = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)

    const [files, deps] = await Promise.all([
      CodeFile.find({ uploadId: upload._id }).select('path fileType language components routes models').limit(300),
      CodeDependency.find({ uploadId: upload._id }).limit(600),
    ])

    // Build React Flow compatible nodes + edges
    const TYPE_COLORS = {
      component: '#6E46AA', api: '#2864B4', model: '#1E9191',
      service: '#32965A', test: '#5A5A5A', file: '#8A8A8A', style: '#DC8228', config: '#DC8228',
    }

    const nodes = files.map((f, i) => ({
      id:   f._id.toString(),
      data: { label: f.path.split('/').pop(), path: f.path, type: f.fileType },
      position: { x: (i % 8) * 200, y: Math.floor(i / 8) * 120 },
      style: {
        background: TYPE_COLORS[f.fileType] || '#8A8A8A',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '6px 10px',
        fontSize: 10,
        fontWeight: 600,
        minWidth: 120,
        textAlign: 'center',
      },
    }))

    const fileIdMap = {}
    files.forEach(f => { fileIdMap[f.path] = f._id.toString() })

    const edges = deps
      .filter(d => fileIdMap[d.sourceFile] && fileIdMap[d.targetFile])
      .map(d => ({
        id:     `${fileIdMap[d.sourceFile]}-${fileIdMap[d.targetFile]}`,
        source: fileIdMap[d.sourceFile],
        target: fileIdMap[d.targetFile],
        label:  d.relationship,
        style:  { stroke: '#aaa' },
        labelStyle: { fontSize: 9 },
        animated: false,
      }))

    res.json({ success: true, data: { nodes, edges, fileCount: files.length, edgeCount: edges.length } })
  } catch (err) { next(err) }
}

// ─── IMPACT ANALYSIS ─────────────────────────────────────────────────────────
// POST /api/codebase/:uploadId/impact
const runImpactAnalysis = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)

    const { requirementText, requirementId } = req.body
    if (!requirementText?.trim()) {
      return res.status(400).json({ success: false, message: 'requirementText is required' })
    }

    if (upload.analysisStatus !== 'completed') {
      return res.status(400).json({ success: false, message: 'Codebase analysis not yet complete. Run /analyze first.' })
    }

    const result = await analyzeCodeImpact(upload._id, requirementText)

    const impact = await CodeImpactAnalysis.create({
      uploadId:   upload._id,
      projectId:  upload.projectId,
      requirementId: requirementId || undefined,
      requirementText: requirementText.trim(),
      ...result,
      createdBy: req.user._id,
    })

    res.status(201).json({
      success: true,
      message: `Impact analysis complete. ${result.affectedFiles.length + result.affectedComponents.length + result.affectedAPIs.length + result.affectedModels.length} potentially affected items identified.`,
      data: { impact },
    })
  } catch (err) { next(err) }
}

// ─── IMPACT HISTORY ──────────────────────────────────────────────────────────
// GET /api/codebase/:uploadId/impact/history
const getImpactHistory = async (req, res, next) => {
  try {
    const upload = await CodebaseUpload.findById(req.params.uploadId)
    if (!upload) return res.status(404).json({ success: false, message: 'Upload not found' })
    await assertOwner(upload.projectId, req.user._id)
    const history = await CodeImpactAnalysis.find({ uploadId: upload._id })
      .populate('requirementId', 'reqId title')
      .sort('-createdAt')
    res.json({ success: true, data: { history } })
  } catch (err) { next(err) }
}

// ─── VERIFY IMPACT ITEM ──────────────────────────────────────────────────────
// PUT /api/codebase/impact/:impactId/items/:itemId/verify
const verifyImpactItem = async (req, res, next) => {
  try {
    const { verificationStatus, reviewComment } = req.body
    const impact = await CodeImpactAnalysis.findById(req.params.impactId)
    if (!impact) return res.status(404).json({ success: false, message: 'Impact analysis not found' })
    await assertOwner(impact.projectId, req.user._id)

    // Search across all four result arrays
    const arrays = ['affectedFiles','affectedComponents','affectedAPIs','affectedModels']
    let found = false
    for (const arr of arrays) {
      const item = impact[arr].id(req.params.itemId)
      if (item) {
        item.verificationStatus = verificationStatus
        if (reviewComment) item.reviewComment = reviewComment
        found = true; break
      }
    }
    if (!found) return res.status(404).json({ success: false, message: 'Item not found in impact analysis' })
    await impact.save()
    res.json({ success: true, message: `Item marked as ${verificationStatus}`, data: { impact } })
  } catch (err) { next(err) }
}

module.exports = {
  uploadCodebase, analyzeCodebase, getUpload, getProjectUploads,
  getFiles, getDependencies, getGraphData,
  runImpactAnalysis, getImpactHistory, verifyImpactItem,
  getProjectHealth, getImpactReport, getImpactDetail,
}

// ─── PROJECT HEALTH ───────────────────────────────────────────────────────────
// GET /api/codebase/project/:projectId/health
async function getProjectHealth(req, res, next) {
  try {
    await assertOwner(req.params.projectId, req.user._id)

    const TraceabilityLink = require('../models/TraceabilityLink')
    const Requirement      = require('../models/Requirement')
    const Component        = require('../models/Component')
    const CodeChangeProposal = require('../models/CodeChangeProposal')

    // Gather all uploads for this project
    const uploads = await CodebaseUpload.find({ projectId: req.params.projectId, analysisStatus: 'completed' })
    const uploadIds = uploads.map(u => u._id)

    const [
      requirements,
      components,
      links,
      verifiedLinks,
      pendingLinks,
      sourceFiles,
      analyses,
      gaps,
      proposals,
      pendingProposals,
    ] = await Promise.all([
      Requirement.countDocuments({ projectId: req.params.projectId }),
      Component.countDocuments({ projectId: req.params.projectId }),
      TraceabilityLink.countDocuments({ projectId: req.params.projectId }),
      TraceabilityLink.countDocuments({ projectId: req.params.projectId, verificationStatus: 'Verified' }),
      TraceabilityLink.countDocuments({ projectId: req.params.projectId, verificationStatus: 'Pending Review' }),
      CodeFile.countDocuments({ projectId: req.params.projectId }),
      CodeImpactAnalysis.countDocuments({ projectId: req.params.projectId }),
      // Count total gaps from latest analysis per upload
      (async () => {
        if (uploadIds.length === 0) return 0
        const latest = await CodeImpactAnalysis.findOne({ projectId: req.params.projectId }).sort('-createdAt')
        return latest?.traceabilityGaps?.length || 0
      })(),
      CodeChangeProposal.countDocuments({ projectId: req.params.projectId }),
      CodeChangeProposal.countDocuments({ projectId: req.params.projectId, proposalStatus: 'Draft' }),
    ])

    // Pending AI impact verifications
    const allAnalyses = await CodeImpactAnalysis.find({ projectId: req.params.projectId })
    let pendingImpactVerifications = 0
    let potentiallyAffected = 0
    for (const a of allAnalyses) {
      const all = [...(a.affectedFiles||[]), ...(a.affectedComponents||[]), ...(a.affectedAPIs||[]), ...(a.affectedModels||[])]
      pendingImpactVerifications += all.filter(i => i.verificationStatus === 'Pending Review').length
      potentiallyAffected += all.length
    }

    // Components without source file mapping
    const compNames = await Component.find({ projectId: req.params.projectId }).select('name componentId')
    const fileNames = await CodeFile.find({ projectId: req.params.projectId }).select('path')
    const unmappedComponents = compNames.filter(c => {
      const nameLow = c.name.toLowerCase()
      return !fileNames.some(f => f.path.toLowerCase().includes(nameLow))
    }).length

    // Attention items
    const attention = []
    if (gaps > 0) attention.push(`${gaps} traceability gap(s) detected in latest analysis.`)
    if (pendingImpactVerifications > 0) attention.push(`${pendingImpactVerifications} AI impact suggestion(s) pending human verification.`)
    if (unmappedComponents > 0) attention.push(`${unmappedComponents} component(s) have no matching source file mapping.`)
    if (pendingProposals > 0) attention.push(`${pendingProposals} AI code proposal(s) awaiting review.`)

    res.json({
      success: true,
      data: {
        health: {
          requirements,
          components,
          sourceFiles,
          traceabilityLinks: links,
          verifiedLinks,
          pendingVerification: pendingLinks,
          traceabilityGaps: gaps,
          aiAnalyses: analyses,
          proposedChanges: proposals,
          potentiallyAffected,
          pendingImpactVerifications,
          unmappedComponents,
          codebaseUploads: uploads.length,
          attention,
        },
      },
    })
  } catch (err) { next(err) }
}

// ─── IMPACT DETAIL (single analysis) ─────────────────────────────────────────
// GET /api/codebase/impact/:impactId
async function getImpactDetail(req, res, next) {
  try {
    const impact = await CodeImpactAnalysis.findById(req.params.impactId)
      .populate('requirementId', 'reqId title')
      .populate('projectId', 'name')
      .populate('createdBy', 'name email')
    if (!impact) return res.status(404).json({ success: false, message: 'Analysis not found' })
    await assertOwner(impact.projectId._id || impact.projectId, req.user._id)

    // Fetch the uploaded codebase metadata so callers know which project was analyzed
    const upload = await CodebaseUpload.findById(impact.uploadId)
      .select('originalFileName sourceFiles totalFiles languages uploadSizeBytes createdAt')

    const codebaseName = upload?.originalFileName
      ? upload.originalFileName.replace(/\.zip$/i, '').replace(/[-_]/g, ' ')
      : 'Unknown Codebase'

    res.json({
      success: true,
      data: {
        impact,
        codebase: {
          name:             codebaseName,
          originalFileName: upload?.originalFileName || '—',
          uploadId:         impact.uploadId,
          sourceFiles:      upload?.sourceFiles || 0,
          totalFiles:       upload?.totalFiles  || 0,
          languages:        upload?.languages   || [],
          uploadedAt:       upload?.createdAt,
        },
      },
    })
  } catch (err) { next(err) }
}

// ─── IMPACT REPORT ────────────────────────────────────────────────────────────
// GET /api/codebase/impact/:impactId/report
async function getImpactReport(req, res, next) {
  try {
    const impact = await CodeImpactAnalysis.findById(req.params.impactId)
      .populate('requirementId', 'reqId title')
      .populate('projectId', 'name')
      .populate('createdBy', 'name email')
    if (!impact) return res.status(404).json({ success: false, message: 'Analysis not found' })
    await assertOwner(impact.projectId._id || impact.projectId, req.user._id)

    // ── Fetch CodebaseUpload so report shows the ACTUAL uploaded codebase name,
    //    never the unrelated TraceAI project "Food Delivery Platform" etc.
    const upload = await CodebaseUpload.findById(impact.uploadId)
      .select('originalFileName sourceFiles totalFiles languages uploadSizeBytes createdAt')

    const codebaseName = upload?.originalFileName
      ? upload.originalFileName.replace(/\.zip$/i, '').replace(/[-_]/g, ' ')
      : 'Unknown Codebase'

    const allAffected = [
      ...(impact.affectedFiles      || []),
      ...(impact.affectedComponents || []),
      ...(impact.affectedAPIs       || []),
      ...(impact.affectedModels     || []),
    ]

    const totalAnalyzed       = upload?.sourceFiles || 0
    const potentiallyAffected = allAffected.length

    const hr = () => '─'.repeat(60)
    const lines = [
      'TRACEAI IMPACT ANALYSIS REPORT',
      hr(),
      `Uploaded Codebase:  ${codebaseName}`,
      `Uploaded File:      ${upload?.originalFileName || '—'}`,
      `Analysis ID:        ${impact._id}`,
      `Requirement:        ${impact.requirementText}`,
      `Linked Req:         ${impact.requirementId?.reqId || '—'} ${impact.requirementId?.title || ''}`,
      `Analysis Date:      ${new Date(impact.createdAt).toLocaleString()}`,
      `Analyst:            ${impact.createdBy?.name || '—'}`,
      hr(),
      '',
      'RISK ASSESSMENT',
      `Risk Level:  ${(impact.riskScore?.level || 'N/A').toUpperCase()}`,
      `Risk Score:  ${impact.riskScore?.score != null ? `${impact.riskScore.score}/100` : 'N/A'}`,
      `Explanation: ${impact.riskScore?.explanation || '—'}`,
      '',
      'IMPACT SUMMARY',
      `Overall Confidence:   ${impact.overallConfidence}%`,
      `Change Type:          ${impact.changeType}`,
      `Total Analyzed:       ${totalAnalyzed} source files`,
      `Potentially Affected: ${potentiallyAffected}`,
      `  Direct:     ${impact.riskScore?.direct   || 0}`,
      `  Indirect:   ${impact.riskScore?.indirect || 0}`,
      `  Possible:   ${impact.riskScore?.possible || 0}`,
      `  Files:      ${impact.riskScore?.files      || 0}`,
      `  Components: ${impact.riskScore?.components || 0}`,
      `  APIs:       ${impact.riskScore?.apis       || 0}`,
      `  Models:     ${impact.riskScore?.models     || 0}`,
      `  Tests:      ${impact.riskScore?.tests      || 0}`,
      '',
      hr(),
      'POTENTIALLY AFFECTED ARTIFACTS',
      hr(),
      ...allAffected.map((a, i) => [
        `${i + 1}. ${a.path}`,
        `   Type: ${a.type} | Impact: ${a.impactLevel} (${a.impactType}) | Confidence: ${a.confidence}%`,
        `   Status: ${a.verificationStatus}`,
        `   Reason: ${a.reason || '—'}`,
        a.evidenceDetail?.functions?.length ? `   Functions: ${a.evidenceDetail.functions.join(', ')}` : '',
        a.evidenceDetail?.apis?.length      ? `   APIs: ${a.evidenceDetail.apis.join(', ')}` : '',
        '',
      ].filter(Boolean).join('\n')),
      '',
      hr(),
      'BLAST RADIUS',
      `Total Propagation Depth: ${impact.blastRadius?.totalArtifacts || 0} artifacts`,
      ...(impact.blastRadius?.propagationPath || []).map((p, i) => `  ${i + 1}. ${p}`),
      '',
      hr(),
      'TEST IMPACT',
      impact.testImpact?.summary || 'No test impact data.',
      ...(impact.testImpact?.potentiallyAffectedTests || []).map(t =>
        `  • ${t.path} (${t.impactType}, ${t.confidence}%) — ${t.reason}`),
      '',
      hr(),
      'TRACEABILITY GAPS',
      ...(impact.traceabilityGaps?.length
        ? impact.traceabilityGaps.map(g =>
            `  • [${g.severity.toUpperCase()}] ${g.gapType}: ${g.relatedArtifact}\n    Reason: ${g.reason}\n    Action: ${g.suggestedAction}`)
        : ['  None detected.']),
      '',
      hr(),
      'HUMAN VERIFICATION',
      `  Verified:       ${allAffected.filter(a => a.verificationStatus === 'Verified').length}`,
      `  Rejected:       ${allAffected.filter(a => a.verificationStatus === 'Rejected').length}`,
      `  Pending Review: ${allAffected.filter(a => a.verificationStatus === 'Pending Review').length}`,
      '',
      hr(),
      'IDENTIFIED RISKS',
      ...(impact.risks || []).map(r => `  • ${r}`),
      '',
      'RECOMMENDATIONS',
      ...(impact.recommendations || []).map(r => `  • ${r}`),
      '',
      hr(),
      'DISCLAIMER',
      'This report is AI-suggested. All results require human verification.',
      'No source code has been automatically modified.',
      hr(),
    ]

    const reportText = lines.join('\n')

    res.json({
      success: true,
      data: {
        impact,
        codebase: {
          name:             codebaseName,
          originalFileName: upload?.originalFileName || '—',
          uploadId:         impact.uploadId,
          sourceFiles:      totalAnalyzed,
          totalFiles:       upload?.totalFiles || 0,
          languages:        upload?.languages  || [],
        },
        reportText,
        stats: {
          totalAnalyzed,
          potentiallyAffected,
          verified:      allAffected.filter(a => a.verificationStatus === 'Verified').length,
          rejected:      allAffected.filter(a => a.verificationStatus === 'Rejected').length,
          pending:       allAffected.filter(a => a.verificationStatus === 'Pending Review').length,
          testsAffected: impact.testImpact?.potentiallyAffectedTests?.length || 0,
          gaps:          impact.traceabilityGaps?.length || 0,
          riskLevel:     impact.riskScore?.level || 'unknown',
          riskScore:     impact.riskScore?.score,
        },
      },
    })
  } catch (err) { next(err) }
}