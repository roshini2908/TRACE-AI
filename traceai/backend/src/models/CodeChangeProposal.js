/**
 * Stores AI-generated proposed code changes.
 *
 * A proposal has two separate acceptance tracks:
 *   impactVerificationStatus — "I agree this file is affected"
 *   proposalStatus           — "I approve this AI code proposal"
 *
 * The system NEVER automatically applies proposed code.
 * The user reviews, edits, approves, or rejects.
 */
const mongoose = require('mongoose')

const codeChangeProposalSchema = new mongoose.Schema(
  {
    uploadId:       { type: mongoose.Schema.Types.ObjectId, ref: 'CodebaseUpload',    required: true, index: true },
    impactId:       { type: mongoose.Schema.Types.ObjectId, ref: 'CodeImpactAnalysis',required: true },
    projectId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Project',           required: true },
    requirementText:{ type: String, required: true },
    filePath:       { type: String, required: true },
    fileType:       { type: String, default: 'file' },
    language:       { type: String, default: 'javascript' },

    // The actual original source (read from ZIP)
    originalCode:   { type: String, required: true },
    // AI-generated proposed modification
    proposedCode:   { type: String, required: true },
    // Unified diff string computed server-side
    diff:           { type: String },
    // AI explanation of the proposed change
    reasoning:      { type: String },

    proposalStatus: {
      type: String,
      enum: ['Draft', 'Approved', 'Rejected', 'Edited'],
      default: 'Draft',
    },

    // Developer's manual edit of the proposed code (if edited)
    editedCode:      { type: String },
    reviewComment:   { type: String },
    reviewedBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt:      { type: Date },

    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    provider:        { type: String, default: 'mock' },
  },
  { timestamps: true }
)

codeChangeProposalSchema.index({ uploadId: 1, filePath: 1 })
codeChangeProposalSchema.index({ impactId: 1 })

module.exports = mongoose.model('CodeChangeProposal', codeChangeProposalSchema)
