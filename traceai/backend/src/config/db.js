/**
 * MongoDB connection — TraceAI backend
 */
const mongoose = require('mongoose')

const connectDB = async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    console.error('❌ MONGODB_URI is not defined in .env')
    process.exit(1)
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    })

    console.log(`✅ MongoDB connected: ${conn.connection.host} — db: ${conn.connection.name}`)

    mongoose.connection.on('disconnected', () =>
      console.warn('⚠️  MongoDB disconnected')
    )
    mongoose.connection.on('error', (err) =>
      console.error(`❌ MongoDB error: ${err.message}`)
    )
  } catch (err) {
    console.error(`❌ MongoDB connection failed: ${err.message}`)
    process.exit(1)
  }
}

module.exports = connectDB
