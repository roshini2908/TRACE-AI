const mongoose = require('mongoose')

const impactedComponentSchema = new mongoose.Schema({
  componentId:     { type: mongoose.Schema.Types.ObjectId, ref: 'Component' },
  componentName:   String,
  componentType:   String,
  impactLevel:     { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
  confidence:      { type: Number, min: 0, max: 100 },
  reason:          String,
  recommendedAction: String,
  verificationStatus: {
    type: String,
    enum: ['Pending Review', 'Verified', 'Rejected'],
    default: 'Pending Review',
  },
  verifiedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewComment: String,
}, { _id: true })

const aiAnalysisSchema = new mongoose.Schema(
  {
    projectId:       { type: mongoose.Schema.Types.ObjectId, ref: 'Project',     required: true, index: true },
    requirementId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true },
    oldVersion:      { type: String, required: true },
    newVersion:      { type: String, required: true },
    changeType:      { type: String, enum: ['Addition', 'Modification', 'Deletion', 'Clarification', 'Unknown'], default: 'Unknown' },
    changedConcepts: [String],
    summary:         String,
    impactedComponents: [impactedComponentSchema],
    risks:           [String],
    recommendations: [String],
    status:          { type: String, enum: ['Pending', 'Completed', 'Failed'], default: 'Completed' },
    provider:        { type: String, default: 'mock' }, // 'mock' | 'gemini'
    createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('AIAnalysis', aiAnalysisSchema)
