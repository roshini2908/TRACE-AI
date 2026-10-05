/**
 * Code Impact Analysis Service — Hybrid static + AI analysis.
 *
 * Computes:
 *  - Potentially affected files / components / APIs / models
 *  - Change Risk Score (LOW / MEDIUM / HIGH / CRITICAL)
 *  - AI Evidence per artifact
 *  - Test Impact (potentially affected tests)
 *  - Blast Radius (propagation depth)
 *  - Traceability Gaps
 *
 * GEMINI_API_KEY stays on the backend — never exposed to React.
 */

const path = require('path')
const CodeFile       = require('../models/CodeFile')
const CodeDependency = require('../models/CodeDependency')

// ─── HELPERS ──────────────────────────────────────────────────────────────────

const scoreFileRelevance = (file, requirementText) => {
  const req    = requirementText.toLowerCase()
  const words  = req.match(/\b\w{4,}\b/g) || []
  const fileLow= file.path.toLowerCase()

  let score = 0
  for (const w of words) {
    if (fileLow.includes(w)) score += 3
    for (const sym of [...(file.components||[]), ...(file.functions||[]), ...(file.classes||[])]) {
      if (sym.toLowerCase().includes(w)) score += 2
    }
    for (const r of (file.routes||[])) {
      if (r.toLowerCase().includes(w)) score += 2
    }
  }
  const type = file.fileType || 'file'
  if (['api','model','component'].includes(type)) score += 1
  return score
}

const walkDependencies = async (uploadId, seedPaths, allDeps, maxHops = 3) => {
  const visited = new Set(seedPaths)
  const queue   = [...seedPaths]
  let   hops    = 0

  while (queue.length > 0 && hops < maxHops) {
    const current = queue.shift()
    const linked  = allDeps
      .filter(d => d.sourceFile === current || d.targetFile === current)
      .map(d => d.sourceFile === current ? d.targetFile : d.sourceFile)
    for (const p of linked) {
      if (!visited.has(p)) { visited.add(p); queue.push(p) }
    }
    hops++
  }
  return [...visited]
}

// ─── CHANGE TYPE DETECTOR ────────────────────────────────────────────────────
/**
 * Determine change type from requirement text keywords.
 * More robust than a single includes('add') check.
 */
const detectChangeType = (requirementText) => {
  const t = requirementText.toLowerCase()
  if (/\badd\b|\binclude\b|\bintroduce\b|\bimplement\b|\bcreate\b|\ballow\b/.test(t)) return 'Addition'
  if (/\bremove\b|\bdelete\b|\bdeprecate\b|\bdrop\b|\beliminate\b/.test(t))          return 'Removal'
  if (/\breplace\b|\bswap\b|\bsubstitute\b/.test(t))                                  return 'Replacement'
  if (/\benhance\b|\bimprove\b|\bextend\b|\bupgrade\b|\bexpand\b/.test(t))            return 'Enhancement'
  if (/\bchange\b|\bupdate\b|\bmodify\b|\balter\b|\badjust\b/.test(t))               return 'Modification'
  return 'Modification'
}

// ─── RISK SCORE CALCULATOR ────────────────────────────────────────────────────
/**
 * Calculates a change risk score purely from analysis results.
 * Score is 0-100 → mapped to low/medium/high/critical.
 * Never random — fully deterministic from the result data.
 */
