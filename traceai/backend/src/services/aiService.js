/**
 * AI Service — requirement-level impact analysis.
 *
 * Providers:
 *   'gemini' — Google Gemini (uses GEMINI_API_KEY from backend .env only)
 *   'mock'   — rule-based fallback, uses only the project's own components
 *
 * CRITICAL RULE: Only components belonging to the current project are ever
 * considered. There are NO hardcoded component names, NO fallback component
 * lists, NO Food-Delivery-specific logic. Every component result comes from
 * the `components` array passed in by the caller.
 *
 * GEMINI_API_KEY MUST stay on the backend — never exposed to React.
 */

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Detect the primary change type from the requirement diff.
 * Returns one of: Addition | Deletion | Modification | Clarification | Unknown
 */
const detectChangeType = (oldText, newText) => {
  const oldLen = oldText.length
  const newLen = newText.length
  if (newLen > oldLen * 1.15) return 'Addition'
  if (newLen < oldLen * 0.85) return 'Deletion'
  // Look for addition keywords
  const addedSentences = newText.split(/[.!?]/).filter(s => !oldText.includes(s.trim()) && s.trim().length > 10)
  if (addedSentences.length > 0) return 'Addition'
  return 'Modification'
}

/**
 * Extract newly added concepts by comparing old vs new requirement text.
 */
const detectNewConcepts = (oldText, newText) => {
  const oldWords = new Set(oldText.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const newWords = newText.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !oldWords.has(w))
  // Deduplicate and return the most meaningful new words
  return [...new Set(newWords)].slice(0, 8)
}

/**
 * Score how semantically relevant a component is to the requirement change.
 * Uses only the component's stored name, type, description, and technology.
 * Does NOT use source-code evidence (components may have no file path).
 *
 * Returns a score 0–100. 0 = no relevance detected.
 */
const scoreComponentRelevance = (component, oldText, newText, newConcepts) => {
  const combined   = `${component.name} ${component.description || ''} ${component.type} ${component.technology || ''}`.toLowerCase()
  const reqCombined = `${oldText} ${newText}`.toLowerCase()
  const newTextLow  = newText.toLowerCase()

  let score = 0

  // 1. New concepts from the change match component metadata
  for (const concept of newConcepts) {
    if (combined.includes(concept)) score += 15
  }

  // 2. Key words from the NEW requirement (not in old) match component
  const oldWords = new Set(oldText.toLowerCase().split(/\W+/).filter(w => w.length > 3))
  const importantNewWords = newText.toLowerCase().split(/\W+/).filter(w => w.length > 3 && !oldWords.has(w))
  for (const word of importantNewWords) {
    if (combined.includes(word)) score += 12
  }

  // 3. General requirement keywords match component
  const allReqWords = reqCombined.split(/\W+/).filter(w => w.length > 4)
  const uniqueReqWords = [...new Set(allReqWords)]
  for (const word of uniqueReqWords) {
    if (combined.includes(word)) score += 5
  }

  // 4. Component type bonuses for common change patterns
  const typeUpper = (component.type || '').toUpperCase()
  if (importantNewWords.length > 0) {
    // If something was added, services and APIs are commonly affected
    if (['SERVICE', 'API', 'BACKEND'].includes(typeUpper)) score += 8
    // Frontend components matter if UI behavior changed
    if (typeUpper === 'FRONTEND' && (newTextLow.includes('display') || newTextLow.includes('show') || newTextLow.includes('view') || newTextLow.includes('notification'))) score += 8
    // Database matters if data storage changed
    if (typeUpper === 'DATABASE' && (newTextLow.includes('store') || newTextLow.includes('record') || newTextLow.includes('save') || newTextLow.includes('persist'))) score += 8
  }

  return Math.min(score, 100)
}

/**
 * Build a component-specific reason grounded in:
 *   - the component's actual name, type, description, technology
 *   - the new requirement text
 *   - what was added/changed
 * Never invents function names, routes, or line numbers.
 */
