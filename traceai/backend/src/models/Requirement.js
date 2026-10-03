const mongoose = require('mongoose')

const requirementSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    reqId: { type: String, required: true, trim: true }, // e.g. REQ-101
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['Functional', 'Non-Functional', 'Security', 'Performance', 'Business'],
      default: 'Functional',
    },
    priority: {
      type: String,
      enum: ['Low', 'Medium', 'High', 'Critical'],
      default: 'Medium',
    },
    status: {
      type: String,
      enum: ['Draft', 'Active', 'Changed', 'Deprecated'],
      default: 'Draft',
    },
    currentVersion: { type: String, default: '1.0' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

requirementSchema.index({ projectId: 1, reqId: 1 }, { unique: true })

module.exports = mongoose.model('Requirement', requirementSchema)
