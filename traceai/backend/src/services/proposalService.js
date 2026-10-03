/**
 * AI-powered code change proposal service.
 * Generates a PROPOSED modification based on:
 *   - actual uploaded source code
 *   - new requirement text
 *   - file metadata (type, language, imports, functions)
 *
 * The proposal is clearly labelled "AI Proposed" and is NEVER
 * automatically applied. Human review is always required.
 *
 * GEMINI_API_KEY stays on the backend only — never sent to React.
 */

const path = require('path')

// ─── UNIFIED DIFF GENERATOR ───────────────────────────────────────────────────
/**
 * Creates a minimal unified diff string between two code strings.
 * Pure JS — no shell commands, no child_process.
 * Format: standard unified diff (--- / +++ / @@ lines)
 */
const generateDiff = (originalCode, proposedCode, filePath = 'file') => {
  const origLines = originalCode.split('\n')
  const propLines = proposedCode.split('\n')

  const diff = ['--- a/' + filePath, '+++ b/' + filePath]

  // Simple line-by-line diff with context
  const maxLines = Math.max(origLines.length, propLines.length)
  let i = 0, j = 0
  let hunkLines = []
  let hunkStart = -1

  const flushHunk = () => {
    if (hunkLines.length > 0) {
      const origCount = hunkLines.filter(l => l[0] !== '+').length
      const propCount = hunkLines.filter(l => l[0] !== '-').length
      diff.push(`@@ -${hunkStart + 1},${origCount} +${hunkStart + 1},${propCount} @@`)
      diff.push(...hunkLines)
      hunkLines = []
      hunkStart = -1
    }
  }

  while (i < origLines.length || j < propLines.length) {
    const o = origLines[i]
    const p = propLines[j]

    if (o === p) {
      // Context line
      if (hunkLines.length > 0) {
        hunkLines.push(' ' + (o ?? ''))
      }
      i++; j++
    } else {
      if (hunkStart === -1) hunkStart = Math.max(0, i - 2)
      // Add 2 lines of context before change
      const ctxStart = Math.max(0, i - 2)
      if (hunkLines.length === 0) {
        for (let c = ctxStart; c < i; c++) hunkLines.push(' ' + (origLines[c] ?? ''))
        if (hunkStart === -1) hunkStart = ctxStart
        hunkStart = ctxStart
      }

      if (o !== undefined && p !== undefined && o !== p) {
        hunkLines.push('-' + o)
        hunkLines.push('+' + p)
        i++; j++
      } else if (o !== undefined && p === undefined) {
        hunkLines.push('-' + o)
        i++
      } else if (o === undefined && p !== undefined) {
        hunkLines.push('+' + p)
        j++
      } else {
        i++; j++
      }
    }
  }
  flushHunk()

  return diff.join('\n')
}

// ─── MOCK PROPOSAL GENERATOR ──────────────────────────────────────────────────

/**
 * Generate a proposed code change based on file content + requirement.
 * Works without Gemini — produces a meaningful, file-specific proposal.
 */