const calculateRiskScore = (results, allAffected) => {
  const direct   = allAffected.filter(r => r.impactType === 'direct').length
  const indirect = allAffected.filter(r => r.impactType === 'indirect').length
  const possible = allAffected.filter(r => r.impactType === 'possible').length
  const high     = allAffected.filter(r => r.impactLevel === 'high').length
  const medium   = allAffected.filter(r => r.impactLevel === 'medium').length

  const files     = allAffected.filter(r => r.type === 'file'     || r.type === 'service').length
  const comps     = allAffected.filter(r => r.type === 'component').length
  const apis      = allAffected.filter(r => r.type === 'api').length
  const models    = allAffected.filter(r => r.type === 'model').length
  const tests     = allAffected.filter(r => r.type === 'test').length

  const avgConf   = allAffected.length > 0
    ? Math.round(allAffected.reduce((s, r) => s + (r.confidence || 0), 0) / allAffected.length)
    : 0

  // Score formula — weighted components
  let score = 0
  score += direct   * 12
  score += indirect *  6
  score += possible *  3
  score += high     * 10
  score += medium   *  5
  score += apis     *  8   // API changes are risky
  score += models   * 10   // Schema changes are very risky
  score += (avgConf / 100) * 20

  score = Math.min(100, Math.round(score))

  let level = 'low'
  if (score >= 75)      level = 'critical'
  else if (score >= 50) level = 'high'
  else if (score >= 25) level = 'medium'

  // Build a plain-English explanation
  const layerCount = [comps > 0, apis > 0, models > 0, files > 0].filter(Boolean).length
  const layers     = [comps > 0 && 'UI', apis > 0 && 'API', models > 0 && 'data model', files > 0 && 'service logic']
    .filter(Boolean).join(', ')

  const explanation = layerCount >= 3
    ? `Risk is ${level.toUpperCase()} because the requirement may affect ${layerCount} application layers (${layers}) with ${direct} direct and ${indirect} indirect impacts.`
    : direct >= 2
    ? `Risk is ${level.toUpperCase()} because ${direct} artifacts are directly affected. Review these carefully before making changes.`
    : `Risk is ${level.toUpperCase()} based on ${allAffected.length} potentially affected artifacts and ${avgConf}% average confidence.`

  return { level, score, explanation, direct, indirect, possible, files, components: comps, apis, models, tests }
}

// ─── TEST IMPACT DETECTOR ─────────────────────────────────────────────────────
const detectTestImpact = (allAffected, allFiles, deps) => {
  const testFiles = allFiles.filter(f =>
    f.fileType === 'test' ||
    /\.(test|spec)\.[jt]sx?$/.test(f.path) ||
    f.path.toLowerCase().includes('test') ||
    f.path.toLowerCase().includes('spec') ||
    f.path.toLowerCase().includes('__tests__')
  )

  const affectedPaths  = new Set(allAffected.map(a => a.path))
  const potentialTests = []

  for (const testFile of testFiles) {
    // Check if any import of this test file matches an affected file
    const testedFiles = (testFile.imports || []).map(imp => {
      // Resolve relative import roughly
      if (!imp.startsWith('.')) return null
      const dir   = path.dirname(testFile.path).replace(/\\/g, '/')
      const base  = path.join(dir, imp).replace(/\\/g, '/')
      return base
    }).filter(Boolean)

    const matchedAffected = testedFiles.find(tf =>
      [...affectedPaths].some(ap => ap.includes(tf) || tf.includes(ap.replace(/\.[^.]+$/, '')))
    )

    // Also check dependency edges
    const depMatch = deps.find(d =>
      (d.sourceFile === testFile.path && affectedPaths.has(d.targetFile)) ||
      (d.targetFile === testFile.path && affectedPaths.has(d.sourceFile))
    )

    if (matchedAffected || depMatch) {
      const relFile = matchedAffected
        ? [...affectedPaths].find(ap => ap.includes(matchedAffected) || matchedAffected.includes(ap.replace(/\.[^.]+$/, '')))
        : (depMatch?.sourceFile === testFile.path ? depMatch.targetFile : depMatch.sourceFile)

      potentialTests.push({
        path:        testFile.path,
        testName:    path.basename(testFile.path),
        relatedFile: relFile || '',
        reason:      `This test file imports or depends on a potentially affected source file.`,
        impactType:  matchedAffected ? 'direct' : 'indirect',
        confidence:  matchedAffected ? 80 : 65,
      })
    }
  }

  const direct   = potentialTests.filter(t => t.impactType === 'direct').length
  const indirect = potentialTests.filter(t => t.impactType === 'indirect').length

  return {
    summary: potentialTests.length > 0
      ? `${potentialTests.length} test file(s) are potentially affected. Review and update before merging changes.`
      : 'No test files were directly linked to potentially affected source files.',
    potentiallyAffectedTests: potentialTests,
    direct,
    indirect,
  }
}

