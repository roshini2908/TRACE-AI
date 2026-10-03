/**
 * Request validation middleware helpers.
 * Phase 1: stub — validators added per-route from Phase 3 onward.
 */
const { validationResult } = require('express-validator')

/**
 * Runs after express-validator checks.
 * If there are validation errors, responds with 400 and the error list.
 */
const validate = (req, res, next) => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: errors.array(),
    })
  }
  next()
}

module.exports = { validate }
