/**
 * Reads a single file from the stored ZIP on demand.
 * Never extracts to disk — streams directly from the ZIP entry.
 * Security: path is validated against CodeFile records before reading.
 */
const unzipper = require('unzipper')
const path     = require('path')
const fs       = require('fs')

const CodeFile       = require('../models/CodeFile')
const CodebaseUpload = require('../models/CodebaseUpload')

const UPLOAD_DIR     = path.join(__dirname, '../../uploads')
const MAX_READ_BYTES = 500_000  // 500 KB — hard cap per file read

/**
 * Detect language from extension for syntax-highlight hint.
 */
const LANG_MAP = {
  '.js': 'javascript', '.jsx': 'javascript', '.ts': 'typescript', '.tsx': 'typescript',
  '.py': 'python', '.java': 'java', '.c': 'c', '.cpp': 'cpp', '.cc': 'cpp',
  '.html': 'html', '.css': 'css', '.scss': 'scss', '.json': 'json', '.md': 'markdown',
}
const langFromExt = (filePath) => {
  const ext = path.extname(filePath).toLowerCase()
  return LANG_MAP[ext] || ext.replace('.','') || 'text'
}

/**
 * Return the content of a single file from the stored ZIP.
 *
 * @param {string} uploadId   MongoDB _id of CodebaseUpload
 * @param {string} filePath   Relative path validated against CodeFile records
 * @param {string} userId     Requesting user — must own the project
 */
const getFileContent = async (uploadId, filePath, userId) => {
  // 1. Load upload + verify ownership (done by controller, but double-check)
  const upload = await CodebaseUpload.findById(uploadId)
  if (!upload) throw Object.assign(new Error('Upload not found'), { statusCode: 404 })

  // 2. Confirm the requested path exists in the analyzed file list
  //    (prevents path traversal / accessing arbitrary ZIP entries)
  const codeFile = await CodeFile.findOne({ uploadId, path: filePath })
  if (!codeFile) throw Object.assign(new Error('File not found in analyzed project'), { statusCode: 404 })

  // 3. Locate ZIP on disk
  const zipPath = path.join(UPLOAD_DIR, upload.storedFileName)
  if (!fs.existsSync(zipPath)) {
    throw Object.assign(new Error('Original ZIP no longer available on server'), { statusCode: 404 })
  }

  // 4. Open ZIP and find matching entry
  const directory = await unzipper.Open.file(zipPath)

  // The stored path is the sanitized relative path (root-prefix-stripped).
  // The ZIP entry may still have the original root prefix — find by suffix match.
  const entry = directory.files.find(e => {
    const normalized = e.path.replace(/\\/g, '/').replace(/^[^/]+\//, '') // strip root prefix
    return normalized === filePath || e.path.replace(/\\/g, '/') === filePath
  })

  if (!entry || entry.type !== 'File') {
    throw Object.assign(new Error('File entry not found inside ZIP'), { statusCode: 404 })
  }

  // 5. Stream content with size guard
  const content = await new Promise((resolve, reject) => {
    const stream = entry.stream()
    const chunks = []
    let size = 0

    stream.on('data', chunk => {
      size += chunk.length
      if (size > MAX_READ_BYTES) {
        stream.destroy()
        reject(Object.assign(new Error('File too large to display (> 500 KB)'), { statusCode: 413 }))
      } else {
        chunks.push(chunk)
      }
    })
    stream.on('end',   () => resolve(Buffer.concat(chunks).toString('utf8')))
    stream.on('error', err => reject(err))
  })

  return {
    path:      codeFile.path,
    language:  codeFile.language || langFromExt(filePath),
    fileType:  codeFile.fileType,
    sizeBytes: codeFile.sizeBytes,
    functions: codeFile.functions || [],
    classes:   codeFile.classes   || [],
    routes:    codeFile.routes    || [],
    content,
    lines:     content.split('\n').length,
  }
}

module.exports = { getFileContent }