// ─── TRACEABILITY GAP DETECTOR ────────────────────────────────────────────────
const detectTraceabilityGaps = (allAffected, allFiles, deps, reqText) => {
  const gaps = []

  // Gap 1 — affected API with no corresponding test file
  const affectedAPIs  = allAffected.filter(a => a.type === 'api')
  const testFilePaths = new Set(allFiles.filter(f => f.fileType === 'test' || /\.(test|spec)/.test(f.path)).map(f => f.path))

  for (const api of affectedAPIs) {
    const baseName = path.basename(api.path, path.extname(api.path)).toLowerCase()
    const hasTest  = [...testFilePaths].some(tp => tp.toLowerCase().includes(baseName))
    if (!hasTest) {
      gaps.push({
        gapType:         'api-no-test',
        relatedArtifact: api.path,
        severity:        'high',
        reason:          `Potentially affected API file has no corresponding test file detected in the project.`,
        suggestedAction: `Create a test file covering the behavior of ${path.basename(api.path)}.`,
      })
    }
  }

  // Gap 2 — affected component with no API linkage
  const affectedComps = allAffected.filter(a => a.type === 'component')
  const apiPaths      = new Set(allAffected.filter(a => a.type === 'api').map(a => a.path))
  for (const comp of affectedComps) {
    const linkedToAPI = deps.some(d =>
      (d.sourceFile === comp.path && apiPaths.has(d.targetFile)) ||
      (d.targetFile === comp.path && apiPaths.has(d.sourceFile))
    )
    if (!linkedToAPI && apiPaths.size > 0) {
      gaps.push({
        gapType:         'component-no-api-link',
        relatedArtifact: comp.path,
        severity:        'medium',
        reason:          `Potentially affected component has no detected dependency edge linking it to an API file.`,
        suggestedAction: `Verify whether ${path.basename(comp.path)} directly calls the affected API.`,
      })
    }
  }

  // Gap 3 — high-confidence affected model with no migration note
  const affectedModels = allAffected.filter(a => a.type === 'model' && (a.confidence || 0) >= 75)
  for (const model of affectedModels) {
    gaps.push({
      gapType:         'model-change-no-migration',
      relatedArtifact: model.path,
      severity:        'medium',
      reason:          `Schema/model file is potentially affected but no migration file was detected in the project.`,
      suggestedAction: `Ensure a database migration script is created if schema fields are added or modified.`,
    })
  }

  return gaps
}

// ─── BLAST RADIUS ─────────────────────────────────────────────────────────────
const computeBlastRadius = (allAffected, deps) => {
  const affectedPaths = new Set(allAffected.map(a => a.path))
  const direct   = allAffected.filter(a => a.impactType === 'direct').length
  const indirect = allAffected.filter(a => a.impactType === 'indirect').length
  const possible = allAffected.filter(a => a.impactType === 'possible').length

  // Build propagation path: sort by impact level + type
  const sorted = [...allAffected].sort((a, b) => {
    const lvlOrd  = { direct: 0, indirect: 1, possible: 2 }
    const impOrd  = { high: 0, medium: 1, low: 2 }
    return (lvlOrd[a.impactType] - lvlOrd[b.impactType]) || (impOrd[a.impactLevel] - impOrd[b.impactLevel])
  })
  const propagationPath = sorted.map(a => a.path)

  return {
    totalArtifacts: allAffected.length,
    direct,
    indirect,
    possible,
    propagationPath,
  }
}

// ─── MOCK ANALYSIS — file-specific reasons from actual source symbols ─────────
/**
 * For every candidate file, build a reason grounded in what the static
 * analysis actually found in that file — not a generic bucket sentence.
 *
 * Priority order for reason construction:
 *  1. Specific functions/routes detected in the file
 *  2. File type + path semantics
 *  3. Dependency relationships
 *  4. Generic fallback (only if nothing else applies)
 */
