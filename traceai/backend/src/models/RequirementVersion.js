const mongoose = require('mongoose')

const requirementVersionSchema = new mongoose.Schema(
  {
    requirementId: { type: mongoose.Schema.Types.ObjectId, ref: 'Requirement', required: true, index: true },
    version: { type: String, required: true }, // e.g. '1.0', '2.0'
    description: { type: String, required: true },
    changeSummary: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

requirementVersionSchema.index({ requirementId: 1, version: 1 }, { unique: true })

module.exports = mongoose.model('RequirementVersion', requirementVersionSchema)
