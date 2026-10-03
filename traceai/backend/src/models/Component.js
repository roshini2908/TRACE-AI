const mongoose = require('mongoose')

const componentSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    componentId: { type: String, required: true, trim: true }, // e.g. COMP-001
    name: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ['Frontend', 'API', 'Backend', 'Database', 'Service', 'Test', 'Documentation'],
      required: true,
    },
    description: { type: String, trim: true },
    technology: { type: String, trim: true },
    path: { type: String, trim: true },
    status: { type: String, enum: ['Active', 'Deprecated', 'Draft'], default: 'Active' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

componentSchema.index({ projectId: 1, componentId: 1 }, { unique: true })

module.exports = mongoose.model('Component', componentSchema)