const buildFileSpecificReason = (file, requirementText, deps, isLoc, isEta, reqWords) => {
  const fns     = (file.functions   || []).slice(0, 4)
  const routes  = (file.routes      || []).slice(0, 3)
  const comps   = (file.components  || []).slice(0, 3)
  const classes = (file.classes     || []).slice(0, 3)
  const imports = (file.imports     || []).filter(i => i.startsWith('.')).slice(0, 3)
  const models  = (file.models      || []).slice(0, 3)
  const fname   = path.basename(file.path)
  const type    = file.fileType || 'file'

  const linkedFiles = deps
    .filter(d => d.sourceFile === file.path || d.targetFile === file.path)
    .map(d => path.basename(d.sourceFile === file.path ? d.targetFile : d.sourceFile))
    .slice(0, 2)

  // ── Location feature reasons ───────────────────────────────────────────────
  if (isLoc) {
    if (type === 'component' && comps.length > 0) {
      const submitFn = fns.find(f => /submit|send|report|create|add/i.test(f))
      if (submitFn) {
        return `Potentially affected because ${fname} contains the ${comps[0]} component with a submission handler (${submitFn}). The new location requirement may require this component to collect the user's current coordinates before submitting.`
      }
      return `Potentially affected because ${fname} renders the ${comps.join(', ')} component(s) that likely handle issue submission. Adding location capture will require UI changes to collect and display the user's position.`
    }
    if (type === 'component' && fns.length > 0) {
      return `Potentially affected because ${fname} contains ${fns.join(', ')} — likely a form or reporting UI. The location requirement may need a geolocation call added to the submit flow.`
    }
    if (type === 'api' && routes.length > 0) {
      return `Potentially affected because ${fname} defines the ${routes.join(', ')} endpoint(s). The location payload will need to be accepted and validated in this API handler.`
    }
    if (type === 'service' && fns.length > 0) {
      return `Potentially affected because ${fname} contains ${fns.join(', ')}, which currently sends data to the backend. The new requirement introduces location data that may need to be included in the API request payload.`
    }
    if (type === 'model' && models.length > 0) {
      return `Potentially affected because ${fname} defines the ${models.join(', ')} schema. The new location requirement may require adding a location field (e.g. coordinates or address) to persist the reported position.`
    }
    if (type === 'model') {
      return `Potentially affected because ${fname} likely defines the data schema for the relevant entity. Storing the user's location with each record may require a new schema field.`
    }
    if (fns.length > 0) {
      return `Potentially affected because ${fname} contains ${fns.join(', ')}. These functions may need to be updated to pass location data through the call chain.`
    }
    if (linkedFiles.length > 0) {
      return `Potentially affected because ${fname} depends on or is depended upon by ${linkedFiles.join(', ')}, which are directly affected by the location requirement.`
    }
  }

  // ── ETA feature reasons ────────────────────────────────────────────────────
  if (isEta) {
    if (type === 'component' && fns.length > 0) {
      return `Potentially affected because ${fname} contains ${fns.join(', ')} that display delivery tracking data. The ETA requirement may require adding an estimated arrival time display.`
    }
    if (type === 'api' && routes.length > 0) {
      return `Potentially affected because ${fname} exposes ${routes.join(', ')}. The API response schema may need a new estimatedArrivalTime field.`
    }
    if (type === 'service' && fns.length > 0) {
      return `Potentially affected because ${fname} contains ${fns.join(', ')} that handle delivery-related business logic. ETA calculation logic may need to be added here.`
    }
    if (type === 'model') {
      const existing = (file.exports || []).slice(0, 3)
      return `Potentially affected because ${fname} defines the order/delivery schema${existing.length ? ` with fields: ${existing.join(', ')}` : ''}. A new estimatedArrivalTime field may be required.`
    }
    if (fns.length > 0) {
      return `Potentially affected because ${fname} contains ${fns.join(', ')} related to delivery tracking. These may need to incorporate ETA data.`
    }
  }

  // ── Generic keyword-based reasons using actual symbols ────────────────────
  const matchedFns = fns.filter(f => reqWords.some(w => f.toLowerCase().includes(w)))
  if (matchedFns.length > 0) {
    return `Potentially affected because ${fname} contains ${matchedFns.join(', ')}, which relate to the requirement's subject area and may need to be extended.`
  }
  if (routes.length > 0) {
    return `Potentially affected because ${fname} defines the ${routes.join(', ')} route(s). The new requirement may require changes to the request/response schema on this endpoint.`
  }
  if (comps.length > 0) {
    return `Potentially affected because ${fname} contains the ${comps.join(', ')} component(s). UI changes may be needed to support the new functionality.`
  }
  if (models.length > 0) {
    return `Potentially affected because ${fname} defines the ${models.join(', ')} data model. The new requirement may require schema changes.`
  }
  if (fns.length > 0) {
    return `Potentially affected because ${fname} contains ${fns.join(', ')}. These functions are in the dependency path of files directly affected by the requirement.`
  }
  if (linkedFiles.length > 0) {
    return `Potentially affected because ${fname} has a dependency relationship with ${linkedFiles.join(', ')}, which are directly related to the new requirement.`
  }
  return `Potentially affected via static dependency analysis. This file is in the transitive dependency path of artifacts directly related to the requirement.`
}