const mockGenerateProposal = (originalCode, requirementText, filePath, fileType, language) => {
  const req     = requirementText.toLowerCase()
  const fname   = path.basename(filePath, path.extname(filePath))
  const isLoc   = req.includes('location') || req.includes('geolocation') || req.includes('coordinates') || req.includes('lat') || req.includes('lng')
  const isEta   = req.includes('estimated arrival') || req.includes('eta') || req.includes('arrival time')
  const isNotif = req.includes('notification') || req.includes('push') || req.includes('alert')
  const isAuth  = req.includes('auth') || req.includes('login') || req.includes('password') || req.includes('token')

  const lines  = originalCode.split('\n')
  const lang   = language || 'javascript'
  const isTS   = lang === 'typescript' || filePath.endsWith('.ts') || filePath.endsWith('.tsx')
  const isJSX  = filePath.endsWith('.jsx') || filePath.endsWith('.tsx')
  const isPy   = lang === 'python'
  const isJava = lang === 'java'

  let proposedCode = originalCode
  let reasoning    = ''

  // ── Location feature ─────────────────────────────────────────────────────
  if (isLoc) {
    if (fileType === 'component' || isJSX) {
      // Add geolocation hook / state to a React component
      const hasUseState = originalCode.includes('useState')
      const insertAfter = hasUseState
        ? lines.findIndex(l => l.includes('useState'))
        : lines.findIndex(l => l.includes('function') || l.includes('const ') && l.includes('=>'))

      if (insertAfter >= 0) {
        const newLines = [...lines]
        const indent   = lines[insertAfter].match(/^(\s*)/)?.[1] || '  '
        const locBlock = isTS
          ? [
            `${indent}const [location, setLocation] = useState${isTS ? '<{ lat: number; lng: number } | null>' : ''}(null)`,
            `${indent}const [locationError, setLocationError] = useState${isTS ? '<string | null>' : ''}(null)`,
            '',
            `${indent}const captureLocation = () => {`,
            `${indent}  if (!navigator.geolocation) {`,
            `${indent}    setLocationError('Geolocation is not supported by this browser.')`,
            `${indent}    return`,
            `${indent}  }`,
            `${indent}  navigator.geolocation.getCurrentPosition(`,
            `${indent}    (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),`,
            `${indent}    ()  => setLocationError('Unable to retrieve location.')`,
            `${indent}  )`,
            `${indent}}`,
          ]
          : [
            `${indent}const [location, setLocation] = useState(null)`,
            `${indent}const [locationError, setLocationError] = useState(null)`,
            '',
            `${indent}const captureLocation = () => {`,
            `${indent}  if (!navigator.geolocation) { setLocationError('Geolocation not supported'); return }`,
            `${indent}  navigator.geolocation.getCurrentPosition(`,
            `${indent}    (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),`,
            `${indent}    () => setLocationError('Unable to retrieve location.')`,
            `${indent}  )`,
            `${indent}}`,
          ]

        newLines.splice(insertAfter + 1, 0, '', '  // TODO: Added for new location requirement', ...locBlock)
        proposedCode = newLines.join('\n')
        reasoning    = `Added location state and captureLocation() helper to support the new requirement. The component should call captureLocation() before submitting and include location in the payload. Review the useState import and update the submission handler.`
      }
    } else if (fileType === 'api' || fileType === 'service') {
      // Add location param to relevant functions
      const fnLineIdx = lines.findIndex(l =>
        /export\s+(async\s+)?function|const\s+\w+\s*=\s*(async\s+)?\(/.test(l)
      )
      if (fnLineIdx >= 0) {
        const newLines = [...lines]
        const origFn   = lines[fnLineIdx]
        // Inject location param if not already present
        if (!origFn.includes('location')) {
          const modified = origFn.replace(/\(([^)]*)\)/, (_, params) => {
            const trimmed = params.trim()
            const newParams = trimmed
              ? `${trimmed}, location${isTS ? '?: { lat: number; lng: number }' : ''}`
              : `location${isTS ? '?: { lat: number; lng: number }' : ''}`
            return `(${newParams})`
          })
          newLines[fnLineIdx] = modified

          // Find the return/post/put call and inject location
          const bodyEnd = newLines.findIndex((l, idx) => idx > fnLineIdx && /return|\.post|\.put/.test(l))
          if (bodyEnd >= 0 && newLines[bodyEnd].includes('{')) {
            newLines[bodyEnd] = newLines[bodyEnd].replace('{', '{\n      location,  // Added: attach location to payload')
          }
        }
        proposedCode = newLines.join('\n')
        reasoning    = `Added optional location parameter to the function signature and included it in the request payload. Callers should pass the user's coordinates (lat/lng) obtained via the browser Geolocation API.`
      }
    } else if (fileType === 'model') {
      // Add location field to a model/schema
      const schemaLine = lines.findIndex(l => /Schema\(|schema\s*=|interface\s+\w+|class\s+\w+/.test(l))
      if (schemaLine >= 0) {
        const newLines = [...lines]
        const indent   = '  '
        let insertAt   = schemaLine + 1
        // Find a good insertion point (after the opening brace)
        const openBrace = newLines.findIndex((l, i) => i >= schemaLine && l.includes('{'))
        if (openBrace >= 0) insertAt = openBrace + 1

        const locField = isTS
          ? [`${indent}location?: {`, `${indent}  lat: number`, `${indent}  lng: number`, `${indent}} // Added: store user location`]
          : isPy
          ? [`  # Added: location field`, `  location = models.JSONField(null=True, blank=True)  # { lat, lng }`]
          : [`${indent}location: {`, `${indent}  lat: { type: Number },`, `${indent}  lng: { type: Number },`, `${indent}},  // Added: store coordinates for civic issue location`]

        newLines.splice(insertAt, 0, '', '  // TODO: New field — location requirement', ...locField)
        proposedCode = newLines.join('\n')
        reasoning    = `Added a location field to store user coordinates (lat/lng). Update your database migration or schema sync accordingly. Ensure the API passes this field through and validates it on the backend.`
      }
    }
  }

  // ── ETA feature ───────────────────────────────────────────────────────────
  if (isEta && proposedCode === originalCode) {
    if (fileType === 'model') {
      const insertAt = lines.findIndex(l => l.includes('{')) + 1
      const newLines = [...lines]
      newLines.splice(insertAt, 0, `  estimatedArrivalTime: { type: Date },  // Added: ETA field for delivery tracking`)
      proposedCode = newLines.join('\n')
      reasoning    = `Added estimatedArrivalTime field to store the ETA for delivery tracking. Update the service layer to calculate and populate this field.`
    } else if (fileType === 'service' || fileType === 'api') {
      proposedCode = originalCode.replace(
        /(return\s+\{[^}]*)(})/,
        `$1  estimatedArrivalTime: calculateETA(), // Added: include ETA in response\n$2`
      )
      reasoning = `Added estimatedArrivalTime to the response payload. Implement calculateETA() using distance and current location data.`
    }
  }

  // ── Generic fallback — add a TODO comment block ───────────────────────────
  if (proposedCode === originalCode) {
    const firstNonEmpty = lines.findIndex(l => l.trim() !== '' && !l.trim().startsWith('//') && !l.trim().startsWith('*') && !l.trim().startsWith('/*'))
    const insertAt      = Math.max(0, firstNonEmpty)
    const newLines      = [...lines]
    const commentChar   = isPy ? '#' : '//'
    const todoBlock     = [
      `${commentChar} ─────────────────────────────────────────────────`,
      `${commentChar} TODO (AI Proposed): Changes for new requirement:`,
      `${commentChar} "${requirementText.slice(0, 100)}${requirementText.length > 100 ? '...' : ''}"`,
      `${commentChar}`,
      `${commentChar} Review this file and implement the necessary changes`,
      `${commentChar} based on the impact analysis above.`,
      `${commentChar} ─────────────────────────────────────────────────`,
    ]
    newLines.splice(insertAt, 0, ...todoBlock)
    proposedCode = newLines.join('\n')
    reasoning    = `This file was identified as potentially affected by the new requirement. A TODO block has been added to highlight where changes may be needed. Review the file's functions and data structures against the requirement.`
  }

  const diff = generateDiff(originalCode, proposedCode, filePath)

  return { proposedCode, diff, reasoning, provider: 'mock' }
}

