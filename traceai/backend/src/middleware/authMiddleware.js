const jwt = require('jsonwebtoken')
const User = require('../models/User')

/**
 * Protect routes — verifies JWT from Authorization: Bearer <token>
 * Attaches req.user on success.
 */
const protect = async (req, res, next) => {
  let token
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1]
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized — no token' })
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded.id).select('-password')
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' })
    }
    next()
  } catch {
    return res.status(401).json({ success: false, message: 'Not authorized — invalid token' })
  }
}

/**
 * Restrict to admin role.
 */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next()
  return res.status(403).json({ success: false, message: 'Admin access required' })
}

module.exports = { protect, adminOnly }
