/**
 * Multer-based upload middleware for ZIP files.
 * Compatible with multer v2.x — errors are wrapped and forwarded to Express.
 */
const multer = require('multer')
const path   = require('path')
const fs     = require('fs')
const crypto = require('crypto')

const UPLOAD_DIR    = path.join(__dirname, '../../uploads')
const MAX_ZIP_BYTES = 50 * 1024 * 1024  // 50 MB

// Ensure uploads dir exists
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename:    (_req, _file, cb) => {
    const uid = crypto.randomBytes(8).toString('hex')
    cb(null, `upload-${uid}.zip`)
  },
})

// Multer v2 — fileFilter must NOT call cb(err); instead reject via cb(null, false)
// and let the controller return a friendly error.
const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase()
  // Accept .zip regardless of the MIME type browsers send (varies widely)
  if (ext === '.zip') return cb(null, true)
  cb(null, false)   // reject silently; controller checks req.file
}

const multerInstance = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_ZIP_BYTES },
})

/**
 * Express middleware — wraps multer.single() so errors are forwarded with
 * next(err) instead of crashing the process.
 */
const handleZipUpload = (req, res, next) => {
  multerInstance.single('zipFile')(req, res, (err) => {
    if (err) {
      // multer limit error
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          success: false,
          message: `ZIP file is too large (maximum ${MAX_ZIP_BYTES / 1024 / 1024} MB).`,
        })
      }
      return next(err)
    }
    // File was filtered out (wrong extension)
    if (!req.file && req.headers['content-type']?.includes('multipart')) {
      return res.status(400).json({
        success: false,
        message: 'Only .zip files are accepted.',
      })
    }
    next()
  })
}

module.exports = { handleZipUpload }