// ─── GEMINI PROPOSAL GENERATOR ────────────────────────────────────────────────
const geminiGenerateProposal = async (originalCode, requirementText, filePath, fileType, language) => {
  // Activate when GEMINI_API_KEY is available in .env (backend only)
  // const { GoogleGenerativeAI } = require('@google/generative-ai')
  // const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  // const model = genAI.getGenerativeModel({ model: 'gemini-pro' })
  // const prompt = buildCodePrompt(originalCode, requirementText, filePath)
  // const result = await model.generateContent(prompt)
  // return parseGeminiCodeResponse(result.response.text(), originalCode, filePath)
  console.warn('⚠️  Gemini not configured — using mock proposal generator')
  return mockGenerateProposal(originalCode, requirementText, filePath, fileType, language)
}

// ─── PUBLIC API ───────────────────────────────────────────────────────────────
const generateProposal = async (originalCode, requirementText, filePath, fileType, language) => {
  const provider = (process.env.AI_PROVIDER || 'mock').toLowerCase()
  const hasKey   = !!process.env.GEMINI_API_KEY
  if (provider === 'gemini' && hasKey) {
    return geminiGenerateProposal(originalCode, requirementText, filePath, fileType, language)
  }
  return mockGenerateProposal(originalCode, requirementText, filePath, fileType, language)
}

module.exports = { generateProposal, generateDiff }
