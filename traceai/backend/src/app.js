const express = require('express')
const cors    = require('cors')
const { notFound, errorHandler } = require('./middleware/errorMiddleware')

const app = express()

// ─── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true)
    cb(new Error(`CORS: origin '${origin}' not allowed`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}))

// ─── BODY PARSING ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'TraceAI backend is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  })
})

// ─── API ROUTES ───────────────────────────────────────────────────────────────
app.use('/api/auth',          require('./routes/authRoutes'))
app.use('/api/projects',      require('./routes/projectRoutes'))
app.use('/api/requirements',  require('./routes/requirementRoutes'))
app.use('/api/components',    require('./routes/componentRoutes'))
app.use('/api/traceability',  require('./routes/traceabilityRoutes'))
app.use('/api/analysis',      require('./routes/analysisRoutes'))
app.use('/api/notifications', require('./routes/notificationRoutes'))
app.use('/api/codebase',      require('./routes/codebaseRoutes'))

// ─── ERROR HANDLING ───────────────────────────────────────────────────────────
app.use(notFound)
app.use(errorHandler)

module.exports = app
