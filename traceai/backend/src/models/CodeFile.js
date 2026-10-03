const mongoose = require('mongoose')

const codeFileSchema = new mongoose.Schema(
  {
    uploadId:  { type: mongoose.Schema.Types.ObjectId, ref: 'CodebaseUpload', required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project',        required: true, index: true },
    // Relative path inside the ZIP (sanitized, no traversal)
    path:      { type: String, required: true },
    // Top-level directory segment (frontend / backend / src / etc.)
    topLevel:  { type: String, default: '' },
    language:  { type: String, default: 'unknown' },
    // file | component | api | model | service | test | config | style | unknown
    fileType:  { type: String, default: 'file' },
    sizeBytes: { type: Number, default: 0 },
    // Detected structural info
    imports:   [String],
    exports:   [String],
    functions: [String],
    classes:   [String],
    components:[String],   // React component names
    routes:    [String],   // Express / Flask route strings
    models:    [String],   // Mongoose / Sequelize model names
  },
  { timestamps: true }
)

codeFileSchema.index({ uploadId: 1, path: 1 }, { unique: true })

module.exports = mongoose.model('CodeFile', codeFileSchema)
