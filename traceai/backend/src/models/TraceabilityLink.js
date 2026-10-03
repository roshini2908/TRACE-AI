const mongoose = require('mongoose')

const traceabilityLinkSchema = new mongoose.Schema(
  {
    projectId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Project',     required: true, index: true },
    requirementId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    componentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Component',   required: true },
    relationshipType: {
      type: String,
      enum: ['Implements', 'Uses', 'Depends On', 'Tests', 'Documents', 'Stores Data', 'Calls', 'Displays'],
      default: 'Implements',
    },
    source: { type: String, enum: ['Manual', 'AI Suggested'], default: 'Manual' },
    confidence: { type: Number, min: 0, max: 100, default: 100 },
    verificationStatus: {
      type: String,
      enum: ['Verified', 'Pending Review', 'Rejected'],
      default: 'Pending Review',
    },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewComment: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

traceabilityLinkSchema.index({ requirementId: 1, componentId: 1 }, { unique: true })

module.exports = mongoose.model('TraceabilityLink', traceabilityLinkSchema)
