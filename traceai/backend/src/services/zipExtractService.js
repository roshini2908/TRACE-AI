/**
 * Secure ZIP extraction service — single-pass using unzipper.Open.file().
 *
 * Security:
 *  - path traversal prevention
 *  - max ZIP size: 50 MB
 *  - max extracted size: 200 MB
 *  - max file count: 2 000
 *  - max individual file size: 5 MB
 *  - never executes uploaded code
 */

const fsp      = require('fs/promises')
const path     = require('path')
const unzipper = require('unzipper')
const os       = require('os')
const crypto   = require('crypto')

const { shouldIgnorePath, isSupportedFile, analyzeFile } = require('./codeAnalyzerService')

const MAX_ZIP_BYTES       = 50  * 1024 * 1024
const MAX_EXTRACTED_BYTES = 200 * 1024 * 1024
const MAX_FILES           = 2_000
const MAX_FILE_BYTES      = 5   * 1024 * 1024

/**
 * Sanitize a ZIP entry path. Returns null to skip.
 * rootPrefix is stripped when all files share a single top-level directory.
 */
const sanitizePath = (rawName, rootPrefix) => {
  let p = rawName.replace(/\\/g, '/')
  if (p.startsWith('/')) return null                // absolute — skip
  if (rootPrefix && p.startsWith(rootPrefix)) p = p.slice(rootPrefix.length)
  p = p.replace(/^\.\/+/, '')                       // strip leading ./
  if (!p) return null                                // was the root dir itself
  const parts = p.split('/')
  if (parts.some(seg => seg === '..')) return null   // traversal — skip
  return p
}

/**
 * Extract ZIP using unzipper.Open.file() (random-access, single-pass safe).
 * Returns { extractDir, fileList }.
 */
const extractZip = async (zipPath) => {
  const stat = await fsp.stat(zipPath)
  if (stat.size > MAX_ZIP_BYTES) {
    throw Object.assign(
      new Error(`ZIP too large (max ${MAX_ZIP_BYTES / 1024 / 1024} MB)`),
      { statusCode: 413 }
    )
  }

  // Open the ZIP for random-access reads
  const directory = await unzipper.Open.file(zipPath)
  const entries   = directory.files   // array of entry descriptors

  // ── Detect shared root prefix ──────────────────────────────────────────────
  const fileNames = entries
    .filter(e => e.type === 'File')
    .map(e => e.path.replace(/\\/g, '/'))

  let rootPrefix = ''
  if (fileNames.length > 0) {
    const firstSegment = fileNames[0].split('/')[0] + '/'
    if (fileNames.every(n => n.startsWith(firstSegment))) {
      rootPrefix = firstSegment
    }
  }

  // ── Extract files ──────────────────────────────────────────────────────────
  const uid        = crypto.randomBytes(8).toString('hex')
  const extractDir = path.join(os.tmpdir(), `traceai-extract-${uid}`)
  await fsp.mkdir(extractDir, { recursive: true })

  const fileList  = []
  let totalBytes  = 0
  let fileCount   = 0

  for (const entry of entries) {
    if (entry.type !== 'File') continue

    const safePath = sanitizePath(entry.path, rootPrefix)
    if (!safePath) continue
    if (shouldIgnorePath(safePath)) continue

    fileCount++
    if (fileCount > MAX_FILES) break

    const destPath = path.join(extractDir, safePath)

    // Path traversal double-check after OS path resolution
    const resolved = path.resolve(destPath)
    if (!resolved.startsWith(path.resolve(extractDir) + path.sep)) continue

    try {
      await fsp.mkdir(path.dirname(destPath), { recursive: true })

      // Stream entry content with size guards
      const buffer = await new Promise((resolve, reject) => {
        const stream = entry.stream()
        const chunks = []
        let size = 0

        stream.on('data', chunk => {
          size += chunk.length
          totalBytes += chunk.length
          if (size > MAX_FILE_BYTES || totalBytes > MAX_EXTRACTED_BYTES) {
            stream.destroy()
            reject(new Error('size_exceeded'))
          } else {
            chunks.push(chunk)
          }
        })
        stream.on('end',   () => resolve(Buffer.concat(chunks)))
        stream.on('error', err => {
          if (err.message === 'size_exceeded') resolve(null)
          else reject(err)
        })
      })

      if (buffer) {
        await fsp.writeFile(destPath, buffer)
        fileList.push(safePath)
      }
    } catch (err) {
      if (err.message !== 'size_exceeded') {
        // skip individual corrupt entries silently
      }
    }
  }

  return { extractDir, fileList }
}

/**
 * Analyze all extracted source files → array of objects for MongoDB insertion.
 */
const analyzeExtractedFiles = async (extractDir, fileList, projectId, uploadId) => {
  const analyzed = []

  for (const relPath of fileList) {
    if (!isSupportedFile(relPath)) continue

    const absPath = path.join(extractDir, relPath)
    let content = ''
    try {
      const s = await fsp.stat(absPath)
      if (s.size > MAX_FILE_BYTES) continue
      content = await fsp.readFile(absPath, 'utf8')
    } catch { continue }

    const info     = analyzeFile(relPath, content)
    const topLevel = relPath.split('/')[0] || ''

    analyzed.push({
      uploadId,
      projectId,
      path:       relPath,
      topLevel,
      language:   info.language,
      fileType:   info.fileType,
      sizeBytes:  Buffer.byteLength(content, 'utf8'),
      imports:    info.imports.slice(0, 100),
      exports:    info.exports.slice(0, 50),
      functions:  info.functions.slice(0, 50),
      classes:    info.classes.slice(0, 30),
      components: info.components.slice(0, 30),
      routes:     info.routes.slice(0, 30),
      models:     info.models.slice(0, 20),
    })
  }

  return analyzed
}

/** Best-effort cleanup of temp extraction directory. */
const cleanupExtractDir = async (extractDir) => {
  try { await fsp.rm(extractDir, { recursive: true, force: true }) } catch {}
}

module.exports = { extractZip, analyzeExtractedFiles, cleanupExtractDir }
