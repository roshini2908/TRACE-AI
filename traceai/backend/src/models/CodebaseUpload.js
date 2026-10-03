const mongoose = require('mongoose')

/**
 * Tracks an uploaded project ZIP and its analysis state.
 */
const codebaseUploadSchema = new mongoose.Schema(
  {
    projectId:         { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    uploadedBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true },
    originalFileName:  { type: String, required: true },
    storedFileName:    { type: String },          // on-disk temp name
    uploadSizeBytes:   { type: Number, default: 0 },
    extractedPath:     { type: String },          // server-side temp extraction dir (not exposed to client)
    uploadStatus: {
      type: String,
      enum: ['pending', 'uploaded', 'extracting', 'analyzing', 'completed', 'failed'],
      default: 'pending',
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'in_progress', 'completed', 'failed'],
      default: 'pending',
    },
    totalFiles:       { type: Number, default: 0 },
    sourceFiles:      { type: Number, default: 0 },
    ignoredFiles:     { type: Number, default: 0 },
    languages:        [String],
    errorMessage:     { type: String },
    analysisStartedAt:  { type: Date },
    analysisFinishedAt: { type: Date },
    summary: {
      components: { type: Number, default: 0 },
      apis:        { type: Number, default: 0 },
      models:      { type: Number, default: 0 },
      functions:   { type: Number, default: 0 },
      dependencies:{ type: Number, default: 0 },
    },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CodebaseUpload', codebaseUploadSchema)