const buildComponentReason = (component, oldText, newText, newConcepts, impactLevel) => {
  const desc    = component.description?.trim()
  const name    = component.name
  const type    = component.type
  const newConceptStr = newConcepts.slice(0, 3).join(', ')

  // Extract the newly added behavior for the reason
  const sentences = newText.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10)
  const oldSentences = new Set(oldText.split(/[.!?]+/).map(s => s.trim().toLowerCase()))
  const newBehavior = sentences.find(s => !oldSentences.has(s.toLowerCase())) || ''

  if (desc) {
    // Use the component's actual description to explain relevance
    return `Potentially affected because ${name} ${desc.toLowerCase().startsWith('is') || desc.toLowerCase().startsWith('handles') || desc.toLowerCase().startsWith('manages') || desc.toLowerCase().startsWith('provides') ? desc : 'is a ' + type.toLowerCase() + ' that ' + desc}. ${newBehavior ? 'The new behavior — "' + newBehavior + '" — may require changes to this component.' : 'The new requirement change may require this component to be updated.'}`
  }

  // No description — use type and name
  const typeDesc = {
    'Frontend':      `handles user interface concerns`,
    'API':           `exposes backend functionality to clients`,
    'Backend':       `processes business logic`,
    'Service':       `provides core business functionality`,
    'Database':      `manages data persistence`,
    'Test':          `verifies system behavior`,
    'Documentation': `documents system functionality`,
  }[type] || `performs ${type.toLowerCase()} functionality`

  return `Potentially affected because ${name} ${typeDesc}${newConceptStr ? `, and the new requirement introduces ${newConceptStr}` : ', and may need to be updated to support the changed requirement'}.${newBehavior ? ' Specifically: "' + newBehavior + '".' : ''}`
}

/**
 * Build a recommended action based on component type and the change.
 */
const buildRecommendedAction = (component, newConcepts) => {
  const type = (component.type || '').toLowerCase()
  const name = component.name

  if (type === 'service')   return `Review ${name} to determine if it needs to be extended to support the new behavior. Update service logic if required.`
  if (type === 'api')       return `Check whether the ${name} request/response schema needs to be updated. Ensure the new behavior is exposed through the API contract.`
  if (type === 'frontend')  return `Review the ${name} UI to ensure the new behavior is correctly presented to the user. Update components and state management as needed.`
  if (type === 'database')  return `Evaluate whether the ${name} schema requires new fields or changes to support the updated requirements.`
  if (type === 'test')      return `Update ${name} test cases to cover the new behavior introduced by the requirement change.`
  if (type === 'backend')   return `Review the ${name} business logic to incorporate the changes described in the new requirement.`
  return `Review ${name} to assess whether it needs to be updated to support the new requirement behavior.`
}

// ─── MOCK ANALYSIS (uses only the project's own components) ──────────────────
/**
 * Analyzes the requirement diff and scores each project component.
 * NEVER falls back to hardcoded component names.
 * If no components are registered, returns an empty list with a clear summary.
 */
const mockAnalyze = async ({ oldText, newText, components }) => {
  const newConcepts  = detectNewConcepts(oldText, newText)
  const changeType   = detectChangeType(oldText, newText)

  // Score every component in this project
  const scored = components.map(comp => ({
    comp,
    score: scoreComponentRelevance(comp, oldText, newText, newConcepts),
  })).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)

  // Build impact results — only components with evidence of relevance
  const impactedComponents = scored.map(({ comp, score }) => {
    const confidence = Math.min(Math.round(40 + score * 0.6), 96)
    const impactLevel = score >= 35 ? 'High' : score >= 20 ? 'Medium' : 'Low'
    const reason = buildComponentReason(comp, oldText, newText, newConcepts, impactLevel)
    const recommendedAction = buildRecommendedAction(comp, newConcepts)

    return {
      componentId:       comp._id,
      componentName:     comp.name,
      componentType:     comp.type,
      impactLevel,
      confidence,
      reason,
      recommendedAction,
      verificationStatus: 'Pending Review',
    }
  })

  // Build a meaningful summary
  const newBehavior = newConcepts.length > 0 ? newConcepts.slice(0, 3).join(', ') : 'updated behavior'
  const summary = impactedComponents.length > 0
    ? `${changeType}: The requirement introduces ${newBehavior}. ${impactedComponents.length} component(s) are potentially affected based on their descriptions. All results require human verification.`
    : components.length === 0
    ? 'No components are registered for this project. Add components to this project before running impact analysis.'
    : `The requirement change (${newBehavior}) did not match any registered components based on their names and descriptions. Manually review the ${components.length} registered component(s) for potential impact.`

  return {
    changeType,
    changedConcepts: newConcepts,
    summary,
    risks: impactedComponents.length > 0
      ? ['Review all potentially affected components before implementing changes.', 'These are AI-suggested impacts — human verification is required.']
      : ['No automatic impact was detected. Manual review of all components is still recommended.'],
    recommendations: ['Verify each AI-suggested impact before implementation.', 'Update tests to cover the new behavior.'],
    impactedComponents,
    provider: 'mock',
  }
}

