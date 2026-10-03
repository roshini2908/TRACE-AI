const mongoose = require('mongoose')

const affectedItemSchema = new mongoose.Schema({
  path:        String,
  type:        { type: String, enum: ['file','component','api','model','service','test','unknown'], default: 'file' },
  impactLevel: { type: String, enum: ['high','medium','low'], default: 'medium' },
  impactType:  { type: String, enum: ['direct','indirect','possible'], default: 'possible' },
  confidence:  { type: Number, min: 0, max: 100, default: 70 },
  reason:      String,
  evidence:    String,
  // Structured evidence (NEW)
  evidenceDetail: {
    functions:    [String],
    apis:         [String],
    existingData: [String],
    dependencies: [String],
    lineNumbers:  [Number],
  },
  verificationStatus: {
    type: String,
    enum: ['Pending Review', 'Verified', 'Rejected'],
    default: 'Pending Review',
  },
}, { _id: true })

// Test impact item (NEW)
const testImpactItemSchema = new mongoose.Schema({
  path:        String,
  testName:    String,
  relatedFile: String,
  reason:      String,
  impactType:  { type: String, enum: ['direct','indirect'], default: 'indirect' },
  confidence:  { type: Number, min: 0, max: 100, default: 65 },
}, { _id: true })

// Traceability gap item (NEW)
const gapItemSchema = new mongoose.Schema({
  gapType:           String,   // 'requirement-no-component', 'component-no-file', 'file-no-test', etc.
  relatedArtifact:   String,
  severity:          { type: String, enum: ['high','medium','low'], default: 'medium' },
  reason:            String,
  suggestedAction:   String,
}, { _id: true })

const codeImpactAnalysisSchema = new mongoose.Schema(
  {
    uploadId:     { type: mongoose.Schema.Types.ObjectId, ref: 'CodebaseUpload', required: true, index: true },
    projectId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Project',        required: true },
    requirementId:{ type: mongoose.Schema.Types.ObjectId, ref: 'Requirement' },
    requirementText: { type: String, required: true },

    // AI summary
    summary:    String,
    changeType: { type: String, default: 'Unknown' },

    // Affected item arrays
    affectedFiles:      [affectedItemSchema],
    affectedComponents: [affectedItemSchema],
    affectedAPIs:       [affectedItemSchema],
    affectedModels:     [affectedItemSchema],

    risks:           [String],
    recommendations: [String],
    overallConfidence: { type: Number, default: 0 },

    // ── NEW: Risk Score ────────────────────────────────────────────────────
    riskScore: {
      level:       { type: String, enum: ['low','medium','high','critical'], default: 'medium' },
      score:       { type: Number, default: 0 },   // 0-100
      explanation: String,
      direct:      { type: Number, default: 0 },
      indirect:    { type: Number, default: 0 },
      possible:    { type: Number, default: 0 },
      files:       { type: Number, default: 0 },
      components:  { type: Number, default: 0 },
      apis:        { type: Number, default: 0 },
      models:      { type: Number, default: 0 },
      tests:       { type: Number, default: 0 },
    },

    // ── NEW: Test Impact ───────────────────────────────────────────────────
    testImpact: {
      summary:         String,
      potentiallyAffectedTests: [testImpactItemSchema],
      direct:          { type: Number, default: 0 },
      indirect:        { type: Number, default: 0 },
    },

    // ── NEW: Traceability Gaps ─────────────────────────────────────────────
    traceabilityGaps: [gapItemSchema],

    // ── NEW: Blast Radius ──────────────────────────────────────────────────
    blastRadius: {
      totalArtifacts: { type: Number, default: 0 },
      direct:         { type: Number, default: 0 },
      indirect:       { type: Number, default: 0 },
      possible:       { type: Number, default: 0 },
      // Ordered propagation path for graph rendering
      propagationPath: [String],
    },

    status:   { type: String, enum: ['pending','completed','failed'], default: 'completed' },
    provider: { type: String, default: 'mock' },
    createdBy:{ type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
)

module.exports = mongoose.model('CodeImpactAnalysis', codeImpactAnalysisSchema)
