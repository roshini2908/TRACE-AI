/**
 * TraceAI Seed Script
 * Run: node src/seed.js
 * Creates the complete demo dataset including the REQ-101 ETA analysis demo.
 */
require('dotenv').config()
const mongoose = require('mongoose')

const User             = require('./models/User')
const Project          = require('./models/Project')
const Requirement      = require('./models/Requirement')
const RequirementVersion = require('./models/RequirementVersion')
const Component        = require('./models/Component')
const TraceabilityLink = require('./models/TraceabilityLink')
const AIAnalysis       = require('./models/AIAnalysis')
const Notification     = require('./models/Notification')

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ Connected to MongoDB')

  // ── CLEAR ──────────────────────────────────────────────────────────────────
  await Promise.all([
    User.deleteMany({}), Project.deleteMany({}),
    Requirement.deleteMany({}), RequirementVersion.deleteMany({}),
    Component.deleteMany({}), TraceabilityLink.deleteMany({}),
    AIAnalysis.deleteMany({}), Notification.deleteMany({}),
  ])
  console.log('🗑️  Cleared existing data')

  // ── USERS ─────────────────────────────────────────────────────────────────
  // Use User.create() with plain password — the pre-save hook hashes it.
  const demoUser = await User.create({
    name: 'Roshini Kilari',
    email: 'demo@traceai.com',
    password: 'demo123',
    role: 'user',
  })
  console.log('👤 Demo user created: demo@traceai.com / demo123')

  // ── PROJECT ───────────────────────────────────────────────────────────────
  const project = await Project.create({
    name: 'Food Delivery Platform',
    description: 'A mobile and web platform for food ordering and real-time delivery tracking.',
    owner: demoUser._id,
    status: 'active',
    techStack: ['React Native', 'Node.js', 'MongoDB', 'Google Maps API'],
  })
  console.log(`📁 Project: ${project.name}`)

  // ── COMPONENTS ────────────────────────────────────────────────────────────
  const componentDefs = [
    { componentId: 'COMP-001', name: 'OrderTrackingPage',    type: 'Frontend',  technology: 'React Native', path: 'src/screens/OrderTracking.jsx',       description: 'Mobile screen that displays real-time delivery tracking with map and ETA.' },
    { componentId: 'COMP-002', name: 'OrderTrackingAPI',     type: 'API',       technology: 'Express.js',   path: 'src/routes/tracking.js',               description: 'REST API endpoint that exposes order tracking data to the frontend.' },
    { componentId: 'COMP-003', name: 'DeliveryService',      type: 'Service',   technology: 'Node.js',      path: 'src/services/deliveryService.js',       description: 'Business logic for managing deliveries, routing, and ETA calculation.' },
    { componentId: 'COMP-004', name: 'LocationService',      type: 'Service',   technology: 'Node.js',      path: 'src/services/locationService.js',       description: 'Provides real-time delivery partner location data using GPS.' },
    { componentId: 'COMP-005', name: 'OrderDatabase',        type: 'Database',  technology: 'MongoDB',      path: 'src/models/Order.js',                  description: 'MongoDB collection that stores order data including status and ETA fields.' },
    { componentId: 'COMP-006', name: 'TrackingTest',         type: 'Test',      technology: 'Jest',         path: 'tests/tracking.test.js',               description: 'Unit and integration tests for the order tracking functionality.' },
    { componentId: 'COMP-007', name: 'PaymentPage',          type: 'Frontend',  technology: 'React Native', path: 'src/screens/Payment.jsx',              description: 'Payment screen handling card, UPI, and wallet payment methods.' },
    { componentId: 'COMP-008', name: 'PaymentAPI',           type: 'API',       technology: 'Express.js',   path: 'src/routes/payment.js',                description: 'REST API for processing payments with third-party gateway integration.' },
    { componentId: 'COMP-009', name: 'NotificationService',  type: 'Service',   technology: 'Node.js',      path: 'src/services/notificationService.js',   description: 'Sends push notifications for order updates, ETA changes, and delivery.' },
  ]

  const components = []
  for (const def of componentDefs) {
    const comp = await Component.create({ ...def, projectId: project._id, createdBy: demoUser._id })
    components.push(comp)
  }
  const compMap = Object.fromEntries(components.map((c) => [c.name, c]))
  console.log(`🔧 Created ${components.length} components`)

  // ── REQUIREMENTS ──────────────────────────────────────────────────────────
  const req101 = await Requirement.create({
    projectId: project._id,
    reqId: 'REQ-101',
    title: 'Delivery Location Tracking',
    description: 'Customers can track their food delivery using the delivery partner\'s current location and estimated arrival time.',
    type: 'Functional',
    priority: 'High',
    status: 'Changed',
    currentVersion: '2.0',
    createdBy: demoUser._id,
  })

  const req102 = await Requirement.create({
    projectId: project._id,
    reqId: 'REQ-102',
    title: 'Payment Processing',
    description: 'Customers can pay for their orders using credit cards, debit cards, UPI, or digital wallets.',
    type: 'Functional',
    priority: 'Critical',
    status: 'Active',
    currentVersion: '1.0',
    createdBy: demoUser._id,
  })

  const req103 = await Requirement.create({
    projectId: project._id,
    reqId: 'REQ-103',
    title: 'Order Notifications',
    description: 'Customers receive push notifications for order confirmation, preparation, dispatch, and delivery.',
    type: 'Functional',
    priority: 'High',
    status: 'Active',
    currentVersion: '1.0',
    createdBy: demoUser._id,
  })

  console.log('📋 Created requirements: REQ-101, REQ-102, REQ-103')

  // ── REQUIREMENT VERSIONS ──────────────────────────────────────────────────
  await RequirementVersion.create({
    requirementId: req101._id,
    version: '1.0',
    description: 'Customers can track their food delivery using the delivery partner\'s current location.',
    changeSummary: 'Initial version — basic location tracking.',
    createdBy: demoUser._id,
  })

  await RequirementVersion.create({
    requirementId: req101._id,
    version: '2.0',
    description: 'Customers can track their food delivery using the delivery partner\'s current location and estimated arrival time.',
    changeSummary: 'Added estimated arrival time (ETA) display requirement.',
    createdBy: demoUser._id,
  })

  await RequirementVersion.create({
    requirementId: req102._id,
    version: '1.0',
    description: 'Customers can pay for their orders using credit cards, debit cards, UPI, or digital wallets.',
    changeSummary: 'Initial version.',
    createdBy: demoUser._id,
  })

  await RequirementVersion.create({
    requirementId: req103._id,
    version: '1.0',
    description: 'Customers receive push notifications for order confirmation, preparation, dispatch, and delivery.',
    changeSummary: 'Initial version.',
    createdBy: demoUser._id,
  })
  console.log('📝 Created requirement versions (REQ-101 v1.0 and v2.0)')

  // ── TRACEABILITY LINKS ────────────────────────────────────────────────────
  const linkDefs = [
    { req: req101, comp: 'OrderTrackingPage', rel: 'Displays',    src: 'Manual',       conf: 100, ver: 'Verified' },
    { req: req101, comp: 'OrderTrackingAPI',  rel: 'Calls',       src: 'Manual',       conf: 100, ver: 'Verified' },
    { req: req101, comp: 'DeliveryService',   rel: 'Uses',        src: 'AI Suggested', conf: 81,  ver: 'Pending Review' },
    { req: req101, comp: 'LocationService',   rel: 'Uses',        src: 'AI Suggested', conf: 89,  ver: 'Pending Review' },
    { req: req101, comp: 'OrderDatabase',     rel: 'Stores Data', src: 'AI Suggested', conf: 76,  ver: 'Pending Review' },
    { req: req101, comp: 'TrackingTest',      rel: 'Tests',       src: 'Manual',       conf: 100, ver: 'Verified' },
    { req: req102, comp: 'PaymentPage',       rel: 'Displays',    src: 'Manual',       conf: 100, ver: 'Verified' },
    { req: req102, comp: 'PaymentAPI',        rel: 'Implements',  src: 'Manual',       conf: 100, ver: 'Verified' },
    { req: req103, comp: 'NotificationService', rel: 'Implements', src: 'Manual',      conf: 100, ver: 'Verified' },
  ]

  for (const def of linkDefs) {
    const comp = compMap[def.comp]
    if (!comp) continue
    await TraceabilityLink.create({
      projectId: project._id,
      requirementId: def.req._id,
      componentId: comp._id,
      relationshipType: def.rel,
      source: def.src,
      confidence: def.conf,
      verificationStatus: def.ver,
      verifiedBy: def.ver === 'Verified' ? demoUser._id : undefined,
      createdBy: demoUser._id,
    })
  }
  console.log('🔗 Created traceability links')

  // ── AI ANALYSIS ───────────────────────────────────────────────────────────
  const analysis = await AIAnalysis.create({
    projectId: project._id,
    requirementId: req101._id,
    oldVersion: '1.0',
    newVersion: '2.0',
    changeType: 'Addition',
    changedConcepts: ['Estimated Arrival Time', 'ETA'],
    summary: 'The requirement now includes ETA functionality in addition to real-time location tracking.',
    impactedComponents: [
      { componentId: compMap['OrderTrackingPage']._id,   componentName: 'OrderTrackingPage',   componentType: 'Frontend', impactLevel: 'High',   confidence: 92, reason: 'The tracking page may need to display the newly introduced estimated arrival time.',              recommendedAction: 'Review the tracking UI and add ETA display if required.',                    verificationStatus: 'Pending Review' },
      { componentId: compMap['LocationService']._id,     componentName: 'LocationService',     componentType: 'Service',  impactLevel: 'Medium', confidence: 89, reason: 'The location service provides delivery partner location and may need to expose ETA calculation.', recommendedAction: 'Extend LocationService to calculate and return estimated arrival time.',         verificationStatus: 'Pending Review' },
      { componentId: compMap['OrderTrackingAPI']._id,    componentName: 'OrderTrackingAPI',    componentType: 'API',      impactLevel: 'High',   confidence: 86, reason: 'The API exposes tracking information to the frontend and must include the ETA field.',            recommendedAction: 'Add estimatedArrivalTime to the API response schema.',                         verificationStatus: 'Pending Review' },
      { componentId: compMap['DeliveryService']._id,     componentName: 'DeliveryService',     componentType: 'Service',  impactLevel: 'Medium', confidence: 81, reason: 'Delivery business logic handles delivery-related operations and may need ETA computation.',        recommendedAction: 'Add ETA business logic to DeliveryService.',                                   verificationStatus: 'Pending Review' },
      { componentId: compMap['OrderDatabase']._id,       componentName: 'OrderDatabase',       componentType: 'Database', impactLevel: 'Medium', confidence: 76, reason: 'The database may need a new field to store the estimated arrival time per order.',                 recommendedAction: 'Add estimatedArrivalTime field to the orders collection schema.',               verificationStatus: 'Pending Review' },
      { componentId: compMap['TrackingTest']._id,        componentName: 'TrackingTest',        componentType: 'Test',     impactLevel: 'Low',    confidence: 74, reason: 'Existing tracking tests should be extended to cover ETA scenarios.',                              recommendedAction: 'Write new test cases to verify ETA display and accuracy.',                     verificationStatus: 'Pending Review' },
    ],
    risks: [
      'Existing tracking UI may not have space for ETA display.',
      'The delivery service must calculate and expose ETA data.',
      'Database schema may need an ETA field.',
      'Tests must be updated to cover ETA scenarios.',
    ],
    recommendations: [
      'Review OrderTrackingPage UI for ETA widget placement.',
      'Extend OrderTrackingAPI response with an estimatedArrivalTime field.',
      'Update DeliveryService business logic to calculate ETA.',
      'Add ETA column to OrderDatabase schema.',
      'Extend TrackingTest suite with ETA assertions.',
    ],
    status: 'Completed',
    provider: 'mock',
    createdBy: demoUser._id,
  })
  console.log('🤖 Created AI analysis for REQ-101 v1.0 → v2.0')

  // ── NOTIFICATIONS ─────────────────────────────────────────────────────────
  await Notification.insertMany([
    { userId: demoUser._id, projectId: project._id, type: 'requirement_update',    title: 'Requirement Updated',         message: 'REQ-101 (Delivery Location Tracking) was updated to v2.0.',                      read: false },
    { userId: demoUser._id, projectId: project._id, type: 'impact_detected',       title: 'Potential Impact Detected',   message: '6 components may be potentially affected by the latest change to REQ-101.',     read: false },
    { userId: demoUser._id, projectId: project._id, type: 'verification_pending',  title: 'AI Suggestions Pending',      message: '6 AI-suggested component impacts are waiting for human verification.',            read: false },
    { userId: demoUser._id, projectId: project._id, type: 'coverage_warning',      title: 'Traceability Coverage Alert', message: 'Traceability coverage has dropped below 90%. Review missing links.',              read: true  },
  ])
  console.log('🔔 Created notifications')

  console.log('\n✅ Seed complete!')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('   Login: demo@traceai.com / demo123')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err.message)
  process.exit(1)
})