// ─── GEMINI ANALYSIS ──────────────────────────────────────────────────────────
const geminiAnalyze = async ({ oldText, newText, components }) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' })

    // Send only this project's components — never hardcoded names
    const componentList = components.map(c =>
      `- ${c.name} (${c.type})${c.description ? ': ' + c.description : ''}`
    ).join('\n')

    const prompt = `You are a software requirements analyst. Compare these two requirement versions and identify which of the LISTED COMPONENTS may be affected.

OLD REQUIREMENT:
"${oldText}"

NEW REQUIREMENT:
"${newText}"

REGISTERED COMPONENTS FOR THIS PROJECT (analyze ONLY these):
${componentList || '(no components registered for this project)'}

RULES:
- Only reference components from the list above. Never invent component names.
- Base your reasoning on the component's name, type, and description.
- Do not invent function names, API routes, or line numbers.
- Use "Potentially affected" language — never claim certainty.

Respond ONLY with valid JSON in this exact format:
{
  "changeType": "Addition|Modification|Deletion|Unknown",
  "changedConcepts": ["concept1"],
  "summary": "One sentence.",
  "risks": ["risk1"],
  "recommendations": ["rec1"],
  "impactedComponents": [
    {
      "componentName": "exact name from list above",
      "impactLevel": "High|Medium|Low",
      "confidence": 85,
      "reason": "Specific reason based only on the component description and new requirement.",
      "recommendedAction": "What to do."
    }
  ]
}`

    const result     = await model.generateContent(prompt)
    const text       = result.response.text()
    const jsonMatch  = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Gemini returned non-JSON response')

    const parsed = JSON.parse(jsonMatch[0])

    // Map back to component objects — only components that exist in our list
    const compMap = {}
    components.forEach(c => { compMap[c.name.toLowerCase()] = c })

    const impactedComponents = (parsed.impactedComponents || [])
      .filter(item => {
        // Strict filter: only include if the name matches a real project component
        const key = (item.componentName || '').toLowerCase()
        return !!compMap[key]
      })
      .map(item => {
        const comp = compMap[item.componentName.toLowerCase()]
        return {
          componentId:       comp._id,
          componentName:     comp.name,
          componentType:     comp.type,
          impactLevel:       item.impactLevel || 'Medium',
          confidence:        item.confidence  || 70,
          reason:            item.reason      || '',
          recommendedAction: item.recommendedAction || '',
          verificationStatus: 'Pending Review',
        }
      })

    return {
      changeType:      parsed.changeType      || detectChangeType(oldText, newText),
      changedConcepts: parsed.changedConcepts || detectNewConcepts(oldText, newText),
      summary:         parsed.summary         || '',
      risks:           parsed.risks           || [],
      recommendations: parsed.recommendations || [],
      impactedComponents,
      provider: 'gemini',
    }
  } catch (err) {
    console.error(`⚠️  Gemini analysis failed: ${err.message} — falling back to mock`)
    return mockAnalyze({ oldText, newText, components })
  }
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
const analyze = async ({ oldText, newText, components }) => {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase()
  const hasKey   = !!process.env.GEMINI_API_KEY

  if (provider === 'gemini' && hasKey) {
    return geminiAnalyze({ oldText, newText, components })
  }
  return mockAnalyze({ oldText, newText, components })
}

module.exports = { analyze }
