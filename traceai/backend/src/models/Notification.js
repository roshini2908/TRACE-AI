const mongoose = require('mongoose')

const notificationSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    type: {
      type: String,
      enum: ['requirement_update', 'impact_detected', 'verification_pending', 'coverage_warning', 'general'],
      default: 'general',
    },
    title:   { type: String, required: true },
    message: { type: String, required: true },
    read:    { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Notification', notificationSchema)
