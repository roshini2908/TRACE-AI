/**
 * TraceAI Backend — Server Entry Point
 * Loads environment variables, connects to MongoDB, and starts Express.
 */
const dns = require("dns");
dns.setServers(["8.8.8.8", "8.8.4.4"]);
require('dotenv').config()

const app = require('./app')
const connectDB = require('./config/db')

const PORT = process.env.PORT || 5000

const startServer = async () => {
  // Attempt DB connection (non-fatal in Phase 1 if MONGODB_URI not set)
  await connectDB()

  app.listen(PORT, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`🚀 TraceAI backend running on port ${PORT}`)
    console.log(`   Local:   http://localhost:${PORT}`)
    console.log(`   Health:  http://localhost:${PORT}/api/health`)
    console.log(`   Env:     ${process.env.NODE_ENV || 'development'}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  })
}

startServer()