const mockAnalyze = async (requirementText, relevantFiles, deps) => {
  const req      = requirementText.toLowerCase()
  const reqWords = req.match(/\b\w{4,}\b/g) || []
  const isLoc    = req.includes('location') || req.includes('geolocation') || req.includes('coordinates') || req.includes('latitude') || req.includes('longitude')
  const isEta    = req.includes('estimated arrival') || req.includes('eta') || req.includes('arrival time')

  const results = []

  for (const file of relevantFiles) {
    const score = scoreFileRelevance(file, requirementText)
    if (score === 0 && !isLoc && !isEta) continue

    const pathLow = file.path.toLowerCase()
    let impactLevel = 'low'
    let impactType  = 'possible'
    let confidence  = 60 + Math.min(score * 5, 30)

    // Determine impact level and type from path semantics + score
    if (isLoc) {
      if (/report|issue|civic|form|submit/.test(pathLow) && file.fileType === 'component') {
        impactLevel = 'high'; impactType = 'direct'; confidence = Math.max(confidence, 89)
      } else if (/(api|service|controller|server)/.test(pathLow)) {
        impactLevel = 'high'; impactType = 'direct'; confidence = Math.max(confidence, 85)
      } else if (/(model|schema|entity)/.test(pathLow)) {
        impactLevel = 'medium'; impactType = 'indirect'; confidence = Math.max(confidence, 78)
      } else if (/(test|spec)/.test(pathLow)) {
        impactLevel = 'low'; impactType = 'indirect'; confidence = Math.max(confidence, 70)
      } else if (score >= 3) {
        impactLevel = 'medium'; impactType = 'indirect'; confidence = Math.max(confidence, 72)
      } else {
        continue  // no evidence → exclude entirely
      }
    } else if (isEta) {
      if (/(track|order)/.test(pathLow)) {
        impactLevel = 'high'; impactType = 'direct'; confidence = Math.max(confidence, 88)
      } else if (/(service|controller)/.test(pathLow)) {
        impactLevel = 'medium'; impactType = 'indirect'; confidence = Math.max(confidence, 78)
      } else if (/(model|schema)/.test(pathLow)) {
        impactLevel = 'medium'; impactType = 'indirect'; confidence = Math.max(confidence, 75)
      } else if (/route/.test(pathLow)) {
        impactLevel = 'medium'; impactType = 'indirect'; confidence = Math.max(confidence, 80)
      } else {
        continue
      }
    } else if (score > 0) {
      if (score >= 6)      { impactLevel = 'high';   impactType = 'direct';   confidence = Math.min(confidence + 10, 92) }
      else if (score >= 3) { impactLevel = 'medium'; impactType = 'indirect' }
      else                 { continue }
    } else {
      continue
    }

    // Build file-specific reason from actual source symbols
    const reason = buildFileSpecificReason(file, requirementText, deps, isLoc, isEta, reqWords)

    // Build structured evidence from what static analysis actually found
    const fileDeps = deps
      .filter(d => d.sourceFile === file.path || d.targetFile === file.path)
      .map(d => d.sourceFile === file.path ? d.targetFile : d.sourceFile)
      .slice(0, 4)

    const evidenceDetail = {
      functions:    (file.functions  || []).slice(0, 5),
      apis:         (file.routes     || []).slice(0, 4),
      existingData: (file.exports    || []).slice(0, 4),
      dependencies: fileDeps,
      lineNumbers:  [],  // requires line-level static analysis (future work)
    }

    const evidenceParts = []
    if ((file.functions||[]).length)  evidenceParts.push(`functions: ${(file.functions||[]).slice(0,3).join(', ')}`)
    if ((file.routes||[]).length)     evidenceParts.push(`routes: ${(file.routes||[]).slice(0,3).join(', ')}`)
    if ((file.classes||[]).length)    evidenceParts.push(`classes: ${(file.classes||[]).slice(0,2).join(', ')}`)
    if ((file.components||[]).length) evidenceParts.push(`components: ${(file.components||[]).slice(0,2).join(', ')}`)
    if (fileDeps.length)              evidenceParts.push(`deps: ${fileDeps.slice(0,2).map(d => path.basename(d)).join(', ')}`)

    results.push({
      path:        file.path,
      type:        file.fileType || 'file',
      impactLevel,
      impactType,
      confidence,
      reason,
      evidence: evidenceParts.length
        ? `Static analysis found: ${evidenceParts.join(' | ')}`
        : `Static analysis: file matched by path semantics and keyword relevance.`,
      evidenceDetail,
      verificationStatus: 'Pending Review',
    })
  }

  results.sort((a, b) => b.confidence - a.confidence)
  return { results, provider: 'mock' }
}

