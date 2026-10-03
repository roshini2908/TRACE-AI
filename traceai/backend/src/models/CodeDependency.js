const mongoose = require('mongoose')

/**
 * Represents a deterministic dependency edge between two files.
 * Source: static analysis of import/require/include statements.
 */
const codeDependencySchema = new mongoose.Schema(
  {
    uploadId:   { type: mongoose.Schema.Types.ObjectId, ref: 'CodebaseUpload', required: true, index: true },
    projectId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Project',        required: true },
    // Relative paths inside the project
    sourceFile: { type: String, required: true },
    targetFile: { type: String, required: true },
    // imports | calls | renders | extends | uses
    relationship: { type: String, default: 'imports' },
    // always 100 for deterministic; lower if inferred
    confidence: { type: Number, default: 100, min: 0, max: 100 },
  },
  { timestamps: true }
)

codeDependencySchema.index({ uploadId: 1, sourceFile: 1, targetFile: 1 }, { unique: true })

module.exports = mongoose.model('CodeDependency', codeDependencySchema)
