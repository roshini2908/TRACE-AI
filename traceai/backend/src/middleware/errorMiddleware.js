const notFound = (req, res, next) => {
  const error = new Error(`Not Found — ${req.originalUrl}`)
  res.status(404)
  next(error)
}

const errorHandler = (err, req, res, next) => { // eslint-disable-line no-unused-vars
  if (res.headersSent) return next(err)

  // Use statusCode attached to error object by services, or res.statusCode, or 500
  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500)

  // Handle Mongoose duplicate key error
  let message = err.message || 'Internal Server Error'
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field'
    message = `Duplicate value for ${field}`
  }
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((e) => e.message).join(', ')
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  })
}

module.exports = { notFound, errorHandler }