// ─── GEMINI ANALYSIS ─────────────────────────────────────────────────────────
const geminiAnalyze = async (requirementText, relevantFiles, deps) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })

    // Send only relevant structured context — not the entire codebase
    const fileContext = relevantFiles.slice(0, 15).map(f => ({
      path:      f.path,
      type:      f.fileType,
      language:  f.language,
      functions: (f.functions || []).slice(0, 5),
      routes:    (f.routes    || []).slice(0, 3),
      classes:   (f.classes   || []).slice(0, 3),
      imports:   (f.imports   || []).filter(i => i.startsWith('.')).slice(0, 5),
    }))

    const depContext = deps.slice(0, 20).map(d => `${d.sourceFile} → ${d.targetFile}`)

    const prompt = `You are a software architect analyzing code impact. Given this new requirement and the analyzed source files, identify which files are POTENTIALLY AFFECTED.

NEW REQUIREMENT:
"${requirementText}"

SOURCE FILES IN PROJECT:
${JSON.stringify(fileContext, null, 2)}

DEPENDENCY RELATIONSHIPS:
${depContext.join('\n')}

Respond ONLY with valid JSON:
{
  "changeType": "Addition|Modification|Deletion|Enhancement|Unknown",
  "summary": "One clear sentence describing the overall impact.",
  "results": [
    {
      "path": "exact file path from above",
      "impactLevel": "high|medium|low",
      "impactType": "direct|indirect|possible",
      "confidence": 85,
      "reason": "Specific reason based on the actual file content and new requirement.",
      "evidence": "What specific function/route/class makes this file relevant."
    }
  ]
}`

    const result  = await model.generateContent(prompt)
    const text    = result.response.text()
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Gemini returned non-JSON response')

    const parsed  = JSON.parse(jsonMatch[0])

    // Enrich results with evidenceDetail from static analysis
    const enriched = (parsed.results || []).map(item => {
      const file = relevantFiles.find(f => f.path === item.path)
      return {
        path:        item.path,
        type:        file?.fileType || 'file',
        impactLevel: item.impactLevel || 'medium',
        impactType:  item.impactType  || 'possible',
        confidence:  item.confidence  || 70,
        reason:      item.reason      || '',
        evidence:    item.evidence    || '',
        evidenceDetail: {
          functions:    (file?.functions || []).slice(0, 5),
          apis:         (file?.routes    || []).slice(0, 3),
          existingData: (file?.exports   || []).slice(0, 3),
          dependencies: deps.filter(d => d.sourceFile === item.path || d.targetFile === item.path)
            .map(d => d.sourceFile === item.path ? d.targetFile : d.sourceFile).slice(0, 3),
          lineNumbers: [],
        },
        verificationStatus: 'Pending Review',
      }
    })

    return {
      results:    enriched,
      changeType: parsed.changeType || 'Unknown',
      summary:    parsed.summary    || '',
      provider:   'gemini',
    }
  } catch (err) {
    console.error(`⚠️  Gemini codebase analysis failed: ${err.message} — falling back to mock`)
    return mockAnalyze(requirementText, relevantFiles, deps)
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
const analyzeCodeImpact = async (uploadId, requirementText) => {
  const [files, deps] = await Promise.all([
    CodeFile.find({ uploadId }).lean(),
    CodeDependency.find({ uploadId }).lean(),
  ])

  if (files.length === 0) {
    return {
      summary: 'No source files found. Please upload and analyze a project first.',
      changeType: 'Unknown',
      affectedFiles: [], affectedComponents: [], affectedAPIs: [], affectedModels: [],
      risks: [], recommendations: [], overallConfidence: 0, provider: 'none',
      riskScore: { level: 'low', score: 0, explanation: 'No files analyzed.' },
      testImpact: { summary: '', potentiallyAffectedTests: [], direct: 0, indirect: 0 },
      traceabilityGaps: [],
      blastRadius: { totalArtifacts: 0, direct: 0, indirect: 0, possible: 0, propagationPath: [] },
    }
  }

  // 1. Score + expand via dependency graph
  const scored      = files.map(f => ({ ...f, _score: scoreFileRelevance(f, requirementText) }))
  const seedFiles   = scored.filter(f => f._score > 0).slice(0, 20)
  const seedPaths   = seedFiles.map(f => f.path)
  const expanded    = await walkDependencies(uploadId, seedPaths, deps)
  const expandedFiles = files.filter(f => expanded.includes(f.path))

  // 2. AI analysis
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase()
  const hasKey   = !!process.env.GEMINI_API_KEY
  const aiResult = (provider === 'gemini' && hasKey)
    ? await geminiAnalyze(requirementText, expandedFiles, deps)
    : await mockAnalyze(requirementText, expandedFiles, deps)

  // 3. Split by type
  const bucket = type => aiResult.results.filter(r => r.type === type)
  const filesResult      = aiResult.results.filter(r => !['component','api','model'].includes(r.type))
  const componentsResult = bucket('component')
  const apisResult       = bucket('api')
  const modelsResult     = bucket('model')

  const allAffected = aiResult.results
  const overallConf = allAffected.length > 0
    ? Math.round(allAffected.reduce((s, r) => s + r.confidence, 0) / allAffected.length)
    : 0

  // 4. Extended computations
  const riskScore        = calculateRiskScore(aiResult.results, allAffected)
  const testImpact       = detectTestImpact(allAffected, files, deps)
  const traceabilityGaps = detectTraceabilityGaps(allAffected, files, deps, requirementText)
  const blastRadius      = computeBlastRadius(allAffected, deps)

  // Add test files to risk totals
  riskScore.tests = testImpact.potentiallyAffectedTests.length

  const summary = aiResult.summary ||
    `Static + AI analysis identified ${allAffected.length} potentially affected artifact(s) with ${overallConf}% average confidence. Risk level: ${riskScore.level.toUpperCase()}. Human verification required before making any changes.`

  return {
    summary,
    changeType: aiResult.changeType || detectChangeType(requirementText),
    affectedFiles:      filesResult,
    affectedComponents: componentsResult,
    affectedAPIs:       apisResult,
    affectedModels:     modelsResult,
    risks: [
      'Review all potentially affected files before making changes.',
      'Run existing tests after modifications.',
      'These are AI-suggested impacts — human verification is required.',
      ...(traceabilityGaps.length > 0 ? [`${traceabilityGaps.length} traceability gap(s) detected — see Gaps section.`] : []),
    ],
    recommendations: [
      'Start with high-confidence, high-impact files.',
      'Update tests to cover new functionality.',
      'Review API schema changes carefully.',
    ],
    overallConfidence: overallConf,
    provider: aiResult.provider,
    riskScore,
    testImpact,
    traceabilityGaps,
    blastRadius,
  }
}

module.exports = { analyzeCodeImpact }
