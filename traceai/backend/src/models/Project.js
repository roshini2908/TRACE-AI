const mongoose = require('mongoose')

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      maxlength: [120, 'Name cannot exceed 120 characters'],
    },
    description: { type: String, trim: true, maxlength: [500, 'Description too long'] },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['active', 'archived', 'draft'], default: 'active' },
    techStack: [{ type: String, trim: true }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
)

// Virtual counts populated by controllers as needed
projectSchema.index({ owner: 1 })

module.exports = mongoose.model('Project', projectSchema)
