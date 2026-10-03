/**
 * AI Service — requirement-level impact analysis.
 *
 * Providers:
 *   'gemini' — Google Gemini (uses GEMINI_API_KEY from backend .env only)
 *   'mock'   — rule-based fallback when key is absent
 *
 * SECURITY: GEMINI_API_KEY MUST stay on the backend. Never expose to React.
 */

// ─── GEMINI ANALYSIS ──────────────────────────────────────────────────────────
const geminiAnalyze = async ({ oldText, newText, components }) => {
  try {
    const { GoogleGenerativeAI } = require('@google/generative-ai')
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const componentList = components.map(c => `- ${c.name} (${c.type})`).join('\n')

    const prompt = `You are a software requirements analyst. Compare these two requirement versions and identify which components may be affected.

OLD REQUIREMENT:
"${oldText}"

NEW REQUIREMENT:
"${newText}"

REGISTERED COMPONENTS IN THE SYSTEM:
${componentList || '(none registered)'}

Respond ONLY with valid JSON in this exact format:
{
  "changeType": "Addition|Modification|Deletion|Clarification|Unknown",
  "changedConcepts": ["concept1", "concept2"],
  "summary": "One sentence explaining what changed.",
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "impactedComponents": [
    {
      "componentName": "exact name from list above",
      "impactLevel": "High|Medium|Low",
      "confidence": 85,
      "reason": "Why this component may be affected.",
      "recommendedAction": "What to do."
    }
  ]
}`

    const result = await model.generateContent(prompt)
    const text   = result.response.text()

    // Extract JSON from response (Gemini sometimes wraps in markdown)
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Gemini returned non-JSON response')

    const parsed = JSON.parse(jsonMatch[0])

    // Map back to our component objects
    const impactedComponents = (parsed.impactedComponents || []).map(item => {
      const comp = components.find(c =>
        c.name.toLowerCase() === item.componentName?.toLowerCase()
      )
      return {
        componentId:       comp?._id || null,
        componentName:     item.componentName,
        componentType:     comp?.type || 'Unknown',
        impactLevel:       item.impactLevel || 'Medium',
        confidence:        item.confidence  || 70,
        reason:            item.reason      || '',
        recommendedAction: item.recommendedAction || '',
        verificationStatus: 'Pending Review',
      }
    })

    return {
      changeType:         parsed.changeType     || 'Unknown',
      changedConcepts:    parsed.changedConcepts || [],
      summary:            parsed.summary        || '',
      risks:              parsed.risks           || [],
      recommendations:    parsed.recommendations || [],
      impactedComponents,
      provider: 'gemini',
    }
  } catch (err) {
    console.error(`⚠️  Gemini analysis failed: ${err.message} — falling back to mock`)
    return mockAnalyze({ oldText, newText, components })
  }
}

// ─── MOCK ANALYSIS ────────────────────────────────────────────────────────────
const mockAnalyze = async ({ oldText, newText, components }) => {
  const oldWords     = new Set(oldText.toLowerCase().split(/\s+/))
  const newWords     = newText.toLowerCase().split(/\s+/).filter(w => !oldWords.has(w))
  const isEtaAddition =
    newText.toLowerCase().includes('estimated arrival time') ||
    newText.toLowerCase().includes('eta')

  if (isEtaAddition) {
    return {
      changeType: 'Addition',
      changedConcepts: ['Estimated Arrival Time', 'ETA'],
      summary: 'The requirement now includes ETA functionality in addition to real-time location tracking.',
      risks: [
        'Existing tracking UI may not have space for ETA display.',
        'The delivery service must calculate and expose ETA data.',
        'Database schema may need an ETA field.',
        'Tests must be updated to cover ETA scenarios.',
      ],
      recommendations: [
        'Review OrderTrackingPage UI for ETA widget placement.',
        'Extend OrderTrackingAPI response with an estimatedArrivalTime field.',
        'Update DeliveryService business logic to calculate ETA.',
        'Add ETA column to OrderDatabase schema.',
        'Extend TrackingTest suite with ETA assertions.',
      ],
      impactedComponents: matchComponents(components, ETA_IMPACT_MAP),
      provider: 'mock',
    }
  }

  const changedConcepts = newWords.slice(0, 5)
  return {
    changeType: detectChangeType(oldText, newText),
    changedConcepts,
    summary: `Requirement updated. New concepts detected: ${changedConcepts.join(', ') || 'none'}.`,
    risks: ['Review all linked components for compatibility with the new requirement text.'],
    recommendations: ['Manually verify all traceability links for this requirement.'],
    impactedComponents: components.slice(0, 3).map((c, i) => ({
      componentId:       c._id,
      componentName:     c.name,
      componentType:     c.type,
      impactLevel:       ['High', 'Medium', 'Low'][i] || 'Medium',
      confidence:        90 - i * 10,
      reason:            'This component is linked to the changed requirement and may need review.',
      recommendedAction: 'Inspect this component for compatibility with updated requirement.',
      verificationStatus: 'Pending Review',
    })),
    provider: 'mock',
  }
}

const ETA_IMPACT_MAP = [
  { nameMatch: 'OrderTrackingPage', impactLevel: 'High',   confidence: 92, reason: 'The tracking page may need to display the newly introduced estimated arrival time.', recommendedAction: 'Review the tracking UI and add ETA display if required.' },
  { nameMatch: 'LocationService',   impactLevel: 'Medium', confidence: 89, reason: 'The location service provides delivery partner location and may need to expose ETA calculation.', recommendedAction: 'Extend LocationService to calculate and return estimated arrival time.' },
  { nameMatch: 'OrderTrackingAPI',  impactLevel: 'High',   confidence: 86, reason: 'The API exposes tracking information to the frontend and must include the ETA field.', recommendedAction: 'Add estimatedArrivalTime to the API response schema.' },
  { nameMatch: 'DeliveryService',   impactLevel: 'Medium', confidence: 81, reason: 'Delivery business logic handles delivery-related operations and may need ETA computation.', recommendedAction: 'Add ETA business logic to DeliveryService.' },
  { nameMatch: 'OrderDatabase',     impactLevel: 'Medium', confidence: 76, reason: 'The database may need a new field to store the estimated arrival time per order.', recommendedAction: 'Add estimatedArrivalTime field to the orders collection schema.' },
  { nameMatch: 'TrackingTest',      impactLevel: 'Low',    confidence: 74, reason: 'Existing tracking tests should be extended to cover ETA scenarios.', recommendedAction: 'Write new test cases to verify ETA display and accuracy.' },
]

const matchComponents = (components, impactMap) => {
  const result = []
  for (const entry of impactMap) {
    const comp = components.find(c => c.name.toLowerCase().includes(entry.nameMatch.toLowerCase()))
    result.push({
      componentId:       comp?._id || null,
      componentName:     comp?.name || entry.nameMatch,
      componentType:     comp?.type || 'Unknown',
      impactLevel:       entry.impactLevel,
      confidence:        entry.confidence,
      reason:            entry.reason,
      recommendedAction: entry.recommendedAction,
      verificationStatus: 'Pending Review',
    })
  }
  return result
}

const detectChangeType = (oldText, newText) => {
  const oldLen = oldText.length
  const newLen = newText.length
  if (newLen > oldLen * 1.1) return 'Addition'
  if (newLen < oldLen * 0.9) return 'Deletion'
  return 'Modification'
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
